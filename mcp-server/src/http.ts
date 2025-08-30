/**
 * HTTP transport entry point for MCP server
 * Express server with SSE support and CORS for web-based clients
 */

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { MCPServer } from './server.js';
import { createLogger } from './utils/logger.js';
import { config } from './utils/config.js';
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js"
import { randomUUID } from 'crypto';

const logger = createLogger('HTTP');

/**
 * Start the MCP server with HTTP transport
 */
export async function startHttpServer(setupSignalHandlers = true): Promise<() => Promise<void>> {
  const mcpServer = MCPServer.getInstance();
  const app = express();
  const httpServer = createServer(app);

  // Configure CORS
  app.use(cors({
    origin: config.transport.cors?.origin || '*',
    methods: config.transport.cors?.methods || ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: config.transport.cors?.allowedHeaders || ['Content-Type', 'Authorization'],
    credentials: config.transport.cors?.credentials || true,
  }));
  app.use(express.json());

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({ 
      status: 'healthy',
      server: config.server.name,
      version: config.server.version,
      transport: 'http',
    });
  });

  // Map to store transports by session ID
  const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

  // Handle POST requests for client-to-server communication
  app.post('/mcp', async (req, res) => {
    // Check for existing session ID
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
      // Reuse existing transport
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // New initialization request
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sessionId) => {
          // Store the transport by session ID
          transports[sessionId] = transport;
        },
        // DNS rebinding protection is disabled by default for backwards compatibility. If you are running this server
        // locally, make sure to set:
        // enableDnsRebindingProtection: true,
        // allowedHosts: ['127.0.0.1'],
      });

      // Clean up transport when closed
      transport.onclose = () => {
        if (transport.sessionId) {
          delete transports[transport.sessionId];
        }
      };

      // Connect to the MCP server
      await mcpServer.connect(transport);
    } else {
      // Invalid request
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: No valid session ID provided',
        },
        id: null,
      });
      return;
    }

    // Handle the request
    await transport.handleRequest(req, res, req.body);
  });

  // Reusable handler for GET and DELETE requests
  const handleSessionRequest = async (req: express.Request, res: express.Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }
    
    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
  };

  // Handle GET requests for server-to-client notifications via SSE
  app.get('/mcp', handleSessionRequest);

  // Handle DELETE requests for session termination
  app.delete('/mcp', handleSessionRequest);
  
  // Error handling middleware
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error('Express error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  // Set up graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down HTTP server gracefully');
    
    // Close HTTP server
    httpServer.close(() => {
      logger.info('HTTP server closed');
    });

    // Shutdown MCP server
    await mcpServer.close();
    
    // Only exit if not in test mode
    if (process.env.NODE_ENV !== 'test') {
      process.exit(0);
    }
  };

  if (setupSignalHandlers) {
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }

  // Start the server
  const port = config.transport.port || 3000;
  const host = config.transport.host || 'localhost';

  try {
    await mcpServer.initialize();
    
    httpServer.listen(port, host, () => {
      logger.info(`MCP HTTP server listening on http://${host}:${port}`);
      logger.info(`SSE endpoint: http://${host}:${port}/sse`);
      logger.info(`Health check: http://${host}:${port}/health`);
    });

    return shutdown;
  } catch (error) {
    logger.error('Failed to start HTTP server:', error);
    if (setupSignalHandlers) process.exit(1);
    throw error;
  }
}