/**
 * @module utils/text-cleaning
 *
 * Text cleaning utilities for removing tool rescue artifacts from LLM output.
 */

/**
 * Strips structural artifacts left behind by tool call extraction from LLM text.
 * Removes empty JSON arrays, empty markdown code blocks, and standalone fence markers.
 */
export function cleanToolArtifacts(text: string): string {
  return text
    // Remove delimiter-based tool call markers: <|tool_call_begin|>, <|tool_call_argument_begin|>, <|tool_call_end|>
    .replace(/<\|tool_call(?:_argument)?_(?:begin|end)\|>/g, '')
    // Remove empty/comma-only JSON arrays: [], [,], [ , , ], etc.
    .replace(/\[\s*(?:,\s*)*\]/g, '')
    // Remove empty markdown code blocks: ```json\n\n```, ```\n```
    .replace(/```(?:json)?\s*```/g, '')
    // Remove standalone fence markers on their own line
    .replace(/^\s*```(?:json)?\s*$/gm, '')
    .trim();
}
