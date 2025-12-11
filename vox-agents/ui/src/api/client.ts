/**
 * API client for communication with the Vox Agents backend
 * Provides methods for REST endpoints and SSE streaming
 */

import { extractLogParams } from './log-utils';
import type { LogEntry } from './log-utils';

export type { LogEntry };

export interface HealthStatus {
  status: string;
  timestamp: string;
  service: string;
  version?: string;
  uptime?: number;
  clients?: number;
  port?: number;
}

/**
 * API client for managing communication with the Vox Agents backend server.
 * Handles both REST API calls and Server-Sent Events (SSE) streaming connections.
 *
 * Features:
 * - Health status monitoring
 * - Real-time log streaming
 * - Session management and event streaming
 * - Agent interaction and chat messaging
 * - Configuration management
 * - Automatic SSE connection cleanup
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
   * Fetch health status from the server
   */
  async getHealth(): Promise<HealthStatus> {
    const response = await fetch(`${this.baseUrl}/api/health`);
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Stream logs via Server-Sent Events
   * @param onMessage - Callback for each log entry
   * @param onError - Callback for errors
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

    eventSource.addEventListener("log", (data) => {
      try {
        console.log(data.data);
        const rawLog = JSON.parse(data.data);
        const processedLog = extractLogParams(rawLog);
        onMessage(processedLog);
      } catch (error) {
        console.error('Failed to parse log message:', error);
      }
    });

    eventSource.addEventListener("heartbeat", (data) => {
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
    for (const [key, connection] of this.sseConnections) {
      connection.close();
    }
    this.sseConnections.clear();
  }

  /**
   * Stream session events via Server-Sent Events
   * Monitors agent session lifecycle events and state changes
   * @param onMessage - Callback for each session event (excluding heartbeats)
   * @param onError - Optional callback for connection errors
   * @returns Cleanup function to close the SSE connection
   */
  streamSessionEvents(
    onMessage: (event: any) => void,
    onError?: (error: Event) => void
  ): () => void {
    this.closeSseConnection('session');

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
      console.error('Session SSE error:', error);
      if (onError) onError(error);
    };

    this.sseConnections.set('session', eventSource);
    return () => this.closeSseConnection('session');
  }

  /**
   * Generic fetch wrapper with JSON error handling
   * Automatically adds JSON headers and parses responses
   * @param url - Relative URL path (will be prefixed with baseUrl)
   * @param options - Standard fetch options
   * @returns Parsed JSON response
   * @throws Error with descriptive message on HTTP errors
   */
  private async fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${url}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API request failed: ${error || response.statusText}`);
    }

    return response.json();
  }

  // Configuration Management API

  /** Retrieve all available configuration profiles */
  async getConfigs() {
    return this.fetchJson<any[]>('/api/configs');
  }

  /** Get a specific configuration by name */
  async getConfig(name: string) {
    return this.fetchJson<any>(`/api/configs/${name}`);
  }

  /** Save or update a configuration profile */
  async saveConfig(name: string, config: any) {
    return this.fetchJson(`/api/configs/${name}`, {
      method: 'POST',
      body: JSON.stringify(config)
    });
  }

  /** Delete a configuration profile */
  async deleteConfig(name: string) {
    return this.fetchJson(`/api/configs/${name}`, {
      method: 'DELETE'
    });
  }

  // Session Management API

  /** Start a new agent session with the provided configuration */
  async startSession(config: any) {
    return this.fetchJson('/api/session/start', {
      method: 'POST',
      body: JSON.stringify(config)
    });
  }

  /** Stop the currently active session */
  async stopSession() {
    return this.fetchJson('/api/session/stop', {
      method: 'POST'
    });
  }

  /** Get the current session status and metadata */
  async getSessionStatus() {
    return this.fetchJson<any>('/api/session/status');
  }

  // Agent Communication API

  /** List all available agents in the system */
  async getAgents() {
    return this.fetchJson<any[]>('/api/agents');
  }

  /**
   * Send a chat message to a specific agent
   * @param agentName - Name of the target agent
   * @param message - Message content to send
   */
  async sendChatMessage(agentName: string, message: string) {
    return this.fetchJson(`/api/agents/${agentName}/chat`, {
      method: 'POST',
      body: JSON.stringify({ message })
    });
  }

  /**
   * Stream agent responses via Server-Sent Events
   * Establishes a real-time connection for agent output streaming
   * @param agentName - Name of the agent to stream from
   * @param onMessage - Callback for each agent response (excluding heartbeats)
   * @param onError - Optional callback for connection errors
   * @returns Cleanup function to close the SSE connection
   */
  streamAgentResponse(
    agentName: string,
    onMessage: (data: any) => void,
    onError?: (error: Event) => void
  ): () => void {
    const key = `agent-${agentName}`;
    this.closeSseConnection(key);

    const eventSource = new EventSource(`${this.baseUrl}/api/agents/${agentName}/stream`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type !== 'heartbeat') {
          onMessage(data);
        }
      } catch (error) {
        console.error('Failed to parse agent response:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('Agent SSE error:', error);
      if (onError) onError(error);
    };

    this.sseConnections.set(key, eventSource);
    return () => this.closeSseConnection(key);
  }
}

// Export singleton instance
export const apiClient = new ApiClient();