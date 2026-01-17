import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { matchModels } from "../src/matching/index.js";

function assertArrayEq(actual: string[], expected: string[], msg: string): void {
  assert.deepStrictEqual([...actual].sort(), [...expected].sort(), msg);
}

describe("matchModels", () => {
  describe("empty inputs", () => {
    it("both empty", () => {
      assertArrayEq(matchModels([], []), [], "Both empty");
    });

    it("empty names", () => {
      assertArrayEq(matchModels(["model-1"], []), [], "Empty names");
    });

    it("empty IDs", () => {
      assertArrayEq(matchModels([], ["Model 1"]), [], "Empty IDs");
    });
  });

  describe("normalization", () => {
    it("matches normalized names", () => {
      const ids = ["gpt-4", "claude-3", "gemini-pro"];
      const names = ["GPT 4", "Claude 3"];
      assertArrayEq(matchModels(ids, names), ["gpt-4", "claude-3"], "Normalized");
    });
  });

  describe("mappings", () => {
    it("uses known mappings", () => {
      const ids = ["big-pickle", "minimax-m2.1-free", "glm-4.7-free"];
      const names = ["Big Pickle", "MiniMax M2.1", "GLM 4.7"];
      const result = matchModels(ids, names);
      assert.ok(result.includes("big-pickle"));
      assert.ok(result.includes("minimax-m2.1-free"));
      assert.ok(result.includes("glm-4.7-free"));
    });
  });

  describe("case insensitive", () => {
    it("matches any case", () => {
      const ids = ["Model-A", "MODEL-B", "model-c"];
      const names = ["MODEL A", "model b", "Model C"];
      assert.strictEqual(matchModels(ids, names).length, 3);
    });
  });

  describe("no duplicates", () => {
    it("dedupes results", () => {
      const ids = ["model-a", "Model-A"];
      const names = ["Model A", "MODEL A", "model a"];
      const result = matchModels(ids, names);
      const unique = new Set(result.map((id) => id.toLowerCase()));
      assert.strictEqual(unique.size, result.length);
    });
  });

  describe("unmatched", () => {
    it("ignores unmatched names", () => {
      const ids = ["model-a", "model-b"];
      const names = ["Model A", "Unknown", "Missing"];
      assertArrayEq(matchModels(ids, names), ["model-a"], "Only matched");
    });
  });

  describe("special chars", () => {
    it("handles dots and dashes", () => {
      const ids = ["gpt-4.5-turbo", "claude-3.5-sonnet"];
      const names = ["GPT 4.5 Turbo", "Claude 3.5 Sonnet"];
      assertArrayEq(matchModels(ids, names), ids, "Dots and dashes");
    });
  });

  describe("-free suffix", () => {
    it("needs mapping for -free suffix", () => {
      const ids = ["newmodel-free", "plainmodel"];
      const names = ["NewModel", "PlainModel"];
      const result = matchModels(ids, names);
      assert.ok(result.includes("plainmodel"));
      assert.ok(!result.includes("newmodel-free"));
    });
  });

  describe("validation", () => {
    it("throws on non-array apiIds", () => {
      assert.throws(
        () => matchModels("bad" as unknown as string[], []),
        /apiIds must be an array/
      );
    });

    it("throws on non-array names", () => {
      assert.throws(
        () => matchModels([], "bad" as unknown as string[]),
        /names must be an array/
      );
    });

    it("throws on empty apiId", () => {
      assert.throws(
        () => matchModels(["valid", ""], ["Model"]),
        /Invalid apiId/
      );
    });

    it("throws on empty name", () => {
      assert.throws(
        () => matchModels(["model"], ["Valid", ""]),
        /Invalid name/
      );
    });
  });
});
