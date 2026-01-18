/**
 * Configuration module for zen-free-models scraper.
 *
 * All configuration can be overridden via environment variables.
 */

import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Log levels for the scraper.
 */
export type LogLevel = "silent" | "error" | "warn" | "info" | "debug";

/**
 * Configuration interface.
 */
export interface Config {
  /** Zen API URL for fetching model IDs */
  zenApiUrl: string;
  /** Zen documentation URL for scraping pricing table */
  zenDocsUrl: string;
  /** Output file path for zen-free-models.json */
  outputPath: string;
  /** Cache directory for Stagehand */
  cacheDir: string;
  /** LLM model to use for Stagehand extraction */
  stagehandModel: string;
  /** LLM model to use for model matching */
  matchingModel: string;
  /** LLM service tier */
  llmServiceTier: "default" | "flex" | "auto" | "scale" | "priority";
  /** Maximum retry attempts for API calls */
  maxRetries: number;
  /** Initial delay in ms for retry backoff */
  initialDelayMs: number;
  /** Timeout for Stagehand initialization in ms */
  stagehandInitTimeoutMs: number;
  /** Timeout for Stagehand extraction in ms */
  stagehandExtractTimeoutMs: number;
  /** Timeout for Stagehand close in ms */
  stagehandCloseTimeoutMs: number;
  /** Timeout for fetch requests in ms */
  fetchTimeoutMs: number;
  /** Current log level */
  logLevel: LogLevel;
}

/**
 * Parse log level from string.
 */
function parseLogLevel(value: string | undefined): LogLevel {
  const levels: LogLevel[] = ["silent", "error", "warn", "info", "debug"];
  if (value && levels.includes(value as LogLevel)) {
    return value as LogLevel;
  }
  return "info"; // default
}

/**
 * Parse integer with default value.
 */
function parseIntOrDefault(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Valid LLM service tiers.
 */
type LLMServiceTier = "default" | "flex" | "auto" | "scale" | "priority";

/**
 * Parse LLM service tier from string.
 */
function parseLLMServiceTier(value: string | undefined): LLMServiceTier {
  const validTiers: LLMServiceTier[] = ["default", "flex", "auto", "scale", "priority"];
  if (value && validTiers.includes(value as LLMServiceTier)) {
    return value as LLMServiceTier;
  }
  return "flex"; // default to flex for cost savings
}

/**
 * Load configuration from environment variables with defaults.
 */
export function loadConfig(): Config {
  return {
    zenApiUrl: process.env.ZEN_API_URL ?? "https://opencode.ai/zen/v1/models",
    zenDocsUrl: process.env.ZEN_DOCS_URL ?? "https://opencode.ai/docs/zen/",
    outputPath: process.env.OUTPUT_PATH ?? path.join(__dirname, "../../zen-free-models.json"),
    cacheDir: process.env.STAGEHAND_CACHE_DIR ?? path.join(__dirname, "../../.stagehand-cache"),
    stagehandModel: process.env.STAGEHAND_MODEL ?? "openai/gpt-5-mini",
    matchingModel: process.env.MATCHING_MODEL ?? "gpt-5-mini",
    llmServiceTier: parseLLMServiceTier(process.env.LLM_SERVICE_TIER),
    maxRetries: parseIntOrDefault(process.env.MAX_RETRIES, 3),
    initialDelayMs: parseIntOrDefault(process.env.INITIAL_DELAY_MS, 1000),
    stagehandInitTimeoutMs: parseIntOrDefault(process.env.STAGEHAND_INIT_TIMEOUT_MS, 60000),
    stagehandExtractTimeoutMs: parseIntOrDefault(process.env.STAGEHAND_EXTRACT_TIMEOUT_MS, 60000),
    stagehandCloseTimeoutMs: parseIntOrDefault(process.env.STAGEHAND_CLOSE_TIMEOUT_MS, 10000),
    fetchTimeoutMs: parseIntOrDefault(process.env.FETCH_TIMEOUT_MS, 30000),
    logLevel: parseLogLevel(process.env.LOG_LEVEL),
  };
}

/**
 * Global configuration instance.
 */
export const config = loadConfig();
