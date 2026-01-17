#!/bin/bash
# Zen Free Models Sync - runs before opencode to update free model whitelist
# Uses 12-hour cache to avoid repeated API calls

set -e

CACHE_DIR="$HOME/.cache/zen-free-models"
CACHE_FILE="$CACHE_DIR/models.json"
CONFIG_FILE="$HOME/.config/opencode/opencode.json"
CACHE_MAX_AGE=43200  # 12 hours in seconds

API_URL="https://api.github.com/repos/VcDoc/zen-free-models/contents/zen-free-models.json"

# Check if cache is valid
if [[ -f "$CACHE_FILE" ]]; then
  if [[ "$(uname)" == "Darwin" ]]; then
    cache_age=$(( $(date +%s) - $(stat -f %m "$CACHE_FILE") ))
  else
    cache_age=$(( $(date +%s) - $(stat -c %Y "$CACHE_FILE") ))
  fi

  if [[ $cache_age -lt $CACHE_MAX_AGE ]]; then
    # Cache is valid, no need to fetch
    exit 0
  fi
fi

# Fetch from GitHub API
mkdir -p "$CACHE_DIR"

response=$(curl -s -H "Accept: application/vnd.github.v3+json" "$API_URL")
if [[ $? -ne 0 ]]; then
  echo "Warning: Failed to fetch zen-free-models, using existing config" >&2
  exit 0
fi

# Decode base64 content and extract modelIds
content=$(echo "$response" | grep -o '"content":"[^"]*"' | sed 's/"content":"//;s/"$//' | tr -d '\n' | base64 -d 2>/dev/null)
if [[ -z "$content" ]]; then
  echo "Warning: Failed to decode zen-free-models content" >&2
  exit 0
fi

# Extract modelIds array using simple parsing
model_ids=$(echo "$content" | grep -o '"modelIds":\s*\[[^]]*\]' | sed 's/"modelIds":\s*//')

if [[ -z "$model_ids" || "$model_ids" == "[]" ]]; then
  echo "Warning: No free models available - disabling opencode provider" >&2
  # Update cache with empty state
  echo "$content" > "$CACHE_FILE"

  # Disable opencode provider if no free models
  if [[ -f "$CONFIG_FILE" ]] && command -v node &> /dev/null; then
    node -e "
      const fs = require('fs');
      const config = JSON.parse(fs.readFileSync('$CONFIG_FILE', 'utf-8'));
      // Remove opencode from provider config and add to disabled_providers
      if (config.provider && config.provider.opencode) {
        delete config.provider.opencode;
      }
      if (!config.disabled_providers) config.disabled_providers = [];
      if (!config.disabled_providers.includes('opencode')) {
        config.disabled_providers.push('opencode');
      }
      fs.writeFileSync('$CONFIG_FILE', JSON.stringify(config, null, 2));
    " 2>/dev/null || true
  fi
  exit 0
fi

# Update cache
echo "$content" > "$CACHE_FILE"

# Update opencode config with free models whitelist
if [[ -f "$CONFIG_FILE" ]]; then
  if command -v node &> /dev/null; then
    node -e "
      const fs = require('fs');
      const config = JSON.parse(fs.readFileSync('$CONFIG_FILE', 'utf-8'));
      const models = $model_ids;

      // Enable opencode provider with whitelist
      if (!config.provider) config.provider = {};
      config.provider.opencode = { whitelist: models };

      // Remove from disabled_providers if present
      if (config.disabled_providers) {
        config.disabled_providers = config.disabled_providers.filter(p => p !== 'opencode');
        if (config.disabled_providers.length === 0) {
          delete config.disabled_providers;
        }
      }

      fs.writeFileSync('$CONFIG_FILE', JSON.stringify(config, null, 2));
    " 2>/dev/null || true
  fi
fi
