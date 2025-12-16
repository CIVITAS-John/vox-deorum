/**
 * @module web/routes/agent
 *
 * API routes for agent management and chat functionality.
 * Provides endpoints for listing agents, managing chat sessions,
 * and streaming chat interactions.
 */

import { Router, Request, Response } from 'express';
import { agentRegistry } from '../../infra/agent-registry.js';
import { contextRegistry } from '../../infra/context-registry.js';
import { VoxContext } from '../../infra/vox-context.js';
import { EnvoyThread } from '../../envoy/envoy-thread.js';
import { createLogger } from '../../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
import { SSEManager } from '../sse-manager.js';
import { ModelMessage } from 'ai';
import { sqliteExporter } from '../../instrumentation.js';
import fs from 'fs/promises';
import {
  parseContextIdentifier,
  parseDatabaseIdentifier,
  createTelepathicContextId
} from '../../utils/identifier-parser.js';
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
import { StrategistParameters } from '../../strategist/strategy-parameters.js';
import { StreamingEventCallback } from '../../types/index.js';

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
      const agents = agentRegistry.getAll();
      const agentList: AgentInfo[] = agents.map(agent => ({
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
      const agent = agentRegistry.get(agentName);
      if (!agent) {
        return res.status(404).json({ error: `Agent ${agentName} not found` } as any);
      }

      // Validate contextId or databasePath
      let gameID = 'unknown';
      let playerID = 0;
      const contextType = databasePath ? 'database' : 'live';
      let effectiveContextId = contextId;

      if (contextId) {
        // First check if this is an existing VoxContext
        const existingContext = contextRegistry.get(contextId);
        if (existingContext) {
          // Use the existing live context
          logger.info(`Using existing VoxContext: ${contextId}`);
          // Parse gameId and playerId using utility function
          const identifierInfo = parseContextIdentifier(contextId);
          gameID = identifierInfo.gameID;
          playerID = identifierInfo.playerID;
        } else {
          return res.status(400).json({ error: `Connection not found: ${contextId}` } as any);
        }
      } else if (databasePath) {
        // Validate database file exists
        try {
          await fs.access(databasePath);
          // Parse gameId and playerId using utility function
          const identifierInfo = parseDatabaseIdentifier(databasePath);
          gameID = identifierInfo.gameID;
          playerID = identifierInfo.playerID;

          // Create a new VoxContext for telepathist mode (database-based)
          effectiveContextId = createTelepathicContextId(gameID, playerID);
          const telepathContext = new VoxContext<StrategistParameters>({}, effectiveContextId);
          await telepathContext.registerMCP();
          logger.info(`Created new VoxContext for telepathist mode: ${effectiveContextId}`);
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
        contextId: effectiveContextId!,
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

      // Get session
      let thread = chatSessions.get(sessionId);
      if (!thread) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      const voxContext = contextRegistry.get<StrategistParameters>(thread.contextId);
      if (!voxContext) {
        res.status(400).json({ error: 'Context not found. It may have been shut down.' });
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

      try {
        // Prepare parameters for agent execution
        const parameters: StrategistParameters = {
          playerID: thread.playerID,
          gameID: thread.gameID,
          turn: thread.metadata?.turn || 0,
          after: 0,
          before: Date.now(),
          gameStates: []
        };

        // Execute the agent with the thread as input
        const streamCallback: StreamingEventCallback = {
          OnChunk: ({ chunk }) => {
            // Handle different chunk types
            if (chunk.type === 'text-delta') {
              sseManager.broadcast('message', { text: chunk.text });
            } else if (chunk.type === 'tool-call') {
              sseManager.broadcast('tool-call', {
                toolName: chunk.toolName,
                toolCallId: chunk.toolCallId,
                input: chunk.input
              });
            } else if (chunk.type === 'tool-result') {
              sseManager.broadcast('tool-result', {
                toolName: chunk.toolName,
                toolCallId: chunk.toolCallId,
                output: chunk.output
              });
            }
          }
        };

        const result = await voxContext.execute(
          thread.agent,
          parameters,
          thread,
          streamCallback
        );

        // The result should be an updated EnvoyThread
        if (result && typeof result === 'object' && 'messages' in result) {
          // Update the thread with the result
          thread.messages = result.messages;
          thread.metadata = result.metadata || thread.metadata;
        } else {
          // If the agent doesn't return a thread, add a generic response
          const assistantMessage: ModelMessage = {
            role: 'assistant',
            content: typeof result === 'string' ? result : 'Response processed successfully.'
          };
          thread.messages.push(assistantMessage);
        }

        sseManager.broadcast('done', {
          sessionId: thread.id,
          messageCount: thread.messages.length
        });

      } catch (error) {
        logger.error('Failed to execute agent', { error });
        sseManager.broadcast('error', {
          message: 'Failed to execute agent',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      // Handle client disconnect
      req.on('close', () => {
        logger.info(`Chat client disconnected`);
        // Optionally abort the context if it's still running
        voxContext.abort(false);
      });

    } catch (error) {
      logger.error('Failed to process chat', { error });
      res.status(500).json({ error: 'Failed to process chat' });
    }
  });

  /**
   * DELETE /api/agents/session/:sessionId - Delete a chat session
   * Removes the specified session from memory and optionally shuts down its context
   */
  router.delete('/agents/session/:sessionId', async (req: Request, res: Response<DeleteSessionResponse>): Promise<Response> => {
    try {
      const { sessionId } = req.params;
      const thread = chatSessions.get(sessionId);

      if (!thread) {
        return res.status(404).json({ error: 'Session not found' } as any);
      }

      // If this is a telepathist context (database-based), shut it down
      if (thread.contextId && thread.contextId.startsWith('telepathist-')) {
        const context = contextRegistry.get(thread.contextId);
        if (context) {
          await context.shutdown();
          logger.info(`Shut down telepathist context: ${thread.contextId}`);
        }
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