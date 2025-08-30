/**
 * Units resource for Civilization V
 * Provides access to unit information and positions
 */

import { ResourceBase, PlayerContext } from './base.js';
import { MCPServer } from '../server.js';

/**
 * Unit data structure
 */
interface Unit {
  id: number;
  playerId: number;
  type: string;
  name: string;
  position: {
    x: number;
    y: number;
  };
  health: number;
  maxHealth: number;
  movement: number;
  maxMovement: number;
  strength: number;
  experience: number;
  promotions: string[];
}

/**
 * Units collection
 */
interface UnitsData {
  units: Unit[];
  totalCount: number;
  lastUpdated: string;
}

/**
 * Units resource implementation
 */
export class UnitsResource extends ResourceBase {
  private mockUnits: Unit[];

  constructor() {
    super({
      uri: 'game://units',
      name: 'Units',
      description: 'All units in the current game with their positions and status',
      mimeType: 'application/json',
    });

    // Initialize with mock data
    this.mockUnits = this.generateMockUnits();
  }

  /**
   * Read the units data
   * @param context Optional player context for filtering
   */
  public async read(context?: PlayerContext): Promise<UnitsData> {
    await this.onRead(context);

    let units = this.mockUnits;

    // Filter units based on player context (fog of war)
    if (context?.playerId !== undefined) {
      units = this.filterUnitsForPlayer(units, context.playerId);
    }

    return {
      units,
      totalCount: units.length,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Filter units based on player's visibility
   */
  private filterUnitsForPlayer(units: Unit[], playerId: number): Unit[] {
    // In a real implementation, this would check fog of war
    return units.filter(unit => {
      // Player can always see their own units
      if (unit.playerId === playerId) {
        return true;
      }
      // For demo, assume player can see units within 5 tiles of their own units
      const playerUnits = units.filter(u => u.playerId === playerId);
      return playerUnits.some(playerUnit => {
        const distance = Math.abs(unit.position.x - playerUnit.position.x) + 
                        Math.abs(unit.position.y - playerUnit.position.y);
        return distance <= 5;
      });
    });
  }

  /**
   * Generate mock units data
   */
  private generateMockUnits(): Unit[] {
    return [
      {
        id: 1,
        playerId: 0,
        type: 'UNIT_WARRIOR',
        name: 'Warrior',
        position: { x: 10, y: 15 },
        health: 100,
        maxHealth: 100,
        movement: 2,
        maxMovement: 2,
        strength: 8,
        experience: 0,
        promotions: [],
      },
      {
        id: 2,
        playerId: 0,
        type: 'UNIT_SETTLER',
        name: 'Settler',
        position: { x: 12, y: 15 },
        health: 100,
        maxHealth: 100,
        movement: 2,
        maxMovement: 2,
        strength: 0,
        experience: 0,
        promotions: [],
      },
      {
        id: 3,
        playerId: 1,
        type: 'UNIT_ARCHER',
        name: 'Archer',
        position: { x: 25, y: 20 },
        health: 85,
        maxHealth: 100,
        movement: 1,
        maxMovement: 2,
        strength: 5,
        experience: 15,
        promotions: ['Accuracy I'],
      },
      {
        id: 4,
        playerId: 1,
        type: 'UNIT_SPEARMAN',
        name: 'Spearman',
        position: { x: 24, y: 19 },
        health: 100,
        maxHealth: 100,
        movement: 2,
        maxMovement: 2,
        strength: 11,
        experience: 5,
        promotions: [],
      },
      {
        id: 5,
        playerId: 2,
        type: 'UNIT_SCOUT',
        name: 'Scout',
        position: { x: 40, y: 30 },
        health: 100,
        maxHealth: 100,
        movement: 2,
        maxMovement: 2,
        strength: 4,
        experience: 10,
        promotions: ['Survivalism I'],
      },
    ];
  }

  /**
   * Update mock units (for testing)
   */
  public updateMockUnits(units: Unit[]): void {
    this.mockUnits = units;
  }

  /**
   * Add a mock unit (for testing)
   */
  public addMockUnit(unit: Unit): void {
    this.mockUnits.push(unit);
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
    const resource = new UnitsResource();
    server.registerResource(resource);
  }
}