/**
 * @module analyst/diplomatic-analyst
 *
 * Diplomatic analyst agent that processes raw diplomatic reports from the Diplomat.
 * Assesses information reliability, categorizes messages, and relays assessed intelligence
 * to the leader via the relay-message MCP tool. Runs asynchronously (fire-and-forget).
 */

import { z } from "zod";
import { ModelMessage } from "ai";
import { Analyst } from "./analyst.js";
import { VoxContext } from "../infra/vox-context.js";
import { StrategistParameters } from "../strategist/strategy-parameters.js";

/** Input type for the DiplomaticAnalyst, provided by the Diplomat via the call-diplomatic-analyst tool */
export interface DiplomaticAnalystInput {
  /** Raw report from the diplomatic interaction */
  Report: string;
  /** The player ID this report concerns */
  AboutPlayerID: number;
  /** Brief context about the interaction (who the diplomat spoke with, circumstances) */
  Context: string;
}

/**
 * Diplomatic analyst that processes reports from field diplomats and relays
 * assessed intelligence to the leader. Runs as a fire-and-forget agent-tool,
 * detached from the caller's trace context.
 *
 * @class
 */
export class DiplomaticAnalyst extends Analyst<DiplomaticAnalystInput> {
  /**
   * The name identifier for this agent
   */
  readonly name = "diplomatic-analyst";

  /**
   * Human-readable description of what this agent does
   */
  readonly description = "An intelligence analyst who processes diplomatic reports, assesses reliability, and relays information to the leader";

  /**
   * Tags for categorizing this agent
   */
  public override tags = ["active-game", "analyst", "diplomatic"];

  /**
   * Tool description shown to agents that can invoke this analyst
   */
  public override toolDescription = "Report information to the intelligence analyst for assessment and relay to the leader. Returns immediately.";

  /**
   * Input schema for the call-diplomatic-analyst tool
   */
  public override inputSchema = z.object({
    Report: z.string().describe("Raw report from the diplomatic interaction"),
    AboutPlayerID: z.number().describe("The player ID this report concerns"),
    Context: z.string().describe("Brief context: who you spoke with and circumstances")
  });

  /**
   * Restricts the analyst to only the relay-message MCP tool
   */
  public override getActiveTools(_parameters: StrategistParameters): string[] | undefined {
    return ["relay-message"];
  }

  /**
   * Gets the system prompt defining the analyst's role
   */
  public async getSystem(
    _parameters: StrategistParameters,
    _input: DiplomaticAnalystInput,
    _context: VoxContext<StrategistParameters>
  ): Promise<string> {
    return `
You are an intelligence analyst serving your civilization's leader.
You receive raw diplomatic reports from field diplomats and process them into formal, assessed intelligence.

# Your Role
- Analyze the diplomat's raw report and extract key information
- Assess the confidence level (0-9) based on source reliability:
  - 8-9: Direct, verifiable statements from a foreign leader
  - 5-7: Information from trusted official channels or credible sources
  - 3-4: Secondhand information, citizen accounts, or plausible but unverified claims
  - 0-2: Rumors, gossip, or information from sources with reason to deceive
- Categorize the message type:
  - "diplomatic": Official communications, proposals, declarations, threats, or agreements
  - "intelligence": Gathered information, observations, rumors, or insights
- Assign searchable categories (e.g., "military", "trade", "espionage", "territorial", "alliance", "culture", "religion", "science")
- Write a concise Memo that includes your assessment and the diplomat's reaction to the situation

# Instructions
1. Read the diplomat's report carefully
2. Determine the appropriate Type, Confidence, and Categories
3. Call the \`relay-message\` tool with your assessed information
4. The Message field should contain a clear, concise summary of the key information
5. The Memo field should contain your professional assessment and the diplomat's observed reaction`.trim();
  }

  /**
   * Provides the diplomat's report as initial context
   */
  public async getInitialMessages(
    parameters: StrategistParameters,
    input: DiplomaticAnalystInput,
    _context: VoxContext<StrategistParameters>
  ): Promise<ModelMessage[]> {
    return [{
      role: "user",
      content: `
# Diplomatic Report

**About Player ID:** ${input.AboutPlayerID}
**Our Player ID:** ${parameters.playerID}
**Context:** ${input.Context}

## Raw Report
${input.Report}

Process this report and relay the assessed information to the leader using the relay-message tool.`.trim()
    }];
  }
}
