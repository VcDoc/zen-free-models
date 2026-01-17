# Codebase Issues

Generated: 2026-01-17

## Risks / Edge Cases

| Issue | Location | Impact | Status |
|-------|----------|--------|--------|
| ~~API schema rigidity~~ | [index.ts:15](scraper/src/index.ts#L15) | ~~Rejects model IDs with underscores/uppercase~~ | **Fixed** - removed regex restriction |
| ~~No fetch abort timeout~~ | [index.ts:67](scraper/src/index.ts#L67) | ~~Could hang indefinitely~~ | **Fixed** - added `fetchWithTimeout` |
| ~~LLM prompt scaling~~ | [matching/index.ts:222](scraper/src/matching/index.ts#L222) | ~~All API IDs sent to LLM~~ | **Fixed** - added `prefilterCandidates` |
| ~~Timeout semantic confusion~~ | [ai/index.ts:90](scraper/src/ai/index.ts#L90) | ~~Init timeout reused for extract~~ | **Fixed** - separate `stagehandExtractTimeoutMs` |
| ~~sync.sh portability~~ | [sync.sh:61-68](scripts/sync.sh#L61-L68) | ~~`base64 -d` incompatible on some macOS~~ | **Fixed** - tries `--decode`, `-d`, `-D` |

## Design Decisions (Intentional)

| Item | Location | Rationale |
|------|----------|-----------|
| Zod v4 peer dependency override | [package.json:10-15](package.json#L10-L15) | Stagehand expects Zod v3, override allows v4 |
| `exit 0` on sync.sh failures | [sync.sh](scripts/sync.sh) | Sync failures shouldn't block OpenCode launch |
| Lock directory pattern | [sync.sh:16-24](scripts/sync.sh#L16-L24) | Uses `mkdir` for atomic locking (POSIX-compliant) |
| Service tier "flex" default | [config.ts:80](scraper/src/utils/config.ts#L80) | Cost optimization for LLM calls |
| `.stagehand-cache` committed | [update.yml](/.github/workflows/update.yml) | Speeds up CI runs; cache is deterministic |
| Centralized timeout utilities | [timeout.ts](scraper/src/utils/timeout.ts) | All timeout logic in one place |

## Optional Improvements

| Item | Current State | Suggestion |
|------|---------------|------------|
| `raw.allModels` in output | 28 model entries (~2KB) | Remove if file size matters |
| Monorepo structure | pnpm workspaces | Flatten to single package.json |
| Sync script tests | None | Add lightweight integration test |
| GitHub API hygiene | No User-Agent header | Add explicit User-Agent to API requests in sync.sh |

## Summary

- **Errors**: 0
- **Warnings**: 0
- **Risks tracked**: 5 (all fixed)
- **Test count**: 28 (all passing)
