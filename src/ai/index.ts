import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";

import { config } from "../utils/config.js";
import { logger } from "../utils/logger.js";
import { withTimeout } from "../utils/timeout.js";

/** Schema for extracting free models from pricing table */
export const PricingTableSchema = z.object({
  freeModels: z
    .array(
      z
        .string()
        .describe(
          "The model name exactly as shown in the pricing table (e.g., 'Big Pickle', 'GLM 4.7')"
        )
    )
    .describe(
      "All model names from the pricing table where both Input and Output columns show 'Free'"
    ),
});

const EXTRACTION_PROMPT = `Look at the Pricing table carefully. For each model row, check the Input price column and the Output price column.

ONLY include a model if BOTH of these conditions are true:
1. The Input column shows exactly "Free" (not a dollar amount like "$0.50" or "$2.00")
2. The Output column shows exactly "Free" (not a dollar amount)

Be very careful - most models have dollar amounts, only a few are actually free.
Return ONLY the model names that have "Free" in BOTH columns.`;

function getVerbosity(): 0 | 1 | 2 {
  const env = process.env.STAGEHAND_VERBOSE;
  return env === "0" ? 0 : env === "2" ? 2 : 1;
}

/** Create and initialize a Stagehand instance */
export async function initStagehand(): Promise<Stagehand> {
  const stagehand = new Stagehand({
    env: "BROWSERBASE",
    verbose: getVerbosity(),
    cacheDir: config.cacheDir,
    model: { modelName: config.stagehandModel, apiKey: process.env.OPENAI_API_KEY },
  });

  await withTimeout(stagehand.init(), config.stagehandInitTimeoutMs, "Stagehand initialization");

  const sessionId = stagehand.browserbaseSessionID;
  logger.info(
    sessionId
      ? `Session started. Watch: https://browserbase.com/sessions/${sessionId}`
      : "Session started (no session ID available)"
  );

  return stagehand;
}

/** Close a Stagehand instance with timeout */
export async function closeStagehand(stagehand: Stagehand): Promise<void> {
  try {
    await withTimeout(stagehand.close(), config.stagehandCloseTimeoutMs, "Stagehand close");
  } catch (err) {
    logger.warn("Failed to close Stagehand cleanly:", err);
  }
}

/** Extract free model names from the pricing page */
export async function extractFreeModels(stagehand: Stagehand): Promise<string[]> {
  const pages = stagehand.context.pages();
  const page = pages[0];

  if (!page) {
    throw new Error("No browser page available - Stagehand failed to create a page");
  }

  logger.info(`Navigating to ${config.zenDocsUrl}...`);
  await page.goto(config.zenDocsUrl, {
    waitUntil: "domcontentloaded",
    timeoutMs: config.fetchTimeoutMs,
  });

  logger.info("Extracting free models from pricing table...");

  const extracted = await withTimeout(
    stagehand.extract(EXTRACTION_PROMPT, PricingTableSchema),
    config.stagehandExtractTimeoutMs,
    "Stagehand extraction"
  );

  logger.debug("Free model names from pricing table:", extracted.freeModels);
  return extracted.freeModels;
}
