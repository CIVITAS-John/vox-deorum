/**
 * @module utils/logger
 *
 * Winston logger configuration for Vox Agents.
 * Provides structured logging with color-coded console output for development
 * and JSON output for production. Includes file-based logging for errors and all logs.
 */

import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { sseManager } from '../web/sse-manager.js';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Color codes for different log levels
 */
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  bgRed: '\x1b[41m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgGreen: '\x1b[42m'
};

/**
 * Get level-specific styling for log messages.
 *
 * @param level - The log level (ERROR, WARN, INFO, DEBUG)
 * @returns Object containing color, background, and icon for the level
 */
const getLevelStyle = (level: string) => {
  const upperLevel = level.toUpperCase();
  switch (upperLevel) {
    case 'ERROR':
      return {
        color: colors.red,
        bg: colors.bgRed,
        icon: '❌',
      };
    case 'WARN':
      return {
        color: colors.yellow,
        bg: colors.bgYellow,
        icon: '⚠️ ',
      };
    case 'INFO':
      return {
        color: colors.blue,
        bg: colors.bgBlue,
        icon: 'ℹ️ ',
      };
    case 'DEBUG':
      return {
        color: colors.gray,
        bg: colors.gray,
        icon: '🔍',
      };
    default:
      return {
        color: colors.white,
        bg: colors.white,
        icon: '📝',
      };
  }
};

/**
 * Enhanced custom log format with improved visual formatting and colors
 */
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
  }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
    const style = getLevelStyle(level);
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Simplified format for production
    if (isProduction) {
      const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
      const contextStr = context ? ` [${context}]` : '';
      return `[${timestamp}] ${level.toUpperCase()}:${contextStr} ${message}${metaStr}`;
    }
    
    // Enhanced format for development
    const coloredTimestamp = `${colors.dim}${timestamp}${colors.reset}`;
    const coloredLevel = `${colors.bright}${style.color}${colors.reset}`;
    const contextStr = context ? ` ${colors.cyan}[${context}]${colors.reset}` : '';
    const coloredMessage = `${style.color}${message}${colors.reset}`;
    
    // Format metadata nicely
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      const formattedMeta = JSON.stringify(meta, null, 2)
        .split('\n')
        .map((line, index) => index === 0 ? line : `    ${line}`)
        .join('\n');
      metaStr = `\n  ${colors.gray}${formattedMeta}${colors.reset}`;
    }
    
    return `${coloredTimestamp} ${coloredLevel}${style.icon}${contextStr} ${coloredMessage}${metaStr}`;
  })
);

/**
 * JSON format for production logs
 */
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

/**
 * Create and configure the logger instance
 */
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: process.env.NODE_ENV === 'production' ? jsonFormat : customFormat,
  transports: [
    // Console transport with enhanced formatting
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production' ? jsonFormat : customFormat
    }),
    // File transport for errors
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: jsonFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      level: 'debug',
      format: jsonFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 10
    })
  ],
  exitOnError: false
});

// Hijack the logs and stream to SSE
logger.stream({ start: -1 }).on('log', function(log) {
  sseManager.broadcast("log", log);
});

/**
 * Create a child logger with context and optional web UI streaming.
 * The context is automatically included in all log messages from the returned logger.
 * If webui is true, logs are also streamed to SSE clients.
 *
 * @param context - The context identifier for this logger (e.g., component name)
 * @param webui - If true, creates a web UI logger that streams to SSE clients
 * @returns A Winston logger instance with the context attached
 *
 * @example
 * ```typescript
 * const logger = createLogger('MyComponent'); // Vox agents logger
 * const webLogger = createLogger('WebServer', true); // Web UI logger with SSE streaming
 * logger.info('Component started'); // Logs with [MyComponent] prefix
 * ```
 */
export function createLogger(context: string, webui: boolean = false): winston.Logger {
  return logger.child({ context, webui });
}

/**
 * Log a visual separator for better readability.
 * Useful for clearly dividing sections in log output.
 *
 * @param title - Optional title to display in the separator
 * @param level - Log level to use (default: 'info')
 *
 * @example
 * ```typescript
 * logSeparator('Startup Phase');
 * // Logs: ─────── Startup Phase ───────
 * ```
 */
export function logSeparator(title?: string, level: 'info' | 'debug' = 'info'): void {
  const separator = '─'.repeat(60);
  if (title) {
    const paddedTitle = ` ${title} `;
    const totalLength = 60;
    const sideLength = Math.max(0, Math.floor((totalLength - paddedTitle.length) / 2));
    const leftSide = '─'.repeat(sideLength);
    const rightSide = '─'.repeat(totalLength - sideLength - paddedTitle.length);
    logger[level](`${leftSide}${paddedTitle}${rightSide}`);
  } else {
    logger[level](separator);
  }
}

/**
 * Log startup information with enhanced formatting.
 * Displays service name, version, environment, and optional port information.
 *
 * @param serviceName - Name of the service being started
 * @param version - Version string of the service
 * @param port - Optional port number the service will listen on
 *
 * @example
 * ```typescript
 * logStartup('Vox Agents', '1.0.0', 3000);
 * ```
 */
export function logStartup(serviceName: string, version: string, port?: number): void {
  logSeparator(`${serviceName} v${version}`, 'info');
  logger.info('🚀 Service starting up...');
  if (port) {
    logger.info(`🌐 Server will listen on port ${port}`);
  }
  logger.info(`📊 Log level: ${logger.level}`);
  logger.info(`🏗️  Environment: ${process.env.NODE_ENV || 'development'}`);
  logSeparator();
}

// Log unhandled errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at: ' + promise?.toString() + ', reason:', reason);
});

export default logger;