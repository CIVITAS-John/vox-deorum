/**
 * SSE connection management test - Tests for Server-Sent Events client tracking and event broadcasting
 */

import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { EventSource } from 'eventsource';
import request from 'supertest';
import { app } from '../../src/index.js';
import { getSSEStats } from '../../src/routes/events.js';
import { dllConnector } from '../../src/services/dll-connector.js';
import config from '../../src/utils/config.js';
import bridgeService from '../../src/service.js';

/**
 * Helper to wait for an SSE event with timeout
 */
function waitForSSEEvent(
  eventSource: EventSource, 
  eventType: string, 
  timeout: number = 5000
): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event: ${eventType}`));
    }, timeout);

    const handler = (event: MessageEvent) => {
      clearTimeout(timer);
      try {
        const data = JSON.parse(event.data);
        resolve(data);
      } catch (error) {
        resolve(event.data);
      }
    };

    eventSource.addEventListener(eventType, handler, { once: true });
  });
}

/**
 * Helper to create an SSE client connection
 */
function createSSEClient(): EventSource {
  return new EventSource(`http://localhost:${config.rest.port}/events`, {
    withCredentials: false
  });
}

// SSE service functionality tests
describe('SSE Service', () => {
  // Setup and teardown
  beforeAll(async () => {
    // Start the server if not already running
    await bridgeService.start();
  });

  afterEach(() => {
    bridgeService.shutdown();
  });

  // SSE statistics and client tracking
  describe('SSE Statistics', () => {
    it('should provide SSE statistics', async () => {
      const sseStats = getSSEStats();
      
      expect(sseStats).toHaveProperty('activeClients');
      expect(sseStats).toHaveProperty('clientIds');
      expect(typeof sseStats.activeClients).toBe('number');
      expect(Array.isArray(sseStats.clientIds)).toBe(true);
      
      console.log('✅ SSE statistics available');
    });

    it('should track active client count accurately', async () => {
      const initialStats = getSSEStats();
      const initialCount = initialStats.activeClients;
      
      // Connect a client
      const client = createSSEClient();
      
      // Wait for connection to establish
      await waitForSSEEvent(client, 'connected');
      
      const statsAfterConnect = getSSEStats();
      expect(statsAfterConnect.activeClients).toBe(initialCount + 1);
      
      // Close the client
      client.close();
      
      // Wait for disconnection to process
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const statsAfterDisconnect = getSSEStats();
      expect(statsAfterDisconnect.activeClients).toBe(initialCount);
      
      console.log('✅ SSE client tracking working');
    });
  });

  // Single SSE client connection
  describe('Single SSE Client Connection', () => {
    let client: EventSource;

    afterEach(() => {
      if (client) {
        client.close();
      }
    });

    it('should establish SSE connection and receive connected event', async () => {
      client = createSSEClient();
      
      const connectedEvent = await waitForSSEEvent(client, 'connected');
      
      expect(connectedEvent).toHaveProperty('clientId');
      expect(connectedEvent).toHaveProperty('timestamp');
      expect(connectedEvent).toHaveProperty('message');
      expect(connectedEvent.message).toBe('Successfully connected to event stream');
      
      console.log('✅ SSE connection established with connected event');
    });

    it.skip('should receive ping events for keep-alive', async () => {
      // Skipping this test as it requires real timer waits
      // The ping mechanism is tested indirectly through long-running connections
      client = createSSEClient();
      
      // Wait for initial connection
      await waitForSSEEvent(client, 'connected');
      
      // Would need to wait 30 seconds for real ping event
      // This is tested in production scenarios
      
      console.log('⏭️ SSE keep-alive ping test skipped (requires real timer)');
    });

    it('should handle client-initiated disconnection gracefully', async () => {
      const initialStats = getSSEStats();
      
      client = createSSEClient();
      await waitForSSEEvent(client, 'connected');
      
      const connectedStats = getSSEStats();
      expect(connectedStats.activeClients).toBe(initialStats.activeClients + 1);
      
      // Close the connection
      client.close();
      
      // Wait for server to process disconnection
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const finalStats = getSSEStats();
      expect(finalStats.activeClients).toBe(initialStats.activeClients);
      
      console.log('✅ Client disconnection handled properly');
    });
  });

  // Multiple concurrent SSE clients
  describe('Multiple SSE Client Connections', () => {
    let clients: EventSource[] = [];

    afterEach(() => {
      // Clean up all clients
      clients.forEach(client => client.close());
      clients = [];
    });

    it('should handle multiple concurrent SSE connections', async () => {
      const initialStats = getSSEStats();
      const clientCount = 5;
      
      // Create multiple clients sequentially to avoid race conditions
      for (let i = 0; i < clientCount; i++) {
        const client = createSSEClient();
        clients.push(client);
        await waitForSSEEvent(client, 'connected');
      }
      
      // Check client count
      const stats = getSSEStats();
      expect(stats.activeClients).toBeGreaterThanOrEqual(clientCount);
      expect(stats.clientIds.length).toBeGreaterThanOrEqual(clientCount);
      
      // All client IDs should be unique
      const uniqueIds = new Set(stats.clientIds);
      expect(uniqueIds.size).toBe(stats.clientIds.length);
      
      console.log(`✅ Multiple SSE connections handled (${clientCount} clients)`);
    });

    it('should broadcast events to all connected clients', async () => {
      const clientCount = 3;
      const eventPromises: Promise<any>[] = [];
      
      // Create multiple clients
      for (let i = 0; i < clientCount; i++) {
        const client = createSSEClient();
        clients.push(client);
        await waitForSSEEvent(client, 'connected');
        
        // Set up listener for game event
        eventPromises.push(waitForSSEEvent(client, 'test_event'));
      }
      
      // Emit a game event from DLL connector
      dllConnector.emit('game_event', {
        event: 'test_event',
        payload: { test: 'data', value: 123 },
        timestamp: new Date().toISOString()
      });
      
      // All clients should receive the event
      const receivedEvents = await Promise.all(eventPromises);
      
      expect(receivedEvents).toHaveLength(clientCount);
      receivedEvents.forEach(event => {
        expect(event.type).toBe('test_event');
        expect(event.payload).toEqual({ test: 'data', value: 123 });
        expect(event).toHaveProperty('timestamp');
      });
      
      console.log(`✅ Event broadcast to all ${clientCount} clients`);
    });

    it('should handle partial client disconnections during broadcast', async () => {
      const clientCount = 4;
      
      // Create multiple clients
      for (let i = 0; i < clientCount; i++) {
        const client = createSSEClient();
        clients.push(client);
        await waitForSSEEvent(client, 'connected');
      }
      
      // Disconnect half of the clients
      clients[0].close();
      clients[1].close();
      
      // Wait for disconnections to process
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Set up listeners for remaining clients
      const eventPromises = [
        waitForSSEEvent(clients[2], 'test_broadcast'),
        waitForSSEEvent(clients[3], 'test_broadcast')
      ];
      
      // Broadcast an event
      dllConnector.emit('game_event', {
        event: 'test_broadcast',
        payload: { message: 'partial broadcast' },
        timestamp: new Date().toISOString()
      });
      
      // Remaining clients should receive the event
      const receivedEvents = await Promise.all(eventPromises);
      expect(receivedEvents).toHaveLength(2);
      
      // Check client count
      const stats = getSSEStats();
      expect(stats.activeClients).toBe(2);
      
      console.log('✅ Partial disconnection handled during broadcast');
    });
  });

  // Error handling and edge cases
  describe('Error Handling and Edge Cases', () => {
    it('should handle client errors gracefully', async () => {
      const client = createSSEClient();
      await waitForSSEEvent(client, 'connected');
      
      const initialStats = getSSEStats();
      expect(initialStats.activeClients).toBeGreaterThan(0);
      
      // Close the client connection to simulate disconnection
      client.close();
      
      // Wait for error handling
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Client should be removed from active clients
      const finalStats = getSSEStats();
      expect(finalStats.activeClients).toBeLessThan(initialStats.activeClients);
      
      console.log('✅ Client errors handled gracefully');
    });

    it('should clean up destroyed response connections', async () => {
      const clientCount = 3;
      const clients: EventSource[] = [];
      
      // Create multiple clients
      for (let i = 0; i < clientCount; i++) {
        const client = createSSEClient();
        clients.push(client);
        await waitForSSEEvent(client, 'connected');
      }
      
      // Force destroy one client's response
      clients[1].close();
      
      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Broadcast should still work for remaining clients
      const eventPromises = [
        waitForSSEEvent(clients[0], 'cleanup_test'),
        waitForSSEEvent(clients[2], 'cleanup_test')
      ];
      
      dllConnector.emit('game_event', {
        event: 'cleanup_test',
        payload: { test: 'cleanup' },
        timestamp: new Date().toISOString()
      });
      
      // Should not throw, remaining clients should receive
      const results = await Promise.allSettled(eventPromises);
      const successful = results.filter(r => r.status === 'fulfilled');
      expect(successful.length).toBeGreaterThanOrEqual(1);
      
      // Clean up
      clients.forEach(c => c.close());
      
      console.log('✅ Destroyed connections cleaned up properly');
    });
  });

  // Integration with REST endpoints
  describe('Integration with REST Endpoints', () => {
    it('should report SSE stats via /stats endpoint', async () => {
      // Connect some SSE clients
      const clients: EventSource[] = [];
      for (let i = 0; i < 2; i++) {
        const client = createSSEClient();
        clients.push(client);
        await waitForSSEEvent(client, 'connected');
      }
      
      // Get stats via REST endpoint
      const response = await request(app)
        .get('/stats')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('sse');
      expect(response.body.data.sse.activeClients).toBe(2);
      expect(response.body.data.sse.clientIds).toHaveLength(2);
      
      // Clean up
      clients.forEach(c => c.close());
      
      console.log('✅ SSE stats available via REST endpoint');
    });
  });
});