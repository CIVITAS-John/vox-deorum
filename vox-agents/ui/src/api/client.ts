/**
 * API client for communication with the Vox Agents backend
 * Provides methods for REST endpoints and SSE streaming
 */

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  source?: string;
  meta?: Record<string, any>;
}

export interface HealthStatus {
  status: string;
  timestamp: string;
  service: string;
  version?: string;
  uptime?: number;
  clients?: number;
  port?: number;
}

class ApiClient {
  private baseUrl: string;
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
    onError?: (error: Event) => void
  ): () => void {
    // Close existing connection if any
    this.closeSseConnection('logs');

    const eventSource = new EventSource(`${this.baseUrl}/api/logs/stream`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Handle heartbeat messages
        if (data.type === 'heartbeat') {
          return;
        }

        // Handle log messages
        if (data.type === 'log' && data.data) {
          const log: LogEntry = {
            timestamp: data.data.timestamp || new Date().toISOString(),
            level: data.data.level || 'info',
            message: data.data.message || '',
            source: data.data.source || data.data.component,
            meta: data.data.meta || {}
          };
          onMessage(log);
        }
      } catch (error) {
        console.error('Failed to parse log message:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      if (onError) {
        onError(error);
      }

      // Auto-reconnect handled by browser for EventSource
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
   * Stream session events via SSE
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
   * Generic fetch wrapper with error handling
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

  // Future API methods for other endpoints
  async getConfigs() {
    return this.fetchJson<any[]>('/api/configs');
  }

  async getConfig(name: string) {
    return this.fetchJson<any>(`/api/configs/${name}`);
  }

  async saveConfig(name: string, config: any) {
    return this.fetchJson(`/api/configs/${name}`, {
      method: 'POST',
      body: JSON.stringify(config)
    });
  }

  async deleteConfig(name: string) {
    return this.fetchJson(`/api/configs/${name}`, {
      method: 'DELETE'
    });
  }

  async startSession(config: any) {
    return this.fetchJson('/api/session/start', {
      method: 'POST',
      body: JSON.stringify(config)
    });
  }

  async stopSession() {
    return this.fetchJson('/api/session/stop', {
      method: 'POST'
    });
  }

  async getSessionStatus() {
    return this.fetchJson<any>('/api/session/status');
  }

  async getAgents() {
    return this.fetchJson<any[]>('/api/agents');
  }

  async sendChatMessage(agentName: string, message: string) {
    return this.fetchJson(`/api/agents/${agentName}/chat`, {
      method: 'POST',
      body: JSON.stringify({ message })
    });
  }

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