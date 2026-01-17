import "dotenv/config";
import * as fs from "node:fs";

import { z } from "zod";

import { closeStagehand, initStagehand, extractFreeModels } from "./ai/index.js";
import { matchModelsWithLLM } from "./matching/index.js";
import { config } from "./utils/config.js";
import { logger } from "./utils/logger.js";
import { fetchWithTimeout } from "./utils/timeout.js";
import type { Output } from "./utils/types.js";

const ApiResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.string().min(1).max(255),
    })
  ),
});

class NonRetryableError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = "NonRetryableError";
  }
}

function isRetryable(status: number): boolean {
  return status >= 500 || status === 429;
}

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
      if (error instanceof NonRetryableError) throw error;

      if (attempt < maxRetries) {
        const delay = config.initialDelayMs * Math.pow(2, attempt - 1);
        logger.warn(
          `${description} failed (attempt ${attempt}/${maxRetries}): ${lastError.message}`
        );
        logger.warn(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(`${description} failed after ${maxRetries} attempts: ${lastError?.message}`);
}

async function fetchModels(): Promise<string[]> {
  logger.info(`Fetching models from API: ${config.zenApiUrl}...`);

  return withRetry(async () => {
    const response = await fetchWithTimeout(config.zenApiUrl);
    if (!response.ok) {
      const message = `API request failed: ${response.status} ${response.statusText}`;
      if (!isRetryable(response.status)) {
        throw new NonRetryableError(message, response.status);
      }
      throw new Error(message);
    }

    const json = await response.json();
    const data = ApiResponseSchema.parse(json);
    const modelIds = data.data.map(m => m.id);
    logger.info(`Found ${modelIds.length} models from API`);
    return modelIds;
  }, "Fetch models from API");
}

async function scrapeFreeModels(): Promise<string[]> {
  logger.info("Initializing Stagehand to scrape pricing table...");

  if (!fs.existsSync(config.cacheDir)) {
    fs.mkdirSync(config.cacheDir, { recursive: true });
  }

  const stagehand = await initStagehand();

  try {
    return await extractFreeModels(stagehand);
  } finally {
    await closeStagehand(stagehand);
  }
}

async function scrape(): Promise<Output> {
  const apiModelIds = await fetchModels();
  const freeModelNames = await scrapeFreeModels();

  if (freeModelNames.length === 0) {
    throw new Error(
      `Scraping returned no free model names from pricing table (source: ${config.zenDocsUrl})`
    );
  }

  const freeModelIds = await matchModelsWithLLM(apiModelIds, freeModelNames);

  if (freeModelIds.length === 0) {
    throw new Error(
      `Failed to match any free model names to API IDs. Names: ${freeModelNames.join(", ")}`
    );
  }

  if (freeModelIds.length < freeModelNames.length) {
    logger.warn(`Matched ${freeModelIds.length} of ${freeModelNames.length} free model names`);
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

async function main(): Promise<void> {
  try {
    const output = await scrape();

    logger.log(`\nFound ${output.modelIds.length} free Zen models:`);
    output.modelIds.forEach(id => logger.log(`  - ${id}`));

    fs.writeFileSync(config.outputPath, JSON.stringify(output, null, 2));
    logger.info(`Wrote output to ${config.outputPath}`);
  } catch (error) {
    logger.error("Error during scraping:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("tsx") ||
  process.argv[1]?.endsWith("ts-node");

if (isMainModule) {
  void main();
}
