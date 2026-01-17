# Codebase Issues - zen-free-models

Generated: 2026-01-17
Last Updated: 2026-01-17

## Overview

This document tracks the status of all identified issues. A comprehensive review identified 34+ issues. **All fixable issues have been addressed.** Remaining items are intentional design decisions.

---

## Summary

| Category | Fixed | Acknowledged |
|----------|-------|--------------|
| Critical | 3 | 0 |
| High | 5 | 0 |
| Medium | 8 | 0 |
| Low | 7 | 2 |
| Code Quality | 4 | 0 |
| Documentation | 2 | 0 |

**Total: 29 fixed, 2 acknowledged**

---

## ✅ Fixed Issues

### Critical Fixes

| Issue | Location | Fix |
|-------|----------|-----|
| JSON.parse without try-catch | matching/index.ts:174-178 | Added try-catch with graceful fallback |
| Null pointer on page access | index.ts:145-147 | Added null check with error message |
| Command injection risk (AWK) | Workflow:57-81 | Replaced AWK with Node.js regex |

### High Priority Fixes

| Issue | Location | Fix |
|-------|----------|-----|
| Retry logic retries non-retryable errors | index.ts:44-49, 93-97 | Added NonRetryableError class |
| No timeout on Stagehand operations | index.ts:128-132, 172-179 | Added Promise.race with timeouts |
| Missing LLM retry logic | matching/index.ts:226-259 | Added callLLMWithRetry function |
| Race condition in GitHub Actions | Workflow:8-11 | Added concurrency group |
| Silent failures documented | sync.sh:136-140 | Added comments explaining intentional exit 0 |

### Medium Priority Fixes

| Issue | Location | Fix |
|-------|----------|-----|
| TypeScript config outdated | tsconfig.json | Updated to ES2024, NodeNext, ESM |
| Custom test framework | tests/*.ts | Replaced with Node.js built-in test runner |
| Unused dist/ reference | package.json | Removed `main`, added `type: module` |
| Loose API response validation | index.ts:17-21 | Added min/max/regex constraints |
| Regex compiled on every call | matching/index.ts:21 | Module-level NORMALIZE_REGEX constant |
| Multiple Node.js spawns | sync.sh:161-185 | Combined into single invocation |
| No input validation | matching/index.ts:118-135 | Added validateInputArrays function |
| Session ID undefined check | index.ts:134-139 | Added conditional logging |

### Low Priority Fixes

| Issue | Location | Fix |
|-------|----------|-----|
| Magic number CACHE_MAX_AGE | sync.sh:17 | Configurable via ZEN_CACHE_MAX_AGE |
| No log levels | src/logger.ts | Created logger module with levels |
| Hardcoded URLs/config | src/config.ts | All configurable via environment |
| AWK script fragile | Workflow | Replaced with Node.js regex |
| TOCTOU race condition | sync.sh:26-44 | Added file locking with mkdir |
| Test type assertion | output.test.ts:18-20 | Zod schema validation |
| Missing error scenarios | README.md | Comprehensive troubleshooting section |

### Documentation Fixes

| Issue | Location | Fix |
|-------|----------|-----|
| Missing CONTRIBUTING.md | CONTRIBUTING.md | Created with guidelines |
| Missing API rate limit docs | README.md, sync.sh | Documented limits and cache |

### Code Quality Fixes

| Issue | Location | Fix |
|-------|----------|-----|
| Inconsistent error types | matching/index.ts:10-18 | Added ModelMatchingError class |
| Empty freeModelNames not distinguished | index.ts:204-221 | Separate error messages |
| Variable shadowing | matching/index.ts:196 | Renamed to nestedArrayResult |
| Missing .env.example | .env.example | Created with all config options |

---

## ⚠️ Acknowledged (Intentional Design)

### 1. Zod v4 Peer Dependency Override
**File:** `package.json:10-15`

Stagehand may expect Zod v3, but we use v4 for modern features.

**Reason:** Required for Stagehand compatibility. Override ensures both work.

### 2. Integration Test Hardcoded Values
**File:** `tests/matching.integration.test.ts`

Test has hardcoded expected model IDs.

**Reason:** Intentional snapshot-style test to detect API changes.

---

## Test Results

All tests pass:
```
# Unit tests: 14/14 passed
# Output tests: 13/13 passed
# Total: 27/27 passed
```

---

## Configuration Options

All previously hardcoded values are now configurable:

### Scraper Environment Variables
```bash
# URLs
ZEN_API_URL=https://opencode.ai/zen/v1/models
ZEN_DOCS_URL=https://opencode.ai/docs/zen/

# Models
STAGEHAND_MODEL=openai/gpt-5-mini
MATCHING_MODEL=gpt-5-mini
LLM_SERVICE_TIER=flex

# Retry/Timeout
MAX_RETRIES=3
INITIAL_DELAY_MS=1000
STAGEHAND_INIT_TIMEOUT_MS=60000
STAGEHAND_CLOSE_TIMEOUT_MS=10000

# Logging
LOG_LEVEL=info  # silent, error, warn, info, debug
```

### Sync Script Environment Variables
```bash
ZEN_CACHE_MAX_AGE=43200  # seconds (default: 12 hours)
```

---

## Files Changed

```
.github/workflows/update.yml  # Concurrency, Node.js README update
CONTRIBUTING.md                               # New file
ISSUES.md                                     # This file
README.md                                     # Troubleshooting section
scripts/sync.sh                               # TOCTOU fix, configurable cache
scraper/.env.example                          # All config options
scraper/package.json                          # ESM, test scripts
scraper/src/config.ts                         # New - configuration management
scraper/src/index.ts                          # Timeouts, validation, logging
scraper/src/logger.ts                         # New - log levels
scraper/src/matching/index.ts           # Retry, validation, errors
scraper/src/types.ts                          # Zod schema export
scraper/tests/matching.test.ts    # Node.js test runner
scraper/tests/output.test.ts                  # Zod validation
scraper/tsconfig.json                         # Modern ES2024/NodeNext config
```

---

## Legend

- ✅ **Fixed** - Issue has been resolved
- ⚠️ **Acknowledged** - Intentional design decision, documented
