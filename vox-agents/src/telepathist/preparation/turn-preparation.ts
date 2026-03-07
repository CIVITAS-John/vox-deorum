/**
 * @module telepathist/preparation/turn-preparation
 *
 * Generates turn summaries by executing GetGameStateTool and GetDecisionsTool
 * for each unsummarized turn, then calling the Summarizer with structured output.
 */

// @ts-ignore - jaison doesn't have type definitions
import jaison from 'jaison';
import pLimit from 'p-limit';
import { TelepathistParameters } from '../telepathist-parameters.js';
import { VoxContext } from '../../infra/vox-context.js';
import { GetGameStateTool } from '../tools/get-situation.js';
import { GetDecisionsTool } from '../tools/get-decision.js';
import { SummarizerInput } from '../summarizer.js';
import { turnSummarySchema, buildTurnSummaryInstruction } from './instructions.js';
import { createLogger } from '../../utils/logger.js';
import { exponentialRetry } from '../../utils/retry.js';
import { getModelConfig } from '../../utils/models/models.js';

const logger = createLogger('TurnPreparation');

/**
 * Generates turn summaries for all turns that don't already have them.
 * For each turn: executes game state + decisions tools, combines the data,
 * calls the summarizer with a structured instruction, and stores the result.
 */
export async function prepareTurnSummaries(
  parameters: TelepathistParameters,
  context: VoxContext<TelepathistParameters>
): Promise<void> {
  const existingSummaries = await parameters.telepathistDb
    .selectFrom('turn_summaries')
    .select('turn')
    .execute();
  const existingTurns = new Set(existingSummaries.map(s => s.turn));

  const turnsToSummarize = parameters.availableTurns.filter(t => !existingTurns.has(t));

  if (turnsToSummarize.length === 0) {
    logger.info('All turn summaries already exist, skipping summarization');
    context.streamProgress?.('Summaries already exist. Loading...');
    return;
  }

  logger.info(`Generating summaries for ${turnsToSummarize.length} turns`);

  const gameStateTool = new GetGameStateTool();
  const decisionsTool = new GetDecisionsTool();
  const limit = pLimit(5);

  await Promise.all(
    turnsToSummarize.map((turn, i) =>
      limit(async () => {
        context.streamProgress?.(`Analyzing turn ${turn} (${i + 1}/${turnsToSummarize.length})...`);

        try {
          // Gather situation data (all categories)
          const gameStateSections = await gameStateTool.execute({ Turns: String(turn) }, parameters);
          const gameStateText = gameStateSections.join('\n\n');

          // Gather decisions data
          const decisionsSections = await decisionsTool.execute({ Turns: String(turn) }, parameters);
          const decisionsText = decisionsSections.join('\n\n');

          // Skip if no meaningful data
          if (!gameStateText.includes('## ') && !decisionsText.includes('# Turn')) {
            logger.warn(`No data found for turn ${turn}, skipping`);
            return;
          }

          // Combine into summarizer input
          const combinedText = [
            '# Game State',
            gameStateText,
            '# Decisions',
            decisionsText
          ].join('\n\n');

          const summaryInput: SummarizerInput = {
            text: combinedText,
            instruction: buildTurnSummaryInstruction(turn)
          };

          const turnParameters = { ...parameters, turn };
          const summary = await exponentialRetry(async () => {
            const rawSummary = await context.callAgent<string>(
              'summarizer',
              summaryInput,
              turnParameters
            );
            const parsed = rawSummary ? parseTurnSummary(rawSummary) : undefined;
            if (!parsed) throw new Error(`Summarizer returned no usable result for turn ${turn}`);
            return parsed;
          }, logger, undefined, `turn-${turn}`, 3, 1000, 5000);

          if (summary) {
            context.streamProgress?.(`Turn ${turn}: ${summary.narrative}`);
            await parameters.telepathistDb
              .insertInto('turn_summaries')
              .values({
                turn,
                situation: summary.situation,
                abstract: summary.abstract,
                decisions: summary.decisions,
                narrative: summary.narrative,
                model: getModelConfig('summarizer', undefined, context.modelOverrides).name,
                createdAt: Date.now()
              })
              .execute();
          }
        } catch (e) {
          logger.error(`Failed to summarize turn ${turn}`, { error: e });
        }
      })
    )
  );
}

/**
 * Parse a turn summary from the Summarizer's text response.
 * Uses jaison + code-block stripping (same pattern as VoxAgent.getOutput()).
 */
function parseTurnSummary(rawText: string): { situation: string; abstract: string; decisions: string; narrative: string } | undefined {
  try {
    const cleaned = rawText.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
    const parsed = jaison(cleaned);
    return turnSummarySchema.parse(parsed);
  } catch (e) {
    logger.error('Failed to parse turn summary from summarizer response', { error: e });
    return undefined;
  }
}
