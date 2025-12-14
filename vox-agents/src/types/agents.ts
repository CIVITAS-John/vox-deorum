/**
 * @module types/agents
 *
 * Agent system types for Vox Agents.
 * Contains core agent definitions.
 */

/**
 * Represents an AI agent in the Vox system
 */
export interface Agent {
  /** Agent identifier/name */
  name: string;
  /** Human-readable description of the agent's purpose */
  description?: string;
  /** List of MCP tools available to this agent */
  tools?: string[];
}