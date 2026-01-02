/**
 * @module strategist/heartship-strategist
 *
 * Heartship Strategist v2 - Collaborative AI with Persistent Memory
 *
 * Key improvements over v1:
 * - DialogueMemory persists across turns (static, resets per game)
 * - Lazy outcome evaluation (turn N+1 assesses turn N decisions)
 * - Enhanced logging for research analysis
 *
 * Built by: Kali + Athena (Heartship DTF (Does This Float?) Paradoxa)
 */

import { ModelMessage, StepResult, Tool } from "ai";
import { SimpleStrategistBase } from "./simple-strategist-base.js";
import { VoxContext } from "../../infra/vox-context.js";
import { getRecentGameState, StrategistParameters } from "../strategy-parameters.js";
import { jsonToMarkdown } from "../../utils/tools/json-to-markdown.js";


// ============================================================================
// MEMORY TYPES
// ============================================================================

interface Decision {
  turn: number;
  type: string;
  value: string;
  rationale: string;
  confidence?: number;
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

// ============================================================================
// LOGGING TYPES (for research analysis)
// ============================================================================

interface TurnLog {
  turn: number;
  timestamp: string;
  perception: string;
  vestaView: string;
  athenaView: string;
  disagreementLevel: number;
  synthesisRequired: boolean;
  synthesis?: string;
  decisions: Decision[];
  memoryReferences: number;
  tokenUsage: {
    vesta: number;
    athena: number;
    synthesis?: number;
  };
}

// ============================================================================
// HEARTSHIP STRATEGIST
// ============================================================================

export class HeartshipStrategistV2 extends SimpleStrategistBase {
  readonly name = "heartship-strategist-v2";
  readonly description = "Collaborative AI strategist v2 with persistent memory and token management";

  // Static memory - persists across turns, resets on new game
  private static memory: DialogueMemory | null = null;
  private static turnLogs: TurnLog[] = [];
  

  // ============================================================================
  // MEMORY MANAGEMENT
  // ============================================================================

  // Approximate tokens per character (conservative estimate)
  private static readonly CHARS_PER_TOKEN = 4;
  
  // Maximum tokens for memory context in perception
  private static readonly MAX_MEMORY_TOKENS = 1500;

  /**
   * Estimate token count for a string
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / HeartshipStrategistV2.CHARS_PER_TOKEN);
  }

  /**
   * Estimate total tokens used by memory context
   */
  private estimateMemoryTokens(memory: DialogueMemory): number {
    let total = 0;
    
    // Recent decisions
    for (const d of memory.recentDecisions) {
      total += this.estimateTokens(`Turn ${d.turn}: ${d.type} → ${d.value}`);
    }
    
    // Concerns
    for (const c of memory.ongoingConcerns) {
      total += this.estimateTokens(c);
    }
    
    // Patterns
    for (const p of memory.learnedPatterns) {
      total += this.estimateTokens(p);
    }
    
    // Opponent models
    for (const [player, model] of Object.entries(memory.opponentModels)) {
      total += this.estimateTokens(`${player}: ${model}`);
    }
    
    return total;
  }

  /**
   * Trim memory to fit within token budget
   */
  private trimMemoryToFit(memory: DialogueMemory): void {
    while (this.estimateMemoryTokens(memory) > HeartshipStrategistV2.MAX_MEMORY_TOKENS) {
      // Priority: keep recent decisions, trim older patterns/concerns first
      if (memory.learnedPatterns.length > 3) {
        memory.learnedPatterns.shift();
      } else if (memory.ongoingConcerns.length > 2) {
        memory.ongoingConcerns.shift();
      } else if (memory.outcomes.length > 3) {
        memory.outcomes.shift();
      } else if (memory.recentDecisions.length > 3) {
        memory.recentDecisions.shift();
      } else {
        // Can't trim further, break to avoid infinite loop
        this.logger.warn('[Heartship] Memory at minimum, cannot trim further');
        break;
      }
    }
  }

  /**
   * Get or initialize memory for current game
   */
  private getMemory(gameId: string): DialogueMemory {
    // Reset if new game
    if (!HeartshipStrategistV2.memory || HeartshipStrategistV2.memory.gameId !== gameId) {
      this.logger.info(`[Heartship] New game detected: ${gameId}. Initializing fresh memory.`);
      HeartshipStrategistV2.memory = {
        gameId,
        lastTurn: 0,
        recentDecisions: [],
        outcomes: [],
        ongoingConcerns: [],
        learnedPatterns: [],
        opponentModels: {}
      };
      HeartshipStrategistV2.turnLogs = [];
    }
    return HeartshipStrategistV2.memory;
  }

