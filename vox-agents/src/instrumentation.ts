/**
 * @module instrumentation
 *
 * OpenTelemetry instrumentation configuration for Vox Agents.
 * Sets up Langfuse span processor for observability and tracing of agent executions.
 * This module should be imported at the application entry point to enable telemetry.
 */

import { LangfuseSpanProcessor } from "@langfuse/otel";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import dotenv from 'dotenv';

dotenv.config();

/**
 * Langfuse span processor for collecting and exporting telemetry data.
 * Used to track agent executions, tool calls, and performance metrics.
 * Call `forceFlush()` before application shutdown to ensure all spans are exported.
 */
export const langfuseSpanProcessor = new LangfuseSpanProcessor();

/**
 * OpenTelemetry tracer provider configured with Langfuse processor.
 * Automatically registers itself to capture spans from instrumented code.
 */
const tracerProvider = new NodeTracerProvider({
  spanProcessors: [langfuseSpanProcessor],
});

tracerProvider.register();