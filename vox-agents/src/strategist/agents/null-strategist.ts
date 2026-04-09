/**
 * @module strategist/null-strategist
 *
 * Null strategist agent that forces VPAI to baseline defaults.
 * In Strategy mode: clears all economic/military strategies.
 * In Flavor mode: sets all flavors to 50 (balanced).
 * Grand strategy is not overridden in either mode, letting VPAI decide.
 * Additionally picks a random tech/policy when none is selected,
 * and resets all persona values to baseline (5) every turn.
 */

import { Strategist } from "../strategist.js";
import { VoxContext } from "../../infra/vox-context.js";
import { StrategistParameters, ensureGameState } from "../strategy-parameters.js";

/**
 * A strategist that forces VPAI back to neutral baseline defaults each turn.
 * Unlike NoneStrategist (which does nothing), this actively clears overrides
 * so the in-game AI runs on its own decision-making. Also picks random
 * tech/policy when none is queued and resets persona to midpoint baseline.
 */
export class NullStrategist extends Strategist {
  readonly name = "null-strategist";

  readonly displayName = "Vox Populi AI (Baseline)";

  readonly description = "Baseline agent that resets VPAI to defaults: empty strategies (Strategy mode) or balanced flavors (Flavor mode), with no grand strategy override";

  /**
   * Programmatically resets VPAI to baseline defaults, then returns empty
   * string to skip the LLM execution loop entirely.
   */
  public async getSystem(parameters: StrategistParameters, _input: unknown, context: VoxContext<StrategistParameters>): Promise<string> {
    const rationale = "Null agent baseline — letting VPAI decide on its own";
    const gameState = await ensureGameState(context, parameters);

    if (parameters.mode === "Flavor") {
      // Build balanced flavors from the game state's available flavor keys
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

    // Pick a random technology if none is queued
    if (gameState.options?.Technology?.Next === "None") {
      const techs = gameState.options?.Options?.Technologies;
      if (techs && typeof techs === "object") {
        const techNames = Object.keys(techs as Record<string, unknown>);
        if (techNames.length > 0) {
          const randomTech = techNames[Math.floor(Math.random() * techNames.length)];
          await context.callTool("set-research", {
            PlayerID: parameters.playerID,
            Technology: randomTech,
            Rationale: rationale
          }, parameters);
        }
      }
    }

    // Pick a random policy if none is queued
    if (gameState.options?.Policy?.Next.startsWith("None")) {
      const policies = gameState.options?.Options?.Policies;
      if (policies && typeof policies === "object") {
        const policyDisplayNames = Object.keys(policies as Record<string, unknown>);
        if (policyDisplayNames.length > 0) {
          const randomDisplay = policyDisplayNames[Math.floor(Math.random() * policyDisplayNames.length)];
          // Extract base name before parenthetical suffix (set-policy strips it internally)
          const baseName = randomDisplay.includes(" (")
            ? randomDisplay.substring(0, randomDisplay.indexOf(" ("))
            : randomDisplay;
          await context.callTool("set-policy", {
            PlayerID: parameters.playerID,
            Policy: baseName,
            Rationale: rationale
          }, parameters);
        }
      }
    }

    // Reset all persona values to baseline (5 = midpoint of 1-10 scale)
    await context.callTool("set-persona", {
      PlayerID: parameters.playerID,
      VictoryCompetitiveness: 5, WonderCompetitiveness: 5, MinorCivCompetitiveness: 5,
      Boldness: 5, WarBias: 5, HostileBias: 5, WarmongerHate: 5,
      NeutralBias: 5, FriendlyBias: 5, GuardedBias: 5, AfraidBias: 5,
      DiplomaticBalance: 5, Friendliness: 5, WorkWithWillingness: 5,
      WorkAgainstWillingness: 5, Loyalty: 5, MinorCivFriendlyBias: 5,
      MinorCivNeutralBias: 5, MinorCivHostileBias: 5, MinorCivWarBias: 5,
      DenounceWillingness: 5, Forgiveness: 5, Meanness: 5, Neediness: 5,
      Chattiness: 5, DeceptiveBias: 5,
      Rationale: rationale
    }, parameters);

    return "";
  }
}
