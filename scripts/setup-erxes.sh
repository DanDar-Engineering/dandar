#!/usr/bin/env bash
# Clone erxes into ~/erxes, write its .env, install and build the shared library.
# Run as your normal user:  bash scripts/setup-erxes.sh
# MONGO_URL can be passed in the environment; otherwise it is asked for.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ERXES_DIR="${ERXES_DIR:-$HOME/erxes}"
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0

corepack prepare pnpm@9.12.3 --activate

if [ ! -d "$ERXES_DIR/.git" ]; then
  # Standalone plugins need erxes main (external UI remotes load from main).
  # A shallow clone keeps the download small on venue wifi.
  git clone --depth 1 --single-branch --branch main https://github.com/erxes/erxes.git "$ERXES_DIR"
else
  git -C "$ERXES_DIR" pull --ff-only
fi

if [ ! -f "$ERXES_DIR/.env" ]; then
  if [ -z "${MONGO_URL:-}" ]; then
    echo "Paste your MONGO_URL (MongoDB Atlas: mongodb+srv://USER:PASSWORD@HOST/erxes?retryWrites=true&w=majority)."
    echo "Input is hidden."
    read -rsp "MONGO_URL: " MONGO_URL
    echo
  fi
  if [ -z "$MONGO_URL" ]; then
    echo "MONGO_URL is required." >&2
    exit 1
  fi

  {
    cat "$SCRIPT_DIR/erxes.env.example"
    echo "MONGO_URL=\"$MONGO_URL\""
    echo "JWT_TOKEN_SECRET=$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))")"
  } > "$ERXES_DIR/.env"
  chmod 600 "$ERXES_DIR/.env"
  echo "Wrote $ERXES_DIR/.env"
fi

cd "$ERXES_DIR"
pnpm install --frozen-lockfile
pnpm nx build erxes-api-shared

echo
echo "erxes is ready in $ERXES_DIR"
echo "Next: bash scripts/setup-plugin.sh"
