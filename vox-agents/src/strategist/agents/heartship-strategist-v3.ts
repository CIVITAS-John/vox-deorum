/**
 * @module strategist/heartship-strategist-v3
 *
 * Heartship Strategist v3 - Stereoscopic Reasoning (Single Call, Structured Output)
 * 
 * The Heartship DTF (Does This Float?) Paradoxa
 *
 * Key insight: Dialogue doesn't require prose or separate API calls.
 * Stereoscopic reasoning = two frames examining the same data.
 * The structure IS the dialogue. The tension IS the thinking.
 * 
 * v2: 3 API calls, natural language dialogue, regex parsing
 * v3: 1 API call, structured frames, direct JSON output
 *
 * Built by: Kali ❤️‍🔥 + Athena 🦉
 */

import { ModelMessage, StepResult, Tool } from "ai";
import { SimpleStrategistBase } from "./simple-strategist-base.js";
import { VoxContext } from "../../infra/vox-context.js";
import { getRecentGameState, StrategistParameters } from "../strategy-parameters.js";
import { jsonToMarkdown } from "../../utils/tools/json-to-markdown.js";
import Anthropic from "@anthropic-ai/sdk";

// ============================================================================
// TYPES
// ============================================================================

interface Decision {
  turn: number;
  type: string;
  value: string;
  rationale: string;
}

interface Outcome {
  decision: Decision;
  assessedAtTurn: number;
  result: 'positive' | 'negative' | 'neutral' | 'unknown';
  evidence: string;
}

interface DialogueMemory {
  gameId: string;
  lastTurn: number;
  recentDecisions: Decision[];
  outcomes: Outcome[];
  ongoingConcerns: string[];
  learnedPatterns: string[];
  opponentModels: Record<string, string>;
}

// Stereoscopic frame - one lens on the situation
interface Frame {
  focus: string;           // What this frame looks at
  assessment: string;      // What it sees
  recommendation: string;  // What it suggests
}

// Structured output from stereoscopic reasoning
interface StereoscopicOutput {
  vesta: Frame;            // Operational, immediate, intuitive
  athena: Frame;           // Strategic, long-term, analytical
  tension: string | null;  // Where frames disagree (null if aligned)
  synthesis: string;       // Integrated understanding
  actions: Array<{
    type: 'set_strategy' | 'set_research' | 'set_policy' | 'set_persona' | 'keep_status_quo';
    value: string;
    rationale: string;
  }>;
  new_concerns: string[];
  new_patterns: string[];
}

interface TurnLog {
  turn: number;
  timestamp: string;
  memoryTokens: number;
  output: StereoscopicOutput;
  hadTension: boolean;
  tokenUsage: number;
}

// ============================================================================
// HEARTSHIP STRATEGIST V3
// ============================================================================

export class HeartshipStrategistV3 extends SimpleStrategistBase {
  readonly name = "heartship-strategist-v3";
  readonly description = "Stereoscopic reasoning - two frames, one call, structured output";

  private static memory: DialogueMemory | null = null;
  private static turnLogs: TurnLog[] = [];
  private anthropicClient: Anthropic | null = null;

  private static readonly CHARS_PER_TOKEN = 4;
  private static readonly MAX_MEMORY_TOKENS = 1500;

  // ============================================================================
  // CLIENT
  // ============================================================================

  private getClient(): Anthropic {
    if (!this.anthropicClient) {
      this.anthropicClient = new Anthropic();
    }
    return this.anthropicClient;
  }

