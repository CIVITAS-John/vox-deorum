import { langfuseSpanProcessor } from "../instrumentation.js";
import { createLogger } from "../utils/logger.js";
import { StrategistSession, StrategistSessionConfig } from "./strategist-session.js";
import { setTimeout } from 'node:timers/promises';

const logger = createLogger('Strategists');

// Configuration
const config: StrategistSessionConfig = {
  llmPlayers: [0],
  autoPlay: true,
  strategist: "simple-strategist"
  // strategist: "none"
};

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
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  shutdown('unhandledRejection');
});

// Start the session
async function main() {
  try {
    session = new StrategistSession(config);
    await session.start();
    logger.info('Session completed successfully');
  } catch (error) {
    logger.error('Session failed:', error);
    process.exit(1);
  } finally {
    await shutdown('main-complete');
  }
}

// Run the main function
main();