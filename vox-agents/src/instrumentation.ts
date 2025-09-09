import { LangfuseSpanProcessor } from "@langfuse/otel";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import dotenv from 'dotenv';

dotenv.config();
 
export const langfuseSpanProcessor = new LangfuseSpanProcessor();
 
const tracerProvider = new NodeTracerProvider({
  spanProcessors: [langfuseSpanProcessor],
});
 
tracerProvider.register();