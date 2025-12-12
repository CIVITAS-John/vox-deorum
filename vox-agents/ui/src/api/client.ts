/**
 * API client for communication with the Vox Agents backend
 * Provides methods for REST endpoints and SSE streaming with strong typing
 */

import { extractLogParams } from './log-utils';
import type {
  HealthStatus,
  LogEntry,
  TelemetryDatabasesResponse,
  TelemetrySessionsResponse,
  SessionSpansResponse,
  DatabaseTracesResponse,
  TraceSpansResponse,
  SpanStreamEvent,
  SessionStatus,
  ConfigFile,
  ConfigListResponse,
  Agent,
  AgentListResponse,
  ChatResponse,
  ErrorResponse,
  UploadResponse
} from './types';

/**
 * API client for managing communication with the Vox Agents backend server.
 * Handles both REST API calls and Server-Sent Events (SSE) streaming connections.
 *
 * Features:
 * - Health status monitoring
 * - Real-time log streaming
 * - Telemetry data access and streaming
 * - Session management and event streaming
 * - Agent interaction and chat messaging
 * - Configuration management
 * - Automatic SSE connection cleanup
 * - Strong TypeScript typing for all methods
 */
class ApiClient {
  private baseUrl: string;
  /** Map of active SSE connections indexed by unique keys */
  private sseConnections: Map<string, EventSource> = new Map();

  constructor() {
    // In production, use same origin. In dev, use Vite proxy or configured port
    this.baseUrl = import.meta.env.PROD ? '' : 'http://localhost:5555';
  }

