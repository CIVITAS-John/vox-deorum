/**
 * Web UI Server for Vox Agents
 * Provides REST API and SSE endpoints for telemetry, logs, sessions, and agent chat
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import * as fsPromises from 'fs/promises';
import { createLogger } from '../utils/logger.js';
import { sseManager } from './sse-manager.js';
import config from '../utils/config.js';
import telemetryRoutes from './routes/telemetry.js';
import configRoutes from './routes/config.js';
import { createAgentRoutes } from './routes/agent.js';
import sessionRoutes from './routes/session.js';
import { processManager } from '../infra/process-manager.js';
import type { HealthStatus, ErrorResponse } from '../types/index.js';

// Get __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express app
const app = express();
const PORT = config.webui.port;
const shutdownUrlFile = process.env.VOX_SHUTDOWN_URL_FILE;

// Create loggers using the unified logger utility
// These will automatically stream to SSE when available
const webLogger = createLogger('WebUI', 'webui');    // Web UI logger with source: 'webui'
let activeServer: ReturnType<typeof app.listen> | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let activePort: number | null = null;

function getShutdownHost(host: string): string {
  if (host === '0.0.0.0' || host === '::' || host === '::1' || host === 'localhost') {
    return '127.0.0.1';
  }

  return host;
}

async function writeShutdownUrlFile(port: number, host = '127.0.0.1'): Promise<void> {
  if (!shutdownUrlFile) return;

  const shutdownUrl = `http://${getShutdownHost(host)}:${port}/shutdown`;
  await fsPromises.writeFile(shutdownUrlFile, `${shutdownUrl}\n`, 'utf8');
  webLogger.info(`Wrote shutdown URL to ${shutdownUrlFile}`);
}

export async function shutdownWebServer(): Promise<void> {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  if (!activeServer) {
    return;
  }

  const server = activeServer;
  activeServer = null;
  activePort = null;

  sseManager.closeAll();

  await new Promise<void>((resolve, reject) => {
    server.close((error?: Error) => {
      if (error) {
        reject(error);
        return;
      }

      webLogger.info('Web UI server closed');
      resolve();
    });
    server.closeAllConnections();
  });
}

// Middleware setup
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from dist-ui directory (production build)
const staticPath = path.join(__dirname, '../../dist-ui');

app.use(express.static(staticPath, {
  maxAge: 0,
  etag: false,
  setHeaders: (res, filePath) => {
    // Prevent caching for development
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Set proper content types for specific file extensions
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    }
  }
}));

// API routes should come before the catch-all route

// Mount telemetry routes
app.use('/api/telemetry', telemetryRoutes);

// Mount config routes
app.use('/api/config', configRoutes);

// Mount agent routes
app.use('/api', createAgentRoutes());

// Mount session routes
app.use('/api/session', sessionRoutes);

// Health check endpoint - minimal API foundation
app.get('/api/health', (_req: Request, res: Response<HealthStatus>) => {
  const healthStatus: HealthStatus = {
    timestamp: new Date().toISOString(),
    service: 'vox-agents-webui',
    version: config.versionInfo?.version || '0.0.0',
    uptime: process.uptime(),
    clients: sseManager.getClientCount(),
    port: activePort ?? PORT
  };
  res.json(healthStatus);
});

// SSE endpoint for log streaming
app.get('/api/logs/stream', (_req: Request, res: Response) => {
  webLogger.info('New SSE client connected');
  sseManager.addClient(res);
});

app.post('/shutdown', (_req: Request, res: Response) => {
  webLogger.info('Received HTTP shutdown request');
  res.status(202).json({ success: true, message: 'Shutdown initiated' });
  setImmediate(() => {
    void processManager.shutdown('http-shutdown');
  });
});

// Catch-all route for SPA - must come AFTER all API routes
app.get('*', (_req: Request, res: Response<ErrorResponse>) => {
  const indexPath = path.join(staticPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({
      error: 'UI not built',
      details: 'Run "npm run build" in ui/ directory to build the frontend'
    });
  }
});

/** Try to listen on the given port. Resolves with the port on success, null on EADDRINUSE. */
function tryListen(port: number): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      const address = server.address();
      const actualHost = typeof address === 'object' && address ? address.address : '127.0.0.1';
      const actualPort = typeof address === 'object' && address ? address.port : port;

      activeServer = server;
      activePort = actualPort;
      processManager.register('web-server', async () => {
        await shutdownWebServer();
      });

      webLogger.info(`🌐 Web UI available at: http://localhost:${actualPort}`);
      webLogger.info('Press Ctrl+C to stop the server');
      webLogger.info(`Shutdown endpoint: POST http://${getShutdownHost(actualHost)}:${actualPort}/shutdown`);

      // Start SSE heartbeat to keep connections alive
      heartbeatInterval = sseManager.startHeartbeat();

      void writeShutdownUrlFile(actualPort, actualHost).catch((error) => {
        webLogger.warn(`Failed to write shutdown URL file: ${String(error)}`);
      });

      resolve(actualPort);
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        resolve(null);
      } else {
        reject(err);
      }
    });
  });
}

// Start server function — tries configured port, then falls back to port + 1
export async function startWebServer(): Promise<number | null> {
  const result = await tryListen(PORT);
  if (result !== null) return result;

  const fallback = PORT + 1;
  webLogger.warn(`Port ${PORT} is already in use — trying ${fallback}`);
  const fallbackResult = await tryListen(fallback);
  if (fallbackResult !== null) return fallbackResult;

  webLogger.warn(`Port ${fallback} is also in use — skipping Web UI startup`);
  return null;
}

// Export for integration with vox-agents process
export { app };
