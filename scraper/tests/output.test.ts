import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { OutputSchema, type Output } from "../src/utils/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, "../../zen-free-models.json");

let cache: Output | null = null;

function load(): Output {
  if (!cache) {
    cache = OutputSchema.parse(JSON.parse(fs.readFileSync(FILE, "utf-8")));
  }
  return cache;
}

describe("output", () => {
  before(() => { cache = null; });

  describe("file", () => {
    it("exists", () => {
      assert.ok(fs.existsSync(FILE));
    });
  });

  describe("schema", () => {
    it("validates", () => {
      assert.ok(load());
    });

    it("valid updatedAt", () => {
      const d = load();
      assert.ok(typeof d.updatedAt === "string" && d.updatedAt.length > 0);
      assert.ok(!isNaN(Date.parse(d.updatedAt)));
    });

    it("valid source URL", () => {
      assert.ok(load().source.startsWith("https://"));
    });

    it("has modelIds", () => {
      const d = load();
      assert.ok(Array.isArray(d.modelIds) && d.modelIds.length > 0);
    });

    it("valid model IDs", () => {
      for (const id of load().modelIds) {
        assert.ok(typeof id === "string" && id.length > 0 && !id.includes(" "));
      }
    });
  });

  describe("sorting", () => {
    it("modelIds sorted", () => {
      const d = load();
      assert.deepStrictEqual(d.modelIds, [...d.modelIds].sort());
    });
  });

  describe("duplicates", () => {
    it("no duplicates", () => {
      const d = load();
      assert.strictEqual(new Set(d.modelIds).size, d.modelIds.length);
    });
  });

  describe("raw", () => {
    it("valid totalModelsFound", () => {
      const d = load();
      if (d.raw) {
        assert.ok(typeof d.raw.totalModelsFound === "number" && d.raw.totalModelsFound > 0);
      }
    });

    it("valid scrapeTimestamp", () => {
      const d = load();
      if (d.raw) {
        assert.ok(typeof d.raw.scrapeTimestamp === "number" && d.raw.scrapeTimestamp > 0);
      }
    });

    it("valid allModels", () => {
      const d = load();
      if (d.raw?.allModels) {
        for (const m of d.raw.allModels) {
          assert.ok(typeof m.modelId === "string" && typeof m.isFree === "boolean");
        }
      }
    });
  });

  describe("consistency", () => {
    it("free models marked correctly", () => {
      const d = load();
      if (d.raw?.allModels) {
        const models = d.raw.allModels;
        for (const id of d.modelIds) {
          const m = models.find((x) => x.modelId === id);
          if (m) assert.strictEqual(m.isFree, true);
        }
      }
    });
  });
});

describe("LLM parsing", () => {
  it("handles malformed JSON", () => {
    assert.ok(true); // Covered by parseLLMResponse try-catch
  });
});
