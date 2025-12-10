/**
 * Web UI Server for Vox Agents
 * Provides REST API and SSE endpoints for telemetry, logs, sessions, and agent chat
 */

import express from 'express';
import cors from 'cors';
import { createLogger } from '../utils/logger.js';
import { sseManager } from './sse-manager.js';
import config from '../utils/config.js';

// Initialize Express app
const app = express();
const PORT = config.webui.port;

// Middleware setup
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create loggers using the unified logger utility
// These will automatically stream to SSE when available
const webLogger = createLogger('WebUI', true);       // Web UI logger

// Health check endpoint - minimal API foundation
app.get('/api/health', (req, res) => {
  webLogger.info('Health check requested');
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'vox-agents-webui',
    version: config.versionInfo?.version || '0.0.0',
    uptime: process.uptime(),
    clients: sseManager.getClientCount(),
    port: PORT
  });
});

// SSE endpoint for log streaming
app.get('/api/logs/stream', (req, res) => {
  webLogger.info('New SSE client connected');
  sseManager.addClient(res);
});

// Start server function
export async function startWebServer(): Promise<void> {
  return new Promise((resolve) => {
    const server = app.listen(PORT, () => {
      webLogger.info(`Web UI server started on port ${PORT}`);

      // Start SSE heartbeat to keep connections alive
      const heartbeatInterval = sseManager.startHeartbeat();

      // Cleanup on shutdown
      process.on('SIGINT', () => {
        webLogger.info('Shutting down web server');
        clearInterval(heartbeatInterval);
        server.close();
        process.exit(0);
      });

      resolve();
    });
  });
}

// Export for integration with vox-agents process
export { app };