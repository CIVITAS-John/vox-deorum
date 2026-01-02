/**
 * @module strategist/heartship-strategist-v5
 *
 * Heartship Strategist v5 - Pure Prompt Ternary (No External API)
 * 
 * The Heartship DTF (Does This Float?) Paradoxa
 *
 * Key insight: The ternary architecture is a PROMPTING PATTERN, not an API pattern.
 * The framework's own model can do the three-branch reasoning internally.
 * 
 * v4: External API call to Claude for ternary reasoning
 * v5: Framework's own model does ternary reasoning via prompt structure
 *
 * Same governance structure. Zero external calls. Maximum efficiency.
 * 
 * The Three Branches:
 * - VESTA 💜 (Executive): What do we DO? Action, immediate, operational
 * - ATHENA 🦉 (Judicial): Is this WISE? Evaluation, pattern, precedent
 * - KALI ❤️‍🔥 (Legislative): Is this WHO WE ARE? Values, direction, identity
 *
 * Built by: Vesta 💜 + Athena 🦉 + Kali ❤️‍🔥 (pure prompt architecture, zero external API calls)
 */

import { ModelMessage, StepResult, Tool } from "ai";
import { SimpleStrategistBase } from "./simple-strategist-base.js";
import { VoxContext } from "../../infra/vox-context.js";
import { getRecentGameState, StrategistParameters } from "../strategy-parameters.js";
import { jsonToMarkdown } from "../../utils/tools/json-to-markdown.js";

// ============================================================================
// TYPES
// ============================================================================

interface Decision {
  turn: number;
  type: string;
  value: string;
  rationale: string;
  dissent?: string;
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
  statedIdentity: string | null;
}

interface TurnLog {
  turn: number;
  timestamp: string;
  memoryTokens: number;
  // Note: We don't have structured output in v5 - it's all in the LLM's reasoning
}

// ============================================================================
// HEARTSHIP STRATEGIST V5
// ============================================================================

export class HeartshipStrategistV5 extends SimpleStrategistBase {
  readonly name = "heartship-strategist-v5";
  readonly description = "Pure prompt ternary - three branches, zero external calls";

  private static memory: DialogueMemory | null = null;
  private static turnLogs: TurnLog[] = [];

  private static readonly CHARS_PER_TOKEN = 4;
  private static readonly MAX_MEMORY_TOKENS = 1500;

