/**
 * Tests for the global agent registry
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  agentRegistry,
  registerAgent,
  getAgent,
  getAllAgents,
  clearRegistry,
  initializeDefaultAgents
} from '../src/infra/agent-registry.js';
import { SimpleStrategist } from '../src/strategist/agents/simple-strategist.js';
import { SimpleStrategistBriefed } from '../src/strategist/agents/simple-strategist-briefed.js';
import { SimpleBriefer } from '../src/briefer/simple-briefer.js';
import { NoneStrategist } from '../src/strategist/agents/none-strategist.js';

describe('Agent Registry', () => {
  beforeEach(() => {
    clearRegistry();
  });

  it('should register and retrieve agents', () => {
    const agent = new SimpleStrategist();
    registerAgent(agent);

    const retrieved = getAgent('simple-strategist');
    expect(retrieved).toBe(agent);
    expect(retrieved?.name).toBe('simple-strategist');
    expect(retrieved?.description).toBe('Analyzes game state and makes strategic decisions for Civ V gameplay including diplomacy, technology, policy, and grand strategy');
  });

  it('should initialize default agents', () => {
    initializeDefaultAgents();

    const agents = getAllAgents();
    expect(Object.keys(agents)).toHaveLength(4);

    expect(getAgent('simple-strategist')).toBeDefined();
    expect(getAgent('simple-strategist-briefed')).toBeDefined();
    expect(getAgent('simple-briefer')).toBeDefined();
    expect(getAgent('none-strategist')).toBeDefined();
  });

  it('should return undefined for non-existent agents', () => {
    const agent = getAgent('non-existent');
    expect(agent).toBeUndefined();
  });

  it('should clear all agents', () => {
    initializeDefaultAgents();
    expect(Object.keys(getAllAgents())).toHaveLength(4);

    clearRegistry();
    expect(Object.keys(getAllAgents())).toHaveLength(0);
  });

  it('should overwrite existing agents when registering with same name', () => {
    const agent1 = new SimpleStrategist();
    const agent2 = new SimpleStrategist();

    registerAgent(agent1);
    expect(getAgent('simple-strategist')).toBe(agent1);

    registerAgent(agent2);
    expect(getAgent('simple-strategist')).toBe(agent2);
    expect(getAgent('simple-strategist')).not.toBe(agent1);
  });

  it('should return a copy of agents when calling getAllAgents', () => {
    initializeDefaultAgents();

    const agents1 = getAllAgents();
    const agents2 = getAllAgents();

    expect(agents1).not.toBe(agents2); // Different objects
    expect(agents1).toEqual(agents2); // Same content
  });

  it('should have descriptions for all default agents', () => {
    initializeDefaultAgents();

    const agents = getAllAgents();
    for (const [name, agent] of Object.entries(agents)) {
      expect(agent.description).toBeDefined();
      expect(agent.description).not.toBe('');
      expect(agent.name).toBe(name);
    }
  });
});