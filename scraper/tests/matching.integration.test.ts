/**
 * Integration test for LLM-powered model matching.
 * Run with: pnpm test:integration
 * Requires: OPENAI_API_KEY
 */

import "dotenv/config";
import { matchModelsWithLLM } from "../src/matching/index.js";

const API_IDS = [
  "internal-opus", "claude-opus-4-5", "claude-opus-4-1", "claude-sonnet-4",
  "claude-sonnet-4-5", "claude-3-5-haiku", "claude-haiku-4-5", "gemini-3-pro",
  "gemini-3-flash", "gpt-5.2", "gpt-5.2-codex", "gpt-5.1", "gpt-5",
  "gpt-5.1-codex-max", "gpt-5.1-codex", "gpt-5-codex", "gpt-5.1-codex-mini",
  "gpt-5-nano", "qwen3-coder", "glm-4.6", "kimi-k2", "kimi-k2-thinking",
  "minimax-m2.1-free", "glm-4.7-free", "grok-code", "alpha-glm-4.7",
  "alpha-gd4", "big-pickle",
];

const FREE_NAMES = ["Big Pickle", "GLM 4.7", "Grok Code Fast 1", "MiniMax M2.1", "GPT 5 Nano"];

const EXPECTED = ["big-pickle", "glm-4.7-free", "grok-code", "minimax-m2.1-free", "gpt-5-nano"];

async function test(): Promise<void> {
  console.log("\n=== LLM Matching Test ===\n");

  if (!process.env.OPENAI_API_KEY) {
    console.error("✗ OPENAI_API_KEY not set");
    process.exit(1);
  }

  console.log(`API IDs: ${API_IDS.length}, Names: ${FREE_NAMES.length}`);

  try {
    const result = await matchModelsWithLLM(API_IDS, FREE_NAMES);

    console.log("\nResults:", result);

    let ok = true;
    for (const exp of EXPECTED) {
      const found = result.includes(exp);
      console.log(`  ${exp}: ${found ? "✓" : "✗"}`);
      if (!found) ok = false;
    }

    const paid = API_IDS.filter(
      (id) => !EXPECTED.includes(id) && !id.includes("free") &&
              id !== "big-pickle" && id !== "grok-code" && id !== "gpt-5-nano"
    );
    const hasExtra = result.some((id) => paid.includes(id));
    console.log(`\nNo paid models: ${!hasExtra ? "✓" : "✗"}`);
    if (hasExtra) {
      console.log("  Extra:", result.filter((id) => paid.includes(id)));
      ok = false;
    }

    console.log(`\nMatched: ${result.length} (expected: ${EXPECTED.length})\n`);
    console.log(ok ? "=== Passed ===" : "=== Failed ===");
    if (!ok) process.exit(1);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

test();
