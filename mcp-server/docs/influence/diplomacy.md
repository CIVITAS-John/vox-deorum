# Diplomatic Influence

How `set-persona` and `set-relationship` steer the in-game diplomatic AI.

For tool schemas and arguments, see [TOOLS.md](../TOOLS.md).

---

## Persona fields (`set-persona`)

### What it writes

`set-persona` forwards a Lua table to `CvLuaPlayer::lSetPersona`, which mutates 26 fields directly on the caller's `CvDiplomacyAI`. These runtime values replace the leader's current personality values on that AI object until overwritten.

**Core competitiveness:**
- `VictoryCompetitiveness` -- reaction intensity to others pursuing victories
- `WonderCompetitiveness` -- reaction intensity to wonder competition
- `MinorCivCompetitiveness` -- reaction intensity to city-state influence competition
- `Boldness` -- military risk-taking and territorial claims

**War and peace tendencies:**
- `WarBias` -- likelihood to plan or declare offensive war
- `HostileBias` -- tendency toward hostile postures without direct war
- `WarmongerHate` -- negative reaction to warlike behaviors
- `NeutralBias`, `FriendlyBias`, `GuardedBias`, `AfraidBias` -- approach biases

**Diplomacy and cooperation:**
- `DiplomaticBalance` -- increased relationship with non-competitive civs and peaceful resolution
- `Friendliness` -- desire for friendship declarations, increases maximum DoFs
- `WorkWithWillingness` -- tendency to collaborate with allies
- `WorkAgainstWillingness` -- tendency to bond over shared enemies
- `Loyalty` -- loyalty to allies; lower values enable backstabbing

**Minor civ relations:**
- `MinorCivFriendlyBias`, `MinorCivNeutralBias`, `MinorCivHostileBias`, `MinorCivWarBias`

**Personality traits:**
- `DenounceWillingness` -- readiness to denounce
- `Forgiveness` -- how quickly past transgressions are forgiven
- `Meanness` -- general aggressiveness, demanding/bullying
- `Neediness` -- desire for support from friends
- `Chattiness` -- frequency of diplomatic contact initiation
- `DeceptiveBias` -- tendency to be deceptively friendly

### Naming notes

- `Friendliness` is the MCP/Lua-facing label for the DLL field `DoFWillingness` (`m_iDoFWillingness`, `GetDoFWillingness`).
- The balance-of-power field in the DLL is `DiploBalance` (`m_iDiploBalance`, `GetDiploBalance`).
- The current bindings are asymmetric: `GetPersona()` returns `DiplomaticBalance`, but `SetPersona()` currently reads the key `DiploBalance`. In other words, the action schema and the Lua setter do not use the same key for that field today.

### AI subsystems and decisions

`CvDiplomacyAI::CalculateApproachTowardsPlayer` is the main consumer: its approach score vector (WAR, HOSTILE, DECEPTIVE, GUARDED, AFRAID, FRIENDLY, NEUTRAL) is seeded from `m_aiMajorCivApproachBiases[]`, then further modified by fields such as `GetBoldness`, `GetMeanness`, `GetVictoryCompetitiveness`, `GetDiploBalance`, and `GetDoFWillingness`.

**Key mechanisms:**

- **Boldness** reduces the AI's estimate of enemy military strength and target value by 3% per point (`MILITARY_STRENGTH_REDUCTION_PER_BOLDNESS = -3`, `TARGET_VALUE_REDUCTION_PER_BOLDNESS = -3`). At Boldness=10, the AI underestimates both by 30%.
- **Meanness** lowers the negative war score threshold via `GetWarscoreThresholdNegative()`, making the AI more willing to stay in unfavorable wars and less likely to accept peace.
- **VictoryCompetitiveness** + **Meanness** additively drive `VICTORY_PURSUIT_DOMINATION` scoring.
- **WonderCompetitiveness** feeds wonder-dispute and culture-victory logic.
- **DoFWillingness** (`Friendliness`), **DenounceWillingness**, **Loyalty**, and **Forgiveness** feed friendship, denouncement, and betrayal logic.
- **MinorCivWarBias**, **HostileBias**, **FriendlyBias**, **NeutralBias** drive city-state approach selection and bully/attack likelihood.
- `CvDealAI`, `CvGrandStrategyAI`, `CvMilitaryAI`, `CvReligionAI`, and other owner-side subsystems also read these getters directly when pricing deals, weighting victory plans, evaluating combat posture, or picking religious behavior.

### Timing

The write itself is immediate. There is no flavor broadcast, no opinion refresh, and no auto-recompute hook. Most observable behavior shifts on the next relevant diplomacy reevaluation, typically the next `CvDiplomacyAI::DoTurn`. The values persist until overwritten; there is no expiration timer.

### Cross-civ scope

