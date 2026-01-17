# AGENTS.md - Code Style Guidelines

See [README.md](./README.md) for commands, setup, and configuration.

## TypeScript

- **Target**: ES2024, **Module**: NodeNext (ESM), **Strict mode**: Enabled
- Use `node:` prefix for built-ins, `.js` extension for internal imports
- Use `import type` for type-only imports

```typescript
import * as fs from "node:fs";
import { z } from "zod";
import { config } from "./utils/config.js";
import type { Output } from "./utils/types.js";
```

## Formatting

- Semicolons: Always
- Quotes: Double (`"`)
- Print width: 100, Tab width: 2 spaces
- Arrow parens: Avoid when possible

## Naming

| Type | Convention | Example |
|------|------------|---------|
| Constants | UPPER_SNAKE_CASE | `const MAX_RETRIES = 3;` |
| Functions | camelCase | `function fetchModels()` |
| Classes/Types | PascalCase | `type LogLevel = "info"` |
| Unused params | `_` prefix | `(_unused) => {}` |

## Patterns

### Zod Validation
```typescript
const Schema = z.object({ field: z.string().min(1) });
const data = Schema.parse(rawData);
type Data = z.infer<typeof Schema>;
```

### Error Handling
```typescript
// Retry with exponential backoff
const delay = config.initialDelayMs * Math.pow(2, attempt - 1);

// Timeout with Promise.race
await Promise.race([operation(), createTimeout(ms, "operation")]);
```

### Logger
```typescript
import { logger } from "./utils/logger.js";
logger.error("Critical");  // Always shown
logger.warn("Warning");    // warn level+
logger.info("Info");       // Default
logger.debug("Debug");     // Verbose
```

## Testing

```typescript
import assert from "node:assert/strict";
import { describe, it } from "node:test";

void describe("feature", () => {
  it("should work", () => {
    assert.strictEqual(result, expected);
  });
});
```

Run single test: `node --import tsx --test tests/matching.test.ts`

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Main scraper |
| `src/matching/index.ts` | LLM-first model matching |
| `src/utils/types.ts` | Zod schemas & types |
| `src/utils/config.ts` | Configuration |
| `src/utils/logger.ts` | Logging |
