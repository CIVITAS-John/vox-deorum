/**
 * @module utils/telemetry/sqlite-exporter
 *
 * Custom OpenTelemetry span exporter that writes trace data to SQLite databases.
 * Each VoxContext gets its own database file for easy analysis and debugging.
 * Uses WAL (Write-Ahead Logging) mode for better concurrent access.
 */

import { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { ExportResult, ExportResultCode } from '@opentelemetry/core';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../logger.js';
import { spanProcessor } from '../../instrumentation.js';
import { VoxSpanExporter } from './vox-exporter.js';

const logger = createLogger('SQLiteExporter');

/**
 * Map of context IDs to SQLite databases
 */
const databases = new Map<string, Database.Database>();

/**
 * Map of context IDs to custom folders
 */
const customFolders = new Map<string, string>();

/**
 * Custom OpenTelemetry span exporter that writes to SQLite databases.
 * Groups trace data by VoxContext ID for easier analysis.
 */
export class SQLiteSpanExporter extends VoxSpanExporter {
  private dataDir: string;

  constructor(dataDir: string = 'telemetry') {
    super();
    this.dataDir = dataDir;
    this.ensureDataDirectory();
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
   * Get or create a SQLite database for a specific context
   * Overrides the optional method from VoxSpanExporter
   */
  public getDatabase(contextId: string): Database.Database {
    if (!databases.has(contextId)) {
      // Use custom folder if specified, otherwise use default structure
      const contextDir = path.join(this.dataDir, customFolders.has(contextId)
        ? customFolders.get(contextId)! : contextId.split("-")[0]);

      if (!fs.existsSync(contextDir)) {
        fs.mkdirSync(contextDir, { recursive: true });
      }

      const filename = path.join(contextDir, `${contextId}.db`);
      const db = new Database(filename);

      // Enable WAL mode for better concurrent access
      db.pragma('journal_mode = WAL');
      db.pragma('synchronous = NORMAL');

      // Create table if not exists
      db.exec(`
        CREATE TABLE IF NOT EXISTS spans (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          context_id TEXT NOT NULL,
          trace_id TEXT NOT NULL,
          span_id TEXT NOT NULL,
          parent_span_id TEXT,
          name TEXT NOT NULL,
          kind INTEGER NOT NULL,
          start_time INTEGER NOT NULL,
          end_time INTEGER NOT NULL,
          duration_ms INTEGER NOT NULL,
          attributes TEXT,
          status_code INTEGER NOT NULL,
          status_message TEXT,
          events TEXT,
          links TEXT,
          resource TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Prepare insert statement for better performance
      const insertStmt = db.prepare(`
        INSERT INTO spans (
          context_id, trace_id, span_id, parent_span_id, name, kind,
          start_time, end_time, duration_ms, attributes, status_code,
          status_message, events, links, resource
        ) VALUES (
          @context_id, @trace_id, @span_id, @parent_span_id, @name, @kind,
          @start_time, @end_time, @duration_ms, @attributes, @status_code,
          @status_message, @events, @links, @resource
        )
      `);

      // Store the prepared statement on the database object
      (db as any).insertSpan = insertStmt;

      databases.set(contextId, db);
      logger.info(`Created SQLite database for context ${contextId}`);
    }

    return databases.get(contextId)!;
  }

  /**
   * Convert a ReadableSpan to a database row
   */
  private spanToRow(span: ReadableSpan): any {
    const contextId = span.attributes['vox.context.id'] as string ||
                     span.attributes['ai.telemetry.metadata.vox.context.id'] as string ||
                     'unknown';

    if (contextId === 'unknown') {
      // Only care about the telemetry we need
      logger.warn(`Unknown span: ${JSON.stringify(span.attributes)}`);
      return null;
    }

    const traceId = span.spanContext().traceId;
    const spanId = span.spanContext().spanId;
    // Properly access parent span ID from parentSpanContext
    const parentSpanId = span.parentSpanContext ? span.parentSpanContext.spanId : null;

    // Clean up attributes to avoid duplication
    const attributes = { ...span.attributes };
    delete attributes['vox.context.id'];

    return {
      context_id: contextId,
      trace_id: traceId,
      span_id: spanId,
      parent_span_id: parentSpanId,
      name: span.name,
      kind: span.kind,
      start_time: Math.floor(span.startTime[0] * 1e9 + span.startTime[1]), // Convert to nanoseconds
      end_time: Math.floor(span.endTime[0] * 1e9 + span.endTime[1]),
      duration_ms: Math.floor((span.endTime[0] - span.startTime[0]) * 1000 +
                              (span.endTime[1] - span.startTime[1]) / 1e6),
      attributes: JSON.stringify(attributes),
      status_code: span.status.code,
      status_message: span.status.message || null,
      events: span.events.length > 0 ? JSON.stringify(span.events) : null,
      links: span.links.length > 0 ? JSON.stringify(span.links) : null,
      resource: JSON.stringify(span.resource.attributes),
    };
  }

  /**
   * Export spans to SQLite databases
   */
  async export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): Promise<void> {
    try {
      // Group spans by context ID for batch inserts
      const spansByContext = new Map<string, any[]>();

      for (const span of spans) {
        const row = this.spanToRow(span);
        if (!row) continue;

        const contextId = row.context_id;
        if (!spansByContext.has(contextId)) {
          spansByContext.set(contextId, []);
        }
        spansByContext.get(contextId)!.push(row);
      }

      // Batch insert spans for each context
      for (const [contextId, contextSpans] of spansByContext) {
        const db = this.getDatabase(contextId);
        const insertStmt = (db as any).insertSpan;

        // Use transaction for batch inserts
        const insertMany = db.transaction((spans: any[]) => {
          for (const span of spans) {
            insertStmt.run(span);
          }
        });

        insertMany(contextSpans);
      }

      resultCallback({ code: ExportResultCode.SUCCESS });
    } catch (error) {
      logger.error('Error exporting spans to SQLite', error);
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
      await spanProcessor.forceFlush();

      // Checkpoint all databases to ensure data is written
      for (const db of databases.values()) {
        db.pragma('wal_checkpoint(TRUNCATE)');
      }

      logger.info('Force flushed all telemetry data');
    } catch (error) {
      logger.error('Error during force flush', error);
      throw error;
    }
  }

  /**
   * Create a context with a specific folder for its telemetry data
   */
  async createContext(contextId: string, folder: string): Promise<void> {
    try {
      // Ensure folder exists
      if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
      }

      // Store the custom folder mapping
      customFolders.set(contextId, folder);

      logger.info(`Registered custom folder for context ${contextId}: ${folder}`);
    } catch (error) {
      logger.error(`Error creating context ${contextId} with folder ${folder}`, error);
      throw error;
    }
  }

  /**
   * Close the database for a specific context
   */
  async closeContext(contextId: string): Promise<void> {
    try {
      const db = databases.get(contextId);
      if (db) {
        // Checkpoint to ensure all data is written
        db.pragma('wal_checkpoint(TRUNCATE)');
        db.close();
        databases.delete(contextId);
        logger.info(`Closed SQLite database for context ${contextId}`);
      }

      // Clear custom folder mapping if exists
      if (customFolders.has(contextId)) {
        customFolders.delete(contextId);
      }
    } catch (error) {
      logger.error(`Error closing database for context ${contextId}`, error);
      throw error;
    }
  }

  /**
   * Shutdown the exporter
   */
  async shutdown(): Promise<void> {
    try {
      // Force flush first
      await this.forceFlush();

      // Close all contexts properly
      const contextIds = Array.from(databases.keys());
      for (const contextId of contextIds) {
        await this.closeContext(contextId);
      }

      logger.info('SQLite exporter shut down');
    } catch (error) {
      logger.error('Error during shutdown', error);
      throw error;
    }
  }
}