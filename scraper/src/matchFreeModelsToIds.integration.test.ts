/**
 * Integration test for LLM-powered model matching.
 * This test actually calls the OpenAI API to verify the LLM matching works.
 *
 * Run with: pnpm tsx src/matchFreeModelsToIds.integration.test.ts
 * Requires: OPENAI_API_KEY environment variable
 */

import "dotenv/config";
import { matchFreeModelsToIdsWithLLM } from "./matchFreeModelsToIds";

async function testLLMMatching(): Promise<void> {
  console.log("\n=== LLM Matching Integration Test ===\n");

  if (!process.env.OPENAI_API_KEY) {
    console.error("✗ OPENAI_API_KEY not set, skipping integration test");
    process.exit(1);
  }

  // Simulate a scenario where we have:
  // 1. Some models that match via known mappings (should NOT call LLM)
  // 2. Some models that match via normalization (should NOT call LLM)
  // 3. Some models that require LLM matching (SHOULD call LLM)
  const apiModelIds = [
    "big-pickle", // Known mapping: "Big Pickle"
    "gpt-5-nano", // Known mapping: "GPT 5 Nano"
    "claude-3", // Normalization match: "Claude 3"
    "new-experimental-model-free", // Requires LLM: "New Experimental Model"
    "mystery-ai-2.0-free", // Requires LLM: "Mystery AI 2.0"
    "unrelated-model",
  ];

  const freeModelNames = [
    "Big Pickle", // Should match via known mapping
    "GPT 5 Nano", // Should match via known mapping
    "Claude 3", // Should match via normalization
    "New Experimental Model", // Should match via LLM (has -free suffix in API)
    "Mystery AI 2.0", // Should match via LLM (has -free suffix in API)
  ];

  console.log("API Model IDs:", apiModelIds);
  console.log("Free Model Names:", freeModelNames);
  console.log("");

  try {
    const result = await matchFreeModelsToIdsWithLLM(apiModelIds, freeModelNames);

    console.log("\n=== Results ===");
    console.log("Matched IDs:", result);
    console.log("");

    // Verify known mappings worked
    const hasKnownMappings = result.includes("big-pickle") && result.includes("gpt-5-nano");
    console.log(`Known mappings: ${hasKnownMappings ? "✓" : "✗"}`);

    // Verify normalization worked
    const hasNormalization = result.includes("claude-3");
    console.log(`Normalization: ${hasNormalization ? "✓" : "✗"}`);

    // Verify LLM matched the -free suffix models
    const hasLLMMatches =
      result.includes("new-experimental-model-free") && result.includes("mystery-ai-2.0-free");
    console.log(`LLM matching: ${hasLLMMatches ? "✓" : "✗"}`);

    // Verify unrelated model was NOT included
    const excludedUnrelated = !result.includes("unrelated-model");
    console.log(`Excluded unrelated: ${excludedUnrelated ? "✓" : "✗"}`);

    console.log("");

    if (hasKnownMappings && hasNormalization && hasLLMMatches && excludedUnrelated) {
      console.log("=== All checks passed! ===");
    } else {
      console.log("=== Some checks failed ===");
      if (!hasLLMMatches) {
        console.log(
          "Note: LLM matching may have failed. Check if the model was able to match the display names."
        );
      }
      process.exit(1);
    }
  } catch (error) {
    console.error("Test failed with error:", error);
    process.exit(1);
  }
}

testLLMMatching();
