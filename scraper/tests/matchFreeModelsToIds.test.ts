import { matchFreeModelsToIds } from "../src/matchFreeModelsToIds";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertArrayEquals(actual: string[], expected: string[], message: string): void {
  const actualSorted = [...actual].sort();
  const expectedSorted = [...expected].sort();
  assert(
    JSON.stringify(actualSorted) === JSON.stringify(expectedSorted),
    `${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
  );
}

// Test: Empty inputs
function testEmptyInputs(): void {
  console.log("Test: Empty inputs...");

  assertArrayEquals(matchFreeModelsToIds([], []), [], "Both empty");
  assertArrayEquals(matchFreeModelsToIds(["model-1"], []), [], "Empty free names");
  assertArrayEquals(matchFreeModelsToIds([], ["Model 1"]), [], "Empty API IDs");

  console.log("  ✓ Empty inputs handled correctly");
}

// Test: Exact match (normalized)
function testExactMatch(): void {
  console.log("Test: Exact match via normalization...");

  const apiIds = ["gpt-4", "claude-3", "gemini-pro"];
  const freeNames = ["GPT 4", "Claude 3"];

  const result = matchFreeModelsToIds(apiIds, freeNames);

  // "GPT 4" normalizes to "gpt4" which matches "gpt-4" -> "gpt4"
  // "Claude 3" normalizes to "claude3" which matches "claude-3" -> "claude3"
  assertArrayEquals(result, ["gpt-4", "claude-3"], "Should match normalized names");

  console.log("  ✓ Exact match works");
}

// Test: Explicit mapping takes precedence
function testExplicitMapping(): void {
  console.log("Test: Explicit mapping takes precedence...");

  const apiIds = ["big-pickle", "minimax-m2.1-free", "glm-4.7-free"];
  const freeNames = ["Big Pickle", "MiniMax M2.1", "GLM 4.7"];

  const result = matchFreeModelsToIds(apiIds, freeNames);

  // These should use FREE_MODEL_NAME_TO_ID mapping
  assert(result.includes("big-pickle"), "Should map 'Big Pickle' to 'big-pickle'");
  assert(result.includes("minimax-m2.1-free"), "Should map 'MiniMax M2.1' to 'minimax-m2.1-free'");
  assert(result.includes("glm-4.7-free"), "Should map 'GLM 4.7' to 'glm-4.7-free'");

  console.log("  ✓ Explicit mapping works");
}

// Test: Case insensitivity
function testCaseInsensitivity(): void {
  console.log("Test: Case insensitivity...");

  const apiIds = ["Model-A", "MODEL-B", "model-c"];
  const freeNames = ["MODEL A", "model b", "Model C"];

  const result = matchFreeModelsToIds(apiIds, freeNames);

  assert(result.length === 3, `Should find all 3 models, found ${result.length}`);

  console.log("  ✓ Case insensitivity works");
}

// Test: No duplicates in output
function testNoDuplicates(): void {
  console.log("Test: No duplicates in output...");

  const apiIds = ["model-a", "Model-A"];
  const freeNames = ["Model A", "MODEL A", "model a"];

  const result = matchFreeModelsToIds(apiIds, freeNames);

  // Should only include each unique model once
  const unique = new Set(result.map((id) => id.toLowerCase()));
  assert(unique.size === result.length, "Should not have duplicates");

  console.log("  ✓ No duplicates in output");
}

// Test: Unmatched names are ignored
function testUnmatchedNamesIgnored(): void {
  console.log("Test: Unmatched names are ignored...");

  const apiIds = ["model-a", "model-b"];
  const freeNames = ["Model A", "Unknown Model", "Another Missing"];

  const result = matchFreeModelsToIds(apiIds, freeNames);

  assertArrayEquals(result, ["model-a"], "Should only include matched models");

  console.log("  ✓ Unmatched names ignored");
}

// Test: Special characters in names
function testSpecialCharacters(): void {
  console.log("Test: Special characters in names...");

  const apiIds = ["gpt-4.5-turbo", "claude-3.5-sonnet"];
  const freeNames = ["GPT 4.5 Turbo", "Claude 3.5 Sonnet"];

  const result = matchFreeModelsToIds(apiIds, freeNames);

  assertArrayEquals(result, ["gpt-4.5-turbo", "claude-3.5-sonnet"], "Should handle dots and dashes");

  console.log("  ✓ Special characters handled");
}

// Test: API has -free suffix but docs show display name without "Free"
// This tests that explicit mapping handles the suffix mismatch
function testFreeSuffixMismatch(): void {
  console.log("Test: -free suffix mismatch between API and docs...");

  // API returns IDs with -free suffix, but docs show display names without "Free"
  const apiIds = ["newmodel-free", "anothermodel-free", "plainmodel"];
  // Docs show "NewModel" not "NewModel Free" - the -free is only in the API ID
  const freeNames = ["NewModel", "PlainModel"];

  const result = matchFreeModelsToIds(apiIds, freeNames);

  // "NewModel" normalizes to "newmodel" which won't match "newmodel-free" -> "newmodelfree"
  // This demonstrates the limitation: without explicit mapping, -free suffix models won't match
  // Only "PlainModel" -> "plainmodel" matches "plainmodel"
  assert(result.includes("plainmodel"), "Should match plainmodel via normalization");
  assert(!result.includes("newmodel-free"), "Should NOT match newmodel-free without explicit mapping");

  console.log("  ✓ -free suffix mismatch handled (requires explicit mapping)");
}

async function runTests(): Promise<void> {
  console.log("\n=== Running matchFreeModelsToIds unit tests ===\n");

  const tests = [
    testEmptyInputs,
    testExactMatch,
    testExplicitMapping,
    testCaseInsensitivity,
    testNoDuplicates,
    testUnmatchedNamesIgnored,
    testSpecialCharacters,
    testFreeSuffixMismatch,
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
