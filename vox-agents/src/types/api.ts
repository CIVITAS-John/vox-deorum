/**
 * @module types/api
 *
 * API response types for Vox Agents.
 * Contains all types for HTTP endpoint responses and requests.
 */

import type { Span, TelemetryMetadata, TelemetrySession } from './telemetry.js';
import type { EnvoyThread } from './chat.js';

// ============================================================================
// Core API Response Types
// ============================================================================

/**
 * Represents the health status of the Vox Agents service
 */
export interface HealthStatus {
  /** Service health status (e.g., "healthy", "unhealthy") */
  status?: string;
  /** ISO timestamp of when the health check was performed */
  timestamp: string;
  /** Name of the service being checked */
  service: string;
  /** Optional version string of the service */
  version?: string;
  /** Service uptime in seconds */
  uptime?: number;
  /** Number of connected clients */
  clients?: number;
  /** Port the service is running on */
  port?: number;
}

/**
 * Standard error response format for API failures
 */
export interface ErrorResponse {
  /** Main error message */
  error: string;
  /** Additional error details or stack trace */
  details?: string;
}

/**
 * Represents a single log entry from the Vox Agents system
 */
export interface LogEntry {
  /** ISO timestamp of when the log was created */
  timestamp: string;
  /** Log severity level */
  level: 'debug' | 'info' | 'warn' | 'error';
  /** The log message content */
  message: string;
  /** Source component that generated the log */
  context: string;
  /** Source that generated the log */
  source: string;
  /** Additional structured parameters associated with the log */
  params?: Record<string, any>;
}

// ============================================================================
// Configuration API Response Types
// ============================================================================

/**
 * Response containing a list of available configuration files
 */
export interface ConfigListResponse {
  /** Array of configuration filenames */
  configs: string[];
}

/**
 * API response for configuration endpoint
 */
export interface ConfigResponse {
  /** Main configuration from config.json */
  config: import('./config.js').VoxAgentsConfig;
  /** API keys from .env file */
  apiKeys: Record<string, string>;
}

// ============================================================================
// Session API Response Types
// ============================================================================

/**
 * Represents the current status of a Vox Agents game session
 */
export interface SessionStatus {
  /** Whether a session is currently active */
  active: boolean;
  /** Unique identifier for the active session */
  sessionId?: string;
  /** Configuration file used for the session */
  config?: string;
  /** ISO timestamp when the session started */
  startTime?: string;
  /** Session progress percentage (0-100) */
  progress?: number;
}

// ============================================================================
// Telemetry API Response Types
// ============================================================================

/**
 * Response containing a list of available telemetry databases
 */
export interface TelemetryDatabasesResponse {
  /** Array of telemetry database metadata */
  databases: TelemetryMetadata[];
}

/**
 * Response containing a list of active telemetry sessions
 */
export interface TelemetrySessionsResponse {
  /** Array of active sessions with parsed metadata */
  sessions: TelemetrySession[];
}

/**
 * Response containing spans for a specific session
 */
export interface SessionSpansResponse {
  /** Array of spans belonging to the session */
  spans: Span[];
}

/**
 * Response containing root spans (traces) from a database
 */
export interface DatabaseTracesResponse {
  /** Array of root spans that represent complete traces */
  traces: Span[];
}

/**
 * Response containing all spans for a specific trace
 */
export interface TraceSpansResponse {
  /** Array of spans belonging to the same trace */
  spans: Span[];
}

/**
 * Response after uploading a telemetry database file
 */
export interface UploadResponse {
  /** Whether the upload was successful */
  success: boolean;
  /** Name of the uploaded file */
  filename: string;
  /** Optional server path where the file was stored */
  path?: string;
}

// ============================================================================
// Agent API Response Types
// ============================================================================

/**
 * Message sent to an agent for chat interaction
 */
export interface ChatMessage {
  /** The message content to send to the agent */
  message: string;
  /** Additional context data for the agent */
  context?: Record<string, any>;
}

/**
 * Response from an agent chat interaction
 */
export interface ChatResponse {
  /** The agent's text response */
  response: string;
  /** Optional array of tool calls made by the agent */
  toolCalls?: Array<{
    /** Name of the tool that was called */
    tool: string;
    /** Arguments passed to the tool */
    args: Record<string, any>;
    /** Result returned from the tool */
    result?: any;
  }>;
}

/**
 * Information about an available agent
 */
export interface AgentInfo {
  /** Name of the agent */
  name: string;
  /** Description of what the agent does */
  description: string;
  /** Tags for categorizing/filtering agents */
  tags: string[];
}

/**
 * Response containing list of available agents
 */
export interface ListAgentsResponse {
  /** Array of available agents */
  agents: AgentInfo[];
}

/**
 * Request to create a new chat session
 */
export interface CreateSessionRequest {
  /** Name of the agent to use */
  agentName: string;
  /** Context ID for live sessions */
  contextId?: string;
  /** Database path for telepathist mode */
  databasePath?: string;
  /** Current game turn */
  turn?: number;
}

/**
 * Response after creating a new chat session
 * Returns the full EnvoyThread object
 */
export type CreateSessionResponse = EnvoyThread;

/**
 * Response containing list of chat sessions
 */
export interface ListSessionsResponse {
  /** Array of active chat sessions (EnvoyThread objects) */
  sessions: EnvoyThread[];
}

/**
 * Response containing a single chat session
 */
export type GetSessionResponse = EnvoyThread;

/**
 * Request to send a chat message
 */
export interface ChatRequest {
  /** Session ID to send the message to */
  sessionId: string;
  /** The message content */
  message: string;
}

/**
 * Response after deleting a session
 */
export interface DeleteSessionResponse {
  /** Whether the deletion was successful */
  success: boolean;
}