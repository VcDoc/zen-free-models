# Codebase Issues

Generated: 2026-01-17

## ESLint Warnings

None - all warnings have been fixed by refactoring.

## Design Decisions (Intentional)

| Item | Location | Rationale |
|------|----------|-----------|
| Zod v4 peer dependency override | [package.json:10-15](package.json#L10-L15) | Stagehand expects Zod v3, override allows v4 |
| `exit 0` on sync.sh failures | [sync.sh](scripts/sync.sh) | Sync failures shouldn't block OpenCode launch |
| Lock directory pattern | [sync.sh:16-24](scripts/sync.sh#L16-L24) | Uses `mkdir` for atomic locking (POSIX-compliant) |
| Service tier "flex" default | [config.ts:80](scraper/src/utils/config.ts#L80) | Cost optimization for LLM calls |

## Optional Improvements

| Item | Current State | Simpler Alternative |
|------|---------------|---------------------|
| `raw.allModels` in output | 28 model entries (~2KB) | Remove if file size matters |
| Monorepo structure | pnpm workspaces | Flatten to single package.json |

## Summary

- **Errors**: 0
- **Warnings**: 0
- **Test count**: 28 (all passing)
