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

// Get __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express app
const app = express();
const PORT = config.webui.port;

// Create loggers using the unified logger utility
// These will automatically stream to SSE when available
const webLogger = createLogger('WebUI', true);       // Web UI logger

// Middleware setup
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from dist-ui directory (production build)
const staticPath = path.join(__dirname, '../../dist-ui');

// Check if dist-ui exists and log the path
if (fs.existsSync(staticPath)) {
  webLogger.info(`Serving static files from: ${staticPath}`);
  const indexPath = path.join(staticPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    webLogger.info('index.html found in dist-ui');
  } else {
    webLogger.warn('index.html not found in dist-ui - run "npm run build" in ui/ directory');
  }
} else {
  webLogger.warn(`Static directory not found: ${staticPath}`);
  webLogger.warn('Run "npm run build" in ui/ directory to create production build');
}

app.use(express.static(staticPath, {
  maxAge: '1d',
  setHeaders: (res, filePath) => {
    // Set proper content types for specific file extensions
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    }
  }
}));

// API routes should come before the catch-all route

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
      webLogger.info('  • Health Check:  GET  /api/health');
      webLogger.info('  • Log Stream:    GET  /api/logs/stream (SSE)');
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