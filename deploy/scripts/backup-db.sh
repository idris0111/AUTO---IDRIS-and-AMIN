#!/usr/bin/env bash
# Run as postgres. No password required, no automatic pruning or overwrite.
set -euo pipefail
umask 077
[[ $(id -un) == postgres ]] || { echo 'Run as postgres' >&2; exit 1; }
backup_dir=/var/backups/zapchast
[[ -d $backup_dir ]] || { echo 'Create the private backup directory first' >&2; exit 1; }
backup_file=$(mktemp "$backup_dir/zapchast-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX.dump")
pg_dump --format=custom --no-password --dbname=zapchast --file="$backup_file"
pg_restore --list "$backup_file" >/dev/null
printf 'Backup verified: %s\n' "$backup_file"
