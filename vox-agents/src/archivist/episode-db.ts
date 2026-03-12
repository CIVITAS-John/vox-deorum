/**
 * @module archivist/episode-db
 *
 * Unified DuckDB instance access for the episode database.
 * All consumers (reader, writer, console UI) should use these functions
 * instead of calling DuckDBInstance directly, to ensure path normalization
 * and instance sharing via the native cache.
 */

import path from 'node:path';
import { DuckDBInstance, DuckDBConnection } from '@duckdb/node-api';

/** Get a shared DuckDB instance for the given path (resolved to absolute for consistent cache keys). */
export async function getEpisodeDbInstance(dbPath: string): Promise<DuckDBInstance> {
  return DuckDBInstance.fromCache(path.resolve(dbPath));
}

/** Get a read-only DuckDB instance that won't acquire a write lock, allowing concurrent access from other processes. */
export async function getEpisodeDbReadonlyInstance(dbPath: string): Promise<DuckDBInstance> {
  return DuckDBInstance.fromCache(path.resolve(dbPath), { access_mode: 'READ_ONLY' });
}

/** Get a new connection from the shared instance. */
export async function getEpisodeDbConnection(dbPath: string): Promise<DuckDBConnection> {
  const instance = await getEpisodeDbInstance(dbPath);
  return instance.connect();
}
