/**
 * @module web/types/agent-api
 *
 * Type definitions for agent API endpoints.
 * Provides strongly typed request and response interfaces.
 */

import { EnvoyThread } from '../../envoy/envoy-thread.js';

/**
 * Agent information in the registry
 */
export interface AgentInfo {
  /** Agent name identifier */
  name: string;
  /** Human-readable description */
  description: string;
  /** Tags for categorization and filtering */
  tags: string[];
}

/**
 * GET /api/agents response
 */
export interface ListAgentsResponse {
  agents: AgentInfo[];
}

/**
 * POST /api/agents/session request
 */
export interface CreateSessionRequest {
  /** Name of the agent to use */
  agentName: string;
  /** Option 1: Connect to VoxAgent/Telemetry database via context */
  contextId?: string;
  /** Option 2: Connect directly to database file path */
  databasePath?: string;
  /** Optional: Specific turn number (mainly for historian) */
  turn?: number;
}

/**
 * POST /api/agents/session response
 * Returns the created EnvoyThread
 */
export type CreateSessionResponse = EnvoyThread;

/**
 * GET /api/agents/sessions response
 */
export interface ListSessionsResponse {
  sessions: EnvoyThread[];
}

/**
 * GET /api/agents/session/:sessionId response
 * Returns the EnvoyThread with full message history
 */
export type GetSessionResponse = EnvoyThread;

/**
 * POST /api/agents/chat request
 */
export interface ChatRequest {
  /** Name of the agent to use */
  agentName?: string;
  /** Session ID for existing session */
  sessionId?: string;
  /** User's message */
  message: string;
}

/**
 * DELETE /api/agents/session/:sessionId response
 */
export interface DeleteSessionResponse {
  success: boolean;
}

/**
 * SSE event types for chat streaming
 */
export type ChatEventType = 'connected' | 'message' | 'tool_call' | 'done' | 'error';

/**
 * SSE event data for chat streaming
 */
export interface ChatEventData {
  /** Event type */
  event: ChatEventType;
  /** Optional text for message events */
  text?: string;
  /** Optional tool call data */
  toolCall?: {
    tool: string;
    args: any;
    result?: any;
  };
  /** Session information for done event */
  sessionId?: string;
  /** Message count for done event */
  messageCount?: number;
  /** Error message for error events */
  error?: string;
}