/**
 * @module strategist/null-strategist
 *
 * Null strategist agent that forces VPAI to baseline defaults.
 * In Strategy mode: clears all economic/military strategies.
 * In Flavor mode: sets all flavors to 50 (balanced).
 * Grand strategy is not overridden in either mode, letting VPAI decide.
 */

import { StepResult, Tool } from "ai";
import { Strategist } from "../strategist.js";
import { VoxContext } from "../../infra/vox-context.js";
import { StrategistParameters, ensureGameState } from "../strategy-parameters.js";

/**
 * A strategist that forces VPAI back to neutral baseline defaults each turn.
 * Unlike NoneStrategist (which does nothing), this actively clears overrides
 * so the in-game AI runs on its own decision-making.
 */
export class NullStrategist extends Strategist {
  readonly name = "null-strategist";

  readonly description = "Baseline agent that resets VPAI to defaults: empty strategies (Strategy mode) or balanced flavors (Flavor mode), with no grand strategy override";

  /**
   * Programmatically resets VPAI to baseline defaults, then returns a non-empty
   * system prompt so the execution loop runs (and stopCheck exits immediately).
   */
  public async getSystem(parameters: StrategistParameters, _input: unknown, context: VoxContext<StrategistParameters>): Promise<string> {
    const rationale = "Null agent baseline — letting VPAI decide on its own";

    if (parameters.mode === "Flavor") {
      // Build balanced flavors from the game state's available flavor keys
      const gameState = await ensureGameState(context, parameters);
      const flavorDescriptions = gameState.options?.Options?.Flavors as Record<string, string> | undefined;
      const balancedFlavors: Record<string, number> = {};
      if (flavorDescriptions) {
        for (const key of Object.keys(flavorDescriptions)) {
          balancedFlavors[key] = 50;
        }
      }

      await context.callTool("set-flavors", {
        PlayerID: parameters.playerID,
        Flavors: balancedFlavors,
        Rationale: rationale
      }, parameters);
    } else {
      await context.callTool("set-strategy", {
        PlayerID: parameters.playerID,
        EconomicStrategies: [],
        MilitaryStrategies: [],
        Rationale: rationale
      }, parameters);
    }

    return rationale;
  }

  /**
   * Always stops immediately — all work is done in getSystem
   */
  public stopCheck(
    _parameters: StrategistParameters,
    _input: unknown,
    _lastStep: StepResult<Record<string, Tool>>,
    _allSteps: StepResult<Record<string, Tool>>[]
  ): boolean {
    return true;
  }
}
