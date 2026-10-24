#!/usr/bin/env bash
# Start erxes, this plugin and (when logged in) the VS Code tunnel in the
# background, in the order the gateway needs. Safe to re-run: anything already
# listening is left alone. Logs and pid files: ~/logs/<name>.log|.pid
#   bash scripts/start-all.sh        (inside Ubuntu)
#   wsl -d Ubuntu-24.04 -e bash /home/<user>/erxes-plugins/dandar/scripts/start-all.sh
set -euo pipefail

PLUGIN_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ERXES_DIR="${ERXES_DIR:-$HOME/erxes}"
LOG_DIR="$HOME/logs"
CODE_CLI="${CODE_CLI:-$HOME/.local/bin/code}"
TUNNEL_NAME="${TUNNEL_NAME:-dandar-home}"
mkdir -p "$LOG_DIR"

listening() { ss -ltn "sport = :$1" | grep -q LISTEN; }

start() {
  local name="$1" dir="$2"
  shift 2
  # exec replaces the subshell, so nothing keeps this script's stdout open
  # while the service runs. setsid makes the service its own process group
  # (pgid = $!), which stop-all.sh kills.
  (cd "$dir" && exec nohup setsid "$@" > "$LOG_DIR/$name.log" 2>&1 < /dev/null) &
  echo $! > "$LOG_DIR/$name.pid"
  echo "started $name (log: $LOG_DIR/$name.log)"
}

wait_port() {
  local port="$1" label="$2" tries="$3"
  for _ in $(seq 1 "$tries"); do
    if listening "$port"; then
      echo "ready: $label (:$port)"
      return 0
    fi
    sleep 3
  done
  echo "TIMEOUT: $label (:$port) did not start; see $LOG_DIR" >&2
  return 1
}

start_backend() {
  # A gateway that crashed leaves nodemon waiting for file changes, core-api
  # holding :3300 and possibly its Apollo Router holding :50000; clear them.
  if [ -f "$LOG_DIR/erxes-backend.pid" ]; then
    kill -- "-$(cat "$LOG_DIR/erxes-backend.pid")" 2> /dev/null || true
    sleep 2
  fi
  pkill -x router 2> /dev/null || true
  start erxes-backend "$ERXES_DIR" pnpm dev:core-api
}

# The first start downloads Apollo Router (minutes on venue wifi), and the
# gateway then gives it 15 s to come up; on a busy machine it misses that and
# exits instead of retrying. Restart the backend once when that happens.
wait_gateway() {
  local restarted=0
  for _ in $(seq 1 200); do
    if listening 4000; then
      echo "ready: erxes gateway (:4000)"
      return 0
    fi
    if [ "$restarted" -eq 0 ] && grep -q "app crashed" "$LOG_DIR/erxes-backend.log" 2> /dev/null; then
      echo "erxes backend crashed while starting; restarting it once"
      start_backend
      restarted=1
    fi
    sleep 3
  done
  echo "TIMEOUT: erxes gateway (:4000) did not start; see $LOG_DIR/erxes-backend.log" >&2
  return 1
}

# Every service exits when MongoDB is unreachable; the usual cause is a new
# public IP that Atlas Network Access does not allow yet.
if ! (cd "$PLUGIN_DIR/api" && timeout 30 node --env-file=../.env -e '
  require("mongoose").connect(process.env.MONGO_URL, { serverSelectionTimeoutMS: 15000 })
    .then((m) => m.disconnect()).then(() => process.exit(0)).catch(() => process.exit(1))'); then
  echo "MongoDB is not reachable. In Atlas → Network Access, allow this IP: $(curl -s -m 10 https://api.ipify.org)" >&2
  exit 1
fi

listening 3399 || start plugin-api "$PLUGIN_DIR" pnpm run dev:api
wait_port 3399 "plugin API" 40

listening 4000 || start_backend
wait_gateway

listening 3001 || start core-ui "$ERXES_DIR" pnpm nx serve core-ui
listening 3099 || start plugin-ui "$PLUGIN_DIR" pnpm run dev:ui
wait_port 3099 "plugin UI" 60
wait_port 3001 "erxes UI" 100

if [ -x "$CODE_CLI" ]; then
  # Captured first: with pipefail, `| grep -q` exiting early would fail the test.
  login_state="$("$CODE_CLI" tunnel user show 2>&1 || true)"
  if pgrep -f "tunnel --name $TUNNEL_NAME" > /dev/null; then
    echo "VS Code tunnel '$TUNNEL_NAME' already running"
  elif [[ "$login_state" == *"not logged in"* ]]; then
    echo "VS Code tunnel skipped: not logged in (see REMOTE.md)"
  else
    # Running the tunnel means accepting the VS Code Server License Terms.
    start vscode-tunnel "$HOME" "$CODE_CLI" tunnel --name "$TUNNEL_NAME" --accept-server-license-terms
  fi
fi

echo
echo "erxes is up: http://localhost:3001"
