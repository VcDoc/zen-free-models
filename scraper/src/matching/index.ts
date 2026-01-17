import OpenAI from "openai";
import { z } from "zod";
import { config } from "../utils/config.js";
import { logger } from "../utils/logger.js";

/**
 * Custom error for matching failures.
 */
export class MatchError extends Error {
  constructor(
    message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = "MatchError";
  }
}

const NORM_REGEX = /[^a-z0-9.]/g;

/**
 * Known display name → API ID mappings.
 * Format: { "display name (lowercase)": "api-id" }
 */
const MAPPINGS: Record<string, string> = {
  "big pickle": "big-pickle",
  "grok code fast 1": "grok-code",
  "minimax m2.1": "minimax-m2.1-free",
  "glm 4.7": "glm-4.7-free",
  "gpt 5 nano": "gpt-5-nano",
};

const norm = (s: string) => s.toLowerCase().replace(NORM_REGEX, "");

function buildMaps(apiIds: string[]) {
  const lower = new Map<string, string>();
  const normalized = new Map<string, string>();

  for (const id of apiIds) {
    lower.set(id.toLowerCase(), id);
    normalized.set(norm(id), id);
  }

  return { lower, normalized };
}

function matchWithMaps(
  names: string[],
  maps: ReturnType<typeof buildMaps>
): { matched: string[]; unmatched: string[] } {
  const { lower, normalized } = maps;
  const result = new Set<string>();
  const unmatched: string[] = [];

  for (const name of names) {
    const mapped = MAPPINGS[name.toLowerCase()];
    if (mapped) {
      const actual = lower.get(mapped.toLowerCase());
      if (actual) {
        result.add(actual);
        continue;
      }
    }

    const actual = normalized.get(norm(name));
    if (actual) {
      result.add(actual);
    } else {
      unmatched.push(name);
    }
  }

  return { matched: [...result], unmatched };
}

const LLMResponseSchema = z.object({
  matches: z.array(z.object({ displayName: z.string(), apiId: z.string() })),
});

const LLMArraySchema = z.array(
  z.object({ displayName: z.string(), apiId: z.string() })
);

function validate(apiIds: string[], names: string[]): void {
  if (!Array.isArray(apiIds)) {
    throw new MatchError("apiIds must be an array", { received: typeof apiIds });
  }
  if (!Array.isArray(names)) {
    throw new MatchError("names must be an array", { received: typeof names });
  }
  for (const id of apiIds) {
    if (typeof id !== "string" || !id.trim()) {
      throw new MatchError("Invalid apiId: expected non-empty string", { received: id });
    }
  }
  for (const name of names) {
    if (typeof name !== "string" || !name.trim()) {
      throw new MatchError("Invalid name: expected non-empty string", { received: name });
    }
  }
}

/**
 * Match display names to API IDs using mappings and normalization.
 * Synchronous version without LLM fallback.
 */
export function matchModels(apiIds: string[], names: string[]): string[] {
  validate(apiIds, names);
  const maps = buildMaps(apiIds);
  const { matched } = matchWithMaps(names, maps);
  return matched;
}

function parseLLMResponse(content: string): Array<{ displayName: string; apiId: string }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    logger.warn("Failed to parse LLM response:", content.substring(0, 200));
    return [];
  }

  const objResult = LLMResponseSchema.safeParse(parsed);
  if (objResult.success) return objResult.data.matches;

  const arrResult = LLMArraySchema.safeParse(parsed);
  if (arrResult.success) return arrResult.data;

  if (typeof parsed === "object" && parsed !== null) {
    for (const key of Object.keys(parsed as Record<string, unknown>)) {
      const nested = LLMArraySchema.safeParse((parsed as Record<string, unknown>)[key]);
      if (nested.success) return nested.data;
    }
  }

  logger.warn("LLM response format unknown:", content.substring(0, 200));
  return [];
}

function isRetryable(err: unknown): boolean {
  if (err instanceof OpenAI.APIError) {
    return err.status === 429 || (err.status !== undefined && err.status >= 500);
  }
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return msg.includes("network") || msg.includes("timeout") || msg.includes("econnreset");
  }
  return false;
}

async function callLLM(
  client: OpenAI,
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
): Promise<string> {
  let lastErr: Error | undefined;

  for (let i = 1; i <= config.maxRetries; i++) {
    try {
      const res = await client.chat.completions.create({
        model: config.matchingModel,
        service_tier: config.llmServiceTier,
        messages,
        response_format: { type: "json_object" },
      });
      return res.choices[0]?.message?.content || "{}";
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));

      if (!isRetryable(err)) throw err;

      if (i < config.maxRetries) {
        const delay = config.initialDelayMs * Math.pow(2, i - 1);
        logger.warn(`LLM call failed (${i}/${config.maxRetries}): ${lastErr.message}`);
        logger.warn(`Retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw new Error(`LLM failed after ${config.maxRetries} attempts: ${lastErr?.message}`);
}

/**
 * Match display names to API IDs with LLM fallback for unmatched names.
 */
export async function matchModelsWithLLM(apiIds: string[], names: string[]): Promise<string[]> {
  validate(apiIds, names);
  const maps = buildMaps(apiIds);
  const { matched, unmatched } = matchWithMaps(names, maps);
  const result = new Set(matched);

  if (unmatched.length > 0) {
    logger.info(`Using LLM to match ${unmatched.length} names...`);

    if (!process.env.OPENAI_API_KEY) {
      logger.error("OPENAI_API_KEY not set");
      logger.error("Skipped unmatched:", unmatched);
      return matched;
    }

    try {
      const client = new OpenAI();
      const available = apiIds.filter((id) => !result.has(id));

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: "system",
          content: `Match display names to API IDs.
Rules:
- Display names are human-readable (e.g., "Big Pickle")
- API IDs are kebab-case (e.g., "big-pickle", "glm-4.7-free")
- Some have "-free" suffix not in display name
- Return JSON: {"matches": [{"displayName": "...", "apiId": "..."}]}`,
        },
        {
          role: "user",
          content: `Match these:\n${unmatched.map((n) => `- "${n}"`).join("\n")}\n\nAvailable IDs:\n${available.map((id) => `- "${id}"`).join("\n")}`,
        },
      ];

      const content = await callLLM(client, messages);
      const llmMatches = parseLLMResponse(content);

      for (const m of llmMatches) {
        const actual = maps.lower.get(m.apiId.toLowerCase());
        if (actual && !result.has(actual)) {
          result.add(actual);
          logger.info(`  LLM: "${m.displayName}" -> "${actual}"`);
        }
      }

      if (llmMatches.length === 0 && unmatched.length > 0) {
        logger.warn("LLM returned no matches for:", unmatched);
      }
    } catch (err) {
      if (err instanceof OpenAI.APIError) {
        logger.error(`OpenAI error (${err.status}): ${err.message}`);
      } else {
        logger.error("LLM call failed:", err);
      }
      logger.error("Skipped:", unmatched);
    }
  }

  return [...result];
}
