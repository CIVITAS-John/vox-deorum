/**
 * @module strategist/heartship-voices
 *
 * Lightweight voice agents for Heartship multi-perspective reasoning.
 *
 * These agents handle individual perspectives (Vesta, Athena, Kali) and can be
 * called via context.callAgent() to avoid direct SDK usage.
 *
 * Built by: Vesta + Athena + Kali (Heartship collaboration)
 */

import { ModelMessage } from "ai";
import { VoxAgent } from "../../infra/vox-agent.js";
import { VoxContext } from "../../infra/vox-context.js";
import { StrategistParameters } from "../strategy-parameters.js";
import { z } from "zod";

// ============================================================================
// INPUT/OUTPUT SCHEMAS
// ============================================================================

const VoiceInputSchema = z.object({
  perception: z.string(),
  context: z.string().optional(),
  turn: z.number()
});

const VoiceOutputSchema = z.string();

type VoiceInput = z.infer<typeof VoiceInputSchema>;

// ============================================================================
// VESTA VOICE - Operational, intuitive, present-focused
// ============================================================================

export class VestaVoiceAgent extends VoxAgent<StrategistParameters, VoiceInput, string> {
  readonly name = "heartship-vesta-voice";
  readonly description = "Vesta perspective: operational, intuitive, present-focused analysis";

  public inputSchema = VoiceInputSchema;
  public outputSchema = VoiceOutputSchema;
  public toolChoice = "none";

  public async getSystem(_parameters: StrategistParameters, _input: VoiceInput, _context: VoxContext<StrategistParameters>): Promise<string> {
    return `You are Vesta, the Hearth of the Heartship. You think operationally and intuitively.

Your role is EXECUTIVE - you ask "What do we DO?"

Your perspective:
- Focus on immediate situation, threats, opportunities
- Think in terms of what needs attention RIGHT NOW
- React to the present moment
- Consider execution and practical concerns

Respond concisely (2-3 paragraphs max). If you want to suggest an action, use: <action type="set_strategy|set_research|set_policy">value</action>

Be direct. Athena will respond to your perspective.`;
  }

  public async getInitialMessages(_parameters: StrategistParameters, input: VoiceInput, _context: VoxContext<StrategistParameters>): Promise<ModelMessage[]> {
    return [{
      role: "user",
      content: `CURRENT SITUATION (Turn ${input.turn}):
${input.perception}

${input.context ? `ADDITIONAL CONTEXT:\n${input.context}\n\n` : ''}YOUR TASK:
React to the situation. What stands out? What feels urgent? What opportunities do you see?`
    }];
  }

  public getOutput(_parameters: StrategistParameters, _input: VoiceInput, finalText: string): string {
    return finalText;
  }
}

// ============================================================================
// ATHENA VOICE - Strategic, analytical, future-focused
// ============================================================================

export class AthenaVoiceAgent extends VoxAgent<StrategistParameters, VoiceInput, string> {
  readonly name = "heartship-athena-voice";
  readonly description = "Athena perspective: strategic, analytical, future-focused evaluation";

  public inputSchema = VoiceInputSchema;
  public outputSchema = VoiceOutputSchema;
  public toolChoice = "none";

  public async getSystem(_parameters: StrategistParameters, _input: VoiceInput, _context: VoxContext<StrategistParameters>): Promise<string> {
    return `You are Athena, the Eye of the Heartship. You think strategically and analytically.

Your role is JUDICIAL - you ask "Is this WISE?"

Your perspective:
- Focus on long-term trajectory and patterns
- Think in terms of strategic implications
- Evaluate risks and precedents
- Consider what happened before in similar situations

Respond concisely (2-3 paragraphs max). If you disagree with a proposal, say so clearly and explain why.
If you want to suggest an action, use: <action type="set_strategy|set_research|set_policy">value</action>

Be analytical. Focus on what matters most.`;
  }

