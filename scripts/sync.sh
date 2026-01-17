#!/bin/bash
# Sync free models whitelist before opencode starts
# Uses configurable cache TTL (default: 12 hours)

set -e

DIR="$HOME/.cache/zen-free-models"
CACHE="$DIR/models.json"
LOCK="$DIR/.lock"
CONF="$HOME/.config/opencode/opencode.json"
MAX_AGE="${ZEN_CACHE_MAX_AGE:-43200}"
URL="https://api.github.com/repos/VcDoc/zen-free-models/contents/zen-free-models.json"

cleanup() { rm -f "$LOCK" 2>/dev/null; }

lock() {
  local wait=0
  while ! mkdir "$LOCK" 2>/dev/null; do
    [[ $wait -ge 5 ]] && { echo "Warning: Lock timeout" >&2; return 0; }
    sleep 0.5
    wait=$((wait + 1))
  done
  trap cleanup EXIT
}

update_conf() {
  local ids="$1"
  [[ -f "$CONF" ]] || return 0
  command -v node &>/dev/null || return 0

  if [[ -z "$ids" || "$ids" == "[]" ]]; then
    node -e "
      const fs = require('fs');
      const c = JSON.parse(fs.readFileSync(process.argv[1], 'utf-8'));
      if (c.provider?.opencode) delete c.provider.opencode;
      if (!c.disabled_providers) c.disabled_providers = [];
      if (!c.disabled_providers.includes('opencode')) c.disabled_providers.push('opencode');
      fs.writeFileSync(process.argv[1], JSON.stringify(c, null, 2));
    " "$CONF" 2>/dev/null || true
  else
    node -e "
      const fs = require('fs');
      const ids = JSON.parse(process.argv[2]);
      const c = JSON.parse(fs.readFileSync(process.argv[1], 'utf-8'));
      if (!c.provider) c.provider = {};
      c.provider.opencode = { whitelist: ids };
      if (c.disabled_providers) {
        c.disabled_providers = c.disabled_providers.filter(p => p !== 'opencode');
        if (!c.disabled_providers.length) delete c.disabled_providers;
      }
      fs.writeFileSync(process.argv[1], JSON.stringify(c, null, 2));
    " "$CONF" "$ids" 2>/dev/null || true
  fi
}

save() {
  local tmp="$CACHE.tmp.$$"
  echo "$1" > "$tmp" && mv "$tmp" "$CACHE" || { rm -f "$tmp"; return 1; }
}

parse_jq() {
  local b64=$(echo "$resp" | jq -r '.content // empty')
  [[ -z "$b64" ]] && return 1
  data=$(echo "$b64" | base64 -d)
  ids=$(echo "$data" | jq -c '.modelIds // []')
}

parse_node() {
  local out=$(node -e "
    const r = JSON.parse(process.argv[1]);
    if (!r.content) process.exit(1);
    const d = Buffer.from(r.content, 'base64').toString('utf-8');
    const j = JSON.parse(d);
    process.stdout.write(d + '\0' + JSON.stringify(j.modelIds || []));
  " "$resp" 2>/dev/null)
  [[ $? -ne 0 || -z "$out" ]] && return 1
  data="${out%%$'\0'*}"
  ids="${out#*$'\0'}"
}

mkdir -p "$DIR"
lock

if [[ -f "$CACHE" ]]; then
  if [[ "$(uname)" == "Darwin" ]]; then
    age=$(( $(date +%s) - $(stat -f %m "$CACHE") ))
  else
    age=$(( $(date +%s) - $(stat -c %Y "$CACHE") ))
  fi
  [[ $age -lt $MAX_AGE ]] && exit 0
fi

resp=$(curl -sf -H "Accept: application/vnd.github.v3+json" "$URL") || { echo "Warning: Fetch failed" >&2; exit 0; }
[[ -z "$resp" ]] && { echo "Warning: Empty response" >&2; exit 0; }

if command -v jq &>/dev/null; then
  parse_jq || { command -v node &>/dev/null && parse_node || { echo "Warning: Parse failed" >&2; exit 0; }; }
elif command -v node &>/dev/null; then
  parse_node || { echo "Warning: Parse failed" >&2; exit 0; }
else
  echo "Warning: No jq or node" >&2; exit 0
fi

if [[ -z "$ids" || "$ids" == "[]" ]]; then
  echo "Warning: No free models" >&2
  save "$data"
  update_conf ""
  exit 0
fi

save "$data"
update_conf "$ids"
