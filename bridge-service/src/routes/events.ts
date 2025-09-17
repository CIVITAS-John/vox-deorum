/**
 * Server-Sent Events endpoint for real-time game event streaming
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../utils/logger.js';
import { dllConnector } from '../services/dll-connector.js';
import { GameEvent, SSEClient } from '../types/event.js';
import { respondError } from '../types/api.js';
import { gameMutexManager } from '../utils/mutex.js';

const logger = createLogger('EventRoutes');
const router = Router();

// Store active SSE connections
const sseClients: Map<string, SSEClient> = new Map();

/**
 * GET /events - Server-Sent Events endpoint for game events
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const clientId = uuidv4();
    
    logger.info(`New SSE client connected: ${clientId}`);

    // Set headers for Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Store client connection
    const client: SSEClient = {
      id: clientId,
      response: res,
      connectedAt: new Date()
    };
    sseClients.set(clientId, client);

    // Send initial connection event
    sendSSEMessage(res, 'connected', {
      clientId,
      timestamp: new Date().toISOString(),
      message: 'Successfully connected to event stream'
    });

    // Send keep-alive ping every 30 seconds
    const keepAlive = setInterval(() => {
      if (!res.destroyed) {
        sendSSEMessage(res, 'ping', { timestamp: new Date().toISOString() });
      } else {
        clearInterval(keepAlive);
      }
    }, 30000);

    // Handle client disconnect
    req.on('close', () => {
      logger.info(`SSE client disconnected: ${clientId}`);
      sseClients.delete(clientId);
      clearInterval(keepAlive);
    });

    req.on('error', (error) => {
      logger.error(`SSE client error: ${clientId}`, error);
      sseClients.delete(clientId);
      clearInterval(keepAlive);
    });
  } catch (error) {
    logger.error('Error establishing SSE connection:', error);
    // If headers not sent yet, send error response
    if (!res.headersSent) {
      res.status(500).json(respondError(
        'INTERNAL_ERROR' as any,
        'Failed to establish SSE connection',
        error instanceof Error ? error.message : 'Unknown error'
      ));
    }
  }
});

/**
 * Send SSE message to a specific response
 */
function sendSSEMessage(res: Response, event: string, data: any): void {
  try {
    if (!res.destroyed) {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  } catch (error) {
    logger.error('Error sending SSE message:', error);
  }
}

/**
 * Broadcast event to all connected SSE clients
 */
function broadcastEvent(gameEvent: GameEvent): void {
  logger.debug(`Broadcasting event to ${sseClients.size} clients: ${gameEvent.type}`);
  
  const disconnectedClients: string[] = [];
  
  for (const [clientId, client] of sseClients) {
    try {
      if (client.response.destroyed) {
        disconnectedClients.push(clientId);
      } else {
        sendSSEMessage(client.response, "message", {
          id: gameEvent.id,
          type: gameEvent.type,
          payload: gameEvent.payload,
          timestamp: gameEvent.timestamp
        });
      }
    } catch (error) {
      logger.error(`Error broadcasting to client ${clientId}:`, error);
      disconnectedClients.push(clientId);
    }
  }

  // Clean up disconnected clients
  for (const clientId of disconnectedClients) {
    sseClients.delete(clientId);
  }
}

/**
 * Get SSE statistics
 */
export function getSSEStats(): {
  activeClients: number;
  clientIds: string[];
} {
  return {
    activeClients: sseClients.size,
    clientIds: Array.from(sseClients.keys())
  };
}

// Listen for game events from DLL and broadcast to SSE clients
dllConnector.on('game_event', (eventData: any) => {
  const gameEvent: GameEvent = {
    id: eventData.id,
    type: eventData.event,
    payload: eventData.payload,
    timestamp: eventData.timestamp || new Date().toISOString()
  };

  // Handle player turn events for auto-pause functionality
  if (eventData.event === 'PlayerDoTurn' && eventData.payload?.args) {
    const playerId = eventData.payload.args.PlayerID;
    if (typeof playerId === 'number') {
      gameMutexManager.setActivePlayer(playerId);
      logger.debug(`Active player changed to ${playerId} (PlayerDoTurn event)`);
    }
  } else if (eventData.event === 'PlayerDoneTurn' && eventData.payload?.args) {
    const nextPlayerId = eventData.payload.args.NextPlayerID;
    if (typeof nextPlayerId === 'number') {
      gameMutexManager.setActivePlayer(nextPlayerId);
      logger.debug(`Active player changed to ${nextPlayerId} (PlayerDoneTurn event)`);
    }
  }

  broadcastEvent(gameEvent);
});

// Send connection status events when DLL connects/disconnects
dllConnector.on('connected', () => {
  const statusEvent: GameEvent = {
    type: 'dll_status',
    payload: { connected: true },
    timestamp: new Date().toISOString()
  };
  broadcastEvent(statusEvent);
});

dllConnector.on('disconnected', () => {
  const statusEvent: GameEvent = {
    type: 'dll_status',
    payload: { connected: false },
    timestamp: new Date().toISOString()
  };
  broadcastEvent(statusEvent);
  gameMutexManager.clearPausedPlayers();
});

export default router;