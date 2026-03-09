/**
 * Ambient type declarations for kysely-duckdb.
 * The package uses exports.types which moduleResolution:"node" doesn't resolve.
 * Re-declares the subset of the API used by the archivist.
 */

declare module 'kysely-duckdb' {
  import type { Dialect, Kysely, QueryCompiler, DatabaseIntrospector, Driver, DialectAdapter } from 'kysely';
  import type { DuckDBInstance, DuckDBConnection } from '@duckdb/node-api';

  interface DuckDbDialectConfig {
    database: (() => Promise<DuckDBInstance>) | DuckDBInstance;
    onCreateConnection?: (connection: DuckDBConnection) => Promise<void>;
    tableMappings?: Record<string, string>;
  }

  class DuckDbDialect implements Dialect {
    constructor(config: DuckDbDialectConfig);
    createQueryCompiler(): QueryCompiler;
    createIntrospector(db: Kysely<any>): DatabaseIntrospector;
    createDriver(): Driver;
    createAdapter(): DialectAdapter;
  }
}
