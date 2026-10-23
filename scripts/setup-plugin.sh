#!/usr/bin/env bash
# Install this plugin and write its .env (same MongoDB and Redis as erxes).
# Run as your normal user after setup-erxes.sh:  bash scripts/setup-plugin.sh
# GEMINI_API_KEY can be passed in the environment; otherwise it is asked for.
set -euo pipefail

PLUGIN_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ERXES_DIR="${ERXES_DIR:-$HOME/erxes}"
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0

cd "$PLUGIN_DIR"

if [ ! -f .env ]; then
  if [ ! -f "$ERXES_DIR/.env" ]; then
    echo "$ERXES_DIR/.env not found. Run scripts/setup-erxes.sh first." >&2
    exit 1
  fi
  if [ -z "${GEMINI_API_KEY:-}" ]; then
    echo "Paste your Google AI Studio key (https://aistudio.google.com/apikey), or press Enter to add it later."
    echo "Input is hidden."
    read -rsp "GEMINI_API_KEY: " GEMINI_API_KEY
    echo
  fi

  # Copy lines verbatim: URLs and keys contain characters sed would rewrite.
  grep -vE '^(REDIS_HOST|GEMINI_API_KEY)=' .env.example > .env
  echo "REDIS_HOST=127.0.0.1" >> .env
  echo "GEMINI_API_KEY=${GEMINI_API_KEY}" >> .env
  grep -E '^MONGO_URL=' "$ERXES_DIR/.env" | head -1 >> .env
  chmod 600 .env
  echo "Wrote $PLUGIN_DIR/.env"
fi

pnpm install --frozen-lockfile
pnpm run check

echo
echo "Plugin is ready. Start order (one terminal each):"
echo "  1) cd $PLUGIN_DIR && pnpm run dev:api"
echo "  2) cd $ERXES_DIR && pnpm dev:core-api"
echo "  3) cd $ERXES_DIR && pnpm nx serve core-ui"
echo "  4) cd $PLUGIN_DIR && pnpm run dev:ui"
echo "Then open http://localhost:3001"
