/**
 * Integration test for LLM-powered model matching.
 * This test actually calls the OpenAI API to verify the LLM matching works.
 *
 * Uses realistic data:
 * - API model IDs from the actual OpenCode Zen API
 * - Free model names as Stagehand would extract from the pricing table
 *
 * Run with: pnpm test:integration
 * Requires: OPENAI_API_KEY environment variable
 */

import "dotenv/config";
import { matchFreeModelsToIdsWithLLM } from "../src/matchFreeModelsToIds";

async function testLLMMatching(): Promise<void> {
  console.log("\n=== LLM Matching Integration Test ===\n");

  if (!process.env.OPENAI_API_KEY) {
    console.error("✗ OPENAI_API_KEY not set, skipping integration test");
    process.exit(1);
  }

  // Actual API model IDs from OpenCode Zen API (as of 2026-01-17)
  const apiModelIds = [
    "internal-opus",
    "claude-opus-4-5",
    "claude-opus-4-1",
    "claude-sonnet-4",
    "claude-sonnet-4-5",
    "claude-3-5-haiku",
    "claude-haiku-4-5",
    "gemini-3-pro",
    "gemini-3-flash",
    "gpt-5.2",
    "gpt-5.2-codex",
    "gpt-5.1",
    "gpt-5",
    "gpt-5.1-codex-max",
    "gpt-5.1-codex",
    "gpt-5-codex",
    "gpt-5.1-codex-mini",
    "gpt-5-nano",
    "qwen3-coder",
    "glm-4.6",
    "kimi-k2",
    "kimi-k2-thinking",
    "minimax-m2.1-free",
    "glm-4.7-free",
    "grok-code",
    "alpha-glm-4.7",
    "alpha-gd4",
    "big-pickle",
  ];

  // Free model names as Stagehand extracts from the pricing table
  // These are display names that show "Free" in both Input and Output columns
  const freeModelNames = [
    "Big Pickle",
    "GLM 4.7",
    "Grok Code Fast 1",
    "MiniMax M2.1",
    "GPT 5 Nano",
  ];

  // Expected matches based on the above data
  const expectedMatches = [
    "big-pickle", // "Big Pickle" -> known mapping
    "glm-4.7-free", // "GLM 4.7" -> known mapping or LLM (has -free suffix)
    "grok-code", // "Grok Code Fast 1" -> known mapping
    "minimax-m2.1-free", // "MiniMax M2.1" -> known mapping (has -free suffix)
    "gpt-5-nano", // "GPT 5 Nano" -> known mapping
  ];

  console.log("API Model IDs:", apiModelIds.length, "models");
  console.log("Free Model Names from pricing table:", freeModelNames);
  console.log("Expected matches:", expectedMatches);
  console.log("");

  try {
    const result = await matchFreeModelsToIdsWithLLM(apiModelIds, freeModelNames);

    console.log("\n=== Results ===");
    console.log("Matched IDs:", result);
    console.log("");

    // Check each expected match
    let allPassed = true;
    for (const expected of expectedMatches) {
      const found = result.includes(expected);
      console.log(`  ${expected}: ${found ? "✓" : "✗"}`);
      if (!found) allPassed = false;
    }

    // Verify no unexpected models were included (models that aren't free)
    const paidModels = apiModelIds.filter(
      (id) => !expectedMatches.includes(id) && !id.includes("free") && id !== "big-pickle" && id !== "grok-code" && id !== "gpt-5-nano"
    );
    const hasUnexpected = result.some((id: string) => paidModels.includes(id));
    console.log(`\nNo paid models included: ${!hasUnexpected ? "✓" : "✗"}`);
    if (hasUnexpected) {
      const unexpected = result.filter((id: string) => paidModels.includes(id));
      console.log("  Unexpected models:", unexpected);
      allPassed = false;
    }

    // Verify count is reasonable
    console.log(`\nTotal matched: ${result.length} (expected: ${expectedMatches.length})`);

    console.log("");

    if (allPassed) {
      console.log("=== All checks passed! ===");
    } else {
      console.log("=== Some checks failed ===");
      console.log("\nNote: If LLM matching failed, check:");
      console.log("  1. The LLM may have returned unexpected matches");
      console.log("  2. The known mappings in matchFreeModelsToIds.ts may need updating");
      process.exit(1);
    }
  } catch (error) {
    console.error("Test failed with error:", error);
    process.exit(1);
  }
}

testLLMMatching();
