import { AgentParameters } from "../infra/vox-agent.js";
import { VoxContext } from "../infra/vox-context.js";
import type { CitiesReport } from "../../../mcp-server/dist/tools/knowledge/get-cities.js";
import type { PlayersReport } from "../../../mcp-server/dist/tools/knowledge/get-players.js";
import type { EventsReport } from "../../../mcp-server/dist/tools/knowledge/get-events.js";
import type { MilitaryReport } from "../../../mcp-server/dist/tools/knowledge/get-military-report.js";
import type { OptionsReport } from "../../../mcp-server/dist/tools/knowledge/get-options.js";
import type { VictoryProgressReport } from "../../../mcp-server/dist/tools/knowledge/get-victory-progress.js";
import type { GameMetadata } from "../../../mcp-server/dist/tools/knowledge/get-metadata.js"

/**
 * Parameters for the strategist agent
 */
export interface StrategistParameters extends AgentParameters {
  /** Fetch events after this ID */
  after: number;
  /** Fetch events equals to or before this ID */
  before: number;
  /** Metadata storage for custom agent annotations */
  metadata?: GameMetadata;
  /** Map of turn numbers to game states for historical tracking */
  gameStates: Record<number, GameState>;
}

/**
 * Game state snapshot containing all relevant game information at a specific turn
 */
export interface GameState {
  /** Player information including civilizations, leaders, and diplomacy */
  players?: PlayersReport;
  /** Game events that occurred during this turn */
  events?: EventsReport;
  /** Cities data including population, production, and buildings */
  cities?: CitiesReport;
  /** Available strategic and tactical options */
  options?: OptionsReport;
  /** Military units, positions, and combat status */
  military?: MilitaryReport;
  /** Victory condition progress and standings */
  victory?: VictoryProgressReport;
  /** Additional reports (e.g. briefings) */
  reports: Record<string, string>;
}

/**
 * Checks if a tool call result is an error result
 * @param result - The result from a tool call
 * @returns True if the result indicates an error
 */
function isErrorResult(result: any): boolean {
  return result && typeof result === 'object' && 'isError' in result && result.isError === true;
}

/**
 * Extracts human-readable error text from an error result
 * @param result - The error result object
 * @returns A string description of the error
 */
function extractErrorText(result: any): string {
  if (result?.error) return String(result.error);
  if (result?.message) return String(result.message);
  return 'Unknown error';
}

/**
 * Refreshes strategy parameters by fetching all required game state information
 * @param context - The VoxContext to use for calling tools
 * @param parameters - The strategy parameters to refresh
 * @returns The updated strategy parameters
 */
export async function refreshGameState(
  context: VoxContext<StrategistParameters>,
  parameters: StrategistParameters
): Promise<GameState> {
  // Get the game metadata as a prerequisite
  parameters.metadata = parameters.metadata ??
    await context.callTool("get-metadata", { PlayerID: parameters.playerID }, parameters);

  // Get the information
  const [players, events, cities, options, victory, military] = await Promise.all([
    context.callTool("get-players", {}, parameters),
    context.callTool("get-events", {}, parameters),
    context.callTool("get-cities", {}, parameters),
    context.callTool("get-options", {}, parameters),
    context.callTool("get-victory-progress", {}, parameters),
    context.callTool("get-military-report", {}, parameters),
  ]);

  // Validate all results are defined and not errors
  if (isErrorResult(players)) throw new Error(`Failed to fetch players: ${extractErrorText(players)}`);
  if (isErrorResult(events)) throw new Error(`Failed to fetch events: ${extractErrorText(events)}`);
  if (isErrorResult(cities)) throw new Error(`Failed to fetch cities: ${extractErrorText(cities)}`);
  if (isErrorResult(options)) throw new Error(`Failed to fetch options: ${extractErrorText(options)}`);
  if (isErrorResult(victory)) throw new Error(`Failed to fetch victory: ${extractErrorText(victory)}`);
  if (isErrorResult(military)) throw new Error(`Failed to fetch military: ${extractErrorText(military)}`);

  // Create the current game state snapshot
  const currentState: GameState = {
    players,
    events,
    cities,
    options,
    military,
    victory,
    reports: {}
  };

  // Update and return parameters with the new game state stored by turn
  parameters.gameStates[parameters.turn] = currentState;
  return currentState;
}

/**
 * Retrieves the game state at a specific turn, or the closest available state within the offset range
 * @param parameters - The strategy parameters containing game states
 * @param targetTurn - The desired turn number to retrieve
 * @param maxOffset - Maximum number of turns to search forward/backward for a state (default: 5)
 * @returns The game state at the target turn or closest available, or undefined if none found
 */
export function getGameState(
  parameters: StrategistParameters,
  targetTurn: number,
  maxOffset: number = 5
): GameState | undefined {
  // Check if we have the exact turn
  if (parameters.gameStates[targetTurn]) {
    return parameters.gameStates[targetTurn];
  }

  // If no offset allowed, return undefined
  if (maxOffset <= 0) {
    return undefined;
  }

  // Search for closest available state within offset range
  let closestTurn: number | undefined;
  let closestDistance = Infinity;

  const availableTurns = Object.keys(parameters.gameStates).map(Number);

  for (const turn of availableTurns) {
    const distance = Math.abs(turn - targetTurn);

    // Check if this turn is within our offset range and closer than previous best
    if (distance <= maxOffset && distance < closestDistance) {
      closestDistance = distance;
      closestTurn = turn;
    }
  }

  return closestTurn !== undefined ? parameters.gameStates[closestTurn] : undefined;
}

/**
 * Gets the most recent game state before or at a specific turn
 * @param parameters - The strategy parameters containing game states
 * @param maxTurn - The maximum turn number to consider
 * @returns The most recent game state at or before maxTurn, or undefined if none found
 */
export function getRecentGameState(
  parameters: StrategistParameters,
  maxTurn?: number
): GameState | undefined {
  let mostRecentTurn: number | undefined;

  for (const turnStr of Object.keys(parameters.gameStates)) {
    const turn = Number(turnStr);

    // Skip turns beyond our maximum
    if (maxTurn !== undefined && turn > maxTurn) {
      continue;
    }

    // Update if this is the most recent turn we've seen
    if (mostRecentTurn === undefined || turn > mostRecentTurn) {
      mostRecentTurn = turn;
    }
  }

  return mostRecentTurn !== undefined ? parameters.gameStates[mostRecentTurn] : undefined;
}