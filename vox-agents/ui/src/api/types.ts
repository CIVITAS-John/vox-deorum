/**
 * Type definitions for the Vox Agents API
 */

// Health API Types

/**
 * Represents the health status of the Vox Agents service
 */
export interface HealthStatus {
  /** Service health status (e.g., "healthy", "unhealthy") */
  status: string;
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

// Log API Types

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

// Telemetry API Types

/**
 * Metadata for a telemetry database file containing game session data
 */
export interface TelemetryMetadata {
  /** Folder path containing the database */
  folder: string;
  /** Database filename */
  filename: string;
  /** Unique game session identifier */
  gameId: string;
  /** Player identifier for the session */
  playerId: string;
  /** Database file size in bytes */
  size: number;
  /** ISO timestamp of last modification */
  lastModified: string;
}

/**
 * Response containing a list of available telemetry databases
 */
export interface TelemetryDatabasesResponse {
  /** Array of telemetry database metadata */
  databases: TelemetryMetadata[];
}

/**
 * Represents an active telemetry session
 */
export interface TelemetrySession {
  /** The session identifier */
  sessionId: string;
  /** Extracted game ID if available */
  gameId?: string;
  /** Extracted player ID if available */
  playerId?: string;
}

/**
 * Response containing a list of active telemetry sessions
 */
export interface TelemetrySessionsResponse {
  /** Array of active sessions with parsed metadata */
  sessions: TelemetrySession[];
}

/**
 * Flexible key-value attributes for OpenTelemetry spans
 */
export interface SpanAttributes {
  /** Any additional attributes as key-value pairs */
  [key: string]: any;
}

/**
 * Represents an OpenTelemetry span (a unit of work in a distributed trace)
 */
export interface Span {
  /** Optional database row ID */
  id?: number;
  /** Session context identifier */
  contextId: string;
  /** Game turn number when the span was created, null if not during a turn */
  turn: number | null;
  /** Unique trace identifier (groups related spans) */
  traceId: string;
  /** Unique span identifier */
  spanId: string;
  /** Parent span ID for hierarchical traces, null for root spans */
  parentSpanId: string | null;
  /** Human-readable name describing the operation */
  name: string;
  /** Unix timestamp (nanoseconds) when the span started */
  startTime: number;
  /** Unix timestamp (nanoseconds) when the span ended */
  endTime: number;
  /** Duration of the operation in milliseconds */
  durationMs: number;
  /** Additional metadata and context for the span */
  attributes: SpanAttributes;
  /** Status code (0 = OK, 1 = ERROR) */
  statusCode: number;
  /** Optional status message providing error details */
  statusMessage: string | null;
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

// Session API Types (for future implementation)

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

// Config API Types (for future implementation)

/**
 * Represents a configuration file for Vox Agents
 */
export interface ConfigFile {
  /** Configuration filename */
  name: string;
  /** Configuration content as JSON object */
  content: Record<string, any>;
  /** ISO timestamp of last modification */
  lastModified?: string;
}

/**
 * Response containing a list of available configuration files
 */
export interface ConfigListResponse {
  /** Array of configuration filenames */
  configs: string[];
}

// Agent API Types (for future implementation)

/**
 * Represents an AI agent in the Vox system
 */
export interface Agent {
  /** Agent identifier/name */
  name: string;
  /** Human-readable description of the agent's purpose */
  description?: string;
  /** List of MCP tools available to this agent */
  tools?: string[];
}

/**
 * Response containing a list of available agents
 */
export interface AgentListResponse {
  /** Array of agent definitions */
  agents: Agent[];
}

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

// Error Response Type

/**
 * Standard error response format for API failures
 */
export interface ErrorResponse {
  /** Main error message */
  error: string;
  /** Additional error details or stack trace */
  details?: string;
}