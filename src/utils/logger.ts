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
      console.error(`[${timestamp()}] ERROR:`, message, ...this.formatArgs(args));
    }
  },

  /**
   * Log a warning message.
   */
  warn(message: string, ...args: unknown[]): void {
    if (shouldLog("warn")) {
      console.warn(`[${timestamp()}] WARN:`, message, ...this.formatArgs(args));
    }
  },

  /**
   * Log an info message (default level).
   */
  info(message: string, ...args: unknown[]): void {
    if (shouldLog("info")) {
      console.log(`[${timestamp()}] INFO:`, message, ...this.formatArgs(args));
    }
  },

  /**
   * Log a debug message (verbose).
   */
  debug(message: string, ...args: unknown[]): void {
    if (shouldLog("debug")) {
      console.log(`[${timestamp()}] DEBUG:`, message, ...this.formatArgs(args));
    }
  },

  /**
   * Log without prefix (for simple output).
   */
  log(message: string, ...args: unknown[]): void {
    if (shouldLog("info")) {
      console.log(message, ...this.formatArgs(args));
    }
  },

  /**
   * Helper to format arguments for logging.
   */
  formatArgs(args: unknown[]): unknown[] {
    return args.map(arg => {
      if (arg instanceof Error) {
        return arg.stack || arg.message;
      }
      if (typeof arg === "object" && arg !== null) {
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return arg;
        }
      }
      return arg;
    });
  },
};
