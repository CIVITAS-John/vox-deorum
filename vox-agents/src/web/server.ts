/**
 * Web UI Server for Vox Agents
 * Provides REST API and SSE endpoints for telemetry, logs, sessions, and agent chat
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { createLogger } from '../utils/logger.js';
import { sseManager } from './sse-manager.js';
import config from '../utils/config.js';
import telemetryRoutes from './routes/telemetry.js';
import configRoutes from './routes/config.js';

// Get __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express app
const app = express();
const PORT = config.webui.port;

// Create loggers using the unified logger utility
// These will automatically stream to SSE when available
const webLogger = createLogger('WebUI', 'webui');    // Web UI logger with source: 'webui'

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

// Health check endpoint - minimal API foundation
app.get('/api/health', (req, res) => {
  res.json({
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

// Catch-all route for SPA - must come AFTER all API routes
app.get('*', (_req, res) => {
  const indexPath = path.join(staticPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({
      error: 'UI not built',
      message: 'Run "npm run build" in ui/ directory to build the frontend'
    });
  }
});

// Start server function
export async function startWebServer(): Promise<void> {
  return new Promise((resolve) => {
    const server = app.listen(PORT, () => {
      webLogger.info(`🌐 Web UI available at: http://localhost:${config.webui.port}`);
      webLogger.info('Available endpoints:');
      webLogger.info('  • Health Check:            GET  /api/health');
      webLogger.info('  • Log Stream:              GET  /api/logs/stream (SSE)');
      webLogger.info('  • Active Sessions:         GET  /api/telemetry/sessions/active');
      webLogger.info('  • Database List:           GET  /api/telemetry/databases');
      webLogger.info('  • Upload Database:         POST /api/telemetry/upload');
      webLogger.info('  • Session Spans:           GET  /api/telemetry/sessions/:id/spans');
      webLogger.info('  • Session Stream:          GET  /api/telemetry/sessions/:id/stream (SSE)');
      webLogger.info('  • Database Traces:         GET  /api/telemetry/db/:filename/traces');
      webLogger.info('  • Trace Spans:             GET  /api/telemetry/db/:filename/trace/:traceId/spans');
      webLogger.info('  • Get Configuration:       GET  /api/config');
      webLogger.info('  • Update Configuration:    POST /api/config');
      webLogger.info('Press Ctrl+C to stop the server');

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