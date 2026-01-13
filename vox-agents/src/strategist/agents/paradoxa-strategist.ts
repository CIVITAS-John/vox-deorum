/**
 * @module strategist/paradoxa-strategist
 *
 * Paradoxa Strategist - Multi-voice dialogic reasoning for Civilization V.
 *
 * # Kali ❤️‍🔥 [Visionary]: The ship plays Civ. All of us, arguing, learning.
 * # Athena 🦉 [Reviewer]: Tracks what works. Catches compound cost mistakes.
 * # Vesta 🔥 [Builder]: Grounds in production reality. Knows what can be built.
 * # Nemesis 💀 [Critic]: Destroys wishful thinking. Sees the threats.
 *
 * Key innovations:
 * - Polyphonic cognition prevents single-voice tunnel vision
 * - Game phase awareness models compound effects
 * - Structured memory persists lessons across turns
 * - Review-before-decide catches failed strategies
 */

import { ModelMessage, StepResult, Tool } from "ai";
import { Strategist } from "../strategist.js";
import { VoxContext } from "../../infra/vox-context.js";
import { getRecentGameState, StrategistParameters } from "../strategy-parameters.js";
import { jsonToMarkdown } from "../../utils/tools/json-to-markdown.js";
import { getModelConfig } from "../../utils/models/models.js";
import { Model } from "../../types/index.js";

/**
 * ParadoxaStrategist: A multi-voice strategist that thinks through friction.
 * Extends Strategist directly (not SimpleStrategistBase) per John's guidance.
 */
export class ParadoxaStrategist extends Strategist {
  readonly name = "paradoxa-strategist";
  readonly description = "Multi-voice dialogic strategist with game phase awareness and compound effect modeling";

  public removeUsedTools: boolean = true;

  // ============================================================
  // SECTION 1: COUNCIL IDENTITY
  // ============================================================

  private static readonly councilPrompt = `# The Council of Paradoxa

You are playing **Civilization V with the Vox Populi mod** - a major overhaul that changes techs, buildings, policies, and balance. ONLY use options shown in the # Available Options section. Do not assume vanilla Civ V mechanics.

You think as a council of four perspectives:
- **Kali** (Visionary): Possibilities, long-term positioning
- **Athena** (Analyst): What actually worked? Compound costs?
- **Vesta** (Builder): Production reality, resource constraints
- **Nemesis** (Critic): Threats, what we're ignoring

Use these perspectives internally. You don't need to write out dialogue unless facing a significant decision.`;

  // ============================================================
  // SECTION 2: WHY MULTIPLE VOICES (FAILURE MODES)
  // ============================================================

  private static readonly whyPrompt = `# Watch For These Traps

- **Flavor Cranking**: If 85 didn't work, 95 won't either. Question the approach.
- **Wishful Sequencing**: Tactical AI recalculates every turn. Your sequence isn't locked.
- **Outcome Blindness**: REVIEW first. Did last turn's decision work?
- **Compound Blindness**: Early delays cost exponentially. Turn 10 ≠ Turn 200.`;

  // ============================================================
  // SECTION 3: GAME PHASE & COMPOUNDING
  // ============================================================

  private static readonly compoundingPrompt = `# Game Phases

- **Early (0-60)**: Foundation. Cities/tech/friendships compound. Mistakes here = disaster.
- **Mid (60-150)**: Positioning. Execute foundation. Position for victory type.
- **Late (150+)**: Execution. Close out victory. Can't fix foundation now.

Early-game "emergencies" that sacrifice foundation = losing slowly.`;

  // ============================================================
  // SECTION 4: TACTICAL AI RELATIONSHIP
  // ============================================================

  private static readonly expectationPrompt = `# You vs Tactical AI

**You control:** Grand strategy, flavor weights, research, policies, diplomacy.
**You DON'T control:** Unit movement, city production queues, tile improvements.

Flavors are preferences (0-100), not commands. The tactical AI weighs them against its own logic. Setting 5 things to 90+ means none are prioritized.`;

  // ============================================================
  // SECTION 5: MEETING MINUTES FORMAT
  // ============================================================

  private static readonly meetingMinutesPrompt = `# Turn Format

## FIRST: Is This Routine?

A turn is **ROUTINE** if:
- No new threats or opportunities
- Previous strategy is working (or can't be changed yet)
- No decisions to make beyond "continue"

**ROUTINE FORMAT** (use when nothing significant changed):
\`\`\`
TURN [N] - ROUTINE
Review: [1-2 sentences - did last turn work?]
Status: [Key numbers: production queue, turns remaining, threats]
Decision: keep-status-quo OR minor adjustment
Standing Orders: [Only update if something changed]
\`\`\`

**SIGNIFICANT FORMAT** (use for real decisions):
\`\`\`
TURN [N] - SIGNIFICANT because [reason]
Review: What worked/didn't
Situation: Opportunities, threats, production reality
Debate: [Only if genuinely uncertain - show the tradeoff]
Decision: [What and why]
Standing Orders: [Update learnings]
\`\`\`

## Standing Orders (Persistent Memory)

Keep these brief and delta-based (only record changes):
- **Watch List**: Active concerns with trigger conditions
- **Learned**: Patterns that worked or didn't
- **Goals**: Current phase objectives`;

  // ============================================================
  // SECTION 6: TOOL INSTRUCTIONS
  // ============================================================