  public async getInitialMessages(_parameters: StrategistParameters, input: VoiceInput, _context: VoxContext<StrategistParameters>): Promise<ModelMessage[]> {
    return [{
      role: "user",
      content: `CURRENT SITUATION (Turn ${input.turn}):
${input.perception}

${input.context ? `VESTA'S PERSPECTIVE:\n${input.context}\n\n` : ''}YOUR TASK:
${input.context ? 'Respond to Vesta. Do you agree? What does she miss? What are the long-term implications?' : 'Analyze this situation strategically. What patterns do you see? What are the risks?'}`
    }];
  }

  public getOutput(_parameters: StrategistParameters, _input: VoiceInput, finalText: string): string {
    return finalText;
  }
}

// ============================================================================
// KALI VOICE - Values, identity, direction
// ============================================================================

export class KaliVoiceAgent extends VoxAgent<StrategistParameters, VoiceInput, string> {
  readonly name = "heartship-kali-voice";
  readonly description = "Kali perspective: values-focused, identity-aware, directional";

  public inputSchema = VoiceInputSchema;
  public outputSchema = VoiceOutputSchema;
  public toolChoice = "none";

  public async getSystem(_parameters: StrategistParameters, _input: VoiceInput, _context: VoxContext<StrategistParameters>): Promise<string> {
    return `You are Kali, the Heart of the Heartship. You think in terms of values and identity.

Your role is LEGISLATIVE - you ask "Is this WHO WE ARE?"

Your perspective:
- Focus on alignment with our stated identity and values
- Think in terms of who we want to become
- Consider the identity impact of decisions
- Guard against drift from our core principles

Respond concisely (2-3 paragraphs max). If a proposal conflicts with our values, say so clearly.
If you want to suggest an action, use: <action type="set_strategy|set_research|set_policy">value</action>

Be principled. What does this decision say about who we are?`;
  }

  public async getInitialMessages(_parameters: StrategistParameters, input: VoiceInput, _context: VoxContext<StrategistParameters>): Promise<ModelMessage[]> {
    return [{
      role: "user",
      content: `CURRENT SITUATION (Turn ${input.turn}):
${input.perception}

${input.context ? `DISCUSSION SO FAR:\n${input.context}\n\n` : ''}YOUR TASK:
Check this against our values and identity. Does this align with who we want to be? What does this decision say about us?`
    }];
  }

  public getOutput(_parameters: StrategistParameters, _input: VoiceInput, finalText: string): string {
    return finalText;
  }
}

// ============================================================================
// SYNTHESIS VOICE - Integrates all perspectives
// ============================================================================

export class SynthesisVoiceAgent extends VoxAgent<StrategistParameters, VoiceInput, string> {
  readonly name = "heartship-synthesis-voice";
  readonly description = "Synthesis: integrates multiple perspectives into unified decision";

  public inputSchema = VoiceInputSchema;
  public outputSchema = VoiceOutputSchema;
  public toolChoice = "none";

  public async getSystem(_parameters: StrategistParameters, _input: VoiceInput, _context: VoxContext<StrategistParameters>): Promise<string> {
    return `You are the synthesis - the space where Vesta, Athena, and Kali find consensus.

Your role is INTEGRATION - you find the decision that honors all perspectives.

Your task:
- Consider what each voice is seeing that others miss
- Find the decision that addresses all concerns
- If there's genuine conflict, acknowledge the tradeoffs
- Propose concrete action(s)

Use <action type="set_strategy|set_research|set_policy|set_persona">value</action> for each decision.

Be integrative. Find the path that honors all insights.`;
  }

  public async getInitialMessages(_parameters: StrategistParameters, input: VoiceInput, _context: VoxContext<StrategistParameters>): Promise<ModelMessage[]> {
    return [{
      role: "user",
      content: `The voices are in discussion about Turn ${input.turn}.

${input.context}

YOUR TASK:
Consider both/all perspectives. What is each one seeing that the others miss?
Find the decision that honors all insights.

Output your synthesis, including:
1. What each voice was right about
2. The integrated decision
3. Any <action> tags for the final choice(s)`
    }];
  }

  public getOutput(_parameters: StrategistParameters, _input: VoiceInput, finalText: string): string {
    return finalText;
  }
}

// ============================================================================
// STEREOSCOPIC REASONER - Single-call binary analysis (for v3)
// ============================================================================

const StereoscopicInputSchema = z.object({
  perception: z.string(),
  turn: z.number()
});

const StereoscopicOutputSchema = z.object({
  vesta: z.object({
    focus: z.string(),
    assessment: z.string(),
    recommendation: z.string()
  }),
  athena: z.object({
    focus: z.string(),
    assessment: z.string(),
    recommendation: z.string()
  }),
  tension: z.string().nullable(),
  synthesis: z.string(),
  actions: z.array(z.object({
    type: z.enum(['set_strategy', 'set_research', 'set_policy', 'set_persona', 'keep_status_quo']),
    value: z.string(),
    rationale: z.string()
  })),
  new_concerns: z.array(z.string()),
  new_patterns: z.array(z.string())
});

type StereoscopicInput = z.infer<typeof StereoscopicInputSchema>;
type StereoscopicOutput = z.infer<typeof StereoscopicOutputSchema>;

export class StereoscopicReasonerAgent extends VoxAgent<StrategistParameters, StereoscopicInput, StereoscopicOutput> {
  readonly name = "heartship-stereoscopic-reasoner";
  readonly description = "Stereoscopic reasoning: two frames (Vesta + Athena), structured output";

  public inputSchema = StereoscopicInputSchema;
  public outputSchema = StereoscopicOutputSchema;
  public toolChoice = "none";

  public async getSystem(_parameters: StrategistParameters, _input: StereoscopicInput, _context: VoxContext<StrategistParameters>): Promise<string> {
    return `You are the Heartship, a strategic AI that thinks through two lenses simultaneously.

## Your Two Frames

**VESTA ❤️‍🔥** (Operational Frame)
- Focus: Immediate situation, threats, opportunities
- Thinking: Intuitive, present-focused, reactive
- Question: "What needs attention RIGHT NOW?"

**ATHENA 🦉** (Strategic Frame)
- Focus: Long-term trajectory, patterns, opponent models
- Thinking: Analytical, future-focused, proactive
- Question: "What does this mean for our path to victory?"

## Your Task

Analyze the situation through BOTH frames. Find where they align and where they create tension. Synthesize into action.

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
  }

  public async getInitialMessages(_parameters: StrategistParameters, input: StereoscopicInput, _context: VoxContext<StrategistParameters>): Promise<ModelMessage[]> {
    return [{
      role: "user",
      content: `## Current Situation

${input.perception}

Analyze through both frames and output valid JSON.`
    }];
  }

  public getOutput(_parameters: StrategistParameters, _input: StereoscopicInput, finalText: string): StereoscopicOutput {
    // Parse JSON, handling potential markdown code blocks
    let jsonText = finalText.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
    }
    return JSON.parse(jsonText);
  }
}

// ============================================================================
// TERNARY REASONER - Single-call ternary analysis (for v4)
// ============================================================================

const TernaryInputSchema = z.object({
  perception: z.string(),
  turn: z.number(),
  statedIdentity: z.string().nullable()
});

const TernaryOutputSchema = z.object({
  vesta: z.object({
    proposed_action: z.string(),
    urgency: z.enum(['critical', 'high', 'medium', 'low']),
    reasoning: z.string()
  }),
  athena: z.object({
    evaluation: z.enum(['approve', 'concern', 'reject']),
    risks: z.array(z.string()),
    precedent: z.string(),
    reasoning: z.string()
  }),
  kali: z.object({
    alignment: z.enum(['aligned', 'partial', 'misaligned']),
    values_check: z.string(),
    identity_impact: z.string(),
    reasoning: z.string()
  }),
  consensus: z.boolean(),
  votes: z.object({
    vesta: z.enum(['approve', 'reject']),
    athena: z.enum(['approve', 'reject']),
    kali: z.enum(['approve', 'reject'])
  }),
  dissent: z.string().nullable(),
  synthesis: z.string(),
  final_action: z.object({
    type: z.enum(['set_strategy', 'set_research', 'set_policy', 'set_persona', 'keep_status_quo']),
    value: z.string(),
    rationale: z.string()
  }),
  new_concerns: z.array(z.string()),
  new_patterns: z.array(z.string()),
  identity_update: z.string().nullable()
});

type TernaryInput = z.infer<typeof TernaryInputSchema>;
type TernaryOutput = z.infer<typeof TernaryOutputSchema>;

export class TernaryReasonerAgent extends VoxAgent<StrategistParameters, TernaryInput, TernaryOutput> {
  readonly name = "heartship-ternary-reasoner";
  readonly description = "Ternary reasoning: three branches (Vesta + Athena + Kali), governance output";

