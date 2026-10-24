#!/usr/bin/env bash
# Stop everything scripts/start-all.sh started, including the VS Code tunnel.
set -uo pipefail

LOG_DIR="$HOME/logs"

for pid_file in "$LOG_DIR"/*.pid; do
  [ -f "$pid_file" ] || continue
  name="$(basename "$pid_file" .pid)"
  if kill -- "-$(cat "$pid_file")" 2> /dev/null; then
    echo "stopped $name"
  fi
  rm -f "$pid_file"
done

# The gateway's Apollo Router can outlive the gateway process.
pkill -x router 2> /dev/null && echo "stopped Apollo Router"
true
