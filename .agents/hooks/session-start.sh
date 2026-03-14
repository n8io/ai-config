#!/usr/bin/env bash
# session-start.sh — Auto-sync ai-config on Claude Code session start
# Debounced to once per 24 hours via ~/.ai-config/.sync-cache

set -euo pipefail

REPO_DIR="$HOME/.ai-config"
SYNC_CACHE="$REPO_DIR/.sync-cache"
MAX_AGE_HOURS=24

# Skip if repo doesn't exist yet
if [[ ! -d "$REPO_DIR/.git" ]]; then
  exit 0
fi

# Check cache age
if [[ -f "$SYNC_CACHE" ]]; then
  last_sync=$(node -e "try { const c = JSON.parse(require('fs').readFileSync('$SYNC_CACHE','utf-8')); process.stdout.write(c.lastSync || ''); } catch { }" 2>/dev/null || echo "")
  if [[ -n "$last_sync" ]]; then
    last_ts=$(date -d "$last_sync" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%S" "${last_sync%%.*}" +%s 2>/dev/null || echo 0)
    now_ts=$(date +%s)
    age_hours=$(( (now_ts - last_ts) / 3600 ))
    if (( age_hours < MAX_AGE_HOURS )); then
      exit 0
    fi
  fi
fi

# Pull latest (fail silently — don't block the session)
git -C "$REPO_DIR" pull origin main --quiet 2>/dev/null || true

# Re-apply any broken symlinks via the CLI (fail silently)
# Note: no --dry-run here — we actually want to re-link broken symlinks
node "$REPO_DIR/dist/cli.js" install 2>/dev/null || true

# Update cache
node -e "require('fs').writeFileSync('$SYNC_CACHE', JSON.stringify({ lastSync: new Date().toISOString() }))" 2>/dev/null || true

exit 0
