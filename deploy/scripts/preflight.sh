#!/usr/bin/env bash
# Read-only inventory. Run before agreeing to changes on an existing VPS.
set -euo pipefail
cat /etc/os-release
id
df -h /
free -h
ss -lnt
for command in python3 nginx psql certbot node; do
    command -v "$command" || true
done
systemctl is-active nginx postgresql zapchast-api || true
if command -v sudo >/dev/null; then
    sudo -n -l || true
fi
# Do not print environment files, private keys, database contents or nginx -T.
