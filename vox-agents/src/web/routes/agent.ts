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
import { createLogger } from '../../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
import { ModelMessage } from 'ai';
import fs from 'fs/promises';
import {
  parseContextIdentifier,
  parseDatabaseIdentifier,
  createTelepathicContextId
} from '../../utils/identifier-parser.js';
import { StrategistParameters } from '../../strategist/strategy-parameters.js';
import {
  ListAgentsResponse,
  CreateChatRequest,
  CreateChatResponse,
  ListChatsResponse,
  GetChatResponse,
  ChatMessageRequest,
  DeleteChatResponse,
  AgentInfo,
  StreamingEventCallback,
  EnvoyThread
} from '../../types/index.js';

const logger = createLogger('webui:agent-routes');

// In-memory storage for chat sessions (in production, use a database)
const chatSessions = new Map<string, EnvoyThread>();

/**
 * Create agent API routes
 * @returns Express router with agent endpoints
 */
export function createAgentRoutes(): Router {
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
   * POST /api/agents/chat - Create a new chat thread
   * Initializes a new chat thread for the specified agent
   */
  router.post('/agents/chat', async (req: Request<{}, {}, CreateChatRequest>, res: Response<CreateChatResponse>): Promise<Response> => {
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
          // Parse gameID and playerID using utility function
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
          // Parse gameID and playerID using utility function
          const identifierInfo = parseDatabaseIdentifier(databasePath);
          gameID = identifierInfo.gameID;
          playerID = identifierInfo.playerID;

          // Create a new VoxContext for telepathist mode (database-based)
          effectiveContextId = createTelepathicContextId(gameID, playerID);
          const context = new VoxContext<StrategistParameters>({}, effectiveContextId);
          await context.registerTools();
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
   * GET /api/agents/chats - Get all active chat threads
   * Returns list of all current chat threads as EnvoyThreads
   */
  router.get('/agents/chats', (_req: Request, res: Response<ListChatsResponse>) => {
    try {
      const chats = Array.from(chatSessions.values());
      res.json({ chats });
    } catch (error) {
      logger.error('Failed to list chat threads', { error });
      res.status(500).json({ error: 'Failed to list chat threads' } as any);
    }
  });

  /**
   * GET /api/agents/chat/:chatId - Get chat thread details with messages
   * Returns the full EnvoyThread with message history
   */
  router.get('/agents/chat/:chatId', (req: Request, res: Response<GetChatResponse>): Response => {
    try {
      const { chatId } = req.params;
      const thread = chatSessions.get(chatId);

      if (!thread) {
        return res.status(404).json({ error: 'Chat thread not found' } as any);
      }

      // Return the full EnvoyThread
      return res.json(thread);
    } catch (error) {
      logger.error('Failed to get chat thread', { error });
      return res.status(500).json({ error: 'Failed to get chat thread' } as any);
    }
  });

  /**
   * POST /api/agents/message - Unified streaming chat endpoint
   * Sends a message to the specified agent and streams the response
   */
  router.post('/agents/message', async (req: Request<{}, {}, ChatMessageRequest>, res: Response): Promise<void> => {
    const { chatId, message } = req.body;

    if (!message) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    if (!chatId) {
      res.status(400).json({ error: 'Chat ID is required' });
      return;
    }

    // Get chat thread
    let thread = chatSessions.get(chatId);
    if (!thread) {
      res.status(404).json({ error: 'Chat thread not found' });
      return;
    }

    const voxContext = contextRegistry.get<StrategistParameters>(thread.contextId);
    if (!voxContext) {
      res.status(400).json({ error: 'Context not found. It may have been shut down.' });
      return;
    }

    // Add user message to thread with metadata
    const currentTurn = voxContext.lastParameter?.turn || 0;
    const userMessage: ModelMessage = {
      role: 'user',
      content: message
    };
    thread.messages.push({
      message: userMessage,
      metadata: {
        datetime: new Date(),
        turn: currentTurn
      }
    });
    thread.metadata!.updatedAt = new Date();

    // Set up SSE stream
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    // Helper function to send SSE event to this specific client
    const sendEvent = (event: string, data: any) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Send initial connection event
    sendEvent('connected', { sessionId: thread.id });

    try {
      // Execute the agent with the thread as input
      const streamCallback: StreamingEventCallback = {
        OnChunk: ({ chunk }) => {
          sendEvent('message', chunk);
        }
      };

      await voxContext.execute(
        thread.agent,
        voxContext.lastParameter!,
        thread,
        streamCallback
      );

      sendEvent('done', {
        sessionId: thread.id,
        messageCount: thread.messages.length
      });
    } catch (error) {
      logger.error('Failed to execute agent', { error });
      sendEvent('error', { message: `Failed to execute agent: ${(error as any).message ?? "unknown"}` })
    } finally {
      // Close the SSE stream
      res.end();
    }

    // Handle client disconnect
    req.on('close', () => {
      logger.info(`Chat client disconnected`);
      // Optionally abort the context if it's still running
      voxContext.abort(false);
    });
  });

  /**
   * DELETE /api/agents/chat/:chatId - Delete a chat thread
   * Removes the specified chat thread from memory and optionally shuts down its context
   */
  router.delete('/agents/chat/:chatId', async (req: Request, res: Response<DeleteChatResponse>): Promise<Response> => {
    try {
      const { chatId } = req.params;
      const thread = chatSessions.get(chatId);

      if (!thread) {
        return res.status(404).json({ error: 'Chat thread not found' } as any);
      }

      // If this is a telepathist context (database-based), shut it down
      if (thread.contextId && thread.contextId.startsWith('telepathist-')) {
        const context = contextRegistry.get(thread.contextId);
        if (context) {
          await context.shutdown();
          logger.info(`Shut down telepathist context: ${thread.contextId}`);
        }
      }

      chatSessions.delete(chatId);
      return res.json({ success: true });
    } catch (error) {
      logger.error('Failed to delete chat thread', { error });
      return res.status(500).json({ error: 'Failed to delete chat thread' } as any);
    }
  });

  return router;
}