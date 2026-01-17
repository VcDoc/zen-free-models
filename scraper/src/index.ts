import "dotenv/config";
import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import { matchFreeModelsToIdsWithLLM } from "./matchFreeModelsToIds";

interface ZenFreeModelsOutput {
  updatedAt: string;
  source: string;
  modelIds: string[];
  raw?: {
    totalModelsFound: number;
    scrapeTimestamp: number;
    allModels?: Array<{ modelId: string; isFree: boolean }>;
  };
}

const ZEN_API_URL = "https://opencode.ai/zen/v1/models";
const ZEN_DOCS_URL = "https://opencode.ai/docs/zen/";
const OUTPUT_PATH = path.join(__dirname, "../../zen-free-models.json");
const CACHE_DIR = path.join(__dirname, "../../.stagehand-cache");

// Zod schema for extracting free models from pricing table
const PricingTableSchema = z.object({
  freeModels: z.array(
    z.string().describe("The model name exactly as shown in the pricing table (e.g., 'Big Pickle', 'GLM 4.7')")
  ).describe("All model names from the pricing table where both Input and Output columns show 'Free'"),
});

async function fetchModelsFromAPI(): Promise<string[]> {
  console.log(`Fetching models from API: ${ZEN_API_URL}...`);

  const response = await fetch(ZEN_API_URL);
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { data: Array<{ id: string }> };
  const modelIds = data.data.map((m) => m.id);
  console.log(`Found ${modelIds.length} models from API`);
  return modelIds;
}

async function scrapeFreeModelsFromDocs(): Promise<string[]> {
  console.log("Initializing Stagehand to scrape pricing table...");

  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }

  // Note: Stagehand doesn't support serviceTier option for flex pricing.
  // The main LLM cost savings come from matchFreeModelsToIds.ts which uses flex tier.
  const stagehand = new Stagehand({
    env: "BROWSERBASE",
    verbose: 1,
    cacheDir: CACHE_DIR,
    model: {
      modelName: "openai/gpt-5-mini",
      apiKey: process.env.OPENAI_API_KEY,
    },
  });

  await stagehand.init();
  console.log(`Session started. Watch: https://browserbase.com/sessions/${stagehand.browserbaseSessionID}`);

  const page = stagehand.context.pages()[0];

  console.log(`Navigating to ${ZEN_DOCS_URL}...`);
  await page.goto(ZEN_DOCS_URL);
  await page.waitForLoadState("networkidle");

  console.log("Extracting free models from pricing table...");

  const extracted = await stagehand.extract(
    `Look at the Pricing table carefully. For each model row, check the Input price column and the Output price column.

ONLY include a model if BOTH of these conditions are true:
1. The Input column shows exactly "Free" (not a dollar amount like "$0.50" or "$2.00")
2. The Output column shows exactly "Free" (not a dollar amount)

Be very careful - most models have dollar amounts, only a few are actually free.
Return ONLY the model names that have "Free" in BOTH columns.`,
    PricingTableSchema
  );

  console.log("Free model names from pricing table:", extracted.freeModels);

  await stagehand.close();

  return extracted.freeModels;
}

async function main(): Promise<void> {
  try {
    // Step 1: Get all model IDs from the API
    const apiModelIds = await fetchModelsFromAPI();

    // Step 2: Scrape free model names from the docs
    const freeModelNames = await scrapeFreeModelsFromDocs();

    // Step 3: Match free models to their API IDs
    const freeModelIds = await matchFreeModelsToIdsWithLLM(apiModelIds, freeModelNames);

    if (freeModelIds.length === 0) {
      console.error("No free models found!");
      console.error("API model IDs:", apiModelIds);
      console.error("Free model names from scrape:", freeModelNames);
      process.exit(1);
    }

    const sortedFreeIds = freeModelIds.sort().filter((v, i, a) => a.indexOf(v) === i);

    const output: ZenFreeModelsOutput = {
      updatedAt: new Date().toISOString(),
      source: ZEN_DOCS_URL,
      modelIds: sortedFreeIds,
      raw: {
        totalModelsFound: apiModelIds.length,
        scrapeTimestamp: Date.now(),
        allModels: apiModelIds.map(id => ({
          modelId: id,
          isFree: sortedFreeIds.includes(id),
        })),
      },
    };

    console.log(`\nFound ${sortedFreeIds.length} free Zen models:`);
    sortedFreeIds.forEach((id) => console.log(`  - ${id}`));

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
    console.log(`\nWrote output to ${OUTPUT_PATH}`);
  } catch (error) {
    console.error("Error during scraping:", error);
    process.exit(1);
  }
}

main();
