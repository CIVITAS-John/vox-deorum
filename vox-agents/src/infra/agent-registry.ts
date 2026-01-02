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
import { SpecializedBriefer } from "../briefer/specialized-briefer.js";
import { NoneStrategist } from "../strategist/agents/none-strategist.js";
import { Spokesperson } from "../envoy/spokesperson.js";

/**
 * Registry for managing available Vox agents.
 * Provides centralized registration, discovery, and management of all agents.
 */
class AgentRegistry {
  private logger = createLogger('AgentRegistry');

  /**
   * Map of registered agents indexed by their names
   */
  private agents: Map<string, VoxAgent<any>> = new Map();

  /**
   * Flag to track if default agents have been initialized
   */
  private defaultsInitialized: boolean = false;

  /**
   * Register an agent in the registry.
   *
   * @param agent - The agent to register
   * @returns true if the agent was newly registered, false if it replaced an existing one
   */
  public register<T extends AgentParameters>(agent: VoxAgent<T>): boolean {
    const isReplacement = this.agents.has(agent.name);

    if (isReplacement) {
      this.logger.warn(`Agent ${agent.name} is already registered, replacing existing agent`);
    }

    this.agents.set(agent.name, agent);
    this.logger.info(`Agent registered: ${agent.name} - ${agent.description}`);

    return !isReplacement;
  }

  /**
   * Unregister an agent from the registry.
   *
   * @param name - The name of the agent to unregister
   * @returns true if the agent was found and unregistered, false otherwise
   */
  public unregister(name: string): boolean {
    const wasDeleted = this.agents.delete(name);

    if (wasDeleted) {
      this.logger.info(`Unregistered agent ${name} (remaining agents: ${this.agents.size})`);
    } else {
      this.logger.warn(`Attempted to unregister non-existent agent ${name}`);
    }

    return wasDeleted;
  }

  /**
   * Get an agent from the registry by name.
   *
   * @param name - The name of the agent to retrieve
   * @returns The agent if found, undefined otherwise
   */
  public get<T extends AgentParameters>(name: string): VoxAgent<T> | undefined {
    return this.agents.get(name) as VoxAgent<T> | undefined;
  }

  /**
   * Get all registered agents.
   *
   * @returns Array of all registered agents
   */
  public getAll(): VoxAgent<any>[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get all registered agents as a record/object.
   * Maintains backward compatibility with existing code.
   *
   * @returns Record of all registered agents indexed by name
   */
  public getAllAsRecord(): Record<string, VoxAgent<any>> {
    const record: Record<string, VoxAgent<any>> = {};
    for (const [name, agent] of this.agents) {
      record[name] = agent;
    }
    return record;
  }

  /**
   * Get all registered agent names.
   *
   * @returns Array of all registered agent names
   */
  public getNames(): string[] {
    return Array.from(this.agents.keys());
  }

  /**
   * Check if an agent is currently registered.
   *
   * @param name - The name of the agent to check
   * @returns true if the agent is registered, false otherwise
   */
  public has(name: string): boolean {
    return this.agents.has(name);
  }

  /**
   * Get the count of registered agents.
   *
   * @returns The number of registered agents
   */
  public size(): number {
    return this.agents.size;
  }

  /**
   * Clear all registered agents.
   * Primarily useful for testing.
   *
   * @param includeDefaults - If true, also reset the defaults initialization flag
   */
  public clear(includeDefaults: boolean = false): void {
    const count = this.agents.size;
    this.agents.clear();

    if (includeDefaults) {
      this.defaultsInitialized = false;
    }

    this.logger.info(`Cleared ${count} agents from registry${includeDefaults ? ' (including defaults flag)' : ''}`);
  }

  /**
   * Initialize the default agents in the registry.
   * This function registers all the built-in agents that ship with vox-agents.
   * Safe to call multiple times - will only initialize once.
   */
  public initializeDefaults(): void {
    if (this.defaultsInitialized) {
      this.logger.debug('Default agents already initialized, skipping');
      return;
    }

    this.logger.info('Initializing default agents');

    // Register strategist agents
    this.register(new SimpleStrategist());
    this.register(new SimpleStrategistBriefed());
    this.register(new NoneStrategist());

    // Register briefer agents
    this.register(new SimpleBriefer());
    this.register(new SpecializedBriefer());

    // Register envoy agents
    this.register(new Spokesperson());

    this.defaultsInitialized = true;
    this.logger.info(`Default agents initialized: ${this.agents.size} agents registered`);
  }

  /**
   * Check if default agents have been initialized.
   *
   * @returns true if defaults have been initialized, false otherwise
   */
  public areDefaultsInitialized(): boolean {
    return this.defaultsInitialized;
  }
}

// Export singleton instance
export const agentRegistry = new AgentRegistry();

// Export type for testing or extension
export type { AgentRegistry };

// Auto-initialize default agents on module load
agentRegistry.initializeDefaults();