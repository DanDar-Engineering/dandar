#!/usr/bin/env bash
# System packages for erxes development inside WSL Ubuntu 24.04.
# Run once per machine:  sudo bash scripts/setup-wsl.sh
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run with sudo: sudo bash $0" >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

if ! timeout 15 getent ahosts deb.nodesource.com > /dev/null; then
  echo "DNS lookups are failing or slow. If the steps below fail, run: sudo bash scripts/wsl-dns.sh" >&2
fi

# Venue wifi drops packets: let every apt download (NodeSource's too) retry.
echo 'Acquire::Retries "5";' > /etc/apt/apt.conf.d/80-retries

apt-get update -y
apt-get install -y git gh curl ca-certificates build-essential python3 redis-server

# Redis on 127.0.0.1:6379, started now and on every WSL boot (systemd is on by default in 24.04)
systemctl enable --now redis-server
redis-cli ping

# Node 22 from NodeSource (Ubuntu 24.04 ships Node 18, which erxes does not support)
if ! node -v 2>/dev/null | grep -q '^v22\.'; then
  # Downloaded first: a retried download piped into bash could run twice.
  curl -fsSL --retry 5 --retry-all-errors --retry-delay 5 -o /tmp/nodesource_setup.sh \
    https://deb.nodesource.com/setup_22.x
  bash /tmp/nodesource_setup.sh
  rm -f /tmp/nodesource_setup.sh
  apt-get install -y nodejs
fi
corepack enable

echo
echo "node $(node -v), $(redis-server --version | cut -d' ' -f1-3)"
echo "Next: bash scripts/setup-erxes.sh   (as your normal user, without sudo)"
