/**
 * @module types/agents
 *
 * Chat-related types for Vox Agents.
 * Contains core agent definitions.
 */

import { StreamTextOnChunkCallback, ToolSet } from "ai";

export interface StreamingEventCallback {
  OnChunk: StreamTextOnChunkCallback<ToolSet>
}