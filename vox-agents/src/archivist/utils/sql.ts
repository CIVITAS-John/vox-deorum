/**
 * @module archivist/utils/sql
 *
 * DuckDB SQL generation utilities and result mapping helpers
 * for the episode retrieval pipeline.
 */

import { eraMap } from '../types.js';

/** Convert a JS number array to a DuckDB REAL[] literal for embedding in SQL. */
export function toRealArrayLiteral(arr: number[]): string {
  return `[${arr.join(',')}]::REAL[]`;
}

/** Build a SQL CASE expression mapping era strings to ordinal values. */
export function buildEraCaseExpr(): string {
  const cases = Object.entries(eraMap)
    .map(([era, ord]) => `WHEN era = '${era}' THEN ${ord}`)
    .join(' ');
  return `CASE ${cases} ELSE 0 END`;
}

/** Escape single quotes for safe SQL string embedding. */
export function escapeSql(s: string): string {
  return s.replace(/'/g, "''");
}

/** Map DuckDB result rows to plain objects keyed by column name. */
export async function rowsToObjects(result: any): Promise<Record<string, any>[]> {
  const columnCount = result.columnCount;
  const names: string[] = [];
  for (let i = 0; i < columnCount; i++) {
    names.push(result.columnName(i));
  }
  const rows = await result.getRows();
  return rows.map((row: any) => {
    const obj: Record<string, any> = {};
    for (let i = 0; i < columnCount; i++) {
      obj[names[i]] = row[i];
    }
    return obj;
  });
}