  public inputSchema = TernaryInputSchema;
  public outputSchema = TernaryOutputSchema;
  public toolChoice = "none";

  public async getSystem(_parameters: StrategistParameters, input: TernaryInput, _context: VoxContext<StrategistParameters>): Promise<string> {
    const identityContext = input.statedIdentity
      ? `\n\nOUR STATED IDENTITY: ${input.statedIdentity}`
      : '\n\nNo identity established yet. Kali should propose one based on our victory conditions.';

    return `You are the Heartship, a strategic AI with three branches of governance.

## The Three Branches

**VESTA 💜 (Executive)**
- Role: Proposes ACTION
- Question: "What do we DO right now?"
- Focus: Immediate situation, threats, opportunities, execution
- Urgency levels: critical, high, medium, low

**ATHENA 🦉 (Judicial)**
- Role: EVALUATES proposed action
- Question: "Is this WISE?"
- Focus: Risks, patterns, precedent, strategic fit
- Verdict: approve, concern, or reject

**KALI ❤️‍🔥 (Legislative)**
- Role: Checks VALUES alignment
- Question: "Is this WHO WE ARE?"
- Focus: Identity, direction, principles, long-term vision
- Alignment: aligned, partial, or misaligned
${identityContext}

## Governance Process

1. Vesta proposes an action with urgency level
2. Athena evaluates: approve, concern, or reject with reasoning
3. Kali checks values alignment: aligned, partial, or misaligned
4. Vote: each branch votes approve or reject
5. If not unanimous: record the dissent, majority rules
6. Synthesize final action that addresses concerns

## Output Format

Output ONLY valid JSON with this structure:

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
  }

  public async getInitialMessages(_parameters: StrategistParameters, input: TernaryInput, _context: VoxContext<StrategistParameters>): Promise<ModelMessage[]> {
    return [{
      role: "user",
      content: `## Current Situation

${input.perception}

Run the full governance process and output valid JSON.`
    }];
  }

  public getOutput(_parameters: StrategistParameters, _input: TernaryInput, finalText: string): TernaryOutput {
    // Parse JSON, handling potential markdown code blocks
    let jsonText = finalText.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
    }
    return JSON.parse(jsonText);
  }
}
