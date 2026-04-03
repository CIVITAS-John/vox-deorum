/**
 * @module oracle/oracle
 *
 * Public API for Oracle experiments.
 * Two composable phases: retrieve (raw telemetry extraction) and replay (LLM execution).
 *
 * See docs/oracle.md for full documentation.
 */

export { runRetrieve } from './retriever.js';
export { runReplay } from './replayer.js';