  /**
   * Generic fetch wrapper with error handling and strong typing
   */
  private async fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await fetch(url, options);
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Request failed: ${response.statusText}`;
      try {
        const error: ErrorResponse = JSON.parse(errorText);
        errorMessage = error.error || errorMessage;
      } catch {
        // If not JSON, use the text directly
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }
    return response.json();
  }

  /**
   * Fetch health status from the server
   */
  async getHealth(): Promise<HealthStatus> {
    return this.fetchJson<HealthStatus>(`${this.baseUrl}/api/health`);
  }

  /**
   * Stream logs via Server-Sent Events
   * @param onMessage - Callback for each log entry
   * @param onError - Callback for errors
   * @param onHeartbeat - Callback for heartbeat events
   * @returns Cleanup function to close the connection
   */
  streamLogs(
    onMessage: (log: LogEntry) => void,
    onError?: (error: Event) => void,
    onHeartbeat?: () => void
  ): () => void {
    // Close existing connection if any
    this.closeSseConnection('logs');

    const eventSource = new EventSource(`${this.baseUrl}/api/logs/stream`);

    eventSource.addEventListener("log", (event: MessageEvent) => {
      try {
        const rawLog = JSON.parse(event.data);
        const processedLog = extractLogParams(rawLog);
        onMessage(processedLog);
      } catch (error) {
        console.error('Failed to parse log message:', error);
      }
    });

    eventSource.addEventListener("heartbeat", () => {
      onHeartbeat?.();
    });

    eventSource.onerror = (error) => {
      if (onError) onError(error);
    };

    // Store connection for cleanup
    this.sseConnections.set('logs', eventSource);

    // Return cleanup function
    return () => {
      this.closeSseConnection('logs');
    };
  }

  // ============= Telemetry API Methods =============

  /**
   * Get list of telemetry databases
   */
  async getTelemetryDatabases(): Promise<TelemetryDatabasesResponse> {
    return this.fetchJson<TelemetryDatabasesResponse>(
      `${this.baseUrl}/api/telemetry/databases`
    );
  }

  /**
   * Get active telemetry sessions
   */
  async getTelemetrySessions(): Promise<TelemetrySessionsResponse> {
    return this.fetchJson<TelemetrySessionsResponse>(
      `${this.baseUrl}/api/telemetry/sessions/active`
    );
  }

  /**
   * Get spans for an active session
   */
  async getSessionSpans(sessionId: string): Promise<SessionSpansResponse> {
    return this.fetchJson<SessionSpansResponse>(
      `${this.baseUrl}/api/telemetry/sessions/${encodeURIComponent(sessionId)}/spans`
    );
  }

  /**
   * Stream spans for an active session via SSE
   * @param sessionId - The session ID to stream
   * @param onMessage - Callback for span data
   * @param onError - Callback for errors
   * @param onHeartbeat - Callback for heartbeat events
   * @returns Cleanup function to close the connection
   */
  streamSessionSpans(
    sessionId: string,
    onMessage: (data: SpanStreamEvent) => void,
    onError?: (error: Event) => void,
    onHeartbeat?: () => void
  ): () => void {
    const key = `session-${sessionId}`;
    this.closeSseConnection(key);

    const eventSource = new EventSource(
      `${this.baseUrl}/api/telemetry/sessions/${encodeURIComponent(sessionId)}/stream`
    );

    eventSource.onmessage = (event) => {
      try {
        const data: SpanStreamEvent = JSON.parse(event.data);
        onMessage(data);
      } catch (error) {
        console.error('Failed to parse span data:', error);
      }
    };

    eventSource.addEventListener("heartbeat", () => {
      onHeartbeat?.();
    });

    eventSource.onerror = (error) => {
      if (onError) onError(error);
    };

    this.sseConnections.set(key, eventSource);
    return () => this.closeSseConnection(key);
  }

  /**
   * Get traces from a database
   * @param filename - Database filename (can include folder path)
   * @param limit - Maximum number of traces to return
   * @param offset - Number of traces to skip
   */
  async getDatabaseTraces(
    filename: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<DatabaseTracesResponse> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString()
    });
    return this.fetchJson<DatabaseTracesResponse>(
      `${this.baseUrl}/api/telemetry/db/${encodeURIComponent(filename)}/traces?${params}`
    );
  }

  /**
   * Get all spans for a specific trace
   * @param filename - Database filename (can include folder path)
   * @param traceId - The trace ID to get spans for
   */
  async getTraceSpans(
    filename: string,
    traceId: string
  ): Promise<TraceSpansResponse> {
    return this.fetchJson<TraceSpansResponse>(
      `${this.baseUrl}/api/telemetry/db/${encodeURIComponent(filename)}/trace/${encodeURIComponent(traceId)}/spans`
    );
  }

  /**
   * Upload a telemetry database file
   * @param file - The database file to upload
   */
  async uploadDatabase(file: File): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('database', file);

    const response = await fetch(`${this.baseUrl}/api/telemetry/upload`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Upload failed';
      try {
        const error: ErrorResponse = JSON.parse(errorText);
        errorMessage = error.error || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }

  // ============= Session API Methods =============

  /**
   * Get current session status
   */
  async getSessionStatus(): Promise<SessionStatus> {
    return this.fetchJson<SessionStatus>(`${this.baseUrl}/api/session/status`);
  }

  /**
   * Start a new session with configuration
   */
  async startSession(config: Record<string, any>): Promise<SessionStatus> {
    return this.fetchJson<SessionStatus>(`${this.baseUrl}/api/session/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
  }

  /**
   * Stop the current session
   */
  async stopSession(): Promise<{ success: boolean }> {
    return this.fetchJson<{ success: boolean }>(`${this.baseUrl}/api/session/stop`, {
      method: 'POST'
    });
  }

  /**
   * Stream session events via SSE
   */
  streamSessionEvents(
    onMessage: (event: any) => void,
    onError?: (error: Event) => void
  ): () => void {
    const key = 'session-events';
    this.closeSseConnection(key);

    const eventSource = new EventSource(`${this.baseUrl}/api/session/events`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type !== 'heartbeat') {
          onMessage(data);
        }
      } catch (error) {
        console.error('Failed to parse session event:', error);
      }
    };

    eventSource.onerror = (error) => {
      if (onError) onError(error);
    };

    this.sseConnections.set(key, eventSource);
    return () => this.closeSseConnection(key);
  }

  // ============= Config API Methods =============

  /**
   * List all configuration files
   */
  async getConfigs(): Promise<ConfigListResponse> {
    return this.fetchJson<ConfigListResponse>(`${this.baseUrl}/api/configs`);
  }

  /**
   * Get a specific configuration file
   */
  async getConfig(name: string): Promise<ConfigFile> {
    return this.fetchJson<ConfigFile>(
      `${this.baseUrl}/api/configs/${encodeURIComponent(name)}`
    );
  }

  /**
   * Save a configuration file
   */
  async saveConfig(name: string, content: Record<string, any>): Promise<{ success: boolean }> {
    return this.fetchJson<{ success: boolean }>(
      `${this.baseUrl}/api/configs/${encodeURIComponent(name)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(content)
      }
    );
  }

  /**
   * Delete a configuration file
   */
  async deleteConfig(name: string): Promise<{ success: boolean }> {
    return this.fetchJson<{ success: boolean }>(
      `${this.baseUrl}/api/configs/${encodeURIComponent(name)}`,
      { method: 'DELETE' }
    );
  }

  /**
   * Validate configuration JSON
   */
  async validateConfig(content: Record<string, any>): Promise<{ valid: boolean; errors?: string[] }> {
    return this.fetchJson<{ valid: boolean; errors?: string[] }>(
      `${this.baseUrl}/api/configs/validate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(content)
      }
    );
  }

  // ============= Agent API Methods =============

  /**
   * List all registered agents
   */
  async getAgents(): Promise<AgentListResponse> {
    return this.fetchJson<AgentListResponse>(`${this.baseUrl}/api/agents`);
  }

  /**
   * Get details for a specific agent
   */
  async getAgent(name: string): Promise<Agent> {
    return this.fetchJson<Agent>(
      `${this.baseUrl}/api/agents/${encodeURIComponent(name)}`
    );
  }

  /**
   * Send a chat message to an agent
   */
  async sendChatMessage(agentName: string, message: string): Promise<ChatResponse> {
    return this.fetchJson<ChatResponse>(
      `${this.baseUrl}/api/agents/${encodeURIComponent(agentName)}/chat`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      }
    );
  }

  /**
   * Stream agent responses via SSE
   */
  streamAgentResponse(
    agentName: string,
    onMessage: (response: ChatResponse) => void,
    onError?: (error: Event) => void
  ): () => void {
    const key = `agent-${agentName}`;
    this.closeSseConnection(key);

    const eventSource = new EventSource(
      `${this.baseUrl}/api/agents/${encodeURIComponent(agentName)}/stream`
    );

    eventSource.onmessage = (event) => {
      try {
        const data: ChatResponse = JSON.parse(event.data);
        onMessage(data);
      } catch (error) {
        console.error('Failed to parse agent response:', error);
      }
    };

    eventSource.onerror = (error) => {
      if (onError) onError(error);
    };

    this.sseConnections.set(key, eventSource);
    return () => this.closeSseConnection(key);
  }

  // ============= Utility Methods =============

  /**
   * Close a specific SSE connection
   */
  private closeSseConnection(key: string): void {
    const connection = this.sseConnections.get(key);
    if (connection) {
      connection.close();
      this.sseConnections.delete(key);
    }
  }

  /**
   * Close all SSE connections
   */
  closeAllConnections(): void {
    this.sseConnections.forEach((connection) => {
      connection.close();
    });
    this.sseConnections.clear();
  }
}

// Export singleton instance
export const api = new ApiClient();

// Also export as apiClient for backward compatibility
export const apiClient = api;