# OpenCode Zen Free Models Sync

Automatically sync your local OpenCode configuration with only free Zen models.

## Overview

This system has two parts:

1. **Remote scraper** (GitHub Actions): Runs daily to scrape OpenCode Zen docs for free models and publishes `zen-free-models.json`
2. **Local sync** (shell script): Fetches the JSON and updates your OpenCode config to whitelist only free models

## Architecture

```mermaid
flowchart TB
    subgraph GitHub ["GitHub (Daily)"]
        GA[GitHub Actions]
        API[OpenCode API<br/>/zen/v1/models]
        DOCS[OpenCode Docs<br/>Pricing Table]
        JSON[zen-free-models.json]

        GA -->|1. Fetch model IDs| API
        GA -->|2. Scrape free models| DOCS
        GA -->|3. Match & commit| JSON
    end

    subgraph Local ["Local Machine"]
        ZSH[~/.zshrc<br/>opencode wrapper]
        SYNC[sync.sh]
        CACHE[~/.cache/zen-free-models<br/>12-hour TTL]
        CONFIG[~/.config/opencode<br/>opencode.json]
        OC[OpenCode CLI]

        ZSH -->|1. User runs 'opencode'| SYNC
        SYNC -->|2. Check cache age| CACHE
        SYNC -->|3. Fetch if stale| GHAPI
        SYNC -->|4. Update whitelist| CONFIG
        ZSH -->|5. Launch| OC
    end

    GHAPI[GitHub API]
    JSON -.->|serves| GHAPI

    style JSON fill:#1a1a2e,stroke:#4ade80,color:#4ade80
    style CONFIG fill:#1a1a2e,stroke:#60a5fa,color:#60a5fa
    style CACHE fill:#1a1a2e,stroke:#fbbf24,color:#fbbf24
    style GA fill:#1a1a2e,stroke:#a78bfa,color:#a78bfa
    style SYNC fill:#1a1a2e,stroke:#f472b6,color:#f472b6
    style OC fill:#1a1a2e,stroke:#34d399,color:#34d399
```

## Free Models (Current)

- `big-pickle`
- `glm-4.7-free`
- `gpt-5-nano`
- `grok-code`
- `minimax-m2.1-free`

## Requirements

- **macOS, Linux, or WSL**
- **Node.js** (for JSON config updates)
- **curl** (for fetching from GitHub API)
- **Bash or Zsh** (for shell wrapper function)

> **WSL users:** Install dependencies with `sudo apt install nodejs curl` if not already installed.

## Quick Start

### Option A: Clone the repo (recommended for developers)

```bash
# Clone the repo
git clone https://github.com/VcDoc/zen-free-models.git ~/Projects/zen-free-models

# Create symlink to sync script
mkdir -p ~/.local/share/zen-free-models
ln -sf ~/Projects/zen-free-models/scripts/sync.sh ~/.local/share/zen-free-models/sync.sh
```

This way, `git pull` updates your sync script automatically.

### Option B: Download script only

```bash
# Create directory
mkdir -p ~/.local/share/zen-free-models

# Download sync script
curl -o ~/.local/share/zen-free-models/sync.sh \
  https://raw.githubusercontent.com/VcDoc/zen-free-models/main/scripts/sync.sh

# Make executable
chmod +x ~/.local/share/zen-free-models/sync.sh
```

### 2. Add shell function to your shell's rc file

Add to `~/.zshrc` (Zsh) or `~/.bashrc` (Bash):

```bash
# opencode wrapper - syncs zen free models before launching
opencode() {
  ~/.local/share/zen-free-models/sync.sh 2>/dev/null
  command opencode "$@"
}
```

Then reload your shell config:
```bash
source ~/.zshrc   # or source ~/.bashrc
```

### 3. Use normally

```bash
opencode
```

The wrapper will:
1. Check if cache is valid (12-hour TTL)
2. Fetch latest free models from GitHub if needed
3. Update `~/.config/opencode/opencode.json` with whitelist
4. Launch OpenCode

## How It Works

### Remote Scraper (GitHub Actions)

- Runs daily at 03:00 UTC
- Fetches model list from `https://opencode.ai/zen/v1/models` API
- Scrapes pricing table from `https://opencode.ai/docs/zen/` using Stagehand
- Matches free models (both input and output are "Free") to API model IDs
- Commits `zen-free-models.json` if changed

### Local Sync Script

- Uses 12-hour cache to minimize API calls
- Fetches from GitHub API (avoids CDN caching issues)
- Updates `~/.config/opencode/opencode.json`:
  - Sets `provider.opencode.whitelist` with free model IDs
  - Preserves all other config (MCP servers, other providers, etc.)
- If no free models available, disables the opencode provider

## Repository Structure

```
zen-free-models/
├── .github/workflows/
│   └── update-zen-free-models.yml   # Daily scraper workflow
├── scraper/
│   ├── src/
│   │   ├── index.ts                 # Stagehand scraper
│   │   └── index.test.ts            # Output validation tests
│   ├── package.json
│   └── tsconfig.json
├── scripts/
│   └── sync.sh                      # Local sync script (download this)
├── zen-free-models.json             # Generated output (don't edit)
└── README.md
```

## For Developers

### Prerequisites

- Node.js 20+ (use fnm with `.nvmrc`)
- pnpm 10+ (via Corepack)
- Browserbase account (for Stagehand)
- OpenAI API key (for Stagehand's LLM extraction)

### Run Scraper Locally

```bash
# Install dependencies
pnpm install

# Set environment variables
export BROWSERBASE_API_KEY=your_key
export BROWSERBASE_PROJECT_ID=your_project_id
export OPENAI_API_KEY=your_openai_key

# Run scraper
pnpm scrape

# Run tests
pnpm test
```

### GitHub Actions Secrets Required

Add these as **Repository secrets** (Settings → Secrets and variables → Actions → Repository secrets):

| Secret | Description |
|--------|-------------|
| `BROWSERBASE_API_KEY` | Browserbase API key |
| `BROWSERBASE_PROJECT_ID` | Browserbase project ID |
| `OPENAI_API_KEY` | OpenAI API key for Stagehand extraction |

### Trigger Manual Update

1. Go to **Actions** tab on GitHub
2. Select **Update Zen Free Models** workflow
3. Click **Run workflow**

## Troubleshooting

### Models not updating

```bash
# Clear local cache
rm -f ~/.cache/zen-free-models/models.json

# Run opencode again
opencode
```

### Check current config

```bash
cat ~/.config/opencode/opencode.json | jq '.provider.opencode'
```

### Verify models available

```bash
opencode models opencode
```

### GitHub Action fails

- Check Actions tab for error logs
- Verify all secrets are set correctly
- Ensure OpenCode Zen docs page structure hasn't changed
