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
import * as fs from 'fs/promises';

const logger = createLogger('HTTP');
const shutdownUrlFile = process.env.MCP_SHUTDOWN_URL_FILE;
type InitializationState = 'initializing' | 'ready' | 'error';

function getShutdownHost(host: string): string {
  if (host === '0.0.0.0' || host === '::' || host === '::1' || host === 'localhost') {
    return '127.0.0.1';
  }

  return host;
}

async function writeShutdownUrlFile(host: string, port: number): Promise<void> {
  if (!shutdownUrlFile) return;

  const shutdownUrl = `http://${getShutdownHost(host)}:${port}/shutdown`;
  await fs.writeFile(shutdownUrlFile, `${shutdownUrl}\n`, 'utf8');
  logger.info(`Wrote shutdown URL to ${shutdownUrlFile}`);
}

/**
 * Start the MCP server with HTTP transport
 */
export async function startHttpServer(setupSignalHandlers = true): Promise<() => Promise<void>> {
  const mcpServer = MCPServer.getInstance();
  const app = express();
  const httpServer = createServer(app);
  let shuttingDown = false;
  let initializationState: InitializationState = 'initializing';
  let initializationError: string | null = null;

  // Disable nagles
  app.use(function(req, _res, next) {
    req.socket.setNoDelay(true);
    next();
  });

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
    const statusCode = initializationState === 'ready' ? 200 : 503;
    res.status(statusCode).json({
      status: initializationState === 'ready' ? 'healthy' : initializationState,
      server: config.server.name,
      version: config.server.version,
      transport: 'http',
      ready: initializationState === 'ready',
      initialization_error: initializationError,
    });
  });

  const rejectUntilReady = (res: express.Response): boolean => {
    if (initializationState === 'ready') {
      return false;
    }

    const message = initializationState === 'error'
      ? `MCP server initialization failed: ${initializationError ?? 'unknown error'}`
      : 'MCP server is still initializing';

    res.status(503).json({
      error: message,
      status: initializationState,
      ready: false,
    });
    return true;
  };

  // Set up graceful shutdown
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info('Shutting down HTTP server gracefully');

    try {
      await new Promise<void>((resolve, reject) => {
        httpServer.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          logger.info('HTTP server closed');
          resolve();
        });
        httpServer.closeAllConnections();
      });

      await mcpServer.close();

      if (process.env.NODE_ENV !== 'test') {
        process.exit(0);
      }
    } catch (error) {
      logger.error('Error during HTTP shutdown:', error);
      if (process.env.NODE_ENV !== 'test') {
        process.exit(1);
      }
      throw error;
    }
  };

  app.post('/shutdown', (_req, res) => {
    logger.info('Received HTTP shutdown request');
    res.status(202).json({ success: true, message: 'Shutdown initiated' });
    setImmediate(() => {
      void shutdown();
    });
  });

  // Map to store transports and server IDs by session ID
  const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};
  const serverIds: { [sessionId: string]: string } = {};

  // Handle POST requests for client-to-server communication
  app.post('/mcp', async (req, res) => {
    if (rejectUntilReady(res)) {
      return;
    }

    // Check for existing session ID
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
      // Reuse existing transport
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // New initialization request
      const newSessionId = randomUUID();
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => newSessionId,
        onsessioninitialized: async (sessionId) => {
          // Store the transport and use sessionId as serverId
          transports[sessionId] = transport;
          serverIds[sessionId] = sessionId;
          
          // Create and connect server using sessionId
          mcpServer.createServer(sessionId);
          await mcpServer.connect(sessionId, transport);
        },
        onsessionclosed(sessionId) {
          const serverId = serverIds[sessionId];
          if (serverId) {
            mcpServer.removeServer(serverId);
            delete serverIds[sessionId];
          }
          delete transports[sessionId];
        },
        // DNS rebinding protection is disabled by default for backwards compatibility. If you are running this server
        // locally, make sure to set:
        // enableDnsRebindingProtection: true,
        // allowedHosts: ['127.0.0.1'],
      });
    } else {
      // Invalid request
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: `Bad Request: No valid session ID provided (${sessionId})`,
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
    if (rejectUntilReady(res)) {
      return;
    }

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
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error('Express error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  if (setupSignalHandlers) {
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    process.on('SIGBREAK', shutdown);
  }

  // Start the server
  const port = config.transport.port || 3000;
  const host = config.transport.host || '127.0.0.1';

  try {
    httpServer.keepAliveTimeout = 3600000;
    await new Promise<void>((resolve, reject) => {
      httpServer.once('error', reject);
      httpServer.listen(port, host, () => {
        httpServer.off('error', reject);

        const address = httpServer.address();
        const actualHost = typeof address === 'object' && address ? address.address : host;
        const actualPort = typeof address === 'object' && address ? address.port : port;

        logger.info(`MCP HTTP server listening on http://${actualHost}:${actualPort}`);
        logger.info(`Streamable HTTP endpoint: http://${actualHost}:${actualPort}/mcp`);
        logger.info(`Health check: http://${actualHost}:${actualPort}/health`);
        logger.info(`Shutdown endpoint: POST http://${getShutdownHost(actualHost)}:${actualPort}/shutdown`);
        logger.info('MCP server initialization running in background');

        void writeShutdownUrlFile(actualHost, actualPort).catch((error) => {
          logger.warn(`Failed to write shutdown URL file: ${String(error)}`);
        });

        resolve();
      });
    });

    void mcpServer.initialize().then(() => {
      initializationState = 'ready';
      logger.info('MCP server initialization complete');
    }).catch((error) => {
      initializationState = 'error';
      initializationError = error instanceof Error ? error.message : String(error);
      logger.error('Failed to initialize MCP server:', error);
    });

    return shutdown;
  } catch (error) {
    logger.error('Failed to start HTTP server:', error);
    throw error;
  }
}
