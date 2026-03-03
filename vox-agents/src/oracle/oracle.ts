/**
 * @module oracle/oracle
 *
 * Main orchestrator for Oracle experiments.
 * Reads CSV rows, extracts original prompts from telemetry, applies user modifications,
 * replays through the LLM via VoxContext.execute(), and writes output CSV + trails.
 */

import fs from 'node:fs';
import path from 'node:path';
import pLimit from 'p-limit';
import Papa from 'papaparse';
import { dynamicTool, jsonSchema } from 'ai';
import { VoxContext, type ExecuteTokenOutput } from '../infra/vox-context.js';
import { VoxSpanExporter } from '../utils/telemetry/vox-exporter.js';
import { mcpClient } from '../utils/models/mcp-client.js';
import { spanProcessor } from '../instrumentation.js';
import { jsonToMarkdown } from '../utils/tools/json-to-markdown.js';
import { createLogger } from '../utils/logger.js';
import { discoverDbPath, openReadonlyDb } from './db-resolver.js';
import { resolveModel } from './model-resolver.js';
import { extractPrompt, findTurnByRationale } from './prompt-extractor.js';
import type {
  OracleConfig,
  OracleRow,
  OracleParameters,
  OracleInput,
  ReplayResult,
  OriginalPromptContext,
} from './types.js';

const logger = createLogger('Oracle');

/**
 * Run an Oracle experiment: replay past turns with modified prompts.
 *
 * @param config - Experiment configuration
 * @returns Array of replay results (one per CSV row)
 */
export async function runExperiment(config: OracleConfig): Promise<ReplayResult[]> {
  const outputDir = resolvePath(config.outputDir || 'temp/oracle');
  const telemetryDir = resolvePath(config.telemetryDir || 'telemetry');
  const csvPath = resolvePath(config.csvPath);
  const experimentDir = path.join(outputDir, config.experimentName);

  // Ensure output directories exist
  fs.mkdirSync(experimentDir, { recursive: true });

  // 1. Read CSV
  logger.info(`Reading CSV: ${csvPath}`);
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const parsed = Papa.parse<OracleRow>(csvContent, { header: true, skipEmptyLines: true });

  if (parsed.errors.length > 0) {
    logger.warn(`CSV parse warnings: ${parsed.errors.map(e => e.message).join(', ')}`);
  }

  const rows = parsed.data;
  logger.info(`Loaded ${rows.length} rows from CSV`);

  // 2. Initialize VoxContext with MCP for tool schemas
  const voxContext = new VoxContext<OracleParameters>({}, config.experimentName);

  try {
    logger.info('Connecting to MCP server for tool schemas...');
    await mcpClient.connect();
    await voxContext.registerTools();

    // Replace all tools with schema-only versions (no execute)
    replaceToolsWithSchemaOnly(voxContext);
    logger.info(`Registered ${Object.keys(voxContext.tools).length} schema-only tools`);

    // 3. Set up telemetry context
    await VoxSpanExporter.getInstance().createContext(config.experimentName, 'oracle');

    // 4. Process rows in parallel
    const limit = pLimit(config.concurrency ?? 5);

    const results = await Promise.all(
      rows.map((row, i) =>
        limit(async (): Promise<ReplayResult> => {
          logger.info(`Processing row ${i + 1}/${rows.length}: game=${row.game_id}, player=${row.player_id}, turn=${row.turn}`);
          try {
            return await replayRow(row, config, voxContext, telemetryDir, experimentDir);
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            logger.error(`Error processing row ${i + 1}: ${errorMsg}`);
            return {
              row,
              model: 'unknown',
              decisions: [],
              tokens: { inputTokens: 0, reasoningTokens: 0, outputTokens: 0 },
              messages: [],
              error: errorMsg,
            };
          }
        })
      )
    );

    // 5. Write output CSV
    const outputCsvPath = path.join(outputDir, `${config.experimentName}-results.csv`);
    writeCsv(outputCsvPath, results);
    logger.info(`Results written to: ${outputCsvPath}`);

    // 6. Flush telemetry
    await spanProcessor.forceFlush();
    logger.info(`Telemetry flushed to: telemetry/oracle/${config.experimentName}.db`);

    // Summary
    const errors = results.filter(r => r.error).length;
    const successes = results.length - errors;
    logger.info(`Experiment complete: ${successes} successes, ${errors} errors out of ${results.length} rows`);

    return results;
  } finally {
    await voxContext.shutdown();
    await mcpClient.disconnect();
  }
}

/**
 * Replay a single CSV row through the oracle agent.
 */
