/**
 * Game state resource for Civilization V
 * Provides access to current game state information
 */

import { ResourceBase, PlayerContext } from './base.js';
import { MCPServer } from '../server.js';

/**
 * Mock game state data structure
 */
interface GameState {
  turn: number;
  players: Array<{
    id: number;
    name: string;
    civilization: string;
    score: number;
    gold: number;
    science: number;
    culture: number;
  }>;
  mapSize: {
    width: number;
    height: number;
  };
  gameSpeed: string;
  difficulty: string;
}

/**
 * Game state resource implementation
 */
export class GameStateResource extends ResourceBase {
  private mockGameState: GameState;

  constructor() {
    super({
      uri: 'game://state',
      name: 'Game State',
      description: 'Current Civilization V game state including turn, players, and game settings',
      mimeType: 'application/json',
    });

    // Initialize with mock data
    this.mockGameState = this.generateMockGameState();
  }

  /**
   * Read the game state
   * @param context Optional player context for filtering
   */
  public async read(context?: PlayerContext): Promise<GameState> {
    await this.onRead(context);

    // If player context is provided, filter to that player's visible state
    if (context?.playerId !== undefined) {
      return this.filterForPlayer(this.mockGameState, context.playerId);
    }

    return this.mockGameState;
  }

  /**
   * Filter game state for a specific player's perspective
   */
  private filterForPlayer(state: GameState, playerId: number): GameState {
    // In a real implementation, this would filter based on fog of war, diplomacy, etc.
    return {
      ...state,
      players: state.players.map(p => {
        if (p.id === playerId) {
          return p; // Full info for own player
        }
        // Limited info for other players
        return {
          ...p,
          gold: -1, // Hidden
          science: -1, // Hidden
        };
      }),
    };
  }

  /**
   * Generate mock game state data
   */
  private generateMockGameState(): GameState {
    return {
      turn: 125,
      players: [
        {
          id: 0,
          name: 'Player 1',
          civilization: 'Rome',
          score: 450,
          gold: 1250,
          science: 85,
          culture: 62,
        },
        {
          id: 1,
          name: 'Player 2',
          civilization: 'Egypt',
          score: 425,
          gold: 980,
          science: 92,
          culture: 55,
        },
        {
          id: 2,
          name: 'AI Player 1',
          civilization: 'Greece',
          score: 380,
          gold: 750,
          science: 78,
          culture: 48,
        },
      ],
      mapSize: {
        width: 80,
        height: 52,
      },
      gameSpeed: 'Standard',
      difficulty: 'Prince',
    };
  }

  /**
   * Update mock game state (for testing)
   */
  public updateMockState(updates: Partial<GameState>): void {
    this.mockGameState = {
      ...this.mockGameState,
      ...updates,
    };
  }

  /**
   * Override to support player context
   */
  public supportsPlayerContext(): boolean {
    return true;
  }

  /**
   * Self-register with the MCP server
   */
  public static register(): void {
    const server = MCPServer.getInstance();
    const resource = new GameStateResource();
    server.registerResource(resource);
  }
}