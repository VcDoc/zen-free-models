import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const REPO_OWNER = "VcDoc";
const REPO_NAME = "zen-free-models";
const RAW_URL = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/zen-free-models.json`;
const OPENCODE_CONFIG_PATH = path.join(os.homedir(), ".config/opencode/opencode.json");
const CACHE_PATH = path.join(os.homedir(), ".cache/zen-free-models/models.json");
const CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours

interface ZenFreeModels {
  updatedAt: string;
  source: string;
  modelIds: string[];
  raw?: {
    totalModelsFound?: number;
    scrapeTimestamp?: number;
    extractedModels?: string[];
  };
}

interface CachedData {
  fetchedAt: number;
  data: ZenFreeModels;
}

function ensureDirExists(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readCache(): CachedData | null {
  try {
    if (!fs.existsSync(CACHE_PATH)) {
      return null;
    }
    const content = fs.readFileSync(CACHE_PATH, "utf-8");
    const cached: CachedData = JSON.parse(content);

    // Validate cache structure
    if (!cached.fetchedAt || !cached.data || !cached.data.modelIds) {
      return null;
    }

    return cached;
  } catch {
    return null;
  }
}

function writeCache(data: ZenFreeModels): void {
  ensureDirExists(CACHE_PATH);
  const cached: CachedData = {
    fetchedAt: Date.now(),
    data,
  };
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cached, null, 2));
}

function isCacheValid(cached: CachedData): boolean {
  const age = Date.now() - cached.fetchedAt;
  return age < CACHE_MAX_AGE_MS;
}

async function fetchModels(): Promise<ZenFreeModels> {
  // Check cache first
  const cached = readCache();
  if (cached && isCacheValid(cached)) {
    const ageMinutes = Math.round((Date.now() - cached.fetchedAt) / 60000);
    console.log(`Using cached models (${ageMinutes}m old, ${cached.data.modelIds.length} models)`);
    return cached.data;
  }

  console.log(`Fetching free Zen models from ${RAW_URL}...`);

  try {
    const response = await fetch(RAW_URL);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as ZenFreeModels;

    if (!data.updatedAt || !Array.isArray(data.modelIds)) {
      throw new Error("Invalid JSON schema: missing updatedAt or modelIds");
    }

    if (data.modelIds.length === 0) {
      throw new Error("modelIds is empty - no free models found");
    }

    // Update cache
    writeCache(data);
    console.log(`Fetched ${data.modelIds.length} models (updated: ${data.updatedAt})`);

    return data;
  } catch (error) {
    // If fetch fails but we have stale cache, use it
    if (cached) {
      console.warn(`Fetch failed, using stale cache: ${error}`);
      return cached.data;
    }
    throw error;
  }
}

async function main(): Promise<void> {
  const data = await fetchModels();

  let config: Record<string, unknown>;
  try {
    const content = fs.readFileSync(OPENCODE_CONFIG_PATH, "utf-8");
    config = JSON.parse(content);
    console.log(`Read existing config from ${OPENCODE_CONFIG_PATH}`);
  } catch {
    console.log("No existing config found, creating new one");
    ensureDirExists(OPENCODE_CONFIG_PATH);
    config = { "$schema": "https://opencode.ai/config.json" };
  }

  if (!config.provider) {
    (config as Record<string, unknown>).provider = {};
  }

  const provider = (config as Record<string, unknown>).provider as Record<string, unknown>;

  if (!provider.opencode) {
    provider.opencode = {};
  }

  const opencodeProvider = provider.opencode as Record<string, unknown>;

  opencodeProvider.models = {};
  for (const id of data.modelIds) {
    (opencodeProvider.models as Record<string, unknown>)[id] = {};
  }

  console.log(`Configured ${data.modelIds.length} models in provider.opencode.models:`);
  data.modelIds.forEach(id => console.log(`  - ${id}`));

  const tmpPath = `${OPENCODE_CONFIG_PATH}.tmp.${Date.now()}`;
  fs.writeFileSync(tmpPath, JSON.stringify(config, null, 2));
  fs.renameSync(tmpPath, OPENCODE_CONFIG_PATH);

  console.log(`\n✓ Successfully updated ${OPENCODE_CONFIG_PATH}`);
}

main().catch(e => {
  console.error("Error:", e);
  process.exit(1);
});