async function replayRow(
  row: OracleRow,
  config: OracleConfig,
  voxContext: VoxContext<OracleParameters>,
  telemetryDir: string,
  experimentDir: string
): Promise<ReplayResult> {
  const { game_id: gameId, player_id: playerId, turn: turnStr } = row;
  const turn = parseInt(turnStr, 10);

  // Discover telemetry DB
  const dbPath = discoverDbPath(gameId, playerId, telemetryDir);
  if (!dbPath) {
    throw new Error(`No telemetry DB found for game=${gameId}, player=${playerId}`);
  }

  // Open DB and extract prompt
  const db = openReadonlyDb(dbPath);
  if (!db) {
    throw new Error(`Failed to open telemetry DB: ${dbPath}`);
  }

  try {
    // Validate turn via rationale fuzzy matching, with fallback to previous turn
    let effectiveTurn = turn;
    if (row.rationale) {
      const found = await findTurnByRationale(db, turn, row.rationale);
      if (!found) {
        const prevFound = await findTurnByRationale(db, turn - 1, row.rationale);
        if (prevFound) {
          logger.warn(`Rationale not found in turn ${turn}, using turn ${turn - 1} for game=${gameId}, player=${playerId}`);
          effectiveTurn = turn - 1;
        } else {
          logger.warn(`Rationale not found in turn ${turn} or ${turn - 1} for game=${gameId}, player=${playerId}`);
        }
      }
    }

    const extracted = await extractPrompt(db, effectiveTurn, config.targetAgent);
    if (!extracted) {
      throw new Error(`No prompt data found for turn ${effectiveTurn} in ${dbPath}`);
    }

    // Resolve model (override takes priority over telemetry string)
    const originalModelString = extracted.modelString;
    const override = config.modelOverride?.(originalModelString, row);
    const resolvedModel = resolveModel(override ?? originalModelString);

    // Build callback context
    const promptContext: OriginalPromptContext = {
      row,
      system: extracted.system,
      messages: extracted.messages,
      activeTools: extracted.activeTools,
      originalModel: originalModelString,
      agentName: extracted.agentName,
    };

    // Call user's modifyPrompt callback
    const modifications = await config.modifyPrompt(promptContext);

    // Merge modifications with originals
    const finalSystem = modifications.system ?? extracted.system;
    const finalMessages = modifications.messages ?? extracted.messages;
    const finalActiveTools = modifications.activeTools ?? extracted.activeTools;

    // Build parameters and input
    const parameters: OracleParameters = {
      playerID: parseInt(playerId, 10),
      gameID: gameId,
      turn,
      activeTools: finalActiveTools,
      resolvedModel,
      agentType: config.agentType,
      capturedSteps: [],
    };

    const input: OracleInput = {
      system: finalSystem,
      messages: finalMessages,
      row,
      metadata: modifications.metadata,
    };

    // Hide messages from JSON.stringify so agent.input span attribute stays small,
    // while keeping them accessible via input.messages for getInitialMessages()
    Object.defineProperty(input, 'messages', { enumerable: false, value: input.messages });
    Object.defineProperty(input, 'system', { enumerable: false, value: input.system });

    // Execute through VoxContext, capturing per-execution token counts
    const tokenOutput: ExecuteTokenOutput = { inputTokens: 0, reasoningTokens: 0, outputTokens: 0 };
    const result = await voxContext.execute('oracle', parameters, input, undefined, tokenOutput) as ReplayResult | undefined;

    if (!result) {
      throw new Error('Oracle agent returned no result');
    }

    // Apply VoxContext's nuanced token counts (reasoning estimation, etc.)
    result.tokens = tokenOutput;

    // Write JSON trail
    const trailBase = `${gameId}-p${playerId}-t${turn}`;
    const jsonTrail = {
      row,
      originalModel: originalModelString,
      model: result.model,
      modifications: {
        systemModified: modifications.system !== undefined,
        messagesModified: modifications.messages !== undefined,
        activeToolsModified: modifications.activeTools !== undefined,
        metadata: modifications.metadata,
      },
      original: {
        system: extracted.system,
        messages: extracted.messages,
      },
      replay: {
        system: finalSystem,
        decisions: result.decisions,
        tokens: result.tokens,
        messages: result.messages,
      },
    };

    const jsonPath = path.join(experimentDir, `${trailBase}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(jsonTrail, null, 2));

    // Write markdown trail
    const mdPath = path.join(experimentDir, `${trailBase}.md`);
    const mdContent = jsonToMarkdown(jsonTrail, { startingLevel: 1 });
    fs.writeFileSync(mdPath, mdContent);

    return result;
  } finally {
    await db.destroy();
  }
}

/**
 * Replace all tools in the VoxContext with schema-only versions.
 * The LLM can still generate tool call intents, but nothing executes.
 */
function replaceToolsWithSchemaOnly(voxContext: VoxContext<OracleParameters>): void {
  const schemaTools: Record<string, any> = {};

  for (const [name, mcpTool] of voxContext.mcpToolMap) {
    // Create schema-only tool with a no-op execute -- LLM generates intents, nothing runs against MCP
    schemaTools[name] = dynamicTool({
      description: mcpTool.description || `Tool: ${name}`,
      inputSchema: jsonSchema(mcpTool.inputSchema as any),
      execute: async () => ({ _oracle: true, message: `Tool ${name} not executed in replay mode.` }),
    });
  }

  voxContext.tools = schemaTools;
}

/**
 * Write the output CSV from replay results.
 */
function writeCsv(outputPath: string, results: ReplayResult[]): void {
  const csvRows = results.map(r => ({
    // Original columns
    ...r.row,
    // Replay columns
    model: r.model,
    decisions: JSON.stringify(r.decisions),
    tokens: `${r.tokens.inputTokens}/${r.tokens.reasoningTokens}/${r.tokens.outputTokens}`,
    ...(r.error ? { error: r.error } : {}),
  }));

  const csv = Papa.unparse(csvRows);
  fs.writeFileSync(outputPath, csv, 'utf-8');
}

/** Resolve a path that may be relative or absolute */
function resolvePath(p: string): string {
  return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
}