The live values are stored directly on the caller's `CvDiplomacyAI`, but foreign civs usually reason about another leader through `Estimate*` helpers rather than by reading those raw fields.

- For **teammates**, `EstimateVictoryCompetitiveness`, `EstimateBoldness`, `EstimateDiploBalance`, `EstimateDoFWillingness`, `EstimateMeanness`, `EstimateMajorCivApproachBias`, and related helpers return the live runtime values.
- For **non-teammates**, those same helpers usually fall back to XML leader values, or to neutral/default estimates for human players and random-personality games.
- Practical effect: `set-persona` strongly changes the caller's own diplomacy logic and teammate-visible personality estimates, but non-teammate AIs usually continue reasoning about that leader through estimated base personality, not the full custom runtime persona.

---

## Relationship modifiers (`set-relationship`)

This is the one tool whose effect leaks to non-LLM civs that never touched any LLM machinery.

### What it writes

`set-relationship` writes two modifier arrays on the **caller's** `CvDiplomacyAI`:

- `m_aiScenarioModifier1[target]` -- "public" modifier
- `m_aiScenarioModifier2[target]` -- "private" modifier

The tool inverts the user-supplied values before storage:

- `Public = +40` stores `m_aiScenarioModifier1[target] = -40`
- `Private = +40` stores `m_aiScenarioModifier2[target] = -40`

This inversion exists because Civ V's opinion weight is signed in the opposite direction: positive internal values are worse, negative values are friendlier.

The arrays themselves are local storage on the caller. Foreign AI code does not directly read another civ's raw scenario-modifier arrays.

### The opinion cascade

1. `CvDiplomacyAI::GetDiploModifiers` sums modifier1, modifier2, and modifier3 into an opinion delta. In Vox Deorum mode, modifier2's normal breakdown string is hidden behind the `MOD_IPC_CHANNEL` guard, but the numeric value still counts.
2. `CalculateCivOpinionWeight` only adds `GetDiploModifiers` when `MOD_EVENTS_DIPLO_MODIFIERS` is active and the game is not network multiplayer.
3. `DoUpdateOpinions` caches the refreshed weight through `SetCachedOpinionWeight`, then maps it to opinion bands using the normal thresholds: `160`, `80`, `30`, `-30`, `-80`, `-160`.
4. `GetCachedOpinionWeight` and `GetCivOpinion` are then read cross-civ from many DLL call sites, including diplomacy, deal, voting, operation, and player logic.

### Downstream decisions that shift

When that cached opinion refresh happens, any logic that consumes `GetCachedOpinionWeight` or `GetCivOpinion` can shift, including:

- **Approach re-scoring** -- diplomacy and coalition logic can change once `GetCivOpinion` / `GetCachedOpinionWeight` crosses a different band.
- **Trade deal reweighting** -- `CvDealAI` consults opinion repeatedly when pricing offers, peace terms, vassalage, and cooperation.
- **Target selection and strategic coordination** -- operations, voting, and broader diplomatic heuristics use cached opinion as one input.
- **Threshold-crossing transitions** -- changes around `30`, `80`, `160`, `-30`, `-80`, and `-160` can flip civ opinion states and all the downstream checks keyed off those states.

### Timing

Two timings matter:

- **Immediate** -- the raw scenario modifiers are stored immediately, and raw getter/debug-style pathways can observe them immediately.
- **Next opinion refresh** -- cached opinion, opinion bands, and foreign-AI side effects update on the next `CvDiplomacyAI::DoTurn` that runs `DoUpdateOpinions`.

In network multiplayer, `CalculateCivOpinionWeight` skips the `GetDiploModifiers` path, so the normal cached-opinion cascade should not be described as unconditional there.

### Three-audience visibility

| Audience | Immediate raw numeric | Immediate string visibility | Composite opinion impact |
|---|---|---|---|
| Non-LLM VPAI (C++) | No foreign raw-array read | No | Yes, via `GetCachedOpinionWeight` / `GetCivOpinion` after opinion refresh, when the diplo-modifier path is active |
| Other LLM (via `get-opinions`) | Indirect rather than raw-array access | Public-string paths are visible; private-string paths are hidden in normal VD mode except self/debug-style views | Yes, through the refreshed opinion table and composite opinion |
| Human UI / raw Lua | Yes, through `GetScenarioModifier1/2` on the owner | Public modifier strings are visible; private modifier strings are hidden in normal VD mode, but self/debug strings exist (`TXT_KEY_SPECIFIC_DIPLO_STRING_1_SELF`, `TXT_KEY_SPECIFIC_DIPLO_STRING_2_SELF`) | Yes, once opinion refresh has recomputed the cached totals |

### Modifier3 note

`SetScenarioModifier3` exists as a Lua binding and is summed by `GetDiploModifiers`, but **no current MCP tool writes to it**. It stays at its default value and contributes nothing to the cascade.
