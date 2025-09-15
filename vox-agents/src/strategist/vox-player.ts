import { VoxContext } from "../infra/vox-context.js";
import { startActiveObservation } from "@langfuse/tracing";
import { StrategistParameters } from "./strategist.js";
import { createLogger } from "../utils/logger.js";
import { getModelConfig } from "../utils/models/models.js";
import { SimpleStrategist } from "./simple-strategist.js";
import { setTimeout } from 'node:timers/promises';
import { langfuseSpanProcessor } from "../instrumentation.js";

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

  constructor(
    public readonly playerID: number,
    private readonly strategistType: string,
    gameID: string,
    initialTurn: number
  ) {
    this.logger = createLogger(`VoxPlayer-${playerID}`);

    this.context = new VoxContext(getModelConfig("default"));
    this.context.registerAgent(new SimpleStrategist());

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
  notifyTurn(turn: number, latestID: number) {
    if (this.parameters.running) {
      this.logger.warn(`The ${this.strategistType} is still working on turn ${this.parameters.turn}. Skipping turn ${turn}...`);
      return;
    }

    this.pendingTurn = { turn, latestID };
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
        observation.updateTrace({
          sessionId: this.parameters.gameID ?? "Unknown",
        });

        try {
          await this.context.registerMCP();

          // Get the game metadata as a prerequisite
          this.parameters.store!.metadata = 
            this.parameters.store!.metadata ?? await this.context.callTool("get-metadata", {}, this.parameters);

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

              // Resume the game
              await this.context.callTool("resume-game", { PlayerID: this.playerID }, this.parameters);

              observation.update({
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
          this.logger.info(`Player ${this.playerID} (${this.parameters.gameID}) completion: ${this.aborted}`);
          observation.update({
            output: {
              completed: true,
              turns: this.parameters.turn
            }
          });
          await langfuseSpanProcessor.forceFlush();
        }
      }, {
      asType: "agent"
    });
  }

  /**
   * Abort this player's execution
   */
  abort() {
    this.logger.info(`Aborting player ${this.playerID}`);
    this.aborted = true;
    this.context.abort();
  }
}