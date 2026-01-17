import * as fs from "fs";
import * as path from "path";

const OUTPUT_PATH = path.join(__dirname, "../../zen-free-models.json");

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

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function testOutputFileExists(): void {
  console.log("Test: Output file exists...");
  assert(fs.existsSync(OUTPUT_PATH), `Output file should exist at ${OUTPUT_PATH}`);
  console.log("  ✓ Output file exists");
}

function testOutputSchema(): void {
  console.log("Test: Output schema is valid...");

  const content = fs.readFileSync(OUTPUT_PATH, "utf-8");
  const data: ZenFreeModelsOutput = JSON.parse(content);

  assert(typeof data.updatedAt === "string", "updatedAt should be a string");
  assert(data.updatedAt.length > 0, "updatedAt should not be empty");
  assert(!isNaN(Date.parse(data.updatedAt)), "updatedAt should be a valid ISO date");
  console.log("  ✓ updatedAt is valid ISO date");

  assert(typeof data.source === "string", "source should be a string");
  assert(data.source.startsWith("https://"), "source should be an HTTPS URL");
  console.log("  ✓ source is valid URL");

  assert(Array.isArray(data.modelIds), "modelIds should be an array");
  assert(data.modelIds.length > 0, "modelIds should not be empty");
  console.log(`  ✓ modelIds has ${data.modelIds.length} models`);

  for (const id of data.modelIds) {
    assert(typeof id === "string", `modelId ${id} should be a string`);
    assert(id.length > 0, "modelId should not be empty");
    assert(!id.includes(" "), `modelId "${id}" should not contain spaces`);
  }
  console.log("  ✓ All modelIds are valid strings");
}

function testModelIdsAreSorted(): void {
  console.log("Test: Model IDs are sorted...");

  const content = fs.readFileSync(OUTPUT_PATH, "utf-8");
  const data: ZenFreeModelsOutput = JSON.parse(content);

  const sorted = [...data.modelIds].sort();
  assert(
    JSON.stringify(data.modelIds) === JSON.stringify(sorted),
    "modelIds should be sorted alphabetically"
  );
  console.log("  ✓ Model IDs are sorted");
}

function testNoDuplicateModelIds(): void {
  console.log("Test: No duplicate model IDs...");

  const content = fs.readFileSync(OUTPUT_PATH, "utf-8");
  const data: ZenFreeModelsOutput = JSON.parse(content);

  const unique = new Set(data.modelIds);
  assert(
    unique.size === data.modelIds.length,
    `Found ${data.modelIds.length - unique.size} duplicate model IDs`
  );
  console.log("  ✓ No duplicates found");
}

function testRawMetadataIfPresent(): void {
  console.log("Test: Raw metadata is valid (if present)...");

  const content = fs.readFileSync(OUTPUT_PATH, "utf-8");
  const data: ZenFreeModelsOutput = JSON.parse(content);

  if (data.raw) {
    assert(typeof data.raw.totalModelsFound === "number", "raw.totalModelsFound should be a number");
    assert(data.raw.totalModelsFound > 0, "raw.totalModelsFound should be positive");
    console.log(`  ✓ raw.totalModelsFound = ${data.raw.totalModelsFound}`);

    assert(typeof data.raw.scrapeTimestamp === "number", "raw.scrapeTimestamp should be a number");
    assert(data.raw.scrapeTimestamp > 0, "raw.scrapeTimestamp should be positive");
    console.log("  ✓ raw.scrapeTimestamp is valid");

    if (data.raw.allExtractedModels) {
      assert(Array.isArray(data.raw.allExtractedModels), "raw.allExtractedModels should be an array");
      for (const model of data.raw.allExtractedModels) {
        assert(typeof model.modelId === "string", "model.modelId should be a string");
        assert(typeof model.inputCost === "string", "model.inputCost should be a string");
        assert(typeof model.outputCost === "string", "model.outputCost should be a string");
      }
      console.log(`  ✓ raw.allExtractedModels has ${data.raw.allExtractedModels.length} models`);
    }
  } else {
    console.log("  ⊘ No raw metadata present (skipped)");
  }
}

function testFreeModelsHaveFreeCosts(): void {
  console.log("Test: Free models actually have free costs...");

  const content = fs.readFileSync(OUTPUT_PATH, "utf-8");
  const data: ZenFreeModelsOutput = JSON.parse(content);

  if (data.raw?.allExtractedModels) {
    for (const modelId of data.modelIds) {
      const extracted = data.raw.allExtractedModels.find((m) => m.modelId === modelId);
      if (extracted) {
        assert(
          extracted.inputCost.toLowerCase() === "free",
          `Model ${modelId} inputCost should be "Free", got "${extracted.inputCost}"`
        );
        assert(
          extracted.outputCost.toLowerCase() === "free",
          `Model ${modelId} outputCost should be "Free", got "${extracted.outputCost}"`
        );
      }
    }
    console.log("  ✓ All listed models have Free input and output costs");
  } else {
    console.log("  ⊘ No raw.allExtractedModels to verify (skipped)");
  }
}

async function runTests(): Promise<void> {
  console.log("\n=== Running zen-free-models tests ===\n");

  const tests = [
    testOutputFileExists,
    testOutputSchema,
    testModelIdsAreSorted,
    testNoDuplicateModelIds,
    testRawMetadataIfPresent,
    testFreeModelsHaveFreeCosts,
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      test();
      passed++;
    } catch (error) {
      failed++;
      console.error(`  ✗ ${error}`);
    }
    console.log("");
  }

  console.log("=== Test Results ===");
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
