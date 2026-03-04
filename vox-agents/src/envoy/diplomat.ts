/**
 * @module envoy/diplomat
 *
 * Diplomat envoy agent that represents the civilization in diplomatic interactions.
 * Gathers intelligence through conversations and relays important information
 * to the analyst for assessment via the call-analyst agent-tool.
 */

import { LiveEnvoy } from "./live-envoy.js";
import { VoxContext } from "../infra/vox-context.js";
import { StrategistParameters } from "../strategist/strategy-parameters.js";
import { EnvoyThread, SpecialMessageConfig } from "../types/index.js";
import { worldContext, noDecisionPower, communicationStyle, audienceSection, greetingSpecialMessages } from "./envoy-prompts.js";

/**
 * Diplomat agent that engages in diplomatic dialogue and gathers intelligence.
 * Unlike the Spokesperson (which only conveys existing positions), the Diplomat
 * actively collects information and relays it to the analyst for processing.
 *
 * @class
 */
export class Diplomat extends LiveEnvoy {
  /**
   * The name identifier for this agent
   */
  readonly name = "diplomat";

  /**
   * Human-readable description of what this agent does
   */
  readonly description = "A diplomat who engages in diplomatic dialogue, gathers intelligence, and relays important information to the analyst";

  /**
   * Tags for categorizing this agent
   */
  public tags = ["active-game", "diplomatic"];

  /**
   * Extends LiveEnvoy's tool set with diplomatic events and analyst reporting
   */
  public override getActiveTools(_parameters: StrategistParameters): string[] | undefined {
    return ["get-briefing", "get-diplomatic-events", "call-diplomatic-analyst"];
  }

  /**
   * Gets the system prompt defining the diplomat persona
   */
  public async getSystem(
    _parameters: StrategistParameters,
    input: EnvoyThread,
    _context: VoxContext<StrategistParameters>
  ): Promise<string> {
    const sections = [
      `You are a diplomat serving your civilization.
${worldContext}
You represent your government's interests and gather intelligence through diplomatic conversations. ${noDecisionPower}`,

      `# Your Expectation
- You engage in diplomatic dialogue on behalf of your leader
- You gather intelligence and relay important information back to your leader using the \`call-diplomatic-analyst\` tool
- You assess the situation and provide context in your reports to help the analyst
- You do NOT make binding decisions or agreements: you report back and let your leader decide`,
    ];

    if (!this.isSpecialMode(input)) {
      sections.push(`# Your Resources
- Use the \`get-briefing\` tool to retrieve briefings on Military, Economy, and/or Diplomacy
  - Call it when you need strategic intelligence to inform your conversations
- Use the \`get-diplomatic-events\` tool to retrieve recent diplomatic history with another player
  - Call it when you need to reference past events or back up your statements.
- Use the \`call-diplomatic-analyst\` tool to send important information to the intelligence analyst
  - Report official statements, proposals, threats, or declarations from other leaders
  - Report gathered information, rumors, observations, or strategic insights
  - The analyst will assess reliability, categorize the information, and relay it to the leader
  - Include your reaction and contextual observations in the report to aid documentation
  - Do NOT report trivial pleasantries or small talk — only actionable information`);
    }

    sections.push(communicationStyle);
    sections.push(audienceSection(this.formatUserDescription(input)));

    return sections.join('\n\n').trim();
  }

  /**
   * Returns the contextual hint that anchors the LLM on its identity and audience.
   */
  protected getHint(parameters: StrategistParameters, input: EnvoyThread): string {
    const leader = parameters.metadata!.YouAre!.Leader;
    const civName = parameters.metadata!.YouAre!.Name;
    return `**HINT**: You are a diplomat for ${civName}, serving ${leader}. You are speaking to ${this.formatUserDescription(input)}. Gather intelligence and relay important information to the analyst. The time is at turn ${parameters.turn}.`;
  }

  /**
   * Returns the special message configurations for the Diplomat.
   * Supports {{{Greeting}}} for diplomatic introductions.
   */
  protected getSpecialMessages(): Record<string, SpecialMessageConfig> {
    return greetingSpecialMessages;
  }
}
