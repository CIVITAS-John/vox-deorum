/**
 * @module utils/text-cleaning
 *
 * Text cleaning and formatting utilities for tool call/result text representations.
 */

/**
 * Strips structural artifacts left behind by tool call extraction from LLM text.
 * Removes empty JSON arrays, empty markdown code blocks, and standalone fence markers.
 */
export function cleanToolArtifacts(text: string): string {
  return text
    // Remove complete delimiter-based tool calls block: <|tool_calls_section_begin|> ... <|tool_calls_section_end|>
    .replace(/<\|tool_calls_section_begin\|>[\s\S]*?<\|tool_calls_section_end\|>/g, '')
    // Truncate incomplete tool calls block (beginning marker arrived but no end marker yet)
    .replace(/<\|tool_calls_section_begin\|>[\s\S]*$/, '')
    // Remove complete delimiter-based tool call blocks: <|tool_call_begin|> ... <|tool_call_end|>
    .replace(/<\|tool_call_begin\|>[\s\S]*?<\|tool_call_end\|>/g, '')
    // Truncate incomplete tool call blocks (beginning marker arrived but no end marker yet)
    .replace(/<\|tool_call_begin\|>[\s\S]*$/, '')
    // Remove any leftover individual markers
    .replace(/<\|tool_call(?:_argument)?_(?:begin|end)\|>/g, '')
    // Remove standalone section markers: <|tool_calls_section_begin|>, <|tool_calls_section_end|>
    .replace(/<\|tool_calls_section_(?:begin|end)\|>/g, '')
    // Remove standalone section markers: <|tool_call_begin|>, <|tool_call_end|>
    .replace(/<\|tool_call_(?:begin|end)\|>/g, '')
    // Remove empty/comma-only JSON arrays: [], [,], [ , , ], etc.
    .replace(/\[\s*(?:,\s*)*\]/g, '')
    // Truncate incomplete empty/comma-only JSON arrays (beginning marker arrived but no end marker yet)
    .replace(/\[\s*(?:,\s*)$/g, '')
    // Remove empty markdown code blocks: ```json\n\n```, ```\n```
    .replace(/```(?:json)?\s*```/g, '')
    // Remove standalone fence markers on their own line
    .replace(/^\s*```(?:json)?\s*$/gm, '')
    .trim();
}

/**
 * Formats a tool call as a markdown JSON code block (prompt-mode representation).
 */
export function formatToolCallText(toolName: string, args: any): string {
  let parsed = args;
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed); } catch { /* keep as-is */ }
  }
  return '```json\n' + JSON.stringify([{ tool: toolName, arguments: parsed }], null, 2) + '\n```';
}

/**
 * Formats a tool result with a markdown heading and content.
 */
export function formatToolResultText(toolName: string, resultText: string): string {
  return `# Tool ${toolName} Result\n${resultText}`;
}

/**
 * Builds a recovery prompt for empty response rescue.
 * The prompt varies based on the effective toolChoice to guide the model appropriately.
 */
export function buildRescuePrompt(toolChoice: string): string {
  if (toolChoice === "required" || toolChoice === "tool") {
    return 'Your previous response was empty and did not include any tool calls. You MUST call one or more of the available tools in the given format. Please try again.';
  }
  return 'Your previous response was empty. Please provide either a text response or PROPERLY call one or more of the available tools in the given format.';
}
