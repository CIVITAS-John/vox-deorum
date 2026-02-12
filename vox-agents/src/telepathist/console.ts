/**
 * @module telepathist/console
 *
 * Console entry point for the Telepathist workflow.
 * Runs bootstrapping (turn/phase summarization) against a telemetry database
 * and optionally streams the agent's greeting response.
 *
 * Usage:
 *   npm run telepathist -- -d <database-path> [-a <agent-name>] [-p]
 *
 * Options:
 *   -d, --database   Path to the telemetry .db file (required, or first positional arg)
 *   -a, --agent      Agent name (default: talkative-telepathist)
 *   -p, --prepare    Preparation only: run summarization then exit without full agent execution
 */

import { sqliteExporter } from "../instrumentation.js";
import { createLogger } from "../utils/logger.js";
import { parseArgs } from 'node:util';
import { setTimeout } from 'node:timers/promises';
import { VoxContext } from '../infra/vox-context.js';
import {
  createTelepathistParameters,
  TelepathistParameters
} from './telepathist-parameters.js';
import {
  parseDatabaseIdentifier,
  createContextId
} from '../utils/identifier-parser.js';
import { StreamingEventCallback, EnvoyThread } from '../types/index.js';
import { v4 as uuidv4 } from 'uuid';
import path from 'node:path';

const logger = createLogger('Telepathist');

// Parse command line arguments
const { values, positionals } = parseArgs({
  options: {
    database: {
      type: 'string',
      short: 'd'
    },
    agent: {
      type: 'string',
      short: 'a',
      default: 'talkative-telepathist'
    },
    prepare: {
      type: 'boolean',
      short: 'p',
      default: false
    }
  },
  strict: false,
  allowPositionals: true
});

const rawDatabasePath = (values.database as string) || positionals[0];
const agentName = values.agent as string;
const prepareOnly = values.prepare as boolean;

if (!rawDatabasePath) {
  logger.error('Database path is required. Usage: telepathist -d <database-path> [-a <agent>] [-p]');
  process.exit(1);
}

const databasePath = path.resolve(path.join("telemetry", rawDatabasePath));

// Graceful shutdown
let shuttingdown = false;
async function shutdown(signal: string) {
  if (shuttingdown) return;
  shuttingdown = true;

  logger.info(`Received ${signal}, shutting down gracefully...`);

  await sqliteExporter.forceFlush();
  await setTimeout(1000);

  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGBREAK', () => shutdown('SIGBREAK'));
process.on('SIGHUP', () => shutdown('SIGHUP'));

/**
 * Main entry point.
 * Bootstraps the telepathist agent against a telemetry database.
 */
async function main() {
  // Parse database identifier for game/player info
  const identifierInfo = parseDatabaseIdentifier(databasePath);
  logger.info(`Opening telemetry database: ${databasePath}`, {
    gameID: identifierInfo.gameID,
    playerID: identifierInfo.playerID
  });

  // Create parameters (opens DBs, extracts identity, queries available turns)
  const params = await createTelepathistParameters(databasePath, identifierInfo);

  // Create context
  const contextId = createContextId(identifierInfo.gameID, identifierInfo.playerID);
  const voxContext = new VoxContext<TelepathistParameters>({}, contextId);
  voxContext.lastParameter = params;

  // Register tools when running the full agent (not prepare-only mode)
  if (!prepareOnly) {
    await voxContext.registerTools();
  }

  // Wire up streaming to logger
  voxContext.streamProgress = (message: string) => {
    logger.info(message);
  };

  const streamCallback: StreamingEventCallback = {
    OnChunk: ({ chunk }) => {
      if (chunk.type === 'text-delta') {
        logger.info(chunk.text);
      }
    }
  };

  // Build thread with Initialize message to trigger bootstrapping
  const thread: EnvoyThread = {
    id: uuidv4(),
    agent: agentName,
    gameID: identifierInfo.gameID,
    playerID: identifierInfo.playerID,
    civilizationName: params.civilizationName,
    contextType: 'database',
    contextId,
    databasePath,
    messages: [{
      message: { role: 'user', content: '{{{Initialize}}}' },
      metadata: { datetime: new Date(), turn: params.turn }
    }]
  };

  logger.info(`Bootstrapping ${agentName} for ${params.leaderName} of ${params.civilizationName}`, {
    turns: params.availableTurns.length,
    lastTurn: params.turn,
    prepareOnly
  });

  // Execute the agent - Initialize triggers turn/phase summarization then a greeting
  await voxContext.execute(agentName, params, thread, streamCallback);

  logger.info('Bootstrapping complete');

  // Clean up
  await params.close?.();
  await shutdown('complete');
}

main();
