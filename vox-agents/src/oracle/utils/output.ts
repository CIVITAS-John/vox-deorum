/**
 * @module oracle/utils/output
 *
 * Output helpers for Oracle experiments: CSV writing, trail writing, path resolution.
 */

import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';
import { jsonToMarkdown } from '../../utils/tools/json-to-markdown.js';
import type { ReplayResult } from '../types.js';

/** Resolve a path that may be relative or absolute */
export function resolvePath(p: string): string {
  return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
}

/**
 * Write the output CSV from replay results.
 * Extracts replayRationale from strategist decision tool args.
 */
export function writeCsv(outputPath: string, results: ReplayResult[]): void {
  const decisionTools = ['set-flavors', 'set-strategy', 'keep-status-quo'];
  const csvRows = results.map(r => {
    const { rationale, ...rest } = r.row;
    const replayRationale = r.decisions.find(d => decisionTools.includes(d.toolName))?.rationale ?? '';
    return {
      ...rest,
      originalRationale: rationale,
      model: r.model,
      replayRationale,
      input_tokens: r.tokens.inputTokens,
      reasoning_tokens: r.tokens.reasoningTokens,
      output_tokens: r.tokens.outputTokens,
      ...(r.error ? { error: r.error } : {}),
      ...(r.repetition !== undefined ? { repetition: r.repetition } : {}),
      ...(r.extractedColumns ?? {}),
    };
  });

  fs.writeFileSync(outputPath, Papa.unparse(csvRows), 'utf-8');
}

/**
 * Write JSON and markdown trail files for a single replayed row.
 *
 * @param experimentDir - Directory where trails are written
 * @param trailBase - File base name without extension (e.g. "game123-p1-t30" or "game123-p1-t30-ModelName")
 * @param data - Trail payload object
 */
export function writeTrail(experimentDir: string, trailBase: string, data: object): void {
  const jsonPath = path.join(experimentDir, `${trailBase}.json`);
  const mdPath = path.join(experimentDir, `${trailBase}.md`);

  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
  fs.writeFileSync(mdPath, jsonToMarkdown(data, { startingLevel: 1 }));
}
