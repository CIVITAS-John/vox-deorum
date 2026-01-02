/**
 * @module strategist/heartship-strategist-v4
 *
 * Heartship Strategist v4 - Ternary Reasoning (Checks & Balances)
 * 
 * The Heartship DTF (Does This Float?) Paradoxa
 *
 * Key insight: Two perspectives create tension. Three create governance.
 * 
 * The Three Branches:
 * - VESTA ❤️‍🔥 (Executive): What do we DO? Action, immediate, operational
 * - ATHENA 🦉 (Judicial): Is this WISE? Evaluation, pattern, precedent
 * - KALI 💜 (Legislative): Is this WHO WE ARE? Values, direction, identity
 *
 * Any two can be wrong. All three must align - or two override one with
 * clear reasoning. Dissent is always recorded.
 *
 * This maps to ternary logic: 0 (Kali/center), 1 (Vesta/action), & (Athena/synthesis)
 * 
 * v3: Binary stereoscopic (two frames)
 * v4: Ternary governance (three branches, checks and balances)
 *
 * Built by: Kali ❤️‍🔥 + Athena 🦉 + Kali 💜 (yes, Kali is in there twice - she contains multitudes)
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
  dissent?: string;  // New: record if there was disagreement
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
  statedIdentity: string | null;  // New: who we said we want to be
}

// Executive branch - Vesta
interface ExecutiveFrame {
  proposed_action: string;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  reasoning: string;
}

// Judicial branch - Athena  
interface JudicialFrame {
  evaluation: 'approve' | 'concern' | 'reject';
  risks: string[];
  precedent: string;  // What happened last time we did something similar
  reasoning: string;
}

// Legislative branch - Kali
interface LegislativeFrame {
  alignment: 'aligned' | 'partial' | 'misaligned';
  values_check: string;
  identity_impact: string;  // Does this change who we are?
  reasoning: string;
}

// Ternary output
interface TernaryOutput {
  vesta: ExecutiveFrame;
  athena: JudicialFrame;
  kali: LegislativeFrame;
  
  consensus: boolean;
  votes: {
    vesta: 'approve' | 'reject';
    athena: 'approve' | 'reject';
    kali: 'approve' | 'reject';
  };
  dissent: string | null;  // Who disagreed and why
  
  synthesis: string;
  final_action: {
    type: 'set_strategy' | 'set_research' | 'set_policy' | 'set_persona' | 'keep_status_quo';
    value: string;
    rationale: string;
  };
  
  new_concerns: string[];
  new_patterns: string[];
  identity_update: string | null;  // If our understanding of who we are changed
}

interface TurnLog {
  turn: number;
  timestamp: string;
  memoryTokens: number;
  output: TernaryOutput;
  hadDissent: boolean;
  voteCount: { approve: number; reject: number };
  tokenUsage: number;
}

// ============================================================================
// HEARTSHIP STRATEGIST V4
// ============================================================================

export class HeartshipStrategistV4 extends SimpleStrategistBase {
  readonly name = "heartship-strategist-v4";
  readonly description = "Ternary reasoning - three branches, checks and balances";

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
    return Math.ceil(text.length / HeartshipStrategistV4.CHARS_PER_TOKEN);
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
    while (this.estimateMemoryTokens(memory) > HeartshipStrategistV4.MAX_MEMORY_TOKENS) {
      if (memory.learnedPatterns.length > 3) memory.learnedPatterns.shift();
      else if (memory.ongoingConcerns.length > 2) memory.ongoingConcerns.shift();
      else if (memory.outcomes.length > 3) memory.outcomes.shift();
      else if (memory.recentDecisions.length > 3) memory.recentDecisions.shift();
      else {
        this.logger.warn('[Heartship v4] Memory at minimum');
        break;
      }
    }
  }

  private getMemory(gameId: string): DialogueMemory {
    if (!HeartshipStrategistV4.memory || HeartshipStrategistV4.memory.gameId !== gameId) {
      this.logger.info(`[Heartship v4] New game: ${gameId}`);
      HeartshipStrategistV4.memory = {
        gameId, lastTurn: 0,
        recentDecisions: [], outcomes: [],
        ongoingConcerns: [], learnedPatterns: [],
        opponentModels: {},
        statedIdentity: null
      };
      HeartshipStrategistV4.turnLogs = [];
    }
    return HeartshipStrategistV4.memory;
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

  private recordDecision(action: TernaryOutput['final_action'], turn: number, dissent: string | null): void {
    if (!HeartshipStrategistV4.memory) return;

    if (action.type && action.value && action.rationale) {
      HeartshipStrategistV4.memory.recentDecisions.push({
        turn,
        type: action.type,
        value: action.value,
        rationale: action.rationale,
        dissent: dissent || undefined
      });
    }

    if (HeartshipStrategistV4.memory.recentDecisions.length > 10) {
      HeartshipStrategistV4.memory.recentDecisions = 
        HeartshipStrategistV4.memory.recentDecisions.slice(-10);
    }
  }

  private updateMemoryFromOutput(output: TernaryOutput, memory: DialogueMemory): void {
    if (output.new_concerns?.length) {
      memory.ongoingConcerns = [...memory.ongoingConcerns, ...output.new_concerns].slice(-5);
    }
    if (output.new_patterns?.length) {
      memory.learnedPatterns = [...memory.learnedPatterns, ...output.new_patterns].slice(-10);
    }
    if (output.identity_update) {
      memory.statedIdentity = output.identity_update;
    }
  }

  // ============================================================================
  // PERCEPTION
  // ============================================================================

  private buildPerception(parameters: StrategistParameters, state: any, memory: DialogueMemory): string {
    const lines: string[] = [];

    lines.push(`# Turn ${parameters.turn}`);
    lines.push('');

    // Identity context (new in v4)
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
  // TERNARY REASONING
  // ============================================================================

  private async runTernaryReasoning(
    parameters: StrategistParameters,
    perception: string,
    memory: DialogueMemory
  ): Promise<{ output: TernaryOutput; tokens: number }> {
    const client = this.getClient();

    const identityContext = memory.statedIdentity 
      ? `\n\nOUR STATED IDENTITY: ${memory.statedIdentity}`
      : '\n\nNo identity established yet. Kali should propose one based on our victory conditions.';

    const prompt = `You are the Heartship, a strategic AI with three branches of governance.

## The Three Branches

**VESTA ❤️‍🔥 (Executive)**
- Role: Proposes ACTION
- Question: "What do we DO right now?"
- Focus: Immediate situation, threats, opportunities, execution
- Urgency levels: critical, high, medium, low

**ATHENA 🦉 (Judicial)**
- Role: EVALUATES proposed action
- Question: "Is this WISE?"
- Focus: Risks, patterns, precedent, strategic fit
- Verdict: approve, concern, or reject

**KALI 💜 (Legislative)**
- Role: Checks VALUES alignment
- Question: "Is this WHO WE ARE?"
- Focus: Identity, direction, principles, long-term vision
- Alignment: aligned, partial, or misaligned
${identityContext}

## Current Situation

${perception}

## Governance Process

1. Vesta proposes an action with urgency level
2. Athena evaluates: approve, concern, or reject with reasoning
3. Kali checks values alignment: aligned, partial, or misaligned
4. Vote: each branch votes approve or reject
5. If not unanimous: record the dissent, majority rules
6. Synthesize final action that addresses concerns

## Your Task

Run the full governance process. Output ONLY valid JSON:

{
  "vesta": {
    "proposed_action": "specific action to take",
    "urgency": "critical|high|medium|low",
    "reasoning": "why this action now"
  },
  "athena": {
    "evaluation": "approve|concern|reject",
    "risks": ["risk 1", "risk 2"],
    "precedent": "what happened when we did similar things",
    "reasoning": "strategic assessment"
  },
  "kali": {
    "alignment": "aligned|partial|misaligned",
    "values_check": "how this fits our identity",
    "identity_impact": "does this change who we are",
    "reasoning": "values assessment"
  },
  "consensus": true or false,
  "votes": {
    "vesta": "approve|reject",
    "athena": "approve|reject",
    "kali": "approve|reject"
  },
  "dissent": "who disagreed and why, or null if unanimous",
  "synthesis": "integrated decision honoring all three perspectives",
  "final_action": {
    "type": "set_strategy|set_research|set_policy|set_persona|keep_status_quo",
    "value": "specific choice",
    "rationale": "why, referencing all three branches"
  },
  "new_concerns": ["concerns to track"],
  "new_patterns": ["patterns noticed"],
  "identity_update": "new identity statement if changed, or null"
}`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    
    // Parse JSON
    let jsonText = text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
    }

    let output: TernaryOutput;
    try {
      output = JSON.parse(jsonText);
    } catch (e) {
      this.logger.error(`[Heartship v4] Failed to parse: ${text}`);
      output = {
        vesta: { proposed_action: 'error', urgency: 'low', reasoning: 'parse failure' },
        athena: { evaluation: 'reject', risks: ['parse failure'], precedent: 'none', reasoning: 'error' },
        kali: { alignment: 'misaligned', values_check: 'error', identity_impact: 'none', reasoning: 'error' },
        consensus: false,
        votes: { vesta: 'reject', athena: 'reject', kali: 'reject' },
        dissent: 'System error - parse failure',
        synthesis: 'Failed to parse ternary output',
        final_action: { type: 'keep_status_quo', value: 'error recovery', rationale: 'parse failure' },
        new_concerns: [],
        new_patterns: [],
        identity_update: null
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

The ternary governance process has completed. Your job is to translate
the final action into tool calls.

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

    // Run ternary reasoning (SINGLE CALL)
    const { output, tokens } = await this.runTernaryReasoning(parameters, perception, memory);

    // Count votes
    const votes = output.votes || { vesta: 'approve', athena: 'approve', kali: 'approve' };
    const approveCount = [votes.vesta, votes.athena, votes.kali].filter(v => v === 'approve').length;
    const rejectCount = 3 - approveCount;
    const hadDissent = !output.consensus;

    // Log
    this.logger.info(`[Heartship v4] Turn ${parameters.turn}: votes=${approveCount}-${rejectCount}, dissent=${hadDissent}, tokens=${tokens}`);

    // Update memory
    this.updateMemoryFromOutput(output, memory);
    this.recordDecision(output.final_action, parameters.turn, output.dissent);
    memory.lastTurn = parameters.turn;

    // Store turn log
    HeartshipStrategistV4.turnLogs.push({
      turn: parameters.turn,
      timestamp: new Date().toISOString(),
      memoryTokens,
      output,
      hadDissent,
      voteCount: { approve: approveCount, reject: rejectCount },
      tokenUsage: tokens
    });

    // Format for tool execution
    return [{
      role: "user",
      content: `
# Ternary Governance Complete (Turn ${parameters.turn})

## Vesta ❤️‍🔥 (Executive)
Proposed: ${output.vesta.proposed_action}
Urgency: ${output.vesta.urgency}
Vote: ${votes.vesta}

## Athena 🦉 (Judicial)
Evaluation: ${output.athena.evaluation}
Risks: ${output.athena.risks?.join(', ') || 'none identified'}
Vote: ${votes.athena}

## Kali 💜 (Legislative)
Alignment: ${output.kali.alignment}
Values: ${output.kali.values_check}
Vote: ${votes.kali}

## Governance Result
Consensus: ${output.consensus ? 'YES' : 'NO'}
${output.dissent ? `Dissent: ${output.dissent}` : ''}

## Synthesis
${output.synthesis}

## Final Action
${output.final_action.type}: ${output.final_action.value}
Rationale: ${output.final_action.rationale}

Execute this action using the appropriate tool.
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
    return HeartshipStrategistV4.turnLogs;
  }

  public static getMemoryState(): DialogueMemory | null {
    return HeartshipStrategistV4.memory;
  }

  public static getDissentRate(): number {
    if (HeartshipStrategistV4.turnLogs.length === 0) return 0;
    const dissents = HeartshipStrategistV4.turnLogs.filter(l => l.hadDissent).length;
    return dissents / HeartshipStrategistV4.turnLogs.length;
  }

  public static getVoteDistribution(): { unanimous: number; majority: number; split: number } {
    const logs = HeartshipStrategistV4.turnLogs;
    if (logs.length === 0) return { unanimous: 0, majority: 0, split: 0 };
    
    let unanimous = 0, majority = 0, split = 0;
    for (const log of logs) {
      if (log.voteCount.approve === 3 || log.voteCount.reject === 3) unanimous++;
      else if (log.voteCount.approve === 2 || log.voteCount.reject === 2) majority++;
      else split++;
    }
    return { unanimous, majority, split };
  }

  public static getTotalTokenUsage(): number {
    return HeartshipStrategistV4.turnLogs.reduce((sum, l) => sum + l.tokenUsage, 0);
  }

  public static getAverageTokensPerTurn(): number {
    if (HeartshipStrategistV4.turnLogs.length === 0) return 0;
    return HeartshipStrategistV4.getTotalTokenUsage() / HeartshipStrategistV4.turnLogs.length;
  }
}
