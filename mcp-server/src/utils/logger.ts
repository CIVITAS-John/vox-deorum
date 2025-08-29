/**
 * Winston logger configuration for the Bridge Service
 */

import winston from 'winston';
import path from 'path';
import fs from 'fs';

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
 * Get level-specific styling
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

/**
 * Create a child logger with context
 */
export function createLogger(context: string): winston.Logger {
  return logger.child({ context });
}

/**
 * Log a visual separator for better readability
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
 * Log startup information with enhanced formatting
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
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

export default logger;