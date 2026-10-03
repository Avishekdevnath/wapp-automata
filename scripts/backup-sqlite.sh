#!/usr/bin/env bash
# ==============================================================================
# wapp-automata: Online Non-Blocking SQLite WAL Backup Script
# Uses SQLite .backup API to create a transactionally clean snapshot
# ==============================================================================
set -euo pipefail

DB_PATH="${1:-/opt/wapp-automata/data/collector.sqlite}"
BACKUP_DIR="${2:-/opt/wapp-automata/data/backups}"
RETENTION_DAYS="${3:-14}"

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/collector_backup_${TIMESTAMP}.sqlite"

if [ ! -f "${DB_PATH}" ]; then
  echo "Error: SQLite database file not found at ${DB_PATH}"
  exit 1
fi

mkdir -p "${BACKUP_DIR}"

echo "Starting online backup of ${DB_PATH} -> ${BACKUP_FILE}..."

# Execute online backup using sqlite3 CLI .backup command
# This safely coordinates with WAL mode without locking readers/writers
sqlite3 "${DB_PATH}" ".backup '${BACKUP_FILE}'"

if [ -f "${BACKUP_FILE}" ]; then
  FILE_SIZE="$(du -h "${BACKUP_FILE}" | cut -f1)"
  echo "Backup successfully created: ${BACKUP_FILE} (${FILE_SIZE})"
else
  echo "Error: Backup file was not generated"
  exit 1
fi

echo "Pruning backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -type f -name "collector_backup_*.sqlite" -mtime "+${RETENTION_DAYS}" -delete

echo "Backup routine completed successfully."
