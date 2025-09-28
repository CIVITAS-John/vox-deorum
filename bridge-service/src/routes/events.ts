/**
 * Server-Sent Events endpoint for real-time game event streaming
 */

import { Router, Request, Response } from 'express';
import { createSession, Session } from 'better-sse';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../utils/logger.js';
import { dllConnector } from '../services/dll-connector.js';
import { GameEvent, GameEventMessage } from '../types/event.js';
import { respondError } from '../types/api.js';
import { gameMutexManager } from '../utils/mutex.js';

const logger = createLogger('EventRoutes');
const router = Router();

// Store active SSE sessions
const sseSessions: Map<string, Session> = new Map();

/**
 * GET /events - Server-Sent Events endpoint for game events
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const clientId = uuidv4();

    logger.info(`New SSE client connected: ${clientId}`);

    // Create a better-sse session
    const session = await createSession(req, res, {
      headers: {
        'X-Accel-Buffering': 'no',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      },
      retry: 1000
    });

    // Store session
    sseSessions.set(clientId, session);

    // Send initial connection event
    session.push({
      clientId,
      timestamp: new Date().toISOString(),
      message: 'Successfully connected to event stream'
    }, 'connected');

    // Set up keep-alive pings every 5 seconds
    const keepAlive = setInterval(() => {
      if (session.isConnected) {
        session.push({ timestamp: new Date().toISOString() }, 'ping');
      } else {
        clearInterval(keepAlive);
      }
    }, 5000);

    // Handle session disconnect
    session.on('disconnected', () => {
      logger.info(`SSE client disconnected: ${clientId}`);
      sseSessions.delete(clientId);
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
 * Broadcast event to all connected SSE clients
 */
function broadcastEvent(gameEvent: GameEvent): void {
  logger.debug(`Broadcasting event to ${sseSessions.size} clients: ${gameEvent.type}`);

  const disconnectedClients: string[] = [];

  for (const [clientId, session] of sseSessions) {
    try {
      if (!session.isConnected) {
        disconnectedClients.push(clientId);
      } else {
        session.push({
          id: gameEvent.id,
          type: gameEvent.type,
          payload: gameEvent.payload,
          extraPayload: gameEvent.extraPayload,
          visibility: gameEvent.visibility,
        }, 'message');
      }
    } catch (error) {
      logger.error(`Error broadcasting to client ${clientId}:`, error);
      disconnectedClients.push(clientId);
    }
  }

  // Clean up disconnected clients
  for (const clientId of disconnectedClients) {
    sseSessions.delete(clientId);
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
    activeClients: sseSessions.size,
    clientIds: Array.from(sseSessions.keys())
  };
}

// Listen for game events from DLL and broadcast to SSE clients
dllConnector.on('game_event', (eventData: GameEventMessage) => {
  // Handle player turn events for auto-pause functionality
  if (eventData.event === 'PlayerDoTurn' && eventData.payload) {
    const playerId = eventData.payload["PlayerID"]
    if (typeof playerId === 'number') {
      gameMutexManager.setActivePlayer(playerId);
      logger.debug(`Active player changed to ${playerId} (PlayerDoTurn event)`);
    }
  } else if (eventData.event === 'PlayerDoneTurn' && eventData.payload?.args) {
    const nextPlayerId = eventData.payload["NextPlayerID"]
    if (typeof nextPlayerId === 'number') {
      gameMutexManager.setActivePlayer(nextPlayerId);
      logger.debug(`Active player changed to ${nextPlayerId} (PlayerDoneTurn event)`);
    }
  }

  broadcastEvent({
    type: eventData.event,
    id: eventData.id,
    payload: eventData.payload,
    extraPayload: eventData.extraPayload,
    visibility: eventData.visibility
  });
});

// Send connection status events when DLL connects/disconnects
dllConnector.on('connected', () => {
  const statusEvent: GameEvent = {
    type: 'dll_status',
    payload: { connected: true }
  };
  broadcastEvent(statusEvent);
});

dllConnector.on('disconnected', () => {
  const statusEvent: GameEvent = {
    type: 'dll_status',
    payload: { connected: false }
  };
  broadcastEvent(statusEvent);
  gameMutexManager.clearPausedPlayers();
});

export default router;