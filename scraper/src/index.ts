import "dotenv/config";
import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

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

// Mapping from pricing table display names to actual API model IDs
const FREE_MODEL_NAME_TO_ID: Record<string, string> = {
  "big pickle": "big-pickle",
  "grok code fast 1": "grok-code",
  "minimax m2.1": "minimax-m2.1-free",
  "glm 4.7": "glm-4.7-free",
  "gpt 5 nano": "gpt-5-nano",
};

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

  const stagehand = new Stagehand({
    env: "BROWSERBASE",
    verbose: 1,
    cacheDir: CACHE_DIR,
    model: {
      modelName: "openai/gpt-4o-mini",
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
    "Look at the Pricing table. Find all rows where BOTH the Input column AND the Output column show 'Free'. Return the model names from those rows.",
    PricingTableSchema
  );

  console.log("Free model names from pricing table:", extracted.freeModels);

  await stagehand.close();

  return extracted.freeModels;
}

function matchFreeModelsToIds(apiModelIds: string[], freeModelNames: string[]): string[] {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9.]/g, "");
  const apiIdSet = new Set(apiModelIds.map(id => id.toLowerCase()));
  const freeIds: string[] = [];

  for (const freeName of freeModelNames) {
    const normalizedName = normalize(freeName);

    // First, try the explicit mapping
    const mappedId = FREE_MODEL_NAME_TO_ID[freeName.toLowerCase()];
    if (mappedId && apiIdSet.has(mappedId.toLowerCase())) {
      const actualId = apiModelIds.find(id => id.toLowerCase() === mappedId.toLowerCase());
      if (actualId && !freeIds.includes(actualId)) {
        freeIds.push(actualId);
      }
      continue;
    }

    // Fallback: try to find exact match in API IDs
    for (const apiId of apiModelIds) {
      const normalizedApiId = normalize(apiId);
      if (normalizedApiId === normalizedName) {
        if (!freeIds.includes(apiId)) {
          freeIds.push(apiId);
        }
        break;
      }
    }
  }

  return freeIds;
}

async function main(): Promise<void> {
  try {
    // Step 1: Get all model IDs from the API
    const apiModelIds = await fetchModelsFromAPI();

    // Step 2: Scrape free model names from the docs
    const freeModelNames = await scrapeFreeModelsFromDocs();

    // Step 3: Match free models to their API IDs
    const freeModelIds = matchFreeModelsToIds(apiModelIds, freeModelNames);

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
