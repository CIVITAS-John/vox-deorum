/**
 * Server-Sent Events Manager for broadcasting real-time updates
 */

import type { Response } from 'express';

export class SSEManager {
  private clients: Set<Response> = new Set();

  /**
   * Add a new SSE client connection
   */
  addClient(res: Response): void {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable proxy buffering

    // Send initial connection message
    res.write(':ok\n\n');

    this.clients.add(res);

    // Remove client on disconnect
    res.on('close', () => {
      this.clients.delete(res);
    });
  }

  /**
   * Broadcast an event to all connected clients
   */
  broadcast(event: string, data: any): void {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

    // Send to all connected clients
    for (const client of this.clients) {
      try {
        client.write(message);
      } catch (error) {
        // Client disconnected, will be removed on next close event
        console.error('Failed to send to client:', error);
      }
    }
  }

  /**
   * Send a heartbeat to keep connections alive
   */
  sendHeartbeat(): void {
    const heartbeat = ':heartbeat\n\n';
    for (const client of this.clients) {
      try {
        client.write(heartbeat);
      } catch {
        // Client disconnected
      }
    }
  }

  /**
   * Get the number of connected clients
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Start periodic heartbeat
   */
  startHeartbeat(intervalMs: number = 30000): NodeJS.Timeout {
    return setInterval(() => {
      this.sendHeartbeat();
    }, intervalMs);
  }
}

// Singleton instance
export const sseManager = new SSEManager();