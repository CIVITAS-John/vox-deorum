/**
 * @module telepathist/preparation/turn-preparation
 *
 * Generates turn summaries by executing GetGameStateTool and GetDecisionsTool
 * for each unsummarized turn, then calling the Summarizer with structured output.
 */

import pLimit from 'p-limit';
import { TelepathistParameters } from '../telepathist-parameters.js';
import { VoxContext } from '../../infra/vox-context.js';
import { GetGameStateTool } from '../tools/get-situation.js';
import { GetDecisionsTool } from '../tools/get-decision.js';
import { SummarizerInput } from '../summarizer.js';
import { turnSummarySchema, buildTurnSummaryInstruction, parseSummaryMarkdown } from './instructions.js';
import { exponentialRetry, isContextLengthError } from '../../utils/retry.js';
import { getModelConfig } from '../../utils/models/models.js';

/**
 * Generates turn summaries for all turns that don't already have them.
 * For each turn: executes game state + decisions tools, combines the data,
 * calls the summarizer with a structured instruction, and stores the result.
 *
 * @returns Set of turn numbers that failed due to context window exceeded
 */
export async function prepareTurnSummaries(
  parameters: TelepathistParameters,
  context: VoxContext<TelepathistParameters>
): Promise<Set<number>> {
  const model = getModelConfig('summarizer', undefined, context.modelOverrides).name;
  const logger = context.logger.child({ gameID: parameters.gameID, playerID: parameters.playerID, civ: parameters.civilizationName, model });

  const existingSummaries = await parameters.telepathistDb
    .selectFrom('turn_summaries')
    .select('turn')
    .execute();
  const existingTurns = new Set(existingSummaries.map(s => s.turn));

  const turnsToSummarize = parameters.availableTurns.filter(t => !existingTurns.has(t));

  const contextExceededTurns = new Set<number>();

  if (turnsToSummarize.length === 0) {
    logger.info('All turn summaries already exist, skipping summarization');
    context.streamProgress?.('Summaries already exist. Loading...');
    return contextExceededTurns;
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

          const [instruction, reminder] = buildTurnSummaryInstruction(turn);
          const summaryInput: SummarizerInput = {
            text: combinedText,
            instruction,
            reminder
          };

          const turnParameters = { ...parameters, turn };
          let formatFailures = 0;
          const summary = await exponentialRetry(async () => {
            const rawSummary = await context.callAgent<string>(
              'summarizer',
              summaryInput,
              turnParameters
            );
            const parsed = rawSummary ? parseSummaryMarkdown(rawSummary, turnSummarySchema) : undefined;
            if (!parsed) {
              formatFailures++;
              const error = new Error(`Summarizer returned no usable result for turn ${turn} (format failure ${formatFailures}/10): ${rawSummary}`);
              if (formatFailures >= 10) (error as Error & { isRetryable: boolean }).isRetryable = false;
              throw error;
            }
            return parsed;
          }, logger, undefined, `turn-${turn}`);

          if (summary) {
            context.streamProgress?.(`Turn ${turn}: ${summary.narrative}`);
            await parameters.telepathistDb
              .insertInto('turn_summaries')
              .values({
                turn,
                situation: summary.situation,
                situationAbstract: summary.situationabstract,
                decisions: summary.decisions,
                decisionAbstract: summary.decisionabstract,
                narrative: summary.narrative,
                model,
                createdAt: Date.now()
              })
              .execute();
          }
        } catch (e) {
          if (isContextLengthError(e)) {
            logger.warn(`Context window exceeded for turn ${turn}, marking as non-landmark candidate`, { error: e });
            contextExceededTurns.add(turn);
          } else {
            logger.error(`Failed to summarize turn ${turn}`, { error: e });
          }
        }
      })
    )
  );

  return contextExceededTurns;
}