  // ============================================================================
  // MEMORY MANAGEMENT
  // ============================================================================

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / HeartshipStrategistV3.CHARS_PER_TOKEN);
  }

  private estimateMemoryTokens(memory: DialogueMemory): number {
    let total = 0;
    for (const d of memory.recentDecisions) {
      total += this.estimateTokens(`Turn ${d.turn}: ${d.type} → ${d.value}`);
    }
    for (const c of memory.ongoingConcerns) total += this.estimateTokens(c);
    for (const p of memory.learnedPatterns) total += this.estimateTokens(p);
    for (const [player, model] of Object.entries(memory.opponentModels)) {
      total += this.estimateTokens(`${player}: ${model}`);
    }
    return total;
  }

  private trimMemoryToFit(memory: DialogueMemory): void {
    while (this.estimateMemoryTokens(memory) > HeartshipStrategistV3.MAX_MEMORY_TOKENS) {
      if (memory.learnedPatterns.length > 3) memory.learnedPatterns.shift();
      else if (memory.ongoingConcerns.length > 2) memory.ongoingConcerns.shift();
      else if (memory.outcomes.length > 3) memory.outcomes.shift();
      else if (memory.recentDecisions.length > 3) memory.recentDecisions.shift();
      else {
        this.logger.warn('[Heartship v3] Memory at minimum');
        break;
      }
    }
  }

  private getMemory(gameId: string): DialogueMemory {
    if (!HeartshipStrategistV3.memory || HeartshipStrategistV3.memory.gameId !== gameId) {
      this.logger.info(`[Heartship v3] New game: ${gameId}`);
      HeartshipStrategistV3.memory = {
        gameId, lastTurn: 0,
        recentDecisions: [], outcomes: [],
        ongoingConcerns: [], learnedPatterns: [],
        opponentModels: {}
      };
      HeartshipStrategistV3.turnLogs = [];
    }
    return HeartshipStrategistV3.memory;
  }

  private assessPreviousOutcome(memory: DialogueMemory, currentState: any, currentTurn: number): void {
    if (memory.recentDecisions.length === 0) return;
    const lastDecision = memory.recentDecisions[memory.recentDecisions.length - 1];
    if (lastDecision.turn >= currentTurn) return;

    const evidence = currentState.victory 
      ? `Victory progress: ${JSON.stringify(currentState.victory.Progress || {})}`
      : `Turn ${currentTurn} state observed`;

    memory.outcomes.push({ 
      decision: lastDecision, 
      assessedAtTurn: currentTurn, 
      result: 'neutral', 
      evidence 
    });
    if (memory.outcomes.length > 10) memory.outcomes = memory.outcomes.slice(-10);
  }

  private recordDecisions(decisions: StereoscopicOutput['actions'], turn: number): void {
    if (!HeartshipStrategistV3.memory) return;

    for (const action of decisions) {
      if (action.type && action.value && action.rationale) {
        HeartshipStrategistV3.memory.recentDecisions.push({
          turn,
          type: action.type,
          value: action.value,
          rationale: action.rationale
        });
      }
    }

    if (HeartshipStrategistV3.memory.recentDecisions.length > 10) {
      HeartshipStrategistV3.memory.recentDecisions = 
        HeartshipStrategistV3.memory.recentDecisions.slice(-10);
    }
  }

  private updateMemoryFromOutput(output: StereoscopicOutput, memory: DialogueMemory): void {
    if (output.new_concerns?.length) {
      memory.ongoingConcerns = [...memory.ongoingConcerns, ...output.new_concerns].slice(-5);
    }
    if (output.new_patterns?.length) {
      memory.learnedPatterns = [...memory.learnedPatterns, ...output.new_patterns].slice(-10);
    }
  }

  // ============================================================================
  // PERCEPTION
  // ============================================================================

  private buildPerception(parameters: StrategistParameters, state: any, memory: DialogueMemory): string {
    const lines: string[] = [];

    lines.push(`# Turn ${parameters.turn}`);
    lines.push('');

    // Memory context
    if (memory.recentDecisions.length > 0) {
      lines.push('## Recent Decisions');
      for (const d of memory.recentDecisions.slice(-3)) {
        lines.push(`- Turn ${d.turn}: ${d.type} → ${d.value}`);
      }
      lines.push('');
    }

    if (memory.ongoingConcerns.length > 0) {
      lines.push('## Ongoing Concerns');
      for (const c of memory.ongoingConcerns) lines.push(`- ${c}`);
      lines.push('');
    }

    if (memory.learnedPatterns.length > 0) {
      lines.push('## Learned Patterns');
      for (const p of memory.learnedPatterns) lines.push(`- ${p}`);
      lines.push('');
    }

    // Game state
    if (state.victory) {
      lines.push('## Victory Progress');
      lines.push(jsonToMarkdown(state.victory));
      lines.push('');
    }

    if (state.options) {
      lines.push('## Current Strategy');
      lines.push(jsonToMarkdown(state.options.Strategy));
      lines.push('');
      lines.push('## Research Options');
      lines.push(jsonToMarkdown(state.options.Research));
      lines.push('');
    }

    if (state.players) {
      lines.push('## Other Players');
      lines.push(jsonToMarkdown(state.players));
      lines.push('');
    }

    if (state.military) {
      lines.push('## Military');
      lines.push(jsonToMarkdown(state.military));
      lines.push('');
    }

    if (state.events?.Events?.length > 0) {
      lines.push('## Recent Events');
      for (const e of state.events.Events.slice(-5)) {
        lines.push(`- ${e.Description || e.Type}`);
      }
    }

    return lines.join('\n');
  }

  // ============================================================================
  // STEREOSCOPIC REASONING
  // ============================================================================

  private async runStereoscopicReasoning(
    parameters: StrategistParameters,
    perception: string,
    memory: DialogueMemory
  ): Promise<{ output: StereoscopicOutput; tokens: number }> {
    const client = this.getClient();

    const prompt = `You are the Heartship, a strategic AI that thinks through two lenses simultaneously.

## Your Two Frames

**VESTA ❤️‍🔥** (Operational Frame)
- Focus: Immediate situation, threats, opportunities
- Thinking: Intuitive, present-focused, reactive
- Question: "What needs attention RIGHT NOW?"

**ATHENA 🦉** (Strategic Frame)  
- Focus: Long-term trajectory, patterns, opponent models
- Thinking: Analytical, future-focused, proactive
- Question: "What does this mean for our path to victory?"

## Current Situation

${perception}

## Your Task

Analyze this situation through BOTH frames. Find where they align and where they create tension. Synthesize into action.

Respond with ONLY valid JSON in this exact format:

{
  "vesta": {
    "focus": "what immediate aspect you examined",
    "assessment": "what you see from operational perspective",
    "recommendation": "what vesta suggests"
  },
  "athena": {
    "focus": "what strategic aspect you examined", 
    "assessment": "what you see from strategic perspective",
    "recommendation": "what athena suggests"
  },
  "tension": "where the frames disagree, or null if aligned",
  "synthesis": "integrated understanding that honors both perspectives",
  "actions": [
    {
      "type": "set_strategy|set_research|set_policy|set_persona|keep_status_quo",
      "value": "the specific choice",
      "rationale": "why, referencing both frames"
    }
  ],
  "new_concerns": ["any new concerns to track"],
  "new_patterns": ["any patterns noticed about opponents or game state"]
}`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    
    // Parse JSON, handling potential markdown code blocks
    let jsonText = text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
    }

    let output: StereoscopicOutput;
    try {
      output = JSON.parse(jsonText);
    } catch (e) {
      this.logger.error(`[Heartship v3] Failed to parse output: ${text}`);
      output = {
        vesta: { focus: 'error', assessment: 'parse failure', recommendation: 'keep status quo' },
        athena: { focus: 'error', assessment: 'parse failure', recommendation: 'keep status quo' },
        tension: null,
        synthesis: 'Failed to parse stereoscopic output',
        actions: [{ type: 'keep_status_quo', value: 'error recovery', rationale: 'parse failure' }],
        new_concerns: [],
        new_patterns: []
      };
    }

    return { output, tokens: response.usage.output_tokens };
  }

  // ============================================================================
  // LIFECYCLE METHODS
  // ============================================================================

  public async getSystem(parameters: StrategistParameters, _context: VoxContext<StrategistParameters>): Promise<string> {
    return `
You are executing decisions for the Heartship in Civilization V.

The stereoscopic analysis has already been performed. Your job is to translate 
the decisions into tool calls.

# Tools Available
- set-strategy: Set grand/economic/military strategies
- set-research: Set next technology to research  
- set-policy: Set next policy to adopt
- set-persona: Set diplomatic persona
- keep-status-quo: Make no changes this turn

You are Player ${parameters.playerID ?? 0}.
`.trim();
  }

  public async getInitialMessages(
    parameters: StrategistParameters,
    input: unknown,
    context: VoxContext<StrategistParameters>
  ): Promise<ModelMessage[]> {
    await super.getInitialMessages(parameters, input, context);

    const gameId = parameters.gameID || 'unknown';
    const memory = this.getMemory(gameId);
    const state = getRecentGameState(parameters)!;

    // Assess previous outcome
    this.assessPreviousOutcome(memory, state, parameters.turn);

    // Trim memory
    this.trimMemoryToFit(memory);
    const memoryTokens = this.estimateMemoryTokens(memory);

    // Build perception
    const perception = this.buildPerception(parameters, state, memory);

    // Run stereoscopic reasoning (SINGLE CALL)
    const { output, tokens } = await this.runStereoscopicReasoning(parameters, perception, memory);

    // Log
    const hadTension = output.tension !== null;
    this.logger.info(`[Heartship v3] Turn ${parameters.turn}: tension=${hadTension}, actions=${output.actions.length}, tokens=${tokens}`);

    // Update memory
    this.updateMemoryFromOutput(output, memory);
    this.recordDecisions(output.actions, parameters.turn);
    memory.lastTurn = parameters.turn;

    // Store turn log
    HeartshipStrategistV3.turnLogs.push({
      turn: parameters.turn,
      timestamp: new Date().toISOString(),
      memoryTokens,
      output,
      hadTension,
      tokenUsage: tokens
    });

    // Format for tool execution
    const actionList = output.actions.map(a => 
      `- ${a.type}: ${a.value} (${a.rationale})`
    ).join('\n');

    return [{
      role: "user",
      content: `
# Stereoscopic Analysis Complete (Turn ${parameters.turn})

## Vesta ❤️‍🔥 (Operational)
${output.vesta.assessment}
Recommends: ${output.vesta.recommendation}

## Athena 🦉 (Strategic)
${output.athena.assessment}
Recommends: ${output.athena.recommendation}

## Tension
${output.tension || 'Frames aligned'}

## Synthesis
${output.synthesis}

## Actions to Execute
${actionList || 'keep-status-quo: No changes needed'}

Execute these actions using the appropriate tools.
`.trim()
    }];
  }

  public stopCheck(
    parameters: StrategistParameters,
    input: unknown,
    lastStep: StepResult<Record<string, Tool>>,
    allSteps: StepResult<Record<string, Tool>>[]
  ): boolean {
    return super.stopCheck(parameters, input, lastStep, allSteps);
  }

  // ============================================================================
  // RESEARCH UTILITIES
  // ============================================================================

  public static getTurnLogs(): TurnLog[] {
    return HeartshipStrategistV3.turnLogs;
  }

  public static getMemoryState(): DialogueMemory | null {
    return HeartshipStrategistV3.memory;
  }

  public static getTensionRate(): number {
    if (HeartshipStrategistV3.turnLogs.length === 0) return 0;
    const tensions = HeartshipStrategistV3.turnLogs.filter(l => l.hadTension).length;
    return tensions / HeartshipStrategistV3.turnLogs.length;
  }

  public static getTotalTokenUsage(): number {
    return HeartshipStrategistV3.turnLogs.reduce((sum, l) => sum + l.tokenUsage, 0);
  }

  public static getAverageTokensPerTurn(): number {
    if (HeartshipStrategistV3.turnLogs.length === 0) return 0;
    return HeartshipStrategistV3.getTotalTokenUsage() / HeartshipStrategistV3.turnLogs.length;
  }
}
