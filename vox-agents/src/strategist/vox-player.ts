import { VoxContext } from "../infra/vox-context.js";
import { startActiveObservation, updateActiveTrace } from "@langfuse/tracing";
import { StrategistParameters } from "./strategist.js";
import { createLogger } from "../utils/logger.js";
import { getModelConfig } from "../utils/models/models.js";
import { SimpleStrategist } from "./simple-strategist.js";
import { setTimeout } from 'node:timers/promises';
import { langfuseSpanProcessor } from "../instrumentation.js";
import { NoneStrategist } from "./none-strategist.js";
import { config } from "../utils/config.js";

/**
 * Manages a single player's strategist execution within a game session.
 * Each player gets its own VoxContext and observation span.
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
    private readonly strategistType: string,
    gameID: string,
    initialTurn: number
  ) {
    this.logger = createLogger(`VoxPlayer-${playerID}`);

    this.context = new VoxContext(getModelConfig("default"));
    this.context.registerAgent(new SimpleStrategist());
    this.context.registerAgent(new NoneStrategist());

    this.parameters = {
      playerID,
      gameID,
      turn: -1,
      after: initialTurn * 1000000,
      before: 0,
      store: {}
    };
  }

  /**
   * Queue a turn notification for processing
   */
  notifyTurn(turn: number, latestID: number): boolean {
    if (this.parameters.running) {
      this.logger.warn(`The ${this.strategistType} is still working on turn ${this.parameters.turn}. Skipping turn ${turn}...`);
      return this.pendingTurn?.turn !== turn;
    }

    const result = this.pendingTurn?.turn !== turn;
    this.pendingTurn = { turn, latestID };
    return result;
  }

  /**
   * Main execution loop with observation span
   */
  async execute(): Promise<void> {
    // Run the agent
    return await startActiveObservation(
      `${this.parameters.gameID}-${this.playerID}`,
      async (observation) => {
        observation.update({
          input: {
            playerID: this.playerID,
            gameID: this.parameters.gameID,
            strategist: this.strategistType
          },
          output: {
            completed: false,
            turns: this.parameters.turn,
          }
        });
        updateActiveTrace({
          input: {
            playerID: this.playerID,
            gameID: this.parameters.gameID,
            strategist: this.strategistType
          },
          output: {
            completed: false,
            turns: this.parameters.turn,
          },
          sessionId: this.parameters.gameID ?? "Unknown",
          environment: this.strategistType,
          version: config.versionInfo?.version || "unknown"
        })
        await langfuseSpanProcessor.forceFlush();

        try {
          await this.context.registerMCP();

          // Get the game metadata as a prerequisite
          this.parameters.store!.metadata = 
            this.parameters.store!.metadata ?? 
              await this.context.callTool("get-metadata", { PlayerID: this.playerID }, this.parameters);

          // Set the player's AI type
          await this.context.callTool("set-metadata", { Key: `experiment`, Value: this.strategistType }, this.parameters);
          await this.context.callTool("set-metadata", { Key: `strategist-${this.playerID}`, Value: this.strategistType }, this.parameters);

          // Resume the game in case the vox agent was aborted
          await this.context.callTool("resume-game", { PlayerID: this.playerID }, this.parameters);

          while (!this.aborted) {
            const turnData = this.pendingTurn;
            if (!turnData) {
              await setTimeout(10);
              continue;
            }

            // Initializing
            this.pendingTurn = undefined;
            this.parameters.turn = turnData.turn;
            this.parameters.before = turnData.latestID;
            this.parameters.running = this.strategistType;

            this.logger.warn(`Running ${this.strategistType} on ${this.parameters.turn}, with events ${this.parameters.after}~${this.parameters.before}`);

            try {
              await this.context.callTool("pause-game", { PlayerID: this.playerID }, this.parameters);

              // Without strategists, we just fake one
              if (this.strategistType == "none") {
                await setTimeout(2000);
              } else {
                await this.context.execute(this.strategistType, this.parameters);
              }

              // Finalizing
              this.parameters.running = undefined;
              this.parameters.after = turnData.latestID;

              // Recording the tokens and resume the game
              await this.context.callTool("resume-game", { PlayerID: this.playerID }, this.parameters);

              observation.update({
                output: {
                  completed: false,
                  turns: this.parameters.turn,
                }
              });
              updateActiveTrace({
                output: {
                  completed: false,
                  turns: this.parameters.turn,
                }
              });
            } catch (error) {
              this.logger.error(`${this.strategistType} error:`, error);
            }
          }
        } catch (error) {
          this.logger.error(`Player ${this.playerID} (${this.parameters.gameID}) execution error:`, error);
          observation.update({ output: { error: error instanceof Error ? error.message : String(error) } });
        } finally {
          this.logger.info(`Player ${this.playerID} (${this.parameters.gameID}) completion: ${this.aborted} (successful: ${this.successful})`);
          observation.update({
            output: {
              completed: true,
              successful: this.successful,
              turns: this.parameters.turn
            }
          });
          updateActiveTrace({
            output: {
              completed: true,
              successful: this.successful,
              turns: this.parameters.turn,
            }
          });
          await Promise.all([
            this.context.callTool("set-metadata", { Key: `inputTokens-${this.playerID}`, Value: String(this.context.inputTokens) }, this.parameters),
            this.context.callTool("set-metadata", { Key: `reasoningTokens-${this.playerID}`, Value: String(this.context.reasoningTokens) }, this.parameters),
            this.context.callTool("set-metadata", { Key: `outputTokens-${this.playerID}`, Value: String(this.context.outputTokens) }, this.parameters),
            langfuseSpanProcessor.forceFlush()
          ]);
          await setTimeout(1000);
        }
      }, {
      asType: "agent"
    });
  }

  /**
   * Abort this player's execution
   */
  abort(successful: boolean = false) {
    if (this.aborted) return;
    this.logger.info(`Aborting player ${this.playerID}`);
    this.aborted = true;
    this.successful = successful;
    this.context.abort(successful);
  }

  /**
   * Get the underlying VoxContext
   */
  getContext() {
    return this.context;
  }
}