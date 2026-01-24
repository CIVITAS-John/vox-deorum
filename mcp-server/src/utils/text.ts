/**
 * Text utility functions for MCP server
 */

/**
 * Trims a rationale string to a maximum length
 * @param rationale The rationale string to trim
 * @param maxLength The maximum length (default 10240)
 * @returns The trimmed rationale string
 */
export function trimRationale(rationale: string, maxLength = 10240): string {
  if (rationale.length <= maxLength) {
    return rationale;
  }

  // Trim to max length and add ellipsis
  return rationale.substring(0, maxLength - 3) + '...';
}