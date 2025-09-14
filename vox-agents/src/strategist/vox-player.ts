import { VoxContext } from "../infra/vox-context.js";
import { startActiveObservation, updateActiveTrace } from "@langfuse/tracing";
import { StrategistParameters } from "./strategist.js";
import { createLogger } from "../utils/logger.js";
import { getModelConfig } from "../utils/models.js";
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
  private turnSignal?: () => void;
  private aborted = false;

  constructor(
    public readonly playerID: number,
    private readonly strategistType: string,
    gameID?: string,
    initialTurn: number = 0
  ) {
    this.logger = createLogger(`VoxPlayer-${playerID}`);

    this.context = new VoxContext(getModelConfig("default"));
    this.context.registerAgent(new SimpleStrategist());

    this.parameters = {
      playerID,
      gameID,
      turn: -1,
      after: initialTurn * 1000000,
      before: 0
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
    if (this.turnSignal) {
      this.turnSignal();
    }
  }

  /**
   * Wait for the next turn notification
   */
  private async waitForTurn(): Promise<{ turn: number; latestID: number } | null> {
    if (this.pendingTurn) {
      const turn = this.pendingTurn;
      this.pendingTurn = undefined;
      return turn;
    }

    if (this.aborted) return null;

    return new Promise((resolve) => {
      this.turnSignal = () => {
        this.turnSignal = undefined;
        resolve(this.pendingTurn || null);
        this.pendingTurn = undefined;
      };
    });
  }

  /**
   * Main execution loop with observation span
   */
  async execute(): Promise<void> {
    return await startActiveObservation(
      `${this.parameters.gameID}-${this.playerID}`,
      async (observation) => {
        observation.update({
          input: {
            playerID: this.playerID,
            gameID: this.parameters.gameID,
            strategist: this.strategistType
          }
        });
        updateActiveTrace({
          sessionId: this.parameters.gameID ?? "Unknown",
        });
        await langfuseSpanProcessor.forceFlush();

        try {
          await this.context.registerMCP();

          // Resume the game in case the vox agent was aborted
          await this.context.callTool("resume-game", { PlayerID: this.playerID }, this.parameters);

          while (!this.aborted) {
            const turnData = await this.waitForTurn();
            if (!turnData) break;

            this.parameters.turn = turnData.turn;
            this.parameters.before = turnData.latestID;

            this.logger.warn(`Running the ${this.strategistType} on ${this.parameters.turn}, with events ${this.parameters.after}~${this.parameters.before}`);

            try {
              await this.context.callTool("pause-game", { PlayerID: this.playerID }, this.parameters);

              this.parameters.running = this.strategistType;
              // TODO: Uncomment when ready to run actual strategist
              // await this.context.execute(this.strategistType, this.parameters);
              // Fake running for now
              await setTimeout(5000);

              this.parameters.after = turnData.latestID;
              await this.context.callTool("resume-game", { PlayerID: this.playerID }, this.parameters);

              observation.update({
                output: {
                  completed: false,
                  turns: this.parameters.turn,
                }
              });
              langfuseSpanProcessor.forceFlush();
            } catch (error) {
              this.logger.error(`${this.strategistType} error:`, error);
            } finally {
              this.parameters.running = undefined;
            }
          }
        } catch (error) {
          this.logger.error(`Player ${this.playerID} execution error:`, error);
          observation.update({ output: { error: error instanceof Error ? error.message : String(error) } });
        } finally {
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
    if (this.turnSignal) {
      this.turnSignal();
    }
  }
}