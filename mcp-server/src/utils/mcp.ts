/**
 * MCP (Model Context Protocol) utility functions for formatting responses
 */

import { CallToolResult } from "@modelcontextprotocol/sdk/types";

/**
 * Wraps tool execution results into the proper MCP CallToolResult format
 * @param result - The raw result from tool execution (can be any type)
 * @returns A properly formatted CallToolResult with content array
 */
export function wrapResults(result: any): CallToolResult {
  // If result is already in CallToolResult format, return as-is
  if (result && typeof result === 'object' && 'content' in result && Array.isArray(result.content)) {
    return result as CallToolResult;
  }

  // Handle null/undefined results
  if (result === null || result === undefined) {
    return {
      content: [
        {
          type: "text",
          text: "Tool execution completed successfully with no output"
        }
      ]
    };
  }

  // Handle string results
  if (typeof result === 'string') {
    return {
      content: [
        {
          type: "text",
          text: result
        }
      ]
    };
  }

  // Handle primitive types (number, boolean)
  if (typeof result === 'number' || typeof result === 'boolean') {
    return {
      content: [
        {
          type: "text",
          text: String(result)
        }
      ]
    };
  }

  // Handle arrays - call recursively on each element
  if (Array.isArray(result)) {
    return {
      content: result.flatMap(item => wrapResults(item).content)
    };
  } else if (typeof result === 'object') {
    // Handle objects - serialize to JSON
    return {
      content: [{
        type: "text",
        text: JSON.stringify(result, null, 2)
      }]
    };
  }

  // Fallback for any other type
  return {
    content: [
      {
        type: "text",
        text: String(result)
      }
    ]
  };
}