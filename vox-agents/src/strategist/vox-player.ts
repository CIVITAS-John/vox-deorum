/**
 * @module strategist/vox-player
 *
 * Individual player management for strategist sessions.
 * Each VoxPlayer manages one player's agent execution, context, and telemetry.
 * Handles turn notifications, agent execution loop, and token usage tracking.
 */

import { VoxContext } from "../infra/vox-context.js";
import { trace, SpanStatusCode, SpanKind, context } from '@opentelemetry/api';
import { createLogger } from "../utils/logger.js";
import { SimpleStrategist } from "./agents/simple-strategist.js";
import { SimpleStrategistBriefed } from "./agents/simple-strategist-briefed.js";
import { SimpleBriefer } from "../briefer/simple-briefer.js";
import { NoneStrategist } from "./agents/none-strategist.js";
import { setTimeout } from 'node:timers/promises';
import { sqliteExporter, spanProcessor } from "../instrumentation.js";
import { config } from "../utils/config.js";
import { refreshGameState, StrategistParameters } from "./strategy-parameters.js";
import { VoxSpanExporter } from "../utils/telemetry/vox-exporter.js";
import { PlayerConfig } from "./strategist-session.js";

/**
 * Manages a single player's strategist execution within a game session.
 * Each player gets its own VoxContext, observation span, and execution loop.
 * Tracks token usage and reports telemetry via OpenTelemetry.
 *
 * @class
 */
export class VoxPlayer {
  private context: VoxContext<StrategistParameters>;
  private parameters: StrategistParameters;
  private logger;
  private pendingTurn?: { turn: number; latestID: number };
  private aborted = false;
  private successful = false;

  constructor(
    public readonly playerID: number,
    private readonly playerConfig: PlayerConfig,
    gameID: string,
    initialTurn: number
  ) {
    this.logger = createLogger(`VoxPlayer-${playerID}`);

    const id = `${gameID}-player-${playerID}`
    VoxSpanExporter.getInstance().createContext(id, this.playerConfig.strategist);

    // Pass model overrides to VoxContext
    this.context = new VoxContext(playerConfig.llms || {}, id);
    this.context.registerAgent(new SimpleStrategist());
    this.context.registerAgent(new SimpleStrategistBriefed());
    this.context.registerAgent(new SimpleBriefer());
    this.context.registerAgent(new NoneStrategist());

    this.parameters = {
      playerID,
      gameID,
      turn: -1,
      after: initialTurn * 1000000,
      before: 0,
      gameStates: []
    };
  }

  /**
   * Queue a turn notification for processing.
   * Notifications are queued if the agent is still processing the previous turn.
   *
   * @param turn - The turn number
   * @param latestID - Latest event ID from the game
   * @returns True if this is a new turn notification, false if duplicate
   */
  notifyTurn(turn: number, latestID: number): boolean {
    if (this.parameters.running) {
      this.logger.warn(`The ${this.playerConfig.strategist} is still working on turn ${this.parameters.turn}. Skipping turn ${turn}...`);
      return this.pendingTurn?.turn !== turn;
    }

    const result = this.pendingTurn?.turn !== turn;
    this.pendingTurn = { turn, latestID };
    return result;
  }

