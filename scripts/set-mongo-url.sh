#!/usr/bin/env bash
# Write MONGO_URL into ~/erxes/.env (and this plugin's .env, if it exists) and
# test it. Paste the string from Atlas → Database → Connect → Drivers as is:
# when it still says <db_password>, the password is asked for separately and
# URL-encoded. Input is hidden and the URL is never printed.
#   bash scripts/set-mongo-url.sh           set it (or pass MONGO_URL in the environment)
#   bash scripts/set-mongo-url.sh --check   only test the URL already in ~/erxes/.env
set -euo pipefail

PLUGIN_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ERXES_DIR="${ERXES_DIR:-$HOME/erxes}"
ERXES_ENV="$ERXES_DIR/.env"

# Connects and pings with the mongoose erxes installs. Driver error messages
# name the host at most, never the password.
check() {
  if [ ! -d "$ERXES_DIR/node_modules/mongoose" ]; then
    echo "MongoDB not tested yet: setup-erxes.sh tests it after installing erxes."
    return 0
  fi
  if (cd "$ERXES_DIR" && MONGO_URL="$1" timeout 60 node -e '
    require("mongoose")
      .connect(process.env.MONGO_URL, { serverSelectionTimeoutMS: 30000 })
      .then((m) => m.connection.db.admin().ping().then(() => m.disconnect()))
      .then(() => console.log("MongoDB OK"))
      .catch((e) => {
        console.error(`MongoDB FAILED: ${e.message.split("\n")[0]}`);
        process.exit(1);
      })'); then
    return 0
  fi
  cat >&2 << EOF
"bad auth": wrong password for the database user (Atlas → Database Access →
  Edit → Edit Password). A new password takes a minute to apply.
Timeout: allow this IP in Atlas → Network Access: $(curl -s -m 10 https://api.ipify.org || echo "?")
Then run: bash $PLUGIN_DIR/scripts/set-mongo-url.sh
EOF
  return 1
}

if [ ! -f "$ERXES_ENV" ]; then
  echo "$ERXES_ENV not found. Run scripts/setup-erxes.sh first." >&2
  exit 1
fi

if [ "${1:-}" = "--check" ]; then
  url="$(grep -m1 '^MONGO_URL=' "$ERXES_ENV" | cut -d= -f2- || true)"
  url="${url#\"}"
  url="${url%\"}"
  if [ -z "$url" ]; then
    echo "No MONGO_URL in $ERXES_ENV. Run: bash $PLUGIN_DIR/scripts/set-mongo-url.sh" >&2
    exit 1
  fi
  check "$url"
  exit
fi

url="${MONGO_URL:-}"
if [ -z "$url" ]; then
  echo "Paste the connection string from Atlas → Database → Connect → Drivers."
  echo "It starts with mongodb+srv:// (https://cloud.mongodb.com/... is the web page). Input is hidden."
  read -rsp "MONGO_URL: " url
  echo
fi
url="${url//[$'\r\n\t ']/}"

case "$url" in
  mongodb://* | mongodb+srv://*) ;;
  *)
    echo "Not a connection string: it must start with mongodb+srv:// or mongodb://." >&2
    exit 1
    ;;
esac

# Atlas shows the driver string with a <db_password> placeholder.
if [[ "$url" =~ \<[A-Za-z_]*password\> ]]; then
  placeholder="${BASH_REMATCH[0]}"
  echo "Password of the database user in that string (Atlas → Database Access), not your Atlas login."
  echo "Input is hidden."
  read -rsp "Password: " password
  echo
  if [ -z "$password" ]; then
    echo "No password entered." >&2
    exit 1
  fi
  # Percent-encode @ : / ? # and the rest; stdin keeps the password out of argv.
  encoded="$(printf '%s' "$password" | node -e 'process.stdout.write(encodeURIComponent(require("fs").readFileSync(0, "utf8")))')"
  url="${url/"$placeholder"/"$encoded"}"
  unset password encoded
fi

# erxes keeps its data in the "erxes" database; Atlas driver strings name none.
if [[ "$url" =~ ^(mongodb(\+srv)?://[^/?]+)/?(\?.*)?$ ]]; then
  url="${BASH_REMATCH[1]}/erxes${BASH_REMATCH[3]:-?retryWrites=true&w=majority}"
fi

for f in "$ERXES_ENV" "$PLUGIN_DIR/.env"; do
  [ -f "$f" ] || continue
  tmp="$(mktemp "$f.XXXXXX")"
  grep -v '^MONGO_URL=' "$f" > "$tmp" || true
  printf 'MONGO_URL="%s"\n' "$url" >> "$tmp"
  chmod 600 "$tmp"
  mv "$tmp" "$f"
  echo "Updated MONGO_URL in $f"
done

check "$url"
