#!/bin/sh
# Phase 1 skeleton — full pg_dump flow in Phase 10 / docs/backup-restore.md
set -eu
OUT="${1:-backups/o2app-$(date +%F).dump}"
mkdir -p "$(dirname "$OUT")"
echo "TODO Phase 10: pg_dump --format=custom \$DIRECT_URL > $OUT"
