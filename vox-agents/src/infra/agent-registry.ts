/**
 * @module infra/agent-registry
 *
 * Global agent registry for Vox Agents.
 * Provides centralized registration and discovery of all available agents,
 * eliminating the need to register agents for each VoxContext instance.
 */

import { VoxAgent, AgentParameters } from "./vox-agent.js";
import { createLogger } from "../utils/logger.js";
import { SimpleStrategist } from "../strategist/agents/simple-strategist.js";
import { SimpleStrategistBriefed } from "../strategist/agents/simple-strategist-briefed.js";
import { SimpleBriefer } from "../briefer/simple-briefer.js";
import { NoneStrategist } from "../strategist/agents/none-strategist.js";

const logger = createLogger('AgentRegistry');

/**
 * Global registry of all available Vox agents.
 * Agents are registered once and shared across all VoxContext instances.
 */
export const agentRegistry: Record<string, VoxAgent<any>> = {};

/**
 * Register an agent in the global registry.
 * @param agent - The agent to register
 */
export function registerAgent<T extends AgentParameters>(agent: VoxAgent<T>): void {
  if (agentRegistry[agent.name]) {
    logger.warn(`Agent ${agent.name} is already registered, overwriting`);
  }
  agentRegistry[agent.name] = agent;
  logger.info(`Agent registered: ${agent.name} - ${agent.description}`);
}

/**
 * Get an agent from the registry by name.
 * @param name - The name of the agent to retrieve
 * @returns The agent if found, undefined otherwise
 */
export function getAgent<T extends AgentParameters>(name: string): VoxAgent<T> | undefined {
  return agentRegistry[name] as VoxAgent<T> | undefined;
}

/**
 * Get all registered agents.
 * @returns A record of all registered agents
 */
export function getAllAgents(): Record<string, VoxAgent<any>> {
  return { ...agentRegistry };
}

/**
 * Clear all registered agents.
 * Primarily useful for testing.
 */
export function clearRegistry(): void {
  for (const key in agentRegistry) {
    delete agentRegistry[key];
  }
  logger.info('Agent registry cleared');
}

/**
 * Initialize the default agents in the registry.
 * This function registers all the built-in agents that ship with vox-agents.
 */
export function initializeDefaultAgents(): void {
  logger.info('Initializing default agents');

  // Register strategist agents
  registerAgent(new SimpleStrategist());
  registerAgent(new SimpleStrategistBriefed());
  registerAgent(new NoneStrategist());

  // Register briefer agents
  registerAgent(new SimpleBriefer());

  logger.info(`Default agents initialized: ${Object.keys(agentRegistry).length} agents registered`);
}

// Auto-initialize default agents on module load
initializeDefaultAgents();