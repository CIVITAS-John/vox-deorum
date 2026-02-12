/**
 * @module telepathist/telepathist
 *
 * Base Telepathist agent that reads from telemetry databases.
 * Extends Envoy<TelepathistParameters> to reuse chat infrastructure.
 * Handles session initialization (batch summarization) and provides
 * database-backed context instead of live game state.
 */

import { ModelMessage, StepResult, Tool } from 'ai';
import { Envoy } from '../envoy/envoy.js';
import { TelepathistParameters } from './telepathist-parameters.js';
import { TelepathistTool } from './telepathist-tool.js';
import { GetGameOverviewTool } from './tools/get-game-overview.js';
import { GetGameStateTool } from './tools/get-game-state.js';
import { GetDecisionsTool } from './tools/get-decisions.js';
import { GetConversationLogTool } from './tools/get-conversation-log.js';
import { TurnSummarizerInput, TurnSummary } from './turn-summarizer.js';
import { PhaseSummarizerInput } from './phase-summarizer.js';
import { EnvoyThread, SpecialMessageConfig, MessageWithMetadata } from '../types/index.js';
import { VoxContext } from '../infra/vox-context.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Telepathist');

/** Size of each phase in turns for summarization */
const phaseSize = 10;

/**
 * All available telepathist tool instances
 */
const toolInstances: TelepathistTool[] = [
  new GetGameOverviewTool(),
  new GetGameStateTool(),
  new GetDecisionsTool(),
  new GetConversationLogTool(),
];

/**
 * Base Telepathist agent for database-backed conversations.
 * Subclasses specialize the persona and behavior.
 *
 * @abstract
 */
export abstract class Telepathist extends Envoy<TelepathistParameters> {
  /** Allow the LLM to decide when to call tools */
  public override toolChoice: string = 'auto';

  /**
   * Provides the telepathist tools to the context.
   */
  public override getExtraTools(context: VoxContext<TelepathistParameters>): Record<string, Tool> {
    const tools: Record<string, Tool> = {};
    for (const instance of toolInstances) {
      tools[instance.name] = instance.createTool(context);
    }
    return tools;
  }

  /**
   * Returns tool names available to this agent
   */
  public override getActiveTools(_parameters: TelepathistParameters): string[] | undefined {
    return toolInstances.map(t => t.name);
  }

  /**
   * Orchestrates initial messages with special message support.
   * Handles {{{Initialize}}} for batch summarization + greeting,
   * and normal messages with database context + conversation history.
   */
  public async getInitialMessages(
    parameters: TelepathistParameters,
    input: EnvoyThread,
    context: VoxContext<TelepathistParameters>
  ): Promise<ModelMessage[]> {
    const specialConfig = this.findLastSpecialMessage(input);
    const messages = await this.getContextMessages(parameters, input);

    if (specialConfig) {
      // Check if this is the Initialize special message
      if (this.isInitializeMessage(input)) {
        await this.runInitialization(parameters, context);
        // Re-fetch context messages since we may have generated summaries
        const updatedMessages = await this.getContextMessages(parameters, input);
        updatedMessages.push({
          role: 'user',
          content: `# Special Instruction\n${specialConfig.prompt}`.trim()
        });
        return updatedMessages;
      }

      // Other special messages
      messages.push({
        role: 'user',
        content: `# Special Instruction\n${specialConfig.prompt}`.trim()
      });
      return messages;
    }

    // Normal mode: add conversation history and hint
    messages.push(...this.convertToModelMessages(
      this.filterSpecialMessages(input.messages)
    ));
    messages.push({
      role: 'user',
      content: this.getHint(parameters, input)
    });

    return messages;
  }

  /**
   * Disables tools when in special message mode.
   */
  public override async prepareStep(
    parameters: TelepathistParameters,
    input: EnvoyThread,
    lastStep: StepResult<Record<string, Tool>> | null,
    allSteps: StepResult<Record<string, Tool>>[],
    messages: ModelMessage[],
    context: VoxContext<TelepathistParameters>
  ) {
    const config = await super.prepareStep(parameters, input, lastStep, allSteps, messages, context);
    if (this.isSpecialMode(input)) {
      config.activeTools = [];
    }
    return config;
  }

  // --- Special message handling ---

  /** Checks if the current interaction is in special message mode */
  protected isSpecialMode(input: EnvoyThread): boolean {
    return this.findLastSpecialMessage(input) !== undefined;
  }

  /** Checks if the last message is a registered special message token */
  private findLastSpecialMessage(input: EnvoyThread): SpecialMessageConfig | undefined {
    if (input.messages.length === 0) return undefined;
    const last = input.messages[input.messages.length - 1];
    if (typeof last.message.content === 'string') {
      return this.getSpecialMessages()[last.message.content];
    }
    return undefined;
  }

  /** Checks if the last message is the {{{Initialize}}} message */
  private isInitializeMessage(input: EnvoyThread): boolean {
    if (input.messages.length === 0) return false;
    const last = input.messages[input.messages.length - 1];
    return typeof last.message.content === 'string' && last.message.content === '{{{Initialize}}}';
  }

  /** Filters out special messages from message history */
  protected filterSpecialMessages(messages: MessageWithMetadata[]): MessageWithMetadata[] {
    const specialMessages = this.getSpecialMessages();
    return messages.filter(msg => {
      if (msg.message.role === 'user' && typeof msg.message.content === 'string') {
        return !(msg.message.content in specialMessages);
      }
      return true;
    });
  }

  // --- Database context assembly ---

