#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

OPENCODE_BIN=""
if command -v opencode &> /dev/null; then
  OPENCODE_BIN="$(which opencode)"
else
  echo "Error: opencode binary not found in PATH"
  echo "Please ensure OpenCode is installed via Homebrew"
  exit 1
fi

echo "Syncing free Zen models..."
cd "$SCRIPT_DIR"

if [ -f "sync-opencode-zen-free.ts" ]; then
  pnpm exec tsx sync-opencode-zen-free.ts
else
  echo "Error: sync-opencode-zen-free.ts not found"
  exit 1
fi

echo "Launching opencode..."
exec "$OPENCODE_BIN" "$@"
