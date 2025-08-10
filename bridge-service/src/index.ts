/**
 * Bridge Service Entry Point - Express server for Vox Deorum communication layer
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { logger } from './utils/logger';
import { config } from './utils/config';
import { bridgeService } from './service';
import { getSSEStats } from './routes/events';
import luaRoutes from './routes/lua';
import externalRoutes from './routes/external';
import eventsRoutes from './routes/events';
import { APIResponse, HealthCheckResponse } from './types/api';

// Create Express application
const app = express();

/**
 * Middleware setup
 */
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", "*"], // Allow SSE connections from any origin
    }
  }
}));

app.use(cors({
  origin: true, // Allow all origins for development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Cache-Control']
}));

// Request parsing
app.use(express.json({ limit: '10mb' })); // Increase limit for large Lua scripts
app.use(express.urlencoded({ extended: true }));

/**
 * Request logging middleware
 */
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const originalSend = res.send;
  
  res.send = function(body) {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    return originalSend.call(this, body);
  };
  
  next();
});

/**
 * Health check endpoint
 */
app.get('/health', (req: Request, res: Response) => {
  try {
    const healthStatus = bridgeService.getHealthStatus();
    const statusCode = healthStatus.status === 'ok' ? 200 : 503;
    
    const response: APIResponse<HealthCheckResponse> = {
      success: true,
      result: healthStatus
    };
    
    res.status(statusCode).json(response);
  } catch (error: any) {
    logger.error('Health check error:', error);
    const response: APIResponse = {
      success: false,
      error: {
        code: 'HEALTH_CHECK_ERROR',
        message: 'Health check failed',
        details: error.message
      }
    };
    res.status(500).json(response);
  }
});

/**
 * Service statistics endpoint (for debugging/monitoring)
 */
app.get('/stats', (req: Request, res: Response) => {
  try {
    const stats = bridgeService.getServiceStats();
    const sseStats = getSSEStats();
    
    const response: APIResponse = {
      success: true,
      result: {
        ...stats,
        sse: sseStats
      }
    };
    
    res.status(200).json(response);
  } catch (error: any) {
    logger.error('Stats endpoint error:', error);
    const response: APIResponse = {
      success: false,
      error: {
        code: 'STATS_ERROR',
        message: 'Failed to get service statistics',
        details: error.message
      }
    };
    res.status(500).json(response);
  }
});

/**
 * Service control endpoints (for debugging)
 */
app.post('/admin/reconnect', async (req: Request, res: Response) => {
  try {
    await bridgeService.reconnectDLL();
    const response: APIResponse = {
      success: true,
      result: { message: 'DLL reconnection successful' }
    };
    res.status(200).json(response);
  } catch (error: any) {
    logger.error('Reconnect endpoint error:', error);
    const response: APIResponse = {
      success: false,
      error: {
        code: 'RECONNECT_ERROR',
        message: 'Failed to reconnect to DLL',
        details: error.message
      }
    };
    res.status(500).json(response);
  }
});

/**
 * Route handlers
 */
app.use('/lua', luaRoutes);
app.use('/external', externalRoutes);
app.use('/events', eventsRoutes);

/**
 * Default route
 */
app.get('/', (req: Request, res: Response) => {
  const response = {
    service: 'Vox Deorum Bridge Service',
    version: process.env.npm_package_version || '1.0.0',
    status: bridgeService.isServiceRunning() ? 'running' : 'stopped',
    endpoints: {
      health: '/health',
      stats: '/stats',
      lua: {
        call: 'POST /lua/call',
        batch: 'POST /lua/batch',
        execute: 'POST /lua/execute',
        functions: 'GET /lua/functions'
      },
      external: {
        register: 'POST /external/register',
        unregister: 'DELETE /external/register/:name',
        functions: 'GET /external/functions'
      },
      events: 'GET /events (Server-Sent Events)',
      admin: {
        reconnect: 'POST /admin/reconnect'
      }
    },
    documentation: 'See README.md and PROTOCOL.md for detailed API documentation'
  };
  
  res.status(200).json(response);
});

/**
 * 404 handler
 */
app.use('*', (req: Request, res: Response) => {
  const response: APIResponse = {
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Endpoint not found: ${req.method} ${req.originalUrl}`,
      details: 'Check the API documentation for available endpoints'
    }
  };
  res.status(404).json(response);
});

/**
 * Global error handler
 */
app.use((error: any, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error:', error);
  
  const response: APIResponse = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
    }
  };
  
  res.status(500).json(response);
});

/**
 * Start the server
 */
async function startServer(): Promise<void> {
  try {
    // Start the bridge service first
    logger.info('Starting Bridge Service...');
    await bridgeService.start();
    
    // Start HTTP server
    const server = app.listen(config.rest.port, config.rest.host, () => {
      logger.info(`Bridge Service HTTP server listening on http://${config.rest.host}:${config.rest.port}`);
      logger.info('Service endpoints:');
      logger.info(`  Health: GET http://${config.rest.host}:${config.rest.port}/health`);
      logger.info(`  Lua API: http://${config.rest.host}:${config.rest.port}/lua/*`);
      logger.info(`  External API: http://${config.rest.host}:${config.rest.port}/external/*`);
      logger.info(`  Events Stream: GET http://${config.rest.host}:${config.rest.port}/events`);
      logger.info('Bridge Service is ready to accept connections');
    });

    // Graceful shutdown handling
    const shutdown = async () => {
      logger.info('Shutting down HTTP server...');
      server.close(async () => {
        try {
          await bridgeService.shutdown();
          logger.info('Server shutdown complete');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown:', error);
          process.exit(1);
        }
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception - shutting down:', error);
      shutdown();
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Promise Rejection:', reason);
      // Don't exit on unhandled promise rejection in production
      if (process.env.NODE_ENV === 'development') {
        shutdown();
      }
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  startServer().catch((error) => {
    logger.error('Failed to start Bridge Service:', error);
    process.exit(1);
  });
}

export { app, startServer };
export default app;