  /**
   * Returns context messages: player identity + phase summaries.
   * Always available to the LLM as system context.
   */
  protected async getContextMessages(
    parameters: TelepathistParameters,
    _input: EnvoyThread
  ): Promise<ModelMessage[]> {
    // Build phase summaries section
    const phaseSummaries = await parameters.telepathistDb
      .selectFrom('phase_summaries')
      .selectAll()
      .orderBy('fromTurn', 'asc')
      .execute();

    let phaseSummaryText = '';
    if (phaseSummaries.length > 0) {
      const parts = phaseSummaries.map(
        ps => `### Turns ${ps.fromTurn}–${ps.toTurn}\n${ps.summary}`
      );
      phaseSummaryText = `\n\n# Game History\n${parts.join('\n\n')}`;
    }

    const turnRange = parameters.availableTurns.length > 0
      ? `Turns ${parameters.availableTurns[0]} to ${parameters.availableTurns[parameters.availableTurns.length - 1]}`
      : 'No turns available';

    return [{
      role: 'system',
      content: `# Player Identity
- **Civilization**: ${parameters.civilizationName}
- **Leader**: ${parameters.leaderName}
- **Game ID**: ${parameters.gameID}
- **Available Data**: ${turnRange} (${parameters.availableTurns.length} turns)${phaseSummaryText}`.trim()
    }];
  }

  // --- Session initialization ---

  /**
   * Runs batch summarization: generates turn summaries and phase summaries
   * for all turns that don't already have summaries.
   */
  private async runInitialization(
    parameters: TelepathistParameters,
    context: VoxContext<TelepathistParameters>
  ): Promise<void> {
    // Check which turns already have summaries
    const existingSummaries = await parameters.telepathistDb
      .selectFrom('turn_summaries')
      .select('turn')
      .execute();
    const existingTurns = new Set(existingSummaries.map(s => s.turn));

    const turnsToSummarize = parameters.availableTurns.filter(t => !existingTurns.has(t));

    if (turnsToSummarize.length === 0) {
      logger.info('All turn summaries already exist, skipping summarization');
      context.streamProgress?.('Summaries already exist. Loading...');
    } else {
      logger.info(`Generating summaries for ${turnsToSummarize.length} turns`);

      // Generate turn summaries one at a time
      for (let i = 0; i < turnsToSummarize.length; i++) {
        const turn = turnsToSummarize[i];
        context.streamProgress?.(`Analyzing turn ${turn} (${i + 1}/${turnsToSummarize.length})...`);

        try {
          const gameStateTool = toolInstances.find(t => t.name === 'get-game-state') as GetGameStateTool;
          const gameStateText = await gameStateTool.execute({ turns: String(turn) }, parameters);
          if (!gameStateText.includes('## ')) {
            logger.warn(`No game state data found for turn ${turn}, skipping`);
            continue;
          }

          const summaryInput: TurnSummarizerInput = {
            turn,
            gameStateText
          };

          const summary = await context.callAgent<TurnSummary>(
            'turn-summarizer',
            summaryInput,
            parameters
          );

          if (summary) {
            context.streamProgress?.(`Turn ${turn}: ${summary.shortSummary}`);
            await parameters.telepathistDb
              .insertInto('turn_summaries')
              .values({
                turn,
                shortSummary: summary.shortSummary,
                fullSummary: summary.fullSummary,
                model: 'auto',
                createdAt: Date.now()
              })
              .execute();
          }
        } catch (e) {
          logger.error(`Failed to summarize turn ${turn}`, { error: e });
        }
      }
    }

    // Generate phase summaries
    await this.generatePhaseSummaries(parameters, context);
  }

  /**
   * Generates phase summaries from turn summaries, ~10 turns per phase.
   */
  private async generatePhaseSummaries(
    parameters: TelepathistParameters,
    context: VoxContext<TelepathistParameters>
  ): Promise<void> {
    // Check existing phase summaries
    const existingPhases = await parameters.telepathistDb
      .selectFrom('phase_summaries')
      .select(['fromTurn', 'toTurn'])
      .execute();
    const existingPhaseKeys = new Set(existingPhases.map(p => `${p.fromTurn}-${p.toTurn}`));

    // Get all turn summaries
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

    for (const phase of phases) {
      const key = `${phase.fromTurn}-${phase.toTurn}`;
      if (existingPhaseKeys.has(key)) continue;

      context.streamProgress?.(`Summarizing phase: turns ${phase.fromTurn}–${phase.toTurn}...`);

      try {
        const turnSummaries: Record<number, string> = {};
        for (const s of phase.summaries) {
          turnSummaries[s.turn] = s.shortSummary;
        }

        const input: PhaseSummarizerInput = {
          fromTurn: phase.fromTurn,
          toTurn: phase.toTurn,
          turnSummaries
        };

        const phaseSummary = await context.callAgent<string>(
          'phase-summarizer',
          input,
          parameters
        );

        if (phaseSummary) {
          context.streamProgress?.(`Phase ${phase.fromTurn}–${phase.toTurn}: ${phaseSummary}`);
          await parameters.telepathistDb
            .insertInto('phase_summaries')
            .values({
              fromTurn: phase.fromTurn,
              toTurn: phase.toTurn,
              summary: phaseSummary,
              model: 'auto',
              createdAt: Date.now()
            })
            .execute();
        }
      } catch (e) {
        logger.error(`Failed to summarize phase ${phase.fromTurn}-${phase.toTurn}`, { error: e });
      }
    }
  }

  // --- Abstract methods ---

  /**
   * Returns a contextual hint anchoring the LLM on its role and audience.
   */
  protected abstract getHint(parameters: TelepathistParameters, input: EnvoyThread): string;
}
