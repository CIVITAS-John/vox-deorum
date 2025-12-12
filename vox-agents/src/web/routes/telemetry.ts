/**
 * @module web/routes/telemetry
 *
 * API endpoints for telemetry data access.
 * Provides routes for listing databases, querying spans, and trace reconstruction.
 */

import { Router } from 'express';
import { Kysely } from 'kysely';
import { createLogger } from '../../utils/logger.js';
import { SQLiteSpanExporter, type TelemetryDatabase, type Span } from '../../utils/telemetry/sqlite-exporter.js';
import { sqliteExporter } from '../../instrumentation.js';

const logger = createLogger('TelemetryAPI');
const router = Router();

/**
 * Get list of all telemetry database files
 */
router.get('/databases', async (req, res) => {
  try {
    if (!(sqliteExporter instanceof SQLiteSpanExporter)) {
      return res.status(501).json({ error: 'SQLite telemetry not configured' });
    }

    const databases = await sqliteExporter.getDatabaseFiles();
    return res.json({ databases });
  } catch (error) {
    logger.error('Error listing database files', error);
    return res.status(500).json({ error: 'Failed to list database files' });
  }
});

/**
 * Get list of active database connections
 */
router.get('/active', async (req, res) => {
  try {
    if (!(sqliteExporter instanceof SQLiteSpanExporter)) {
      return res.status(501).json({ error: 'SQLite telemetry not configured' });
    }

    const connections = sqliteExporter.getActiveConnections();
    return res.json({ connections });
  } catch (error) {
    logger.error('Error getting active connections', error);
    return res.status(500).json({ error: 'Failed to get active connections' });
  }
});

/**
 * Query spans from a specific database with filters
 */
router.get('/spans', async (req, res) => {
  try {
    if (!(sqliteExporter instanceof SQLiteSpanExporter)) {
      return res.status(501).json({ error: 'SQLite telemetry not configured' });
    }

    const {
      db: dbFile,
      contextId,
      turn,
      limit = '100',
      offset = '0',
      sortBy = 'startTime',
      sortOrder = 'desc'
    } = req.query;

    if (!dbFile) {
      return res.status(400).json({ error: 'Database file parameter is required' });
    }

    const db = sqliteExporter.openDatabaseFile(dbFile as string);
    if (!db) {
      return res.status(404).json({ error: 'Database file not found' });
    }

    try {
      let query = db.selectFrom('spans')
        .selectAll();

      // Apply filters
      if (contextId) {
        query = query.where('contextId', '=', contextId as string);
      }

      if (turn) {
        query = query.where('turn', '=', parseInt(turn as string));
      }

      // Apply sorting
      const validSortColumns = ['startTime', 'endTime', 'durationMs', 'name', 'turn'];
      const sortColumn = validSortColumns.includes(sortBy as string) ? sortBy as string : 'startTime';
      const order = sortOrder === 'asc' ? 'asc' : 'desc';

      query = query.orderBy(sortColumn as any, order);

      // Apply pagination
      const limitNum = Math.min(parseInt(limit as string), 1000);
      const offsetNum = parseInt(offset as string);

      query = query.limit(limitNum).offset(offsetNum);

      // Execute query
      const spans = await query.execute();

      // Get total count for pagination
      let countQuery = db.selectFrom('spans')
        .select(db.fn.count<number>('id').as('count'));

      if (contextId) {
        countQuery = countQuery.where('contextId', '=', contextId as string);
      }

      if (turn) {
        countQuery = countQuery.where('turn', '=', parseInt(turn as string));
      }

      const countResult = await countQuery.executeTakeFirst();
      const total = countResult?.count || 0;

      // Parse attributes JSON for each span
      const spansWithParsedAttributes = spans.map(span => ({
        ...span,
        attributes: span.attributes ? JSON.parse(span.attributes as any) : null
      }));

      return res.json({
        spans: spansWithParsedAttributes,
        pagination: {
          total,
          limit: limitNum,
          offset: offsetNum,
          hasMore: offsetNum + limitNum < total
        }
      });
    } finally {
      await db.destroy();
    }
  } catch (error) {
    logger.error('Error querying spans', error);
    return res.status(500).json({ error: 'Failed to query spans' });
  }
});

/**
 * Get all spans for a specific trace
 */
