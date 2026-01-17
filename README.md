# OpenCode Zen Free Models Sync

Automatically sync your local OpenCode configuration with only free Zen models.

## Overview

This system has two parts:

1. **Remote scraper** (GitHub Action): Runs daily to scrape OpenCode Zen docs for free models and publishes a JSON file
2. **Local sync**: Fetches the JSON and patches your `~/.config/opencode/opencode.json` to use only free models

## Free Models (Current)

Currently free Zen models:
- `big-pickle`
- `grok-code-fast-1`
- `minimax-m2.1`
- `glm-4.7`

## Setup

### 1. Create the GitHub Repository

```bash
# Initialize git repo
git init

# Add all files
git add .
git commit -m "Initial commit"

# Create repo on GitHub, then add remote (replace with your username)
git remote add origin https://github.com/VcDoc/zen-free-models.git

# Push to main branch
git push -u origin main
```

### 2. Enable GitHub Actions

1. Go to your repo on GitHub: `https://github.com/VcDoc/zen-free-models`
2. Click the **Actions** tab
3. Click **I understand my workflows, go ahead and enable them** if prompted

### 3. Add BROWSERBASE_API_KEY Secret

1. Go to `https://browserbase.com/` and sign up/login
2. Get your API key from: `https://browserbase.com/settings/api-keys`
3. Add to GitHub repo secrets:
   - Go to **Settings** > **Secrets and variables** > **Actions**
   - Click **New repository secret**
   - Name: `BROWSERBASE_API_KEY`
   - Value: Your Browserbase API key
   - Click **Add secret**

### 4. Prerequisites

This project uses:
- **pnpm** for package management (automatically enforced via `packageManager` field)
- **fnm** (Fast Node Manager) for Node version management
- **TypeScript** for type safety
- **Stagehand v3** for web scraping

The project includes:
- `.nvmrc` file that tells fnm to automatically use Node 20
- `packageManager: "pnpm@10.0.0"` in package.json that uses Node's built-in Corepack

```bash
# Install fnm (Fast Node Manager)
curl -fsSL https://fnm.vercel.app/install | bash

# Reload shell or run:
source ~/.zshrc  # or ~/.bashrc

# Install Node 20 (will auto-switch when entering this directory)
fnm install 20

# Enable Corepack (auto-manages pnpm based on packageManager field)
corepack enable
```

**Note:** When you enter this directory, fnm will automatically switch to Node 20 because of the `.nvmrc` file. Corepack will ensure the correct pnpm version (10.x) is used.

### 5. Install Local Dependencies

```bash
# Install scraper dependencies
cd scraper
pnpm install

# Install local sync dependencies
cd ../local
pnpm install
```

### 5. Place Wrapper in PATH

The wrapper script syncs free models before launching OpenCode.

**Option A: Symlink (Recommended)**

```bash
# Find where opencode is installed
which opencode
# Example output: /usr/local/bin/opencode

# Create symlink
sudo ln -sf /Users/vardaanchaphekar/Projects/automations/zen-free-models/local/opencode-wrapper.sh /usr/local/bin/opencode-wrapper

# Add alias to your shell config (~/.zshrc or ~/.bashrc)
echo "alias opencode='opencode-wrapper'" >> ~/.zshrc
source ~/.zshrc
```

**Option B: Add to PATH**

```bash
# Add local directory to PATH
echo 'export PATH="/Users/vardaanchaphekar/Projects/automations/zen-free-models/local:$PATH"' >> ~/.zshrc
source ~/.zshrc

# Then run as:
opencode-wrapper
```

## Automatic Version Management

This project uses automatic version switching for consistency:

### Node.js (via fnm)
- `.nvmrc` file contains `20`
- fnm automatically switches to Node 20 when you enter this directory
- Works out of the box with fnm installed

### pnpm (via Corepack)
- `packageManager: "pnpm@10.0.0"` in both `package.json` files
- Node's built-in Corepack automatically manages pnpm version
- Just run `corepack enable` once globally

No manual version switching needed!

## Usage

### Normal Usage

After setting up the alias or PATH:

```bash
opencode
```

The wrapper will:
1. Fetch the latest free models from GitHub
2. Update your `~/.config/opencode/opencode.json`
3. Launch OpenCode with all your arguments passed through

### Test Sync Without Running OpenCode

To test the sync script alone:

```bash
cd local
pnpm run sync
```

### Run Scraper Manually

```bash
cd scraper
npm start
```

## How It Works

### Remote Scraper

- Runs daily at 03:00 UTC via GitHub Actions
- Uses Stagehand v3 to scrape `https://opencode.ai/docs/zen/`
- Extracts models with "Free" pricing from the pricing table
- Outputs `zen-free-models.json` with:
  - `updatedAt`: ISO timestamp
  - `source`: URL scraped from
  - `modelIds`: Array of free model IDs
  - `raw`: Optional diagnostics
- Only commits if JSON content changed

### Local Sync Script

- Fetches `zen-free-models.json` from GitHub raw URL
- Validates JSON schema
- Patches `~/.config/opencode/opencode.json`:
  - Preserves all existing fields
  - Sets `provider.opencode.models` with free model IDs
  - Ensures `providerResolution.mode = "strict"`
- Uses atomic write (temp file + rename)
- Logs how many models were applied

### Wrapper Script

- Finds opencode binary (supports Homebrew installation)
- Runs sync script
- Launches real opencode with all arguments passed through

## Trigger Manual Updates

To manually trigger the GitHub Actions workflow:

1. Go to **Actions** tab on GitHub
2. Select **Update Zen Free Models** workflow
3. Click **Run workflow** > **Run workflow**

## Troubleshooting

### Wrapper says "opencode binary not found"

```bash
# Check if opencode is installed
which opencode

# If not found, install via Homebrew
brew install opencode
```

### Sync fails to fetch from GitHub

- Check your internet connection
- Verify the repo URL in `local/sync-opencode-zen-free.ts` matches your actual repo
- Ensure the `zen-free-models.json` file exists in the repo

### GitHub Action fails

- Check the **Actions** tab for error logs
- Verify `BROWSERBASE_API_KEY` secret is set correctly
- Ensure the `zen-free-models.json` can be committed (not in .gitignore)

## File Structure

```
zen-free-models/
├── .github/workflows/
│   └── update-zen-free-models.yml    # GitHub Action
├── scraper/
│   ├── src/index.ts                 # Stagehand scraper
│   ├── package.json
│   └── tsconfig.json
├── local/
│   ├── sync-opencode-zen-free.ts     # Local sync script
│   ├── opencode-wrapper.sh           # Wrapper script
│   ├── package.json
│   └── tsconfig.json
├── zen-free-models.json            # Generated (don't edit manually)
└── README.md                      # This file
```
