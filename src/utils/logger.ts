/**
 * Simple logger with log levels for zen-free-models scraper.
 */

import { config, type LogLevel } from "./config.js";

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

/**
 * Check if a log level should be output based on current config.
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] <= LOG_LEVEL_PRIORITY[config.logLevel];
}

/**
 * Format timestamp for log output.
 */
function timestamp(): string {
  return new Date().toISOString();
}

/**
 * Logger instance with level-based logging.
 */
export const logger = {
  /**
   * Log an error message (always shown unless silent).
   */
  error(message: string, ...args: unknown[]): void {
    if (shouldLog("error")) {
      console.error(`[${timestamp()}] ERROR:`, message, ...args);
    }
  },

  /**
   * Log a warning message.
   */
  warn(message: string, ...args: unknown[]): void {
    if (shouldLog("warn")) {
      console.warn(`[${timestamp()}] WARN:`, message, ...args);
    }
  },

  /**
   * Log an info message (default level).
   */
  info(message: string, ...args: unknown[]): void {
    if (shouldLog("info")) {
      console.log(`[${timestamp()}] INFO:`, message, ...args);
    }
  },

  /**
   * Log a debug message (verbose).
   */
  debug(message: string, ...args: unknown[]): void {
    if (shouldLog("debug")) {
      console.log(`[${timestamp()}] DEBUG:`, message, ...args);
    }
  },

  /**
   * Log without prefix (for simple output).
   */
  log(message: string, ...args: unknown[]): void {
    if (shouldLog("info")) {
      console.log(message, ...args);
    }
  },
};
