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
    allExtractedModels?: Array<{ modelId: string; inputCost: string; outputCost: string }>;
  };
}

const ZEN_DOCS_URL = "https://opencode.ai/docs/zen/";
const OUTPUT_PATH = path.join(__dirname, "../../zen-free-models.json");
const CACHE_DIR = path.join(__dirname, "../../.stagehand-cache");

// Zod schema for structured extraction
const PricingTableSchema = z.object({
  models: z.array(
    z.object({
      modelId: z.string().describe("The model identifier/ID (e.g., 'grok-code-fast-1', 'big-pickle')"),
      inputCost: z.string().describe("The input cost - either 'Free' or a price like '$0.50'"),
      outputCost: z.string().describe("The output cost - either 'Free' or a price like '$1.00'"),
    })
  ).describe("All models from the pricing table with their costs"),
});

async function scrapeZenFreeModels(): Promise<ZenFreeModelsOutput> {
  console.log("Initializing Stagehand with caching enabled...");

  // Ensure cache directory exists
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

  console.log("Extracting models from pricing table using structured schema...");

  // Use Zod schema for structured extraction
  const extracted = await stagehand.extract(
    "Extract all models from the pricing table. For each model, get its model ID, input cost, and output cost.",
    PricingTableSchema
  );

  console.log("Extracted models:", JSON.stringify(extracted, null, 2));

  // Filter for free models (both input and output are "Free")
  const freeModels = extracted.models.filter(
    (model) =>
      model.inputCost.toLowerCase() === "free" &&
      model.outputCost.toLowerCase() === "free"
  );

  const freeModelIds = freeModels.map((m) => m.modelId);

  if (freeModelIds.length === 0) {
    console.error("No free models found in extraction!");
    console.error("All extracted models:", extracted.models);
    await stagehand.close();
    process.exit(1);
  }

  const output: ZenFreeModelsOutput = {
    updatedAt: new Date().toISOString(),
    source: ZEN_DOCS_URL,
    modelIds: freeModelIds.sort().filter((v, i, a) => a.indexOf(v) === i), // Sort and dedupe
    raw: {
      totalModelsFound: extracted.models.length,
      scrapeTimestamp: Date.now(),
      allExtractedModels: extracted.models,
    },
  };

  await stagehand.close();

  return output;
}

async function main(): Promise<void> {
  try {
    const output = await scrapeZenFreeModels();

    console.log(`\nFound ${output.modelIds.length} free Zen models:`);
    output.modelIds.forEach((id) => console.log(`  - ${id}`));

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
    console.log(`\nWrote output to ${OUTPUT_PATH}`);
  } catch (error) {
    console.error("Error during scraping:", error);
    process.exit(1);
  }
}

main();
