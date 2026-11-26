#!/usr/bin/env bash
# Backs up the MagiDoc PostgreSQL database (custom format, compressed) and prunes old backups.
#   ./deploy/backup.sh [backup-dir]          default dir: ./backups, keeps KEEP_DAYS=14 days
# Cron (daily 03:00): 0 3 * * * cd /opt/magidoc && ./deploy/backup.sh >> backups/backup.log 2>&1
set -euo pipefail

cd "$(dirname "$0")/.."
COMPOSE=${COMPOSE:-"docker compose"}
DIR="${1:-./backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"

mkdir -p "$DIR"
chmod 700 "$DIR"
FILE="$DIR/magidoc-$(date +%Y%m%d-%H%M%S).dump"

# Write to a temp name first so a failed dump never looks like a valid backup.
$COMPOSE exec -T postgres pg_dump -U magidoc -d magidoc --format=custom > "$FILE.partial"
mv "$FILE.partial" "$FILE"
chmod 600 "$FILE"

find "$DIR" -name 'magidoc-*.dump' -type f -mtime +"$KEEP_DAYS" -delete
echo "$(date -Iseconds) backup written: $FILE ($(du -h "$FILE" | cut -f1))"
