/**
 * @module web/routes/agent
 *
 * API routes for agent management and chat functionality.
 * Provides endpoints for listing agents, managing chat sessions,
 * and streaming chat interactions.
 */

import { Router, Request, Response } from 'express';
import { getAllAgents, getAgent } from '../../infra/agent-registry.js';
import { EnvoyThread } from '../../envoy/envoy-thread.js';
import { createLogger } from '../../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
import { SSEManager } from '../sse-manager.js';
import { ModelMessage } from 'ai';
import { sqliteExporter } from '../../instrumentation.js';
import fs from 'fs/promises';
import path from 'path';
import type {
  ListAgentsResponse,
  CreateSessionRequest,
  CreateSessionResponse,
  ListSessionsResponse,
  GetSessionResponse,
  ChatRequest,
  DeleteSessionResponse,
  AgentInfo
} from '../types/agent-api.js';

const logger = createLogger('webui:agent-routes');

// In-memory storage for chat sessions (in production, use a database)
const chatSessions = new Map<string, EnvoyThread>();

/**
 * Create agent API routes
 * @param sseManager - SSE manager for streaming responses
 * @returns Express router with agent endpoints
 */
export function createAgentRoutes(sseManager: SSEManager): Router {
  const router = Router();

  /**
   * GET /api/agents - List all available agents
   * Response includes agent names, descriptions, and tags for filtering
   */
  router.get('/agents', (_req: Request, res: Response<ListAgentsResponse>) => {
    try {
      const agents = getAllAgents();
      const agentList: AgentInfo[] = Object.values(agents).map(agent => ({
        name: agent.name,
        description: agent.description,
        tags: agent.tags || []
      }));

      res.json({ agents: agentList });
    } catch (error) {
      logger.error('Failed to list agents', { error });
      res.status(500).json({ error: 'Failed to list agents' } as any);
    }
  });

  /**
   * POST /api/agents/session - Create a new chat session
   * Initializes a new chat session for the specified agent
   */
  router.post('/agents/session', async (req: Request<{}, {}, CreateSessionRequest>, res: Response<CreateSessionResponse>): Promise<Response> => {
    try {
      const { agentName, contextId, databasePath, turn } = req.body;

      if (!agentName) {
        return res.status(400).json({ error: 'Agent name is required' } as any);
      }

      // Verify agent exists
      const agent = getAgent(agentName);
      if (!agent) {
        return res.status(404).json({ error: `Agent ${agentName} not found` } as any);
      }

      // Validate contextId or databasePath
      let gameID = 'unknown';
      let playerID = 0;
      const contextType = databasePath ? 'database' : 'live';

      if (contextId) {
        // Check if contextId refers to an active telemetry session
        const activeConnections = sqliteExporter.getActiveConnections();
        if (activeConnections.includes(contextId)) {
          // Parse gameId and playerId from contextId (format: gameId-playerId)
          const parts = contextId.split('-');
          if (parts.length >= 2) {
            playerID = parseInt(parts[parts.length - 1] || '0', 10);
            gameID = parts.slice(0, -1).join('-') || contextId;
          } else {
            gameID = contextId;
          }
        }
      } else if (databasePath) {
        // Validate database file exists
        try {
          await fs.access(databasePath);
          // Parse gameId and playerId from filename
          const nameWithoutExt = path.basename(databasePath, '.db');
          const parts = nameWithoutExt.split('-');
          playerID = parseInt(parts[parts.length - 1] || '0', 10);
          gameID = parts.slice(0, -1).join('-') || 'unknown';
        } catch {
          return res.status(400).json({ error: `Database file not found: ${databasePath}` } as any);
        }
      }

      // Create new session
      const sessionId = uuidv4();

      // Initialize chat thread
      const thread: EnvoyThread = {
        id: sessionId,
        agent: agentName,
        title: `${agentName} - ${new Date().toLocaleString()}`,
        gameID,
        playerID,
        contextType,
        contextId,
        databasePath,
        messages: [],
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          turn: turn
        }
      };

      chatSessions.set(sessionId, thread);

      // Return the full EnvoyThread
      return res.json(thread);
    } catch (error) {
      logger.error('Failed to create session', { error });
      return res.status(500).json({ error: 'Failed to create session' } as any);
    }
  });

  /**
   * GET /api/agents/sessions - Get all active chat sessions
   * Returns list of all current chat sessions as EnvoyThreads
   */
  router.get('/agents/sessions', (_req: Request, res: Response<ListSessionsResponse>) => {
    try {
      const sessions = Array.from(chatSessions.values());
      res.json({ sessions });
    } catch (error) {
      logger.error('Failed to list sessions', { error });
      res.status(500).json({ error: 'Failed to list sessions' } as any);
    }
  });

  /**
   * GET /api/agents/session/:sessionId - Get session details with messages
   * Returns the full EnvoyThread with message history
   */
  router.get('/agents/session/:sessionId', (req: Request, res: Response<GetSessionResponse>): Response => {
    try {
      const { sessionId } = req.params;
      const thread = chatSessions.get(sessionId);

      if (!thread) {
        return res.status(404).json({ error: 'Session not found' } as any);
      }

      // Return the full EnvoyThread
      return res.json(thread);
    } catch (error) {
      logger.error('Failed to get session', { error });
      return res.status(500).json({ error: 'Failed to get session' } as any);
    }
  });

  /**
   * POST /api/agents/chat - Unified streaming chat endpoint
   * Sends a message to the specified agent and streams the response
   */
  router.post('/agents/chat', async (req: Request<{}, {}, ChatRequest>, res: Response): Promise<void> => {
    try {
      const { agentName, sessionId, message } = req.body;

      if (!message) {
        res.status(400).json({ error: 'Message is required' });
        return;
      }
      
      if (!sessionId) {
        res.status(400).json({ error: 'SessionID is required' });
        return;
      }

      // Get or create session
      let thread = chatSessions.get(sessionId);
      if (!thread) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      // Add user message to thread
      const userMessage: ModelMessage = {
        role: 'user',
        content: message
      };
      thread.messages.push(userMessage);
      thread.metadata!.updatedAt = new Date();

      // Set up SSE stream
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });

      // Register SSE client
      sseManager.addClient(res);

      // Send initial connection event
      sseManager.broadcast('connected', { sessionId: thread.id });

      // Simulate agent response (would integrate with actual agent execution)
      // For now, just echo back the message
      setTimeout(() => {
        // Send message chunks
        const response = `I received your message: "${message}". This is a placeholder response from ${thread.agent}.`;
        const chunks = response.split(' ');

        chunks.forEach((chunk, index) => {
          setTimeout(() => {
            sseManager.broadcast('message', { text: chunk + ' ' });
          }, index * 100);
        });

        // Send completion after all chunks
        setTimeout(() => {
          // Add assistant message to thread
          const assistantMessage: ModelMessage = {
            role: 'assistant',
            content: response
          };
          thread!.messages.push(assistantMessage);

          sseManager.broadcast('done', {
            sessionId: thread!.id,
            messageCount: thread!.messages.length
          });
        }, chunks.length * 100 + 500);
      }, 500);

      // Handle client disconnect
      req.on('close', () => {
        logger.info(`Chat client disconnected`);
      });

    } catch (error) {
      logger.error('Failed to process chat', { error });
      res.status(500).json({ error: 'Failed to process chat' });
    }
  });

  /**
   * DELETE /api/agents/session/:sessionId - Delete a chat session
   * Removes the specified session from memory
   */
  router.delete('/agents/session/:sessionId', (req: Request, res: Response<DeleteSessionResponse>): Response => {
    try {
      const { sessionId } = req.params;

      if (!chatSessions.has(sessionId)) {
        return res.status(404).json({ error: 'Session not found' } as any);
      }

      chatSessions.delete(sessionId);
      return res.json({ success: true });
    } catch (error) {
      logger.error('Failed to delete session', { error });
      return res.status(500).json({ error: 'Failed to delete session' } as any);
    }
  });

  return router;
}