  /**
   * Main execution loop with observation span.
   * Processes turn notifications and executes the strategist agent for each turn.
   * Tracks telemetry and token usage throughout the game.
   */
  async execute(): Promise<void> {
    const tracer = trace.getTracer('vox-player');
    const span = tracer.startSpan(`player.${this.parameters.gameID}.${this.playerID}`, {
      attributes: {
        'vox.context.id': this.context.id,
        'player.id': this.playerID,
        'game.id': this.parameters.gameID,
        'strategist.type': this.playerConfig.strategist,
        'config.version': config.versionInfo?.version || "unknown"
      }
    });

    return await context.with(trace.setSpan(context.active(), span), async () => {
      try {
        await this.context.registerMCP();

        // Set the player's AI type
        await Promise.all([
          this.context.callTool("set-metadata", { Key: `experiment`, Value: this.playerConfig.strategist }, this.parameters),
          this.context.callTool("set-metadata", { Key: `strategist-${this.playerID}`, Value: this.playerConfig.strategist }, this.parameters)
        ]);

        // Resume the game in case the vox agent was aborted
        await this.context.callTool("resume-game", { PlayerID: this.playerID }, this.parameters);

        while (!this.aborted) {
          const turnData = this.pendingTurn;
          if (!turnData) {
            this.parameters.running = undefined;
            await setTimeout(10);
            continue;
          }

          // Initializing
          this.pendingTurn = undefined;
          this.parameters.turn = turnData.turn;
          this.parameters.before = turnData.latestID;
          this.parameters.running = this.playerConfig.strategist;

          // Logging
          const startingInput = this.context.inputTokens;
          const startingReasoning = this.context.reasoningTokens;
          const startingOutput = this.context.outputTokens;
          this.logger.warn(`Running ${this.playerConfig.strategist} on Turn ${this.parameters.turn}`, {
              GameID: this.parameters.gameID,
              PlayerID: this.parameters.playerID
            });

          // Start a new trace for each turn (no parent)
          const turnSpan = tracer.startSpan(`strategist.turn.${this.parameters.turn}`, {
            root: true, // This makes it a new trace
            attributes: {
              'vox.context.id': this.context.id,
              'player.id': String(this.playerID),
              'game.turn': String(this.parameters.turn),
              'event.before': String(this.parameters.before),
              'event.after': String(this.parameters.after),
              'strategist.type': this.playerConfig.strategist
            }
          });

          try {
            // Create a new root context for this turn's trace
            await context.with(trace.setSpan(context.active(), turnSpan), async () => {
              // Refresh all strategy parameters
              turnSpan.setAttributes({
                'game.state': JSON.stringify(await refreshGameState(this.context, this.parameters))
              });
              
              await this.context.callTool("pause-game", { PlayerID: this.playerID }, this.parameters);

              // Without strategists, we just fake one
              if (this.playerConfig.strategist == "none") {
                await setTimeout(2000);
              } else {
                await this.context.execute(this.playerConfig.strategist, this.parameters, undefined);
              }

              // Finalizing
              this.parameters.after = turnData.latestID;

              // Recording the tokens and resume the game
              await this.context.callTool("resume-game", { PlayerID: this.playerID }, this.parameters);

              // Update the status
              turnSpan.setAttributes({
                'completed': true,
                'tokens.input': this.context.inputTokens - startingInput,
                'tokens.reasoning': this.context.reasoningTokens - startingReasoning,
                'tokens.output': this.context.outputTokens - startingOutput
              });
              turnSpan.setStatus({ code: SpanStatusCode.OK });
            });
          } catch (error) {
            this.logger.error(`Player ${this.playerID} (${this.parameters.gameID}) execution error:`, error);
            turnSpan.recordException(error as Error);
            turnSpan.setStatus({
              code: SpanStatusCode.ERROR,
              message: error instanceof Error ? error.message : String(error)
            });
          } finally {
            this.parameters.running = undefined;
            turnSpan.end();
            await spanProcessor.forceFlush();
          }
        }

        this.successful = true;
        span.setStatus({ code: SpanStatusCode.OK });
      } catch (error) {
        this.logger.error(`Player ${this.playerID} (${this.parameters.gameID}) initializing error:`, error);
        span.recordException(error as Error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error)
        });
      } finally {
        this.logger.info(`Player ${this.playerID} (${this.parameters.gameID}) completion: ${this.aborted} (successful: ${this.successful})`);

        span.setAttributes({
          'completed': this.successful,
          'tokens.input': this.context.inputTokens,
          'tokens.reasoning': this.context.reasoningTokens,
          'tokens.output': this.context.outputTokens
        });

        await Promise.all([
          this.context.callTool("set-metadata", { Key: `inputTokens-${this.playerID}`, Value: String(this.context.inputTokens) }, this.parameters),
          this.context.callTool("set-metadata", { Key: `reasoningTokens-${this.playerID}`, Value: String(this.context.reasoningTokens) }, this.parameters),
          this.context.callTool("set-metadata", { Key: `outputTokens-${this.playerID}`, Value: String(this.context.outputTokens) }, this.parameters),
          sqliteExporter.forceFlush()
        ]);

        // Shutdown the VoxContext to ensure all telemetry is flushed
        await this.context.shutdown();

        span.end();
        await setTimeout(5000);
      }
    });
  }

  /**
   * Abort the player's execution.
   * Sets the abort flag and notifies the context to stop any running generation.
   *
   * @param successful - Whether the abort is due to successful game completion
   */
  abort(successful = false): void {
    this.logger.info(`Aborting player ${this.playerID} (successful: ${successful})`);
    this.aborted = true;
    this.successful = successful;
    this.context.abort(successful);
  }
}