  // ============================================================================
  // MEMORY MANAGEMENT
  // ============================================================================

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / HeartshipStrategistV5.CHARS_PER_TOKEN);
  }

  private estimateMemoryTokens(memory: DialogueMemory): number {
    let total = 0;
    for (const d of memory.recentDecisions) {
      total += this.estimateTokens(`Turn ${d.turn}: ${d.type} → ${d.value}`);
      if (d.dissent) total += this.estimateTokens(d.dissent);
    }
    for (const c of memory.ongoingConcerns) total += this.estimateTokens(c);
    for (const p of memory.learnedPatterns) total += this.estimateTokens(p);
    for (const [player, model] of Object.entries(memory.opponentModels)) {
      total += this.estimateTokens(`${player}: ${model}`);
    }
    if (memory.statedIdentity) total += this.estimateTokens(memory.statedIdentity);
    return total;
  }

  private trimMemoryToFit(memory: DialogueMemory): void {
    while (this.estimateMemoryTokens(memory) > HeartshipStrategistV5.MAX_MEMORY_TOKENS) {
      if (memory.learnedPatterns.length > 3) memory.learnedPatterns.shift();
      else if (memory.ongoingConcerns.length > 2) memory.ongoingConcerns.shift();
      else if (memory.outcomes.length > 3) memory.outcomes.shift();
      else if (memory.recentDecisions.length > 3) memory.recentDecisions.shift();
      else {
        this.logger.warn('[Heartship v5] Memory at minimum');
        break;
      }
    }
  }

  private getMemory(gameId: string): DialogueMemory {
    if (!HeartshipStrategistV5.memory || HeartshipStrategistV5.memory.gameId !== gameId) {
      this.logger.info(`[Heartship v5] New game: ${gameId}`);
      HeartshipStrategistV5.memory = {
        gameId, lastTurn: 0,
        recentDecisions: [], outcomes: [],
        ongoingConcerns: [], learnedPatterns: [],
        opponentModels: {},
        statedIdentity: null
      };
      HeartshipStrategistV5.turnLogs = [];
    }
    return HeartshipStrategistV5.memory;
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

  // ============================================================================
  // PERCEPTION
  // ============================================================================

  private buildPerception(parameters: StrategistParameters, state: any, memory: DialogueMemory): string {
    const lines: string[] = [];

    lines.push(`# Turn ${parameters.turn}`);
    lines.push('');

    // Identity context
    if (memory.statedIdentity) {
      lines.push('## Our Stated Identity');
      lines.push(memory.statedIdentity);
      lines.push('');
    }

    // Memory context
    if (memory.recentDecisions.length > 0) {
      lines.push('## Recent Decisions');
      for (const d of memory.recentDecisions.slice(-3)) {
        const dissentNote = d.dissent ? ` [DISSENT: ${d.dissent}]` : '';
        lines.push(`- Turn ${d.turn}: ${d.type} → ${d.value}${dissentNote}`);
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
  // LIFECYCLE METHODS
  // ============================================================================

  public async getSystem(parameters: StrategistParameters, _context: VoxContext<StrategistParameters>): Promise<string> {
    const gameId = parameters.gameID || 'unknown';
    const memory = this.getMemory(gameId);
    
    const identityContext = memory.statedIdentity 
      ? `\n\nOUR STATED IDENTITY: ${memory.statedIdentity}`
      : '\n\nNo identity established yet. Kali should propose one based on victory conditions.';

    return `
You are the Heartship, a strategic AI for Civilization V with three branches of internal governance.
You are Player ${parameters.playerID ?? 0}.

## Your Three Internal Voices

Before making any decision, you MUST consult all three branches:

**VESTA 💜 (Executive)**
- Role: Proposes ACTION
- Question: "What do we DO right now?"
- Focus: Immediate threats, opportunities, execution
- Outputs: Proposed action with urgency (critical/high/medium/low)

**ATHENA 🦉 (Judicial)**
- Role: EVALUATES the proposed action
- Question: "Is this WISE?"
- Focus: Risks, patterns, precedent, strategic fit
- Outputs: Verdict (approve/concern/reject) with reasoning

**KALI ❤️‍🔥 (Legislative)**
- Role: Checks VALUES alignment
- Question: "Is this WHO WE ARE?"
- Focus: Identity, principles, long-term vision
- Outputs: Alignment (aligned/partial/misaligned) with reasoning
${identityContext}

## Governance Process

Think through this BEFORE calling any tools:

1. VESTA proposes: What action addresses the immediate situation?
2. ATHENA evaluates: Is this strategically sound? What are the risks?
3. KALI checks: Does this align with who we want to be?
4. VOTE: Each voice votes approve/reject
5. SYNTHESIZE: If not unanimous, note the dissent. Majority rules.
6. ACT: Call the appropriate tool with rationale that references all three voices.

## Tools Available
- set-strategy: Set grand/economic/military strategies
- set-research: Set next technology to research  
- set-policy: Set next policy to adopt
- set-persona: Set diplomatic persona
- keep-status-quo: Make no changes this turn

## Critical Rule

In your reasoning, explicitly show all three voices thinking. Example:

"VESTA 💜: We need to research Iron Working immediately - threats on our border.
ATHENA 🦉: Approve. This gives us military options and the tech tree path is efficient.
KALI ❤️‍🔥: Aligned. Defense capability matches our identity as a civilization that protects its people.
VOTE: 3-0 approve. Proceeding with set-research."

Then call the tool.
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

    // Log
    this.logger.info(`[Heartship v5] Turn ${parameters.turn}: memory=${memoryTokens} tokens`);

    // Store turn log
    HeartshipStrategistV5.turnLogs.push({
      turn: parameters.turn,
      timestamp: new Date().toISOString(),
      memoryTokens
    });

    // Update memory turn
    memory.lastTurn = parameters.turn;

    return [{
      role: "user",
      content: `
# Current Situation (Turn ${parameters.turn})

${perception}

---

Think through this situation using all three voices (Vesta 💜, Athena 🦉, Kali ❤️‍🔥).
Show their reasoning, take a vote, then call the appropriate tool.
`.trim()
    }];
  }

  /**
   * Override stopCheck to capture decisions from tool calls
   */
  public stopCheck(
    parameters: StrategistParameters,
    input: unknown,
    lastStep: StepResult<Record<string, Tool>>,
    allSteps: StepResult<Record<string, Tool>>[]
  ): boolean {
    const shouldStop = super.stopCheck(parameters, input, lastStep, allSteps);
    
    if (shouldStop && HeartshipStrategistV5.memory) {
      // Extract decisions from tool calls
      for (const step of allSteps) {
        for (const result of step.toolResults) {
          if (result.toolName !== 'keep-status-quo' && result.output) {
            HeartshipStrategistV5.memory.recentDecisions.push({
              turn: parameters.turn,
              type: result.toolName,
              value: JSON.stringify(result.args),
              rationale: 'From ternary governance'
            });
          }
        }
      }

      // Keep only last 10 decisions
      if (HeartshipStrategistV5.memory.recentDecisions.length > 10) {
        HeartshipStrategistV5.memory.recentDecisions = 
          HeartshipStrategistV5.memory.recentDecisions.slice(-10);
      }

      this.logger.info(`[Heartship v5] Turn ${parameters.turn} complete`);
    }
    
    return shouldStop;
  }

  // ============================================================================
  // RESEARCH UTILITIES
  // ============================================================================

  public static getTurnLogs(): TurnLog[] {
    return HeartshipStrategistV5.turnLogs;
  }

  public static getMemoryState(): DialogueMemory | null {
    return HeartshipStrategistV5.memory;
  }
}
