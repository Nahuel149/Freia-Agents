#!/usr/bin/env bash

# Local backup of the Render Postgres database to a compressed custom-format dump.
# Usage:
#   PGHOST=... PGPORT=... PGUSER=... PGPASSWORD=... PGDATABASE=... ./pg_backup_local.sh /path/to/backups
# Notes:
#   - Requires pg_dump in PATH.
#   - Output is kept locally; consider encrypting and/or syncing to offsite storage.

set -euo pipefail

TARGET_DIR="${1:-./db-backups}"
DATE_STAMP="$(date +'%Y%m%d-%H%M%S')"
FILE_BASENAME="pg-backup-${PGDATABASE:-db}-${DATE_STAMP}.dump"
OUTPUT_PATH="${TARGET_DIR%/}/${FILE_BASENAME}"

mkdir -p "${TARGET_DIR}"

echo "[+] Creating backup at ${OUTPUT_PATH}"
pg_dump -h "${PGHOST:?missing PGHOST}" \
    -p "${PGPORT:-5432}" \
    -U "${PGUSER:?missing PGUSER}" \
    -d "${PGDATABASE:?missing PGDATABASE}" \
    -Fc -Z9 > "${OUTPUT_PATH}"

echo "[+] Backup completed: ${OUTPUT_PATH}"
echo "[i] Restore example: pg_restore -h \$PGHOST -p \$PGPORT -U \$PGUSER -d <new_db> -c ${OUTPUT_PATH}"
