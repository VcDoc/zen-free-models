import "dotenv/config";
import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import * as fs from "node:fs";
import { matchModelsWithLLM } from "./matching/index.js";
import type { Output } from "./utils/types.js";
import { config } from "./utils/config.js";
import { logger } from "./utils/logger.js";

// Zod schema for extracting free models from pricing table
const PricingTableSchema = z.object({
  freeModels: z.array(
    z.string().describe("The model name exactly as shown in the pricing table (e.g., 'Big Pickle', 'GLM 4.7')")
  ).describe("All model names from the pricing table where both Input and Output columns show 'Free'"),
});

// Zod schema for API response validation with stricter constraints
const ApiResponseSchema = z.object({
  data: z.array(z.object({
    id: z.string().min(1).max(255).regex(/^[a-z0-9.-]+$/, "Invalid model ID format"),
  })),
});

/**
 * Create a timeout promise that rejects after the specified duration.
 */
function createTimeout(ms: number, operation: string): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`${operation} timed out after ${ms}ms`)), ms)
  );
}

/**
 * Check if an HTTP error is retryable (transient errors).
 */
function isRetryable(status: number): boolean {
  // Retry on server errors (5xx) and rate limits (429)
  return status >= 500 || status === 429;
}

/**
 * Custom error for non-retryable failures.
 */
class NonRetryableError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "NonRetryableError";
  }
}

/**
 * Retry a function with exponential backoff.
 * Skips retries for non-retryable errors (auth, validation).
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  description: string,
  maxRetries = config.maxRetries
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry non-retryable errors
      if (error instanceof NonRetryableError) {
        throw error;
      }

      if (attempt < maxRetries) {
        const delay = config.initialDelayMs * Math.pow(2, attempt - 1);
        logger.warn(`${description} failed (attempt ${attempt}/${maxRetries}): ${lastError.message}`);
        logger.warn(`Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(`${description} failed after ${maxRetries} attempts: ${lastError?.message}`);
}

async function fetchModels(): Promise<string[]> {
  logger.info(`Fetching models from API: ${config.zenApiUrl}...`);

  return withRetry(async () => {
    const response = await fetch(config.zenApiUrl);
    if (!response.ok) {
      const message = `API request failed: ${response.status} ${response.statusText}`;
      // Don't retry client errors (4xx except 429)
      if (!isRetryable(response.status)) {
        throw new NonRetryableError(message, response.status);
      }
      throw new Error(message);
    }

    const json = await response.json();
    const data = ApiResponseSchema.parse(json);
    const modelIds = data.data.map((m) => m.id);
    logger.info(`Found ${modelIds.length} models from API`);
    return modelIds;
  }, "Fetch models from API");
}

async function scrapeFreeModels(): Promise<string[]> {
  logger.info("Initializing Stagehand to scrape pricing table...");

  if (!fs.existsSync(config.cacheDir)) {
    fs.mkdirSync(config.cacheDir, { recursive: true });
  }

  // Note: Stagehand doesn't support serviceTier option for flex pricing.
  // The main LLM cost savings come from matching/index.ts which uses flex tier.
  const verbosityEnv = process.env.STAGEHAND_VERBOSE;
  const verbosity: 0 | 1 | 2 = verbosityEnv === "0" ? 0 : verbosityEnv === "2" ? 2 : 1;
  const stagehand = new Stagehand({
    env: "BROWSERBASE",
    verbose: verbosity,
    cacheDir: config.cacheDir,
    model: {
      modelName: config.stagehandModel,
      apiKey: process.env.OPENAI_API_KEY,
    },
  });

  // Initialize with timeout to prevent hanging
  await Promise.race([
    stagehand.init(),
    createTimeout(config.stagehandInitTimeoutMs, "Stagehand initialization"),
  ]);

  const sessionId = stagehand.browserbaseSessionID;
  if (sessionId) {
    logger.info(`Session started. Watch: https://browserbase.com/sessions/${sessionId}`);
  } else {
    logger.info("Session started (no session ID available)");
  }

  try {
    const pages = stagehand.context.pages();
    const page = pages[0];

    if (!page) {
      throw new Error("No browser page available - Stagehand failed to create a page");
    }

    logger.info(`Navigating to ${config.zenDocsUrl}...`);
    await page.goto(config.zenDocsUrl);
    await page.waitForLoadState("networkidle");

    logger.info("Extracting free models from pricing table...");

    const extracted = await stagehand.extract(
      `Look at the Pricing table carefully. For each model row, check the Input price column and the Output price column.

ONLY include a model if BOTH of these conditions are true:
1. The Input column shows exactly "Free" (not a dollar amount like "$0.50" or "$2.00")
2. The Output column shows exactly "Free" (not a dollar amount)

Be very careful - most models have dollar amounts, only a few are actually free.
Return ONLY the model names that have "Free" in BOTH columns.`,
      PricingTableSchema
    );

    logger.debug("Free model names from pricing table:", extracted.freeModels);

    return extracted.freeModels;
  } finally {
    // Close with timeout to prevent hanging
    try {
      await Promise.race([
        stagehand.close(),
        createTimeout(config.stagehandCloseTimeoutMs, "Stagehand close"),
      ]);
    } catch (closeError) {
      logger.warn("Failed to close Stagehand cleanly:", closeError);
    }
  }
}

/**
 * Custom error class for scraper failures.
 */
