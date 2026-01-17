import OpenAI from "openai";

/**
 * Known mappings from display names to API IDs.
 *
 * These serve as a fast path before calling the LLM. When the LLM successfully
 * matches a new model, you can optionally add it here to avoid future LLM calls
 * for that model - but it's not required since the LLM will handle new models
 * automatically.
 *
 * Format: { "display name (lowercase)": "api-id" }
 */
const KNOWN_MAPPINGS: Record<string, string> = {
  "big pickle": "big-pickle",
  "grok code fast 1": "grok-code",
  "minimax m2.1": "minimax-m2.1-free",
  "glm 4.7": "glm-4.7-free",
  "gpt 5 nano": "gpt-5-nano",
};

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9.]/g, "");

/**
 * Synchronous matching using normalization and known mappings only.
 * Use this for unit tests that don't need LLM fallback.
 */
export function matchFreeModelsToIds(apiModelIds: string[], freeModelNames: string[]): string[] {
  const apiIdSet = new Set(apiModelIds.map((id) => id.toLowerCase()));
  const freeIds: string[] = [];

  for (const freeName of freeModelNames) {
    const normalizedName = normalize(freeName);

    // First, try the known mapping
    const mappedId = KNOWN_MAPPINGS[freeName.toLowerCase()];
    if (mappedId && apiIdSet.has(mappedId.toLowerCase())) {
      const actualId = apiModelIds.find((id) => id.toLowerCase() === mappedId.toLowerCase());
      if (actualId && !freeIds.includes(actualId)) {
        freeIds.push(actualId);
      }
      continue;
    }

    // Fallback: try to find exact match in API IDs
    for (const apiId of apiModelIds) {
      const normalizedApiId = normalize(apiId);
      if (normalizedApiId === normalizedName) {
        if (!freeIds.includes(apiId)) {
          freeIds.push(apiId);
        }
        break;
      }
    }
  }

  return freeIds;
}

/**
 * Async matching with LLM fallback for unmatched models.
 * Uses OpenAI to intelligently match display names to API IDs.
 */
export async function matchFreeModelsToIdsWithLLM(
  apiModelIds: string[],
  freeModelNames: string[]
): Promise<string[]> {
  const apiIdSet = new Set(apiModelIds.map((id) => id.toLowerCase()));
  const freeIds: string[] = [];
  const unmatchedNames: string[] = [];

  // First pass: use known mappings and normalization
  for (const freeName of freeModelNames) {
    const normalizedName = normalize(freeName);

    // Try known mapping first
    const mappedId = KNOWN_MAPPINGS[freeName.toLowerCase()];
    if (mappedId && apiIdSet.has(mappedId.toLowerCase())) {
      const actualId = apiModelIds.find((id) => id.toLowerCase() === mappedId.toLowerCase());
      if (actualId && !freeIds.includes(actualId)) {
        freeIds.push(actualId);
      }
      continue;
    }

    // Try normalization match
    let matched = false;
    for (const apiId of apiModelIds) {
      const normalizedApiId = normalize(apiId);
      if (normalizedApiId === normalizedName) {
        if (!freeIds.includes(apiId)) {
          freeIds.push(apiId);
        }
        matched = true;
        break;
      }
    }

    if (!matched) {
      unmatchedNames.push(freeName);
    }
  }

  // Second pass: use LLM for unmatched names
  if (unmatchedNames.length > 0) {
    console.log(`Using LLM to match ${unmatchedNames.length} unmatched model names...`);

    const openai = new OpenAI();
    const availableIds = apiModelIds.filter((id) => !freeIds.includes(id));

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `You are a model name matcher. Given display names from a pricing table and a list of API model IDs, match each display name to its corresponding API ID.

Rules:
- Display names are human-readable (e.g., "Big Pickle", "GLM 4.7")
- API IDs are kebab-case (e.g., "big-pickle", "glm-4.7-free")
- Some API IDs have "-free" suffix that isn't in the display name
- Only return matches you're confident about
- Return JSON array of {displayName, apiId} objects`,
        },
        {
          role: "user",
          content: `Match these display names to API IDs:

Display names to match:
${unmatchedNames.map((n) => `- "${n}"`).join("\n")}

Available API IDs:
${availableIds.map((id) => `- "${id}"`).join("\n")}

Return only confident matches as JSON array.`,
        },
      ],
      response_format: { type: "json_object" },
    });

    try {
      const content = response.choices[0]?.message?.content || "{}";
      const parsed = JSON.parse(content) as { matches?: Array<{ displayName: string; apiId: string }> };
      const matches = parsed.matches || [];

      for (const match of matches) {
        if (apiIdSet.has(match.apiId.toLowerCase()) && !freeIds.includes(match.apiId)) {
          const actualId = apiModelIds.find((id) => id.toLowerCase() === match.apiId.toLowerCase());
          if (actualId) {
            freeIds.push(actualId);
            console.log(`  LLM matched: "${match.displayName}" -> "${actualId}"`);
          }
        }
      }
    } catch (error) {
      console.error("Failed to parse LLM response:", error);
    }
  }

  return freeIds;
}
