/**
 * @module telepathist/preparation/phase-preparation
 *
 * Generates phase summaries by grouping turn summaries into ~10-turn phases
 * and calling the Summarizer with structured output for each unsummarized phase.
 */

import pLimit from 'p-limit';
import { TelepathistParameters } from '../telepathist-parameters.js';
import { VoxContext } from '../../infra/vox-context.js';
import { SummarizerInput } from '../summarizer.js';
import { phaseSummarySchema, buildPhaseSummaryInstruction, parseSummaryMarkdown } from './instructions.js';
import { createLogger } from '../../utils/logger.js';
import { exponentialRetry } from '../../utils/retry.js';
import { getModelConfig } from '../../utils/models/models.js';

const logger = createLogger('PhasePreparation');

/** Size of each phase in turns for summarization */
const phaseSize = 10;

/**
 * Generates phase summaries from turn summaries, ~10 turns per phase.
 * For each phase: combines turn situation + decisions texts, calls the summarizer
 * with a structured instruction, and stores the result.
 */
export async function preparePhaseSummaries(
  parameters: TelepathistParameters,
  context: VoxContext<TelepathistParameters>
): Promise<void> {
  const existingPhases = await parameters.telepathistDb
    .selectFrom('phase_summaries')
    .select(['fromTurn', 'toTurn'])
    .execute();
  const existingPhaseKeys = new Set(existingPhases.map(p => `${p.fromTurn}-${p.toTurn}`));

  const turnSummaries = await parameters.telepathistDb
    .selectFrom('turn_summaries')
    .selectAll()
    .orderBy('turn', 'asc')
    .execute();

  if (turnSummaries.length === 0) return;

  // Group into phases of ~phaseSize turns
  const phases: { fromTurn: number; toTurn: number; summaries: typeof turnSummaries }[] = [];
  for (let i = 0; i < turnSummaries.length; i += phaseSize) {
    const chunk = turnSummaries.slice(i, i + phaseSize);
    phases.push({
      fromTurn: chunk[0].turn,
      toTurn: chunk[chunk.length - 1].turn,
      summaries: chunk
    });
  }

  const phasesToSummarize = phases.filter(p => !existingPhaseKeys.has(`${p.fromTurn}-${p.toTurn}`));
  const limit = pLimit(5);

  await Promise.all(
    phasesToSummarize.map(phase =>
      limit(async () => {
        context.streamProgress?.(`Summarizing phase: turns ${phase.fromTurn}–${phase.toTurn}...`);

        try {
          // Format turn situation + decisions as combined input
          const formattedSummaries = phase.summaries
            .map(s => `## Turn ${s.turn}\n### Situation\n${s.situation}\n### Decisions\n${s.decisions}`)
            .join('\n\n');

          const input: SummarizerInput = {
            text: `# Turn Summaries: Turns ${phase.fromTurn} to ${phase.toTurn}\n${formattedSummaries}`,
            instruction: buildPhaseSummaryInstruction(phase.fromTurn, phase.toTurn)
          };
          const phaseParameters = { ...parameters, turn: phase.toTurn };

          const parsed = await exponentialRetry(async () => {
            const rawPhaseSummary = await context.callAgent<string>(
              'summarizer',
              input,
              phaseParameters
            );
            const result = rawPhaseSummary ? parseSummaryMarkdown(rawPhaseSummary, phaseSummarySchema) : undefined;
            if (!result) throw new Error(`Summarizer returned no usable result for phase ${phase.fromTurn}-${phase.toTurn}: ${rawPhaseSummary}`);
            return result;
          }, logger, undefined, `phase-${phase.fromTurn}-${phase.toTurn}`, 3, 1000, 5000);

          if (parsed) {
            context.streamProgress?.(`Phase ${phase.fromTurn}–${phase.toTurn}: ${parsed.narrative}`);
            await parameters.telepathistDb
              .insertInto('phase_summaries')
              .values({
                fromTurn: phase.fromTurn,
                toTurn: phase.toTurn,
                situation: parsed.situation,
                abstract: parsed.abstract,
                decisions: parsed.decisions,
                narrative: parsed.narrative,
                model: getModelConfig('summarizer', undefined, context.modelOverrides).name,
                createdAt: Date.now()
              })
              .execute();
          }
        } catch (e) {
          logger.error(`Failed to summarize phase ${phase.fromTurn}-${phase.toTurn}`, { error: e });
        }
      })
    )
  );
}