export class ScraperError extends Error {
  constructor(message: string, public readonly context?: Record<string, unknown>) {
    super(message);
    this.name = "ScraperError";
  }
}

/**
 * Main scraper function that fetches and matches free models.
 * @throws {ScraperError} If no free models are found or scraping fails.
 */
async function scrape(): Promise<Output> {
  // Step 1: Get all model IDs from the API
  const apiModelIds = await fetchModels();

  // Step 2: Scrape free model names from the docs
  const freeModelNames = await scrapeFreeModels();

  // Validate scraping returned some free models
  if (freeModelNames.length === 0) {
    throw new ScraperError("Scraping returned no free model names from pricing table", {
      apiModelCount: apiModelIds.length,
      source: config.zenDocsUrl,
    });
  }

  // Step 3: Match free models to their API IDs
  const freeModelIds = await matchModelsWithLLM(apiModelIds, freeModelNames);

  if (freeModelIds.length === 0) {
    throw new ScraperError("Failed to match any free model names to API IDs", {
      freeModelNames,
      apiModelCount: apiModelIds.length,
      hint: "Check if model names in pricing table have changed or if KNOWN_MAPPINGS needs updating",
    });
  }

  const sortedFreeIds = [...new Set(freeModelIds)].sort();

  return {
    updatedAt: new Date().toISOString(),
    source: config.zenDocsUrl,
    modelIds: sortedFreeIds,
    raw: {
      totalModelsFound: apiModelIds.length,
      scrapeTimestamp: Date.now(),
      allModels: apiModelIds.map((id: string) => ({
        modelId: id,
        isFree: sortedFreeIds.includes(id),
      })),
    },
  };
}

/**
 * CLI entry point - runs the scraper and writes output to file.
 */
async function main(): Promise<void> {
  try {
    const output = await scrape();

    logger.log(`\nFound ${output.modelIds.length} free Zen models:`);
    output.modelIds.forEach((id) => logger.log(`  - ${id}`));

    fs.writeFileSync(config.outputPath, JSON.stringify(output, null, 2));
    logger.info(`Wrote output to ${config.outputPath}`);
  } catch (error) {
    if (error instanceof ScraperError) {
      logger.error(`Scraper error: ${error.message}`);
      if (error.context) {
        logger.error("Context:", JSON.stringify(error.context, null, 2));
      }
    } else {
      logger.error("Error during scraping:", error);
    }
    process.exit(1);
  }
}

// Only call main() when running as a script, not when imported as a module
main();
