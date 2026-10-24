#!/usr/bin/env bash
# Clone erxes into ~/erxes, write its .env, install and build the shared library.
# Run as your normal user:  bash scripts/setup-erxes.sh
# MONGO_URL can be passed in the environment; otherwise it is asked for.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ERXES_DIR="${ERXES_DIR:-$HOME/erxes}"
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
# Venue wifi drops packets: retry registry downloads instead of failing.
export npm_config_fetch_retries=6 npm_config_fetch_retry_mintimeout=20000 \
  npm_config_fetch_retry_maxtimeout=120000 npm_config_fetch_timeout=120000
# Cypress and Puppeteer download test browsers (~400 MB) on install; erxes runs
# without them, and on slow links they stall pnpm install for good.
export CYPRESS_INSTALL_BINARY=0 PUPPETEER_SKIP_DOWNLOAD=true

corepack prepare pnpm@9.12.3 --activate

if [ ! -d "$ERXES_DIR/.git" ]; then
  # Standalone plugins need erxes main (external UI remotes load from main).
  # A shallow clone keeps the download small on venue wifi.
  git clone --depth 1 --single-branch --branch main https://github.com/erxes/erxes.git "$ERXES_DIR"
else
  git -C "$ERXES_DIR" pull --ff-only
fi

if [ ! -f "$ERXES_DIR/.env" ]; then
  {
    cat "$SCRIPT_DIR/erxes.env.example"
    echo "JWT_TOKEN_SECRET=$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))")"
  } > "$ERXES_DIR/.env"
  chmod 600 "$ERXES_DIR/.env"
  echo "Wrote $ERXES_DIR/.env"
fi
if ! grep -q '^MONGO_URL=' "$ERXES_DIR/.env"; then
  ERXES_DIR="$ERXES_DIR" bash "$SCRIPT_DIR/set-mongo-url.sh"
fi

cd "$ERXES_DIR"
pnpm install --frozen-lockfile
pnpm nx build erxes-api-shared
ERXES_DIR="$ERXES_DIR" bash "$SCRIPT_DIR/set-mongo-url.sh" --check

echo
echo "erxes is ready in $ERXES_DIR"
echo "Next: bash scripts/setup-plugin.sh"
