import { LangfuseSpanProcessor, ShouldExportSpan } from "@langfuse/otel";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import dotenv from 'dotenv';

dotenv.config();

// Optional: filter our NextJS infra spans
const shouldExportSpan: ShouldExportSpan = (span) => {
  return span.otelSpan.instrumentationScope.name !== "next.js";
};
 
const langfuseSpanProcessor = new LangfuseSpanProcessor({
  shouldExportSpan,
});
 
const tracerProvider = new NodeTracerProvider({
  spanProcessors: [langfuseSpanProcessor],
});
 
tracerProvider.register();