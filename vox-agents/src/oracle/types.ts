/**
 * @module oracle/types
 *
 * Type definitions for the Oracle agent prompt replay system.
 * Oracle replays past agent turns with modified prompts through the same (or different) LLM,
 * capturing results for comparative analysis without touching the game or MCP.
 */

import type { ModelMessage, StepResult, Tool } from 'ai';
import type { AgentParameters } from '../infra/vox-agent.js';
import type { ExecuteTokenOutput } from '../infra/vox-context.js';
import type { Model } from '../types/index.js';

/** A single tool call decision from a replay */
export interface ReplayDecision {
  toolName: string;
  args: any;
  /** Rationale extracted from the tool's Rationale arg (strategist decision tools only) */
  rationale?: string;
}

/** A row from the input CSV file */
export interface OracleRow {
  game_id: string;
  player_id: string;
  turn: string;
  player_type: string;
  rationale: string;
  /** Any additional columns from the CSV */
  [key: string]: string;
}

/** Context provided to the modifyPrompt callback */
export interface OriginalPromptContext {
  /** The CSV row being processed */
  row: OracleRow;
  /** Original system prompt from telemetry */
  system: string;
  /** Original non-system messages from telemetry */
  messages: ModelMessage[];
  /** Tool names available during the original turn */
  activeTools: string[];
  /** Original model string from telemetry (e.g. 'openai-compatible/Kimi-K2.5@Medium') */
  originalModel: string;
  /** Original LLM response */
  originalResponse: { text: string; toolCalls: { toolName: string; args: any }[] };
  /** Agent name from telemetry (e.g. 'simple-strategist') */
  agentName: string;
}

/** Return type from the modifyPrompt callback. All fields optional -- undefined keeps original. */
export interface ModifiedPrompt {
  /** Override system prompt */
  system?: string;
  /** Override conversation messages */
  messages?: ModelMessage[];
  /** Override active tools */
  activeTools?: string[];
  /** Arbitrary metadata stored in the trail */
  metadata?: Record<string, any>;
}

/** Configuration for an Oracle experiment */
export interface OracleConfig {
  /** Input CSV path (relative or absolute) */
  csvPath: string;
  /** Names the output DB and files */
  experimentName: string;
  /** Callback to modify the original prompt before replay */
  modifyPrompt: (ctx: OriginalPromptContext) => ModifiedPrompt | Promise<ModifiedPrompt>;
  /** Override model per-row. Undefined = keep original. */
  modelOverride?: (originalModel: string, row: OracleRow) => string | Model | undefined;
  /** Output directory. Default: 'temp/oracle' (relative or absolute) */
  outputDir?: string;
  /** Telemetry directory. Default: 'telemetry' (relative or absolute) */
  telemetryDir?: string;
  /** Target agent name. Default: auto-detect strategist */
  targetAgent?: string;
  /** The type of agent being replayed (e.g. 'strategist', 'spokesperson'). Determines stop behavior. */
  agentType?: string;
  /** Max parallel row executions. Default: 5 */
  concurrency?: number;
}

/** Parameters passed to OracleAgent per execution */
export interface OracleParameters extends AgentParameters {
  /** Tool names from the original span */
  activeTools: string[];
  /** Model to use (original or overridden) */
  resolvedModel: Model;
  /** Agent type being replayed -- controls stop behavior */
  agentType?: string;
  /** Set by stopCheck, read by getOutput to collect all steps */
  capturedSteps: StepResult<Record<string, Tool>>[];
}

/** Input to each oracle execution */
export interface OracleInput {
  /** Modified system prompt */
  system: string;
  /** Modified non-system messages */
  messages: ModelMessage[];
  /** CSV row for context */
  row: OracleRow;
  /** Original response for comparison */
  originalResponse: { text: string; toolCalls: { toolName: string; args: any }[] };
  /** Arbitrary metadata from the modifyPrompt callback */
  metadata?: Record<string, any>;
}

/** Result of a single replay */
export interface ReplayResult {
  /** The CSV row that was replayed */
  row: OracleRow;
  /** Model used for replay */
  model: string;
  /** Tool call decisions from the LLM (with extracted rationale for strategist tools) */
  decisions: ReplayDecision[];
  /** Token usage */
  tokens: ExecuteTokenOutput;
  /** Raw LLM response messages for analysis */
  messages: ModelMessage[];
  /** Error message if the replay failed */
  error?: string;
  /** Metadata from the callback */
  metadata?: Record<string, any>;
}

/** Data extracted from a telemetry span for a single turn */
export interface ExtractedPrompt {
  /** System prompt */
  system: string;
  /** Non-system messages */
  messages: ModelMessage[];
  /** Tool names from step.tools */
  activeTools: string[];
  /** Original model string from span attributes */
  modelString: string;
  /** Original response */
  originalResponse: { text: string; toolCalls: { toolName: string; args: any }[] };
  /** Agent name (e.g. 'simple-strategist') */
  agentName: string;
}