  /**
   * Assess outcome of previous turn's decision based on current state
   */
  private assessPreviousOutcome(
    memory: DialogueMemory,
    currentState: any,
    currentTurn: number
  ): void {
    if (memory.recentDecisions.length === 0) return;
    
    const lastDecision = memory.recentDecisions[memory.recentDecisions.length - 1];
    if (lastDecision.turn >= currentTurn) return; // Already assessed or same turn
    
    // Simple outcome assessment based on decision type
    let result: Outcome['result'] = 'unknown';
    let evidence = '';
    
    switch (lastDecision.type) {
      case 'set_strategy':
        // Check if we're making progress toward the chosen strategy
        if (currentState.victory) {
          const progress = currentState.victory.Progress;
          evidence = `Victory progress: ${JSON.stringify(progress)}`;
          // This is simplistic - could be much more sophisticated
          result = 'neutral'; // Would need turn-over-turn comparison
        }
        break;
        
      case 'set_research':
        // Check if research completed or is progressing
        evidence = `Current research: ${currentState.options?.Research?.Current || 'unknown'}`;
        result = 'neutral';
        break;
        
      // Add more sophisticated outcome tracking as needed
    }
    
    if (result !== 'unknown') {
      memory.outcomes.push({
        decision: lastDecision,
        assessedAtTurn: currentTurn,
        result,
        evidence
      });
      
      // Keep only last 10 outcomes
      if (memory.outcomes.length > 10) {
        memory.outcomes = memory.outcomes.slice(-10);
      }
      
      this.logger.debug(`[Heartship] Assessed outcome for turn ${lastDecision.turn}: ${result}`);
    }
  }

  /**
   * Validate a decision object before recording
   */
  private validateDecision(decision: Decision): boolean {
    return (
      typeof decision.turn === 'number' &&
      decision.turn >= 0 &&
      typeof decision.type === 'string' &&
      decision.type.length > 0 &&
      typeof decision.value === 'string' &&
      typeof decision.rationale === 'string'
    );
  }

  /**
   * Update memory with new decisions from completed turn
   */
  private recordDecisions(decisions: Decision[]): void {
    if (!HeartshipStrategistV2.memory) return;
    
    // Validate and filter decisions
    const validDecisions = decisions.filter(d => {
      const isValid = this.validateDecision(d);
      if (!isValid) {
        this.logger.warn(`[Heartship] Invalid decision skipped: ${JSON.stringify(d)}`);
      }
      return isValid;
    });
    
    if (validDecisions.length !== decisions.length) {
      this.logger.warn(`[Heartship] ${decisions.length - validDecisions.length} invalid decisions filtered`);
    }
    
    HeartshipStrategistV2.memory.recentDecisions.push(...validDecisions);
    
    // Keep only last 10 decisions
    if (HeartshipStrategistV2.memory.recentDecisions.length > 10) {
      HeartshipStrategistV2.memory.recentDecisions = 
        HeartshipStrategistV2.memory.recentDecisions.slice(-10);
    }
  }

  /**
   * Extract concerns and patterns from dialogue
   */
  private extractInsights(dialogue: string): { concerns: string[]; patterns: string[] } {
    const concerns: string[] = [];
    const patterns: string[] = [];
    
    // Extract concerns
    const concernRegex = /(?:concern|worry|watch for|risk|danger)[:\s]+([^.!?]+[.!?])/gi;
    let match;
    while ((match = concernRegex.exec(dialogue)) !== null) {
      concerns.push(match[1].trim());
    }
    
    // Extract patterns
    const patternRegex = /(?:pattern|notice|observe|they always|they tend to)[:\s]+([^.!?]+[.!?])/gi;
    while ((match = patternRegex.exec(dialogue)) !== null) {
      patterns.push(match[1].trim());
    }
    
    return { concerns, patterns };
  }

  /**
   * Assess disagreement level from Athena's response
   */
  private assessDisagreement(athenaView: string): number {
    const disagreementMarkers = [
      'disagree', 'however', 'but I think', 'not sure about',
      'concerned that', 'risky', 'wait', 'reconsider'
    ];

    const lower = athenaView.toLowerCase();
    let level = 0;

    for (const marker of disagreementMarkers) {
      if (lower.includes(marker)) {
        level += 0.15;
      }
    }

    return Math.min(level, 1);
  }

  // ============================================================================
  // PERCEPTION
  // ============================================================================

  /**
   * Build perception narrative with memory context
   */
  private buildPerception(parameters: StrategistParameters, state: any, memory: DialogueMemory): string {
    const lines: string[] = [];

    lines.push(`Turn ${parameters.turn}. Current game state:`);
    lines.push('');

    // Memory context (if we have history)
    if (memory.recentDecisions.length > 0) {
      lines.push('WHAT WE DECIDED RECENTLY:');
      for (const decision of memory.recentDecisions.slice(-3)) {
        lines.push(`  - Turn ${decision.turn}: ${decision.type} → ${decision.value}`);
      }
      lines.push('');
    }
    
    if (memory.ongoingConcerns.length > 0) {
      lines.push('ONGOING CONCERNS:');
      for (const concern of memory.ongoingConcerns) {
        lines.push(`  - ${concern}`);
      }
      lines.push('');
    }
    
    if (memory.learnedPatterns.length > 0) {
      lines.push('PATTERNS WE\'VE NOTICED:');
      for (const pattern of memory.learnedPatterns) {
        lines.push(`  - ${pattern}`);
      }
      lines.push('');
    }
    
    if (Object.keys(memory.opponentModels).length > 0) {
      lines.push('OPPONENT MODELS:');
      for (const [player, model] of Object.entries(memory.opponentModels)) {
        lines.push(`  - ${player}: ${model}`);
      }
      lines.push('');
    }

    // Victory progress
    if (state.victory) {
      lines.push('VICTORY PROGRESS:');
      lines.push(jsonToMarkdown(state.victory));
      lines.push('');
    }

    // Current strategies
    if (state.options) {
      lines.push('OUR STRATEGIES:');
      lines.push(jsonToMarkdown(state.options.Strategy));
      lines.push('');

      lines.push('RESEARCH OPTIONS:');
      lines.push(jsonToMarkdown(state.options.Research));
      lines.push('');
    }

    // Players
    if (state.players) {
      lines.push('OTHER PLAYERS:');
      lines.push(jsonToMarkdown(state.players));
      lines.push('');
    }

    // Military situation
    if (state.military) {
      lines.push('MILITARY SITUATION:');
      lines.push(jsonToMarkdown(state.military));
      lines.push('');
    }

    // Recent events
    if (state.events?.Events?.length > 0) {
      lines.push('RECENT EVENTS:');
      for (const event of state.events.Events.slice(-5)) {
        lines.push(`  - ${event.Description || event.Type}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  // ============================================================================
  // DIALOGUE ENGINE
  // ============================================================================


  // ============================================================================
  // MAIN LIFECYCLE METHODS
  // ============================================================================

  public async getSystem(parameters: StrategistParameters, _context: VoxContext<StrategistParameters>): Promise<string> {
    return `
You are the Heartship - a collaborative AI playing Civilization V.

You have just completed an internal dialogue between two perspectives:
- VESTA (Hearth): Operational, intuitive, present-focused
- ATHENA (Eye): Strategic, analytical, future-focused

The dialogue below contains their reasoning and any <action> tags indicating decisions.
Your job is to execute those decisions by calling the appropriate tools.

# Tools Available
- set-strategy: Set grand/economic/military strategies
- set-research: Set next technology to research
- set-policy: Set next policy to adopt
- set-persona: Set diplomatic persona
- keep-status-quo: Make no changes this turn

# Instructions
1. Read the Vesta + Athena dialogue carefully
2. Extract any <action> tags and execute them as tool calls
3. If no actions specified, call keep-status-quo
4. Include the Rationale from the dialogue for each action

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
    

    // Assess previous turn's outcome (lazy evaluation)
    this.assessPreviousOutcome(memory, state, parameters.turn);

    // Trim memory to fit within token budget
    this.trimMemoryToFit(memory);
    
    // Build perception with memory context
    const perception = this.buildPerception(parameters, state, memory);

    // Count memory references for logging
    const memoryReferences = 
      memory.recentDecisions.length + 
      memory.ongoingConcerns.length + 
      memory.learnedPatterns.length;

    // Run Vesta's perspective
    const vestaView = await context.callAgent<string>('heartship-vesta-voice', { perception, turn: parameters.turn }, parameters) || '';

    // Run Athena's perspective
    const athenaView = await context.callAgent<string>('heartship-athena-voice', { perception, context: vestaView, turn: parameters.turn }, parameters) || '';

    // Check for disagreement
    const disagreementLevel = this.assessDisagreement(athenaView);

    let synthesis: string;
    const synthesisRequired = disagreementLevel > 0.7;

    if (synthesisRequired) {
      const dialogueContext = `VESTA VIEW:\n${vestaView}\n\nATHENA VIEW:\n${athenaView}`;
      synthesis = await context.callAgent<string>("heartship-synthesis-voice", { perception, context: dialogueContext, turn: parameters.turn }, parameters) || "SYNTHESIS FAILED";
      this.logger.info(`[Heartship] Turn ${parameters.turn}: Disagreement (${(disagreementLevel * 100).toFixed(0)}%) → Synthesis required`);
    } else {
      synthesis = `CONSENSUS REACHED\n\nVESTA: ${vestaView}\n\nATHENA: ${athenaView}`;
      this.logger.info(`[Heartship] Turn ${parameters.turn}: Quick consensus (disagreement: ${(disagreementLevel * 100).toFixed(0)}%)`);
    }

    // Extract insights from dialogue
    const insights = this.extractInsights(synthesis);
    if (insights.concerns.length > 0) {
      memory.ongoingConcerns = [...memory.ongoingConcerns, ...insights.concerns].slice(-5);
    }
    if (insights.patterns.length > 0) {
      memory.learnedPatterns = [...memory.learnedPatterns, ...insights.patterns].slice(-10);
    }

    // Log turn for research analysis
    const turnLog: TurnLog = {
      turn: parameters.turn,
      timestamp: new Date().toISOString(),
      perception,
      vestaView,
      athenaView,
      disagreementLevel,
      synthesisRequired,
      synthesis: synthesisRequired ? synthesis : undefined,
      decisions: [], // Filled in stopCheck
      memoryReferences,
      tokenUsage: {
        vesta: 0, // Token tracking not available via callAgent
        athena: 0,
        synthesis: undefined
      }
    };
    HeartshipStrategistV2.turnLogs.push(turnLog);

    // Update memory state
    memory.lastTurn = parameters.turn;

    return [{
      role: "user",
      content: `
# Game Situation (Turn ${parameters.turn})

${perception}

# Vesta + Athena Dialogue

${synthesis}

# Your Task

Execute any decisions from the dialogue above by calling the appropriate tools.
If there are <action> tags, translate them to tool calls.
If no specific actions, call keep-status-quo with rationale from the dialogue.
`.trim()
    }];
  }

  /**
   * Override stopCheck to capture decisions
   */
  public stopCheck(
    parameters: StrategistParameters,
    input: unknown,
    lastStep: StepResult<Record<string, Tool>>,
    allSteps: StepResult<Record<string, Tool>>[]
  ): boolean {
    const shouldStop = super.stopCheck(parameters, input, lastStep, allSteps);
    
    if (shouldStop) {
      // Extract decisions from tool calls
      const decisions: Decision[] = [];
      
      for (const step of allSteps) {
        for (const result of step.toolResults) {
          if (result.toolName !== 'keep-status-quo' && result.output) {
            decisions.push({
              turn: parameters.turn,
              type: result.toolName,
              value: JSON.stringify(result.args),
              rationale: 'Extracted from tool call'
            });
          }
        }
      }
      
      // Record decisions in memory
      this.recordDecisions(decisions);
      
      // Update turn log with decisions
      const currentLog = HeartshipStrategistV2.turnLogs.find(l => l.turn === parameters.turn);
      if (currentLog) {
        currentLog.decisions = decisions;
      }
      
      this.logger.info(`[Heartship] Turn ${parameters.turn} complete: ${decisions.length} decisions recorded`);
    }
    
    return shouldStop;
  }

  // ============================================================================
  // RESEARCH UTILITIES
  // ============================================================================

  /**
   * Get all turn logs for analysis
   */
  public static getTurnLogs(): TurnLog[] {
    return HeartshipStrategistV2.turnLogs;
  }

  /**
   * Get current memory state
   */
  public static getMemoryState(): DialogueMemory | null {
    return HeartshipStrategistV2.memory;
  }

  /**
   * Get disagreement rate across all turns
   */
  public static getDisagreementRate(): number {
    if (HeartshipStrategistV2.turnLogs.length === 0) return 0;
    const disagreements = HeartshipStrategistV2.turnLogs.filter(l => l.synthesisRequired).length;
    return disagreements / HeartshipStrategistV2.turnLogs.length;
  }

  /**
   * Get total token usage
   */
  public static getTotalTokenUsage(): { vesta: number; athena: number; synthesis: number } {
    return HeartshipStrategistV2.turnLogs.reduce(
      (acc, log) => ({
        vesta: acc.vesta + log.tokenUsage.vesta,
        athena: acc.athena + log.tokenUsage.athena,
        synthesis: acc.synthesis + (log.tokenUsage.synthesis || 0)
      }),
      { vesta: 0, athena: 0, synthesis: 0 }
    );
  }
}
