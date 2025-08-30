/**
 * HTTP transport entry point for MCP server
 * Express server with SSE support and CORS for web-based clients
 */

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { MCPServer } from './server.js';
import { logger } from './utils/logger.js';
import { config } from './utils/config.js';

/**
 * Start the MCP server with HTTP transport
 */
export async function startHttpServer(): Promise<void> {
  const mcpServer = MCPServer.getInstance();
  const app = express();
  const httpServer = createServer(app);

  // Configure CORS
  const corsOptions = {
    origin: config.transport.cors?.origin || '*',
    methods: config.transport.cors?.methods || ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: config.transport.cors?.allowedHeaders || ['Content-Type', 'Authorization'],
    credentials: config.transport.cors?.credentials || true,
  };

  app.use(cors(corsOptions));
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

  // SSE endpoint for MCP communication
  app.get('/sse', async (req, res) => {
    logger.info('New SSE connection established');
    
    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    });

    // Create SSE transport for this connection
    const transport = new SSEServerTransport('/message', res as any);
    
    try {
      // Connect the server to this transport
      await mcpServer.getServer().connect(transport);
      
      // Keep connection alive with heartbeat
      const heartbeat = setInterval(() => {
        res.write(':heartbeat\n\n');
      }, 30000);

      // Clean up on client disconnect
      req.on('close', () => {
        clearInterval(heartbeat);
        logger.info('SSE connection closed');
      });
    } catch (error) {
      logger.error('Failed to establish SSE connection:', error);
      res.end();
    }
  });

  // POST endpoint for receiving messages
  app.post('/message', async (_req, res) => {
    try {
      // This endpoint would be used by the SSE transport to receive messages
      // The actual message handling is done by the MCP SDK
      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to process message:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

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
    await mcpServer.shutdown();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Start the server
  const port = config.transport.port || 3000;
  const host = config.transport.host || 'localhost';

  try {
    logger.info('Initializing MCP server');
    await mcpServer.initialize();
    
    httpServer.listen(port, host, () => {
      logger.info(`MCP HTTP server listening on http://${host}:${port}`);
      logger.info(`SSE endpoint: http://${host}:${port}/sse`);
      logger.info(`Health check: http://${host}:${port}/health`);
    });
  } catch (error) {
    logger.error('Failed to start HTTP server:', error);
    process.exit(1);
  }
}