#!/bin/bash
# sync-obsidian.sh — synchronizuje vault Obsidiana z Supabase knowledge_base
# Uruchamiaj croniem co 15 minut: */15 * * * * /opt/paha/scripts/sync-obsidian.sh

set -euo pipefail

# ── Konfiguracja ──────────────────────────────────────────────────────────────
VAULT_DIR="${VAULT_DIR:-/opt/obsidian-vault}"
SUPABASE_URL="${SUPABASE_URL:?Ustaw SUPABASE_URL}"
SUPABASE_SERVICE_KEY="${SUPABASE_SERVICE_KEY:?Ustaw SUPABASE_SERVICE_KEY}"
LOG_FILE="/var/log/sync-obsidian.log"

# ── Helpers ───────────────────────────────────────────────────────────────────
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

# ── Pull najnowszych zmian z GitHub ──────────────────────────────────────────
log "Pulling latest changes from GitHub..."
cd "$VAULT_DIR"
git pull --ff-only origin main 2>&1 | tee -a "$LOG_FILE" || {
  log "WARNING: git pull failed, using existing files"
}

# ── Sync każdego pliku .md do Supabase ───────────────────────────────────────
SYNCED=0
ERRORS=0

while IFS= read -r -d '' file; do
  # Ścieżka relatywna względem vaultu
  relative="${file#$VAULT_DIR/}"

  # Pomiń folder .obsidian
  if [[ "$relative" == .obsidian/* ]]; then
    continue
  fi

  # Slug = ścieżka bez .md, z / jako separatorem
  slug="${relative%.md}"
  slug="${slug// /_}"   # spacje → underscore

  # Tytuł = nazwa pliku bez .md
  filename=$(basename "$file" .md)
  title="${filename//_/ }"

  # Folder = pierwszy katalog lub "" jeśli w rootu
  folder=$(dirname "$relative")
  if [[ "$folder" == "." ]]; then
    folder=""
  fi

  # Treść pliku — escaped dla JSON
  content=$(cat "$file")

  # Upsert do Supabase przez REST API
  payload=$(jq -n \
    --arg slug "$slug" \
    --arg title "$title" \
    --arg content "$content" \
    --arg folder "$folder" \
    '{slug: $slug, title: $title, content: $content, folder: $folder, synced_at: "now()"}')

  http_code=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST \
    "${SUPABASE_URL}/rest/v1/knowledge_base" \
    -H "apikey: ${SUPABASE_SERVICE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: resolution=merge-duplicates" \
    -d "$payload")

  if [[ "$http_code" == "200" || "$http_code" == "201" ]]; then
    SYNCED=$((SYNCED + 1))
    log "  ✓ $slug"
  else
    ERRORS=$((ERRORS + 1))
    log "  ✗ $slug (HTTP $http_code)"
  fi

done < <(find "$VAULT_DIR" -name "*.md" -print0)

log "Sync done. Synced: $SYNCED, Errors: $ERRORS"
