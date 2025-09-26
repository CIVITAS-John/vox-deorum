import { langfuseSpanProcessor } from "../instrumentation.js";
import { createLogger } from "../utils/logger.js";
import { loadConfigFromFile } from "../utils/config.js";
import { StrategistSession, StrategistSessionConfig } from "./strategist-session.js";
import { setTimeout } from 'node:timers/promises';
import { parseArgs } from 'node:util';

const logger = createLogger('Strategists');

// Parse command line arguments using parseArgs
const { values, positionals } = parseArgs({
  options: {
    config: {
      type: 'string',
      short: 'c',
      default: 'play-simple.json'
    },
    load: {
      type: 'boolean',
      short: 'l',
      default: false
    },
    players: {
      type: 'string',
      short: 'p',
      multiple: true
    },
    strategist: {
      type: 'string',
      short: 's'
    },
    autoPlay: {
      type: 'boolean',
      short: 'a'
    },
    repetition: {
      type: 'string',
      short: 'r'
    }
  },
  strict: false,
  allowPositionals: true
});

const configFile = values.config as string;
const isLoadMode = values.load as boolean;

// Default configuration (interactive mode)
const defaultConfig: StrategistSessionConfig = {
  llmPlayers: [1],
  autoPlay: false,
  strategist: "simple-strategist",
  gameMode: 'start',
  repetition: 1
};

// Build command line overrides
const cmdOverrides: Partial<StrategistSessionConfig> = {};

if (isLoadMode) {
  cmdOverrides.gameMode = 'load';
}

if (values.players) {
  const playerList = Array.isArray(values.players) ? values.players : [values.players];
  cmdOverrides.llmPlayers = playerList.flatMap(p =>
    (p as string).split(',').map(id => parseInt(id.trim()))
  ).filter(id => !isNaN(id));
}

if (values.strategist !== undefined) {
  cmdOverrides.strategist = values.strategist as string;
}

if (values.autoPlay !== undefined) {
  cmdOverrides.autoPlay = values.autoPlay as boolean;
}

if (values.repetition !== undefined) {
  const rep = parseInt(values.repetition as string);
  if (!isNaN(rep)) {
    cmdOverrides.repetition = rep;
  }
}

// Load configuration from file with command line overrides
const config: StrategistSessionConfig = loadConfigFromFile(
  "configs/" + configFile,
  defaultConfig,
  cmdOverrides
);

// Session instance
let session: StrategistSession | null = null;

// Graceful shutdown handler
let shuttingdown = false;
async function shutdown(signal: string) {
  if (shuttingdown) return;
  shuttingdown = true;
  logger.info(`Received ${signal}, shutting down gracefully...`);

  // Shutdown the session if it exists
  if (session) {
    await session.shutdown();
  }

  // Flush telemetry
  await langfuseSpanProcessor.forceFlush();
  await setTimeout(1000);

  process.exit(0);
}

// Register signal handlers
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  // shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  // shutdown('unhandledRejection');
});

// Start the session
async function main() {
  logger.info(`Starting in ${config.gameMode} mode`);
  try {
    for (var I = 0; I < (config.repetition ?? 1); I++) {
      if (shuttingdown) break;
      session = new StrategistSession(config);
      await session.start();
      config.gameMode = "start";
      logger.info(`Session ${I} completed successfully`);
      if (shuttingdown) break;
    }
  } catch (error) {
    logger.error('Session failed:', error);
    process.exit(1);
  } finally {
    await shutdown('main-complete');
  }
}

// Run the main function
main();