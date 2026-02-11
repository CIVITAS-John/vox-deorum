/**
 * @module utils/tools/terminal-tools
 *
 * Utilities for detecting terminal tool calls by inspecting tool metadata.
 * A terminal tool call signals that the calling agent's primary task is complete —
 * the agent should stop after processing a step where all tool calls are terminal.
 *
 * Terminal tool sources:
 * - MCP tools with readOnlyHint: false (write/action tools)
 * - Fire-and-forget agent tools (call-* tools where the agent has fireAndForget: true)
 */

import { Tool as MCPTool } from "@modelcontextprotocol/sdk/types.js";
import { agentRegistry } from "../../infra/agent-registry.js";

/** Checks if a single tool call is terminal based on its name and metadata */
export function isTerminalTool(toolName: string, mcpToolMap: Map<string, MCPTool>): boolean {
  // Agent tools: terminal if the agent is fire-and-forget
  if (toolName.startsWith("call-")) {
    const agentName = toolName.slice("call-".length);
    const agent = agentRegistry.get(agentName);
    return agent?.fireAndForget === true;
  }

  // MCP tools: terminal if readOnlyHint is explicitly false
  const mcpTool = mcpToolMap.get(toolName);
  if (mcpTool) {
    return mcpTool.annotations?.readOnlyHint === false;
  }

  return false;
}

/** Checks if ALL tool calls in a step are terminal */
export function hasOnlyTerminalCalls(
  step: { toolCalls: Array<{ toolName: string }> },
  mcpToolMap: Map<string, MCPTool>
): boolean {
  return step.toolCalls.length > 0
    && step.toolCalls.every(tc => isTerminalTool(tc.toolName, mcpToolMap));
}