router.get('/trace/:traceId', async (req, res) => {
  try {
    if (!(sqliteExporter instanceof SQLiteSpanExporter)) {
      return res.status(501).json({ error: 'SQLite telemetry not configured' });
    }

    const { traceId } = req.params;
    const { db: dbFile } = req.query;

    if (!dbFile) {
      return res.status(400).json({ error: 'Database file parameter is required' });
    }

    const db = sqliteExporter.openDatabaseFile(dbFile as string);
    if (!db) {
      return res.status(404).json({ error: 'Database file not found' });
    }

    try {
      const spans = await db.selectFrom('spans')
        .selectAll()
        .where('traceId', '=', traceId)
        .orderBy('startTime', 'asc')
        .execute();

      if (spans.length === 0) {
        return res.status(404).json({ error: 'Trace not found' });
      }

      // Parse attributes and build hierarchy
      const spansWithParsedAttributes = spans.map(span => ({
        ...span,
        attributes: span.attributes ? JSON.parse(span.attributes as any) : null
      }));

      // Build span hierarchy
      const spanMap = new Map<string, any>();
      const rootSpans: any[] = [];

      // First pass: create all span objects
      spansWithParsedAttributes.forEach(span => {
        spanMap.set(span.spanId, {
          ...span,
          children: []
        });
      });

      // Second pass: build hierarchy
      spansWithParsedAttributes.forEach(span => {
        const spanObj = spanMap.get(span.spanId);
        if (span.parentSpanId && spanMap.has(span.parentSpanId)) {
          const parent = spanMap.get(span.parentSpanId);
          parent.children.push(spanObj);
        } else {
          rootSpans.push(spanObj);
        }
      });

      return res.json({
        traceId,
        spans: spansWithParsedAttributes,
        hierarchy: rootSpans,
        spanCount: spans.length
      });
    } finally {
      await db.destroy();
    }
  } catch (error) {
    logger.error('Error getting trace', error);
    return res.status(500).json({ error: 'Failed to get trace' });
  }
});

/**
 * Get summary statistics for a database
 */
router.get('/stats', async (req, res) => {
  try {
    if (!(sqliteExporter instanceof SQLiteSpanExporter)) {
      return res.status(501).json({ error: 'SQLite telemetry not configured' });
    }

    const { db: dbFile } = req.query;

    if (!dbFile) {
      return res.status(400).json({ error: 'Database file parameter is required' });
    }

    const db = sqliteExporter.openDatabaseFile(dbFile as string);
    if (!db) {
      return res.status(404).json({ error: 'Database file not found' });
    }

    try {
      // Get total spans
      const totalResult = await db.selectFrom('spans')
        .select(db.fn.count<number>('id').as('count'))
        .executeTakeFirst();

      // Get unique contexts
      const contextsResult = await db.selectFrom('spans')
        .select(db.fn.countAll<number>().distinct().as('count'))
        .select('contextId')
        .groupBy('contextId')
        .execute();

      // Get unique traces
      const tracesResult = await db.selectFrom('spans')
        .select(db.fn.countAll<number>().distinct().as('count'))
        .select('traceId')
        .groupBy('traceId')
        .execute();

      // Get turn range
      const turnRangeResult = await db.selectFrom('spans')
        .select([
          db.fn.min<number>('turn').as('minTurn'),
          db.fn.max<number>('turn').as('maxTurn')
        ])
        .executeTakeFirst();

      // Get time range
      const timeRangeResult = await db.selectFrom('spans')
        .select([
          db.fn.min<number>('startTime').as('minTime'),
          db.fn.max<number>('startTime').as('maxTime')
        ])
        .executeTakeFirst();

      // Get average duration
      const avgDurationResult = await db.selectFrom('spans')
        .select(db.fn.avg<number>('durationMs').as('avgDuration'))
        .executeTakeFirst();

      // Get status code distribution
      const statusDistribution = await db.selectFrom('spans')
        .select(['statusCode', db.fn.count<number>('id').as('count')])
        .groupBy('statusCode')
        .execute();

      return res.json({
        totalSpans: totalResult?.count || 0,
        uniqueContexts: contextsResult.length,
        uniqueTraces: tracesResult.length,
        turnRange: {
          min: turnRangeResult?.minTurn || null,
          max: turnRangeResult?.maxTurn || null
        },
        timeRange: {
          min: timeRangeResult?.minTime || null,
          max: timeRangeResult?.maxTime || null
        },
        averageDuration: avgDurationResult?.avgDuration || 0,
        statusDistribution: statusDistribution.reduce((acc, item) => {
          const statusName = item.statusCode === 0 ? 'UNSET' :
                           item.statusCode === 1 ? 'OK' : 'ERROR';
          acc[statusName] = item.count;
          return acc;
        }, {} as Record<string, number>)
      });
    } finally {
      await db.destroy();
    }
  } catch (error) {
    logger.error('Error getting database stats', error);
    return res.status(500).json({ error: 'Failed to get database statistics' });
  }
});

export default router;