# Codebase Issues

> **Status:** This repository is **not maintained** and **will not be maintained** unless OpenCode Zen changes how this works. Maintenance may resume if Zen stops exposing **only free models by default** when no Zen API key is configured or the Zen provider is not logged in—making a config whitelist relevant again for typical use.

> **Zen behavior:** As of now, if you do not use a Zen API key and are not logged into the Zen provider, OpenCode only surfaces the **free** Zen models. In that situation, syncing `provider.opencode.whitelist` here is largely redundant.

> **OpenCode Go** is a separate provider (subscribe and connect there for Go models). This project does not manage Go.

Generated: 2026-01-17

## Design Decisions (Intentional)

| Item | Location | Rationale |
|------|----------|-----------|
| Zod v4 peer dependency override | [package.json:42-47](package.json#L42-L47) | Stagehand expects Zod v3, override allows v4 |
| `exit 0` on sync.sh failures | [sync.sh](scripts/sync.sh) | Sync failures shouldn't block OpenCode launch |
| Lock directory pattern | [sync.sh:16-24](scripts/sync.sh#L16-L24) | Uses `mkdir` for atomic locking (POSIX-compliant) |
| Service tier "flex" default | [config.ts:84](src/utils/config.ts#L84) | Cost optimization for LLM calls |
| Centralized timeout utilities | [timeout.ts](src/utils/timeout.ts) | All timeout logic in one place |
