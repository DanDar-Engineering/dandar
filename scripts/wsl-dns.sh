#!/usr/bin/env bash
# Make DNS inside WSL survive slow or lossy wifi: keep WSL's own resolver first,
# fall back to Google DNS, retry after 1 s instead of 5 s and send the A and
# AAAA lookups one at a time. Only Ubuntu is changed, not Windows.
# Run once if apt, NodeSource or pnpm fail with "Could not resolve host":
#   sudo bash scripts/wsl-dns.sh
# Undo: delete the [network] lines from /etc/wsl.conf, then in PowerShell
#   wsl --terminate Ubuntu-24.04
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run with sudo: sudo bash $0" >&2
  exit 1
fi

# WSL's resolver forwards to Windows (10.255.255.254 with DNS tunneling).
wsl_dns="$(awk '/^nameserver/ { print $2; exit }' /etc/resolv.conf 2> /dev/null || true)"
case "$wsl_dns" in
  "" | 8.8.8.8 | 8.8.4.4) wsl_dns=10.255.255.254 ;;
esac

# Stop WSL from regenerating /etc/resolv.conf on every start.
if ! grep -q '^generateResolvConf' /etc/wsl.conf 2> /dev/null; then
  printf '\n[network]\ngenerateResolvConf = false\n' >> /etc/wsl.conf
fi

rm -f /etc/resolv.conf
cat > /etc/resolv.conf << EOF
# Written by scripts/wsl-dns.sh; see /etc/wsl.conf [network].
nameserver $wsl_dns
nameserver 8.8.8.8
nameserver 8.8.4.4
options timeout:1 attempts:5 single-request-reopen
EOF

for host in deb.nodesource.com registry.npmjs.org; do
  printf '%s: ' "$host"
  getent ahosts "$host" | awk '{ print $1; exit }' || echo "still failing"
done
