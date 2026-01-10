/**
 * Utility functions for mapping between MCP flavor range (0-100) and in-game range (-300 to 300)
 *
 * MCP Range: 0-100, where 50 is balanced/default
 * In-Game Range: -300 to 300, where 0 is balanced/default
 *
 * The mapping uses an exponential curve to provide:
 * - High sensitivity at extremes (0-30, 70-100) for strong adjustments
 * - Low sensitivity in middle (40-60) for stable, balanced gameplay
 *
 * Some flavors use linear mapping (0-100 to 0-10) instead
 */

/**
 * Flavors that use linear 0-10 mapping instead of exponential -300 to 300
 */
const LINEAR_FLAVORS = ["UseNuke"];

/**
 * Convert MCP flavor value (0-100) to in-game flavor value (-300 to 300 or 0-10)
 *
 * Uses exponential mapping: e^(3x) - 1
 * This creates an insensitive middle range and sensitive extremes
 *
 * @param mcpValue - Flavor value from MCP layer (0-100, 50 is balanced)
 * @param flavorName - Name of the flavor (for special linear mapping)
 * @returns In-game flavor value (-300 to 300, 0 is balanced) or (0-10 for special flavors)
 */
export function mcpToGameFlavor(mcpValue: number, flavorName?: string): number {
  // Linear mapping for special flavors
  if (flavorName && LINEAR_FLAVORS.includes(flavorName)) {
    return Math.round(mcpValue / 10);
  }

  if (mcpValue === 50) return 0; // Fast path for balanced

  const normalized = (mcpValue - 50) / 50; // -1 to 1
  const sign = Math.sign(normalized);
  const abs = Math.abs(normalized);

  // Exponential: e^(3x) - 1 gives gentle middle, steep extremes
  // e^3 ≈ 20.09, so (e^3 - 1) ≈ 19.09
  const gameValue = sign * Math.round(((Math.exp(3 * abs) - 1) / 19.09) * 300);

  return gameValue;
}

/**
 * Convert in-game flavor value (-300 to 300 or 0-10) to MCP flavor value (0-100)
 *
 * Uses logarithmic mapping (inverse of exponential)
 *
 * @param gameValue - In-game flavor value (-300 to 300, 0 is balanced) or (0-10 for special flavors)
 * @param flavorName - Name of the flavor (for special linear mapping)
 * @returns MCP flavor value (0-100, 50 is balanced)
 */
export function gameToMcpFlavor(gameValue: number, flavorName?: string): number {
  // Linear mapping for special flavors
  if (flavorName && LINEAR_FLAVORS.includes(flavorName)) {
    return gameValue * 10;
  }

  if (gameValue === 0) return 50; // Fast path for balanced

  const sign = Math.sign(gameValue);
  const abs = Math.abs(gameValue);

  // Inverse: log(1 + 19.09x)
  const normalized = abs / 300; // 0 to 1
  const mcpValue = sign * Math.round((Math.log(1 + 19.09 * normalized) / 3) * 50) + 50;

  return Math.max(0, Math.min(100, mcpValue));
}