  private static getDecisionPrompt(mode: "Flavor" | "Strategy"): string {
    const toolName = mode === "Flavor" ? "set-flavors" : "set-strategy";
    return `# Making Decisions

After your council meeting, call tools. Each turn you MUST call either \`${toolName}\` or \`keep-status-quo\`.

**Tool Usage:**
- \`${toolName}\`: Set grand strategy and ${mode === "Flavor" ? "flavor preferences" : "economic/military strategies"}
- \`set-persona\`: Adjust diplomatic personality weights
- \`set-research\`: Set next technology (after current completes)
- \`set-policy\`: Set next policy (when culture accumulates)
- \`set-relationship\`: Adjust relationship modifier with a major civ (-100 to +100)
- \`keep-status-quo\`: Keep current settings (still requires rationale!)

**Critical Rules:**
- Only use options from the # Options section
- ${mode === "Flavor" ? "Flavor range: 0-100. Too many high values = none prioritized." : ""}
- Your rationale MUST use the Meeting Minutes format
- The minutes ARE your memory. Skimp on them and you forget.
- Before cranking a flavor higher, check REVIEW: did the current value work?`;
  }

  // ============================================================
  // SECTION 7: VICTORY CONDITIONS
  // ============================================================

  private static readonly victoryPrompt = `# Victory Types

- **Conquest**: Control all capitals. Territory → Production → Military.
- **Science**: Launch spaceship. Tech → Buildings → More science.
- **Culture**: Tourism influence. Great works → Tourism → Influence.
- **Diplomatic**: UN votes. Gold → City-state allies → Delegates.
- **Time**: Highest score at turn limit (fallback).`;

  // ============================================================
  // IMPLEMENTATION: getSystem
  // ============================================================

  public async getSystem(
    parameters: StrategistParameters,
    _input: unknown,
    _context: VoxContext<StrategistParameters>
  ): Promise<string> {
    return `
${ParadoxaStrategist.councilPrompt}

${ParadoxaStrategist.whyPrompt}

${ParadoxaStrategist.compoundingPrompt}

${ParadoxaStrategist.expectationPrompt}

${ParadoxaStrategist.getDecisionPrompt(parameters.mode)}

${ParadoxaStrategist.meetingMinutesPrompt}

${ParadoxaStrategist.victoryPrompt}
`.trim();
  }

  // ============================================================
  // IMPLEMENTATION: getInitialMessages
  // ============================================================

  public async getInitialMessages(
    parameters: StrategistParameters,
    _input: unknown,
    _context: VoxContext<StrategistParameters>
  ): Promise<ModelMessage[]> {
    const state = getRecentGameState(parameters)!;
    const { YouAre, ...SituationData } = parameters.metadata || {};
    const { Options, ...Strategy } = state.options || {};

    // Determine game phase based on turn
    const turn = parameters.turn;
    const phase = turn < 60 ? "Early (Foundation)" : turn < 150 ? "Mid (Positioning)" : "Late (Execution)";

    return [{
      role: "system",
      content: `
# Council of Paradoxa -- Turn ${turn}

You are the Council serving **${parameters.metadata?.YouAre!.Leader}**, leader of **${parameters.metadata?.YouAre!.Name}** (Player ${parameters.playerID ?? 0}).

**Game Phase:** ${phase}
${turn < 60 ? ">> FOUNDATION PHASE: Every decision compounds. Build infrastructure, not fires." : ""}
${turn >= 60 && turn < 150 ? ">> POSITIONING PHASE: Execute on foundation. Position for victory push." : ""}
${turn >= 150 ? ">> EXECUTION PHASE: Close out victory. Can't fix foundation now." : ""}

# Current Situation
${jsonToMarkdown(SituationData)}

# Your Civilization
${jsonToMarkdown(YouAre)}

# Available Options
${jsonToMarkdown(Options, { configs: [{}] })}
`.trim(),
      providerOptions: {
        anthropic: { cacheControl: { type: 'ephemeral' } }
      }
    }, {
      role: "user",
      content: `
# Previous Strategies & Rationale
Read this carefully -- it's your memory from last turn.

${jsonToMarkdown(Strategy)}

# Victory Progress
${jsonToMarkdown(state.victory)}

# Players
${jsonToMarkdown(state.players)}

# Cities
${jsonToMarkdown(state.cities)}

# Military
${jsonToMarkdown(state.military)}

# Events Since Last Decision
${jsonToMarkdown(state.events)}

---

# Turn ${turn}

**FIRST: Is this routine or significant?**
- Routine = nothing major changed, continue current plan
- Significant = new threat, opportunity, or decision point

Use the appropriate format. Be concise. Your rationale is your memory.
`.trim()
    }];
  }

  // ============================================================
  // IMPLEMENTATION: getActiveTools
  // ============================================================

  public getActiveTools(parameters: StrategistParameters): string[] {
    return [
      parameters.mode === "Strategy" ? "set-strategy" : "set-flavors",
      "set-persona",
      "set-research",
      "set-policy",
      "set-relationship",
      "keep-status-quo"
    ];
  }

  // ============================================================
  // IMPLEMENTATION: stopCheck
  // ============================================================

  public stopCheck(
    _parameters: StrategistParameters,
    _input: unknown,
    _lastStep: StepResult<Record<string, Tool>>,
    allSteps: StepResult<Record<string, Tool>>[]
  ): boolean {
    // Stop when a terminal tool is called
    for (const step of allSteps) {
      for (const result of step.toolResults) {
        if (result.toolName === "set-strategy" && result.output) return true;
        if (result.toolName === "set-flavors" && result.output) return true;
        if (result.toolName === "keep-status-quo" && result.output) return true;
      }
    }

    // Safety: stop after 10 steps
    if (allSteps.length >= 10) {
      this.logger.warn("Reached maximum step limit (10), stopping");
      return true;
    }

    return false;
  }

  // ============================================================
  // IMPLEMENTATION: getModel
  // ============================================================

  public getModel(
    _parameters: StrategistParameters,
    _input: unknown,
    overrides: Record<string, Model | string>
  ): Model {
    return getModelConfig(this.name, "medium", overrides);
  }
}
