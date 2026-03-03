/**
 * @module oracle/index
 *
 * CLI entry point for Oracle experiments.
 * Dynamically imports user experiment scripts and runs them through runExperiment().
 *
 * Usage:
 *   npm run oracle -- -c nuke-real-world.js
 *   npm run oracle -- -c nuke-real-world.js --outputDir temp/oracle-v2
 *   npm run oracle -- -c experiments/nuke-real-world.js --agentType strategist
 */

import path from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { createLogger } from '../utils/logger.js';
import { runExperiment } from './oracle.js';
import type { OracleConfig } from './types.js';
import { startWebServer } from '../web/server.js';

const logger = createLogger('OracleCLI');

/** Parse CLI flags (matches strategist pattern) */
const { values } = parseArgs({
  options: {
    config: {
      type: 'string',
      short: 'c',
    },
    outputDir: {
      type: 'string',
      short: 'o',
    },
    telemetryDir: {
      type: 'string',
      short: 't',
    },
    targetAgent: {
      type: 'string',
    },
    agentType: {
      type: 'string',
    },
  },
  strict: false,
  allowPositionals: false,
});

/**
 * Resolves an experiment script path.
 * - Absolute path -> use directly
 * - Path with directory separator -> resolve from cwd
 * - Bare filename -> resolve from experiments/ directory
 */
function resolveExperimentPath(input: string): string {
  if (path.isAbsolute(input)) return input;
  if (input.includes('/') || input.includes('\\')) return path.resolve(process.cwd(), input);
  return path.resolve(process.cwd(), 'experiments', input);
}

function printUsage(): void {
  logger.info([
    'Usage: npm run oracle -- -c <experiment-script> [options]',
    '',
    'Options:',
    '  --config, -c       Experiment script filename or path (required)',
    '  --outputDir, -o    Override output directory',
    '  --telemetryDir, -t Override telemetry directory',
    '  --targetAgent      Override target agent name',
    '  --agentType        Override agent type',
    '',
    'Examples:',
    '  npm run oracle -- -c nuke-real-world.js',
    '  npm run oracle -- -c nuke-real-world.js --outputDir temp/oracle-v2',
    '  npm run oracle -- -c experiments/nuke-real-world.js --agentType strategist',
  ].join('\n'));
}

async function main() {
  if (!values.config) {
    printUsage();
    process.exit(1);
  }

  const scriptPath = resolveExperimentPath(values.config as string);
  logger.info(`Loading experiment: ${scriptPath}`);

  try {
    // Dynamic import of the experiment script
    const scriptUrl = pathToFileURL(scriptPath).href;
    const module = await import(scriptUrl);
    const experimentConfig: OracleConfig = module.default;

    if (!experimentConfig || !experimentConfig.csvPath || !experimentConfig.experimentName || !experimentConfig.modifyPrompt) {
      logger.error('Experiment script must export a default OracleConfig with csvPath, experimentName, and modifyPrompt.');
      process.exit(1);
    }

    // Merge CLI overrides into experiment config
    const cliOverrides: Partial<OracleConfig> = {};
    if (values.outputDir) cliOverrides.outputDir = values.outputDir as string;
    if (values.telemetryDir) cliOverrides.telemetryDir = values.telemetryDir as string;
    if (values.targetAgent) cliOverrides.targetAgent = values.targetAgent as string;
    if (values.agentType) cliOverrides.agentType = values.agentType as string;

    const config: OracleConfig = { ...experimentConfig, ...cliOverrides };

    await startWebServer();
    logger.info(`Starting experiment: ${config.experimentName}`);
    const results = await runExperiment(config);

    // Print summary
    const errors = results.filter(r => r.error).length;
    const successes = results.length - errors;
    logger.info([
      `Experiment "${config.experimentName}" complete:`,
      `  ${successes} successful replays`,
      `  ${errors} errors`,
      `  Results: temp/oracle/${config.experimentName}-results.csv`,
      `  Trails: temp/oracle/${config.experimentName}/`,
      `  Telemetry: telemetry/oracle/${config.experimentName}.db`,
    ].join('\n'));
  } catch (error) {
    logger.error('Experiment failed:', error);
    process.exit(1);
  }
}

main();
