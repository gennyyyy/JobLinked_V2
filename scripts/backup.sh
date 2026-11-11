#!/usr/bin/env bash
# Nightly backup: one Postgres custom-format dump + one tarball of UPLOAD_DIR,
# written as a single timestamped directory with SHA256SUMS and a manifest.
# A dump without the uploads archive is NOT a complete backup: Postgres stores
# only relative file paths, so every resume/document would 404 after a restore.
#
#   DATABASE_URL=... UPLOAD_DIR=/srv/joblinked/uploads ./scripts/backup.sh
#
# Connection may also come from libpq PG* variables (PGHOST, PGUSER,
# PGPASSWORD/PGPASSFILE, PGDATABASE) — preferred for cron, so no password sits
# in a URL. See docs/ops/deploy-runbook.md#backups for cron and retention.
#
# Output: $BACKUP_DIR/joblinked-<UTC timestamp>/
#           db.dump        pg_dump --format=custom
#           uploads.tgz    contents of UPLOAD_DIR, rooted at the upload dir
#           manifest.txt   where the backup came from
#           SHA256SUMS     sha256 of the three files above
# The directory appears atomically: work happens in .joblinked-<stamp>.partial
# and is renamed only after integrity checks pass. Backups older than
# RETENTION_DAYS (default 30) are removed.
set -euo pipefail
umask 077

if [[ -z "${DATABASE_URL:-}" && -z "${PGDATABASE:-}" ]]; then
  echo "[backup] set DATABASE_URL or libpq PG* variables (PGDATABASE, PGHOST, ...)" >&2
  exit 1
fi
: "${UPLOAD_DIR:?set UPLOAD_DIR to the API resolved uploads directory}"

RETENTION_DAYS="${RETENTION_DAYS:-30}"
[[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]] || { echo "[backup] RETENTION_DAYS must be a number" >&2; exit 1; }

BACKUP_ROOT="${BACKUP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
STAGE="$BACKUP_ROOT/.joblinked-$STAMP.partial"
FINAL="$BACKUP_ROOT/joblinked-$STAMP"

command -v pg_dump >/dev/null 2>&1 || { echo "[backup] pg_dump not found on PATH" >&2; exit 1; }
command -v pg_restore >/dev/null 2>&1 || { echo "[backup] pg_restore not found on PATH" >&2; exit 1; }
command -v tar >/dev/null 2>&1 || { echo "[backup] tar not found on PATH" >&2; exit 1; }
command -v sha256sum >/dev/null 2>&1 || { echo "[backup] sha256sum not found on PATH" >&2; exit 1; }
[[ -d "$UPLOAD_DIR" ]] || { echo "[backup] uploads directory not found: $UPLOAD_DIR" >&2; exit 1; }
UPLOAD_DIR="$(cd "$UPLOAD_DIR" && pwd)"

[[ ! -e "$FINAL" ]] || { echo "[backup] already exists: $FINAL" >&2; exit 1; }
mkdir -p "$BACKUP_ROOT"
mkdir "$STAGE"
trap 'rm -rf "$STAGE"' EXIT

echo "[backup] dumping database -> $STAGE/db.dump"
PG_ARGS=()
if [[ -n "${DATABASE_URL:-}" ]]; then PG_ARGS+=("$DATABASE_URL"); fi
pg_dump "${PG_ARGS[@]}" --format=custom --file="$STAGE/db.dump"

echo "[backup] archiving uploads ($UPLOAD_DIR) -> $STAGE/uploads.tgz"
tar -czf "$STAGE/uploads.tgz" -C "$UPLOAD_DIR" .

{
  echo "created_utc=$STAMP"
  echo "host=$(hostname)"
  echo "upload_dir=$UPLOAD_DIR"
  echo "pg_dump=$(pg_dump --version)"
  echo "retention_days=$RETENTION_DAYS"
  echo "note=DB dump and uploads archive are one backup; restore both."
} > "$STAGE/manifest.txt"

# Cheap integrity checks: a truncated dump or tar must fail here, not on the
# night someone needs it. pg_restore --list reads the custom-format header;
# tar -tzf walks the archive.
pg_restore --list "$STAGE/db.dump" >/dev/null
tar -tzf "$STAGE/uploads.tgz" >/dev/null

(
  cd "$STAGE"
  sha256sum db.dump uploads.tgz manifest.txt > SHA256SUMS
  sha256sum -c SHA256SUMS >/dev/null
)

mv "$STAGE" "$FINAL"
trap - EXIT

# Guard the destructive cleanup: only operate on a validated, non-root directory.
if [[ "$BACKUP_ROOT" == "/" || "$BACKUP_ROOT" == "$HOME" || -z "$BACKUP_ROOT" ]]; then
  echo "[backup] refusing to clean an unsafe BACKUP_ROOT: $BACKUP_ROOT" >&2
  exit 1
fi
[[ -d "$BACKUP_ROOT" ]] || { echo "[backup] BACKUP_ROOT is not a directory: $BACKUP_ROOT" >&2; exit 1; }
find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -name 'joblinked-*' \
  -mtime +"$RETENTION_DAYS" -exec rm -rf {} +

echo "[backup] wrote $FINAL ($(du -sh "$FINAL" | cut -f1))"
sed 's/^/[backup] sha256 /' "$FINAL/SHA256SUMS"
echo "[backup] DB dump and uploads archive belong together — restore both or files 404."
