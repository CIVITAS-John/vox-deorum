/**
 * @module utils/telemetry/parquet-exporter
 *
 * Custom OpenTelemetry span exporter that writes trace data to Parquet files.
 * Each VoxContext gets its own data file for easy analysis and debugging.
 */

import { SpanExporter, ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { ExportResult, ExportResultCode } from '@opentelemetry/core';
import * as parquet from '@dsnp/parquetjs';
import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../logger.js';

const logger = createLogger('ParquetExporter');

/**
 * Parquet schema for trace data
 */
const traceSchema = new parquet.ParquetSchema({
  context_id: { type: 'UTF8', optional: false },
  trace_id: { type: 'UTF8', optional: false },
  span_id: { type: 'UTF8', optional: false },
  parent_span_id: { type: 'UTF8', optional: true },
  name: { type: 'UTF8', optional: false },
  kind: { type: 'INT32', optional: false },
  start_time: { type: 'INT64', optional: false },
  end_time: { type: 'INT64', optional: false },
  duration_ms: { type: 'INT32', optional: false },
  attributes: { type: 'UTF8', optional: true }, // JSON string
  status_code: { type: 'INT32', optional: false },
  status_message: { type: 'UTF8', optional: true },
  events: { type: 'UTF8', optional: true }, // JSON string
  links: { type: 'UTF8', optional: true }, // JSON string
  resource: { type: 'UTF8', optional: true }, // JSON string
});

/**
 * Map of context IDs to Parquet writers
 */
const writers = new Map<string, parquet.ParquetWriter>();

/**
 * Map of context IDs to row buffers for batching
 */
const buffers = new Map<string, any[]>();

/**
 * Batch size for writing to Parquet files
 */
const BATCH_SIZE = 100;

/**
 * Custom OpenTelemetry span exporter that writes to Parquet files.
 * Groups trace data by VoxContext ID for easier analysis.
 */
export class ParquetSpanExporter implements SpanExporter {
  private dataDir: string;
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(dataDir: string = 'telemetry') {
    this.dataDir = dataDir;
    this.ensureDataDirectory();

    // Set up periodic flush every 5 seconds
    this.flushTimer = setInterval(() => {
      this.flushAllBuffers().catch(error => {
        logger.error('Error during periodic flush', error);
      });
    }, 5000);
  }

  /**
   * Ensure the data directory exists
   */
  private ensureDataDirectory(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
      logger.info(`Created telemetry directory: ${this.dataDir}`);
    }
  }

  /**
   * Get or create a Parquet writer for a specific context
   */
  private async getWriter(contextId: string): Promise<parquet.ParquetWriter> {
    if (!writers.has(contextId)) {
      const contextDir = path.join(this.dataDir, contextId);
      if (!fs.existsSync(contextDir)) {
        fs.mkdirSync(contextDir, { recursive: true });
      }

      const filename = path.join(contextDir, `${contextId}.parquet`);

      const writer = await parquet.ParquetWriter.openFile(traceSchema, filename);
      writers.set(contextId, writer);
      buffers.set(contextId, []);

      logger.info(`Created Parquet writer for context ${contextId}: ${filename}`);
    }

    return writers.get(contextId)!;
  }

  /**
   * Convert a ReadableSpan to a Parquet row
   */
  private spanToRow(span: ReadableSpan): any {
    const contextId = span.attributes['vox.context.id'] as string || 'unknown';
    const traceId = span.spanContext().traceId;
    const spanId = span.spanContext().spanId;
    const parentSpanId = (span as any).parentSpanId || null;

    return {
      context_id: contextId,
      trace_id: traceId,
      span_id: spanId,
      parent_span_id: parentSpanId,
      name: span.name,
      kind: span.kind,
      start_time: Math.floor(span.startTime[0] * 1e9 + span.startTime[1]), // Convert to nanoseconds
      end_time: Math.floor(span.endTime[0] * 1e9 + span.endTime[1]),
      duration_ms: Math.floor((span.endTime[0] - span.startTime[0]) * 1000 + (span.endTime[1] - span.startTime[1]) / 1e6),
      attributes: JSON.stringify(span.attributes),
      status_code: span.status.code,
      status_message: span.status.message || null,
      events: span.events.length > 0 ? JSON.stringify(span.events) : null,
      links: span.links.length > 0 ? JSON.stringify(span.links) : null,
      resource: JSON.stringify(span.resource.attributes),
    };
  }

  /**
   * Flush a specific context's buffer to disk
   */
  private async flushBuffer(contextId: string): Promise<void> {
    const buffer = buffers.get(contextId);
    if (!buffer || buffer.length === 0) {
      return;
    }

    const writer = await this.getWriter(contextId);
    for (const row of buffer) {
      await writer.appendRow(row);
    }

    buffers.set(contextId, []);
    logger.debug(`Flushed ${buffer.length} spans for context ${contextId}`);
  }

  /**
   * Flush all buffers to disk
   */
  private async flushAllBuffers(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const contextId of buffers.keys()) {
      promises.push(this.flushBuffer(contextId));
    }
    await Promise.all(promises);
  }

  /**
   * Export spans to Parquet files
   */
  async export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): Promise<void> {
    try {
      // Group spans by context ID
      const spansByContext = new Map<string, any[]>();

      for (const span of spans) {
        const row = this.spanToRow(span);
        const contextId = row.context_id;

        if (!spansByContext.has(contextId)) {
          spansByContext.set(contextId, []);
        }
        spansByContext.get(contextId)!.push(row);
      }

      // Add to buffers
      for (const [contextId, rows] of spansByContext) {
        if (!buffers.has(contextId)) {
          buffers.set(contextId, []);
        }
        const buffer = buffers.get(contextId)!;
        buffer.push(...rows);

        // Flush if buffer exceeds batch size
        if (buffer.length >= BATCH_SIZE) {
          await this.flushBuffer(contextId);
        }
      }

      resultCallback({ code: ExportResultCode.SUCCESS });
    } catch (error) {
      logger.error('Error exporting spans to Parquet', error);
      resultCallback({
        code: ExportResultCode.FAILED,
        error: error instanceof Error ? error : new Error(String(error))
      });
    }
  }

  /**
   * Force flush all pending spans
   */
  async forceFlush(): Promise<void> {
    try {
      await this.flushAllBuffers();

      // Close all writers to ensure data is written
      for (const writer of writers.values()) {
        await writer.close();
      }
      writers.clear();

      logger.info('Force flushed all telemetry data');
    } catch (error) {
      logger.error('Error during force flush', error);
      throw error;
    }
  }

  /**
   * Shutdown the exporter
   */
  async shutdown(): Promise<void> {
    try {
      // Clear the flush timer
      if (this.flushTimer) {
        clearInterval(this.flushTimer);
        this.flushTimer = null;
      }

      // Force flush and close everything
      await this.forceFlush();

      logger.info('Parquet exporter shut down');
    } catch (error) {
      logger.error('Error during shutdown', error);
      throw error;
    }
  }
}