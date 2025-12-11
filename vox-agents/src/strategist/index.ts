/**
 * @module strategist/index
 *
 * Entry point for the Strategist workflow.
 * Manages command-line argument parsing, session configuration,
 * and graceful shutdown with keyboard input handling (Ctrl+A, Ctrl+C).
 * Supports both interactive and automated game sessions with configurable strategists.
 */

import { sqliteExporter } from "../instrumentation.js";
import { createLogger } from "../utils/logger.js";
import { loadConfigFromFile } from "../utils/config.js";
import { StrategistSession, StrategistSessionConfig } from "./strategist-session.js";
import { setTimeout } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import * as readline from 'node:readline';
import { startWebServer } from "../web/server.js";

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
    wait: {
      type: 'boolean',
      short: 'w',
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
const isWaitMode = values.wait as boolean;

// Default configuration (interactive mode)
const defaultConfig: StrategistSessionConfig = {
  llmPlayers: {
    1: { strategist: "simple-strategist" }
  },
  autoPlay: false,
  gameMode: 'start',
  repetition: 1
};

// Build command line overrides
const cmdOverrides: Partial<StrategistSessionConfig> = {};

if (isLoadMode) {
  cmdOverrides.gameMode = 'load';
} else if (isWaitMode) {
  cmdOverrides.gameMode = 'wait';
}

if (values.players || values.strategist) {
  const strategist = (values.strategist as string) || "simple-strategist";

  if (values.players) {
    const playerList = Array.isArray(values.players) ? values.players : [values.players];
    const playerIds = playerList.flatMap(p =>
      (p as string).split(',').map(id => parseInt(id.trim()))
    ).filter(id => !isNaN(id));

    // Build llmPlayers as a Record
    cmdOverrides.llmPlayers = {};
    for (const playerId of playerIds) {
      cmdOverrides.llmPlayers[playerId] = { strategist };
    }
  } else if (values.strategist) {
    // If only strategist is specified, update the default player
    cmdOverrides.llmPlayers = {
      1: { strategist }
    };
  }
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
const sessionConfig: StrategistSessionConfig = loadConfigFromFile(
  "configs/" + configFile,
  defaultConfig,
  cmdOverrides
);

// Session instance
let session: StrategistSession | null = null;
let rl: readline.Interface | null = null;

/**
 * Graceful shutdown handler.
 * Flushes telemetry and cleans up resources before exiting.
 *
 * @param signal - The signal that triggered the shutdown
 */
let shuttingdown = false;
let shuttingdownAfter = false;
async function shutdown(signal: string) {
  if (shuttingdown) return;
  shuttingdown = true;

  logger.info(`Received ${signal}, shutting down gracefully...`);

  // Restore terminal settings
  if (process.stdin.isTTY && process.stdin.setRawMode) {
    process.stdin.setRawMode(false);
  }

  // Close readline interface
  if (rl) {
    rl.close();
  }

  // Shutdown the session if it exists
  if (session) {
    await session.shutdown();
  }

  // Flush telemetry
  await sqliteExporter.forceFlush();
  await setTimeout(1000);

  process.exit(0);
}

// Register signal handlers
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGBREAK', () => shutdown('SIGBREAK'));
process.on('SIGHUP', () => shutdown('SIGHUP'));

// Web UI
await startWebServer();

// Setup readline interface for keyboard input
rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true
});

// Enable raw mode to capture Ctrl key combinations
if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
}

// Listen for keypress events
process.stdin.on('data', (key) => {
  // Ctrl+A is ASCII code 1
  if (key[0] === 1) {
    if (!shuttingdownAfter) {
      shuttingdownAfter = true;
      logger.info('Ctrl+A pressed: Will stop after current session completes');
    } else {
      shuttingdownAfter = false;
      logger.info('Ctrl+A pressed again: Cancelled shutdown after current session');
    }
  }
  // Ctrl+C is ASCII code 3 - let it pass through for immediate shutdown
  else if (key[0] === 3) {
    process.emit('SIGINT', 'SIGINT');
  }
});

/**
 * Main entry point.
 * Runs configured number of game sessions with the selected strategist.
 */
async function main() {
  logger.info(`Starting in ${sessionConfig.gameMode} mode`);
  try {
    for (var I = 0; I < (sessionConfig.repetition ?? 1); I++) {
      if (shuttingdown || shuttingdownAfter) break;
      // Start a new session
      session = new StrategistSession(sessionConfig);
      await session.start();
      sessionConfig.gameMode = "start";
      logger.info(`Session ${I} completed successfully`);
      // Shut down the session
      await session.shutdown();
      if (shuttingdown || shuttingdownAfter) break;
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