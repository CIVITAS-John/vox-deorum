/**
 * @module instrumentation
 *
 * OpenTelemetry instrumentation configuration for Vox Agents.
 * Sets up Parquet span processor for local observability and tracing of agent executions.
 * This module should be imported at the application entry point to enable telemetry.
 */

import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { ParquetSpanExporter } from "./utils/telemetry/parquet-exporter.js";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import dotenv from 'dotenv';
import { createLogger } from "./utils/logger.js";

dotenv.config();

const logger = createLogger('Instrumentation');

/**
 * Parquet span exporter for collecting and exporting telemetry data to local files.
 * Used to track agent executions, tool calls, and performance metrics.
 * Call `forceFlush()` before application shutdown to ensure all spans are exported.
 */
export const parquetExporter = new ParquetSpanExporter();

/**
 * Batch span processor for efficient span export
 */
export const spanProcessor = new BatchSpanProcessor(parquetExporter, {
  maxQueueSize: 2048,
  maxExportBatchSize: 512,
  scheduledDelayMillis: 5000,
  exportTimeoutMillis: 30000,
});

/**
 * OpenTelemetry tracer provider configured with Parquet processor.
 * Automatically registers itself to capture spans from instrumented code.
 */
const tracerProvider = new NodeTracerProvider({
  spanProcessors: [spanProcessor],
});

tracerProvider.register();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down telemetry...');
  await spanProcessor.forceFlush();
  await parquetExporter.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down telemetry...');
  await spanProcessor.forceFlush();
  await parquetExporter.shutdown();
  process.exit(0);
});

logger.info('Telemetry initialized with Parquet exporter');