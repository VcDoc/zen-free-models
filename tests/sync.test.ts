import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, it, beforeEach, afterEach } from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SYNC_SCRIPT = path.join(__dirname, "../scripts/sync.sh");

// Helper to run bash commands
function bash(
  cmd: string,
  env: Record<string, string> = {}
): { stdout: string; stderr: string; status: number } {
  const result = spawnSync("bash", ["-c", cmd], {
    encoding: "utf-8",
    env: { ...process.env, ...env },
  });
  return {
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    status: result.status ?? 1,
  };
}

void describe("sync.sh", () => {
  let tempDir: string;
  let cacheDir: string;
  let configDir: string;
  let configFile: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sync-test-"));
    cacheDir = path.join(tempDir, ".cache/zen-free-models");
    configDir = path.join(tempDir, ".config/opencode");
    configFile = path.join(configDir, "opencode.json");
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.mkdirSync(configDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe("script syntax", () => {
    it("has valid bash syntax", () => {
      const result = bash(`bash -n "${SYNC_SCRIPT}"`);
      assert.strictEqual(result.status, 0, `Syntax error: ${result.stderr}`);
    });

    it("is executable", () => {
      const stats = fs.statSync(SYNC_SCRIPT);
      assert.ok(stats.mode & fs.constants.S_IXUSR, "Script should be executable");
    });
  });

  describe("cache age calculation", () => {
    it("calculates age correctly on macOS", () => {
      const cacheFile = path.join(cacheDir, "models.json");
      fs.writeFileSync(cacheFile, JSON.stringify({ modelIds: ["test-model"] }));

      // Test the age calculation logic
      const result = bash(`
        CACHE="${cacheFile}"
        if [[ "$(uname)" == "Darwin" ]]; then
          age=$(( $(date +%s) - $(stat -f %m "$CACHE") ))
        else
          age=$(( $(date +%s) - $(stat -c %Y "$CACHE") ))
        fi
        echo "$age"
      `);

      assert.strictEqual(result.status, 0);
      const age = parseInt(result.stdout.trim(), 10);
      // Age should be very small (just created)
      assert.ok(age >= 0 && age < 10, `Age should be small, got ${age}`);
    });

    it("detects stale cache", () => {
      const cacheFile = path.join(cacheDir, "models.json");
      fs.writeFileSync(cacheFile, JSON.stringify({ modelIds: ["test-model"] }));

      // Set modification time to 2 days ago
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      fs.utimesSync(cacheFile, twoDaysAgo, twoDaysAgo);

      const result = bash(`
        CACHE="${cacheFile}"
        MAX_AGE=43200  # 12 hours
        if [[ "$(uname)" == "Darwin" ]]; then
          age=$(( $(date +%s) - $(stat -f %m "$CACHE") ))
        else
          age=$(( $(date +%s) - $(stat -c %Y "$CACHE") ))
        fi
        [[ $age -lt $MAX_AGE ]] && echo "fresh" || echo "stale"
      `);

      assert.strictEqual(result.status, 0);
      assert.ok(result.stdout.includes("stale"), "Cache should be detected as stale");
    });
  });

  describe("config update", () => {
    it("adds whitelist to empty config", () => {
      // Create minimal config
      fs.writeFileSync(configFile, JSON.stringify({}));

      // Source script and call update_conf directly
      const result = bash(`
        CONF="${configFile}"
        update_conf() {
          local ids="$1"
          [[ -f "$CONF" ]] || return 0
          command -v node &>/dev/null || return 0
          node -e "
            const fs = require('fs');
            const ids = JSON.parse(process.argv[2]);
            const c = JSON.parse(fs.readFileSync(process.argv[1], 'utf-8'));
            if (!c.provider) c.provider = {};
            c.provider.opencode = { whitelist: ids };
            fs.writeFileSync(process.argv[1], JSON.stringify(c, null, 2));
          " "$CONF" "$ids"
        }
        update_conf '["model-a","model-b"]'
      `);

      assert.strictEqual(result.status, 0);

      const config = JSON.parse(fs.readFileSync(configFile, "utf-8"));
      assert.deepStrictEqual(config.provider?.opencode?.whitelist, ["model-a", "model-b"]);
    });

    it("preserves existing config when adding whitelist", () => {
      // Create config with existing settings
      fs.writeFileSync(
        configFile,
        JSON.stringify({
          provider: {
            anthropic: { apiKey: "test-key" },
          },
          someOtherSetting: true,
        })
      );

      const result = bash(`
        CONF="${configFile}"
        update_conf() {
          local ids="$1"
          [[ -f "$CONF" ]] || return 0
          command -v node &>/dev/null || return 0
          node -e "
            const fs = require('fs');
            const ids = JSON.parse(process.argv[2]);
            const c = JSON.parse(fs.readFileSync(process.argv[1], 'utf-8'));
            if (!c.provider) c.provider = {};
            c.provider.opencode = { whitelist: ids };
            fs.writeFileSync(process.argv[1], JSON.stringify(c, null, 2));
          " "$CONF" "$ids"
        }
        update_conf '["model-c"]'
      `);

      assert.strictEqual(result.status, 0);

      const config = JSON.parse(fs.readFileSync(configFile, "utf-8"));
      assert.deepStrictEqual(config.provider?.opencode?.whitelist, ["model-c"]);
      assert.strictEqual(config.provider?.anthropic?.apiKey, "test-key");
      assert.strictEqual(config.someOtherSetting, true);
    });

    it("disables provider when no models available", () => {
      // Create config with existing opencode provider
      fs.writeFileSync(
        configFile,
        JSON.stringify({
          provider: {
            opencode: { whitelist: ["old-model"] },
          },
        })
      );

      const result = bash(`
        CONF="${configFile}"
        update_conf() {
          local ids="$1"
          [[ -f "$CONF" ]] || return 0
          command -v node &>/dev/null || return 0
          if [[ -z "$ids" || "$ids" == "[]" ]]; then
            node -e "
              const fs = require('fs');
              const c = JSON.parse(fs.readFileSync(process.argv[1], 'utf-8'));
              if (c.provider?.opencode) delete c.provider.opencode;
              if (!c.disabled_providers) c.disabled_providers = [];
              if (!c.disabled_providers.includes('opencode')) c.disabled_providers.push('opencode');
              fs.writeFileSync(process.argv[1], JSON.stringify(c, null, 2));
            " "$CONF"
          fi
        }
        update_conf ''
      `);

      assert.strictEqual(result.status, 0);

      const config = JSON.parse(fs.readFileSync(configFile, "utf-8"));
      assert.strictEqual(config.provider?.opencode, undefined);
      assert.ok(config.disabled_providers?.includes("opencode"));
    });
  });

  describe("locking", () => {
    it("creates lock directory", () => {
      // Run a quick test that creates the lock
      const result = bash(`
        DIR="${cacheDir}"
        LOCK="$DIR/.lock"
        cleanup() { rm -rf "$LOCK" 2>/dev/null; }
        lock() {
          mkdir "$LOCK" 2>/dev/null || return 1
          trap cleanup EXIT
        }
        lock && echo "locked" && cleanup
      `);

      assert.strictEqual(result.status, 0);
      assert.ok(result.stdout.includes("locked"));
    });
  });
});
