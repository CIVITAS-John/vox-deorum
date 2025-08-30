/**
 * Command tools for Civilization V game actions
 * Provides tools to execute game commands
 */

import { z } from 'zod';
import { ToolBase, PlayerContext } from './base.js';
import { MCPServer } from '../server.js';

/**
 * Input schema for move unit command
 */
const MoveUnitSchema = z.object({
  unitId: z.number().describe('ID of the unit to move'),
  targetX: z.number().describe('Target X coordinate'),
  targetY: z.number().describe('Target Y coordinate'),
  playerId: z.number().describe('ID of the player issuing the command'),
});

/**
 * Input schema for end turn command
 */
const EndTurnSchema = z.object({
  playerId: z.number().describe('ID of the player ending their turn'),
  autoSave: z.boolean().default(true).describe('Whether to auto-save before ending turn'),
});

/**
 * Move unit command tool
 */
type MoveUnitInput = z.infer<typeof MoveUnitSchema>;

export class MoveUnitTool extends ToolBase<MoveUnitInput> {
  constructor() {
    super(
      'move_unit',
      'Move a unit to a specified tile position',
      MoveUnitSchema as z.ZodSchema<MoveUnitInput>
    );
  }

  /**
   * Execute move unit command
   */
  protected async execute(
    input: MoveUnitInput,
    context?: PlayerContext
  ): Promise<any> {
    // Validate player context matches the command
    if (context?.playerId !== undefined && context.playerId !== input.playerId) {
      throw new Error('Player context does not match command player ID');
    }

    // Mock implementation - in real implementation would send to Bridge Service
    const result = {
      success: true,
      unitId: input.unitId,
      from: { x: 10, y: 15 }, // Mock current position
      to: { x: input.targetX, y: input.targetY },
      movementCost: 2,
      remainingMovement: 0,
      message: `Unit ${input.unitId} moved to (${input.targetX}, ${input.targetY})`,
      warnings: [] as string[],
    };

    // Simulate validation
    const distance = Math.abs(input.targetX - 10) + Math.abs(input.targetY - 15);
    if (distance > 5) {
      result.warnings.push('Movement exceeds unit range, path will take multiple turns');
    }

    return result;
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
    const tool = new MoveUnitTool();
    server.registerTool(tool);
  }
}

/**
 * End turn command tool
 */
type EndTurnInput = z.infer<typeof EndTurnSchema>;

export class EndTurnTool extends ToolBase<EndTurnInput> {
  constructor() {
    super(
      'end_turn',
      'End the current player turn and proceed to the next turn',
      EndTurnSchema as z.ZodSchema<EndTurnInput>
    );
  }

  /**
   * Execute end turn command
   */
  protected async execute(
    input: EndTurnInput,
    context?: PlayerContext
  ): Promise<any> {
    // Validate player context matches the command
    if (context?.playerId !== undefined && context.playerId !== input.playerId) {
      throw new Error('Player context does not match command player ID');
    }

    // Mock implementation
    const result = {
      success: true,
      playerId: input.playerId,
      turnEnded: 125,
      nextTurn: 126,
      nextPlayer: {
        id: (input.playerId + 1) % 3,
        name: `Player ${(input.playerId + 1) % 3 + 1}`,
        isAI: input.playerId === 1,
      },
      autoSaved: input.autoSave,
      timestamp: new Date().toISOString(),
      pendingActions: [
        'Unit at (12, 15) has movement remaining',
        'City production complete in Rome',
      ],
    };

    return result;
  }

  /**
   * Override to support player context
   */
  public supportsPlayerContext(): boolean {
    return true;
  }

  /**
   * Lifecycle hook - validate before execution
   */
  protected async onExecute(
    input: EndTurnInput,
    _context?: PlayerContext
  ): Promise<void> {
    // Could check if it's actually this player's turn
    if (input.playerId < 0 || input.playerId > 7) {
      throw new Error('Invalid player ID');
    }
  }

  /**
   * Self-register with the MCP server
   */
  public static register(): void {
    const server = MCPServer.getInstance();
    const tool = new EndTurnTool();
    server.registerTool(tool);
  }
}