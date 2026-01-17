import OpenAI from "openai";
import { z } from "zod";

import { config } from "../utils/config.js";
import { logger } from "../utils/logger.js";

const NORM_REGEX = /[^a-z0-9.]/g;
const norm = (s: string) => s.toLowerCase().replace(NORM_REGEX, "");

type IdMaps = { lower: Map<string, string>; normalized: Map<string, string> };

function buildMaps(apiIds: string[]): IdMaps {
  const lower = new Map<string, string>();
  const normalized = new Map<string, string>();
  for (const id of apiIds) {
    lower.set(id.toLowerCase(), id);
    normalized.set(norm(id), id);
  }
  return { lower, normalized };
}

function matchWithNormalization(names: string[], maps: IdMaps): string[] {
  const result = new Set<string>();
  for (const name of names) {
    const actual = maps.normalized.get(norm(name)) ?? maps.normalized.get(norm(name) + "free");
    if (actual) result.add(actual);
  }
  return [...result];
}

const LLMResponseSchema = z.object({
  matches: z.array(z.object({ displayName: z.string(), apiId: z.string() })),
});
const LLMArraySchema = z.array(z.object({ displayName: z.string(), apiId: z.string() }));

function validate(apiIds: string[], names: string[]): void {
  if (!Array.isArray(apiIds)) throw new Error("apiIds must be an array");
  if (!Array.isArray(names)) throw new Error("names must be an array");
  for (const id of apiIds) {
    if (typeof id !== "string" || !id.trim())
      throw new Error("Invalid apiId: expected non-empty string");
  }
  for (const name of names) {
    if (typeof name !== "string" || !name.trim())
      throw new Error("Invalid name: expected non-empty string");
  }
}

export function matchModels(apiIds: string[], names: string[]): string[] {
  validate(apiIds, names);
  return matchWithNormalization(names, buildMaps(apiIds));
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
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw new Error(`LLM failed after ${config.maxRetries} attempts: ${lastErr?.message}`);
}

function buildMessages(
  names: string[],
  apiIds: string[]
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  return [
    {
      role: "system",
      content: `You are a model name matcher. Match display names to their corresponding API IDs.
Rules:
- Display names are human-readable (e.g., "Big Pickle", "GLM 4.7")
- API IDs are kebab-case (e.g., "big-pickle", "glm-4.7-free")
- Some API IDs have a "-free" suffix that is NOT in the display name
- Match each display name to exactly one API ID from the available list
- Only return matches you are confident about
Return JSON: {"matches": [{"displayName": "...", "apiId": "..."}]}`,
    },
    {
      role: "user",
      content: `Match these display names to API IDs:\n\nDisplay names:\n${names.map(n => `- "${n}"`).join("\n")}\n\nAvailable API IDs:\n${apiIds.map(id => `- "${id}"`).join("\n")}`,
    },
  ];
}

function processLLMMatches(
  llmMatches: Array<{ displayName: string; apiId: string }>,
  maps: IdMaps
): { result: Set<string>; matchedNames: Set<string> } {
  const result = new Set<string>();
  const matchedNames = new Set<string>();

  for (const m of llmMatches) {
    const actual = maps.lower.get(m.apiId.toLowerCase());
    if (actual) {
      result.add(actual);
      matchedNames.add(m.displayName.toLowerCase());
      logger.info(`  LLM: "${m.displayName}" -> "${actual}"`);
    } else {
      logger.warn(`  LLM returned invalid API ID: "${m.apiId}" for "${m.displayName}"`);
    }
  }

  return { result, matchedNames };
}

export async function matchModelsWithLLM(apiIds: string[], names: string[]): Promise<string[]> {
  validate(apiIds, names);
  if (names.length === 0) return [];

  const maps = buildMaps(apiIds);

  if (!process.env.OPENAI_API_KEY) {
    logger.warn("OPENAI_API_KEY not set - falling back to normalization matching");
    return matchWithNormalization(names, maps);
  }

  logger.info(`Using LLM to match ${names.length} display names to API IDs...`);

  try {
    const content = await callLLM(new OpenAI(), buildMessages(names, apiIds));
    const { result, matchedNames } = processLLMMatches(parseLLMResponse(content), maps);

    const unmatchedNames = names.filter(n => !matchedNames.has(n.toLowerCase()));
    if (unmatchedNames.length > 0) {
      logger.warn(`LLM did not match ${unmatchedNames.length} names:`, unmatchedNames);
      for (const id of matchWithNormalization(unmatchedNames, maps)) {
        if (!result.has(id)) {
          result.add(id);
          logger.info(`  Fallback: matched "${id}" via normalization`);
        }
      }
    }

    if (result.size === 0) {
      logger.warn("LLM returned no valid matches - falling back to normalization");
      return matchWithNormalization(names, maps);
    }

    return [...result];
  } catch (err) {
    if (err instanceof OpenAI.APIError) {
      logger.error(`OpenAI error (${err.status}): ${err.message}`);
    } else {
      logger.error("LLM call failed:", err);
    }
    logger.warn("Falling back to normalization matching due to LLM error");
    return matchWithNormalization(names, maps);
  }
}
