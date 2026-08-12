#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

SCRIPT_NAME="${0##*/}"
log() { printf '[%s] %s\n' "$SCRIPT_NAME" "$*" >&2; }
die() { log "ERROR: $*"; exit 1; }
usage() {
  printf '%s\n' \
    'Usage: verify-system-backup.sh [--latest] [--full]' \
    '       verify-system-backup.sh --snapshot SNAPSHOT_ID [--full]'
}
require_command() {
  local name="$1"
  command -v "$name" >/dev/null 2>&1 || die "required command not found: $name"
}
validate_snapshot_id() {
  [[ "$1" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || die 'invalid snapshot ID'
}

MODE=latest
REQUESTED_SNAPSHOT=
FULL_CHECK=0
while (($#)); do
  case "$1" in
    --latest) MODE=latest; shift ;;
    --snapshot)
      (($# >= 2)) || die '--snapshot requires an ID'
      MODE=snapshot; REQUESTED_SNAPSHOT="$2"; shift 2 ;;
    --full) FULL_CHECK=1; shift ;;
    --help|-h) usage; exit 0 ;;
    *) usage >&2; die "unknown argument: $1" ;;
  esac
done

USER_HOME="${HOME-}"
[[ -n "$USER_HOME" ]] || die 'HOME is not set'
export PATH="$USER_HOME/.local/bin:${PATH:-}"
CONFIG_FILE="$USER_HOME/.config/server-backup/system-backup.env"
PASSWORD_FILE="$USER_HOME/.config/server-backup/restic-password"
[[ -n "${SYSTEM_BACKUP_CONFIG_FILE-}" ]] && CONFIG_FILE="$SYSTEM_BACKUP_CONFIG_FILE"
[[ -z "${SYSTEM_BACKUP_CONFIG_FILE-}" && -n "${BACKUP_CONFIG_FILE-}" ]] && CONFIG_FILE="$BACKUP_CONFIG_FILE"
[[ -n "${SYSTEM_BACKUP_PASSWORD_FILE-}" ]] && PASSWORD_FILE="$SYSTEM_BACKUP_PASSWORD_FILE"
[[ -z "${SYSTEM_BACKUP_PASSWORD_FILE-}" && -n "${BACKUP_PASSWORD_FILE-}" ]] && PASSWORD_FILE="$BACKUP_PASSWORD_FILE"

[[ "$CONFIG_FILE" == /* && -r "$CONFIG_FILE" ]] || die "configuration file is not readable: $CONFIG_FILE"
[[ "$PASSWORD_FILE" == /* && -s "$PASSWORD_FILE" ]] || die "Restic password file is missing or empty: $PASSWORD_FILE"
CONFIG_PATH="$CONFIG_FILE"
PASSWORD_PATH="$PASSWORD_FILE"
set -a
# shellcheck disable=SC1090
source "$CONFIG_PATH"
set +a
CONFIG_FILE="$CONFIG_PATH"
PASSWORD_FILE="$PASSWORD_PATH"
unset RESTIC_PASSWORD RESTIC_PASSWORD_COMMAND 2>/dev/null || true

EXPECTED_RESTIC_REPOSITORY='rclone:unifil-drive:Servidor-Eron/backup-restic'
CONFIGURED_RESTIC_REPOSITORY="${RESTIC_REPOSITORY:-$EXPECTED_RESTIC_REPOSITORY}"
CONFIGURED_PASSWORD_FILE="${RESTIC_PASSWORD_FILE:-$PASSWORD_FILE}"
[[ "$CONFIGURED_RESTIC_REPOSITORY" == "$EXPECTED_RESTIC_REPOSITORY" ]] || die 'RESTIC_REPOSITORY is not the fixed repository'
[[ "$CONFIGURED_PASSWORD_FILE" == "$PASSWORD_FILE" ]] || die 'RESTIC_PASSWORD_FILE is not the fixed password path'

RESTIC_BIN="${SYSTEM_BACKUP_RESTIC_BIN:-${RESTIC_BIN:-restic}}"
RCLONE_BIN="${SYSTEM_BACKUP_RCLONE_BIN:-${RCLONE_BIN:-rclone}}"
PYTHON_BIN="${SYSTEM_BACKUP_PYTHON_BIN:-${PYTHON_BIN:-python3}}"
PG_RESTORE_BIN="${SYSTEM_BACKUP_PG_RESTORE_BIN:-${PG_RESTORE_BIN:-}}"
DOCKER_BIN="${SYSTEM_BACKUP_DOCKER_BIN:-${DOCKER_BIN:-docker}}"
PG_RESTORE_CONTAINER="${SYSTEM_BACKUP_PG_RESTORE_CONTAINER:-${PG_RESTORE_CONTAINER:-supabase-db}}"
TMP_ROOT="${SYSTEM_BACKUP_TMPDIR:-${TMPDIR:-/tmp}}"
TMP_ROOT="${TMP_ROOT%/}"
[[ -d "$TMP_ROOT" && "$TMP_ROOT" == /* ]] || die 'temporary directory must be absolute and existing'

for name in "$RESTIC_BIN" "$RCLONE_BIN" "$PYTHON_BIN" sha256sum find sort sed head grep mktemp rm; do
  require_command "$name"
done
if [[ -n "$PG_RESTORE_BIN" ]]; then require_command "$PG_RESTORE_BIN"; else require_command "$DOCKER_BIN"; fi

restic() {
  "$RESTIC_BIN" --repo "$EXPECTED_RESTIC_REPOSITORY" --password-file "$PASSWORD_FILE" \
    -o "rclone.program=$RCLONE_BIN" "$@"
}

SNAPSHOT_ID="$REQUESTED_SNAPSHOT"
if [[ "$MODE" == latest ]]; then
  SNAPSHOT_JSON="$(restic snapshots --latest 1 --json)" || die 'unable to read latest snapshot'
  SNAPSHOT_ID="$(printf '%s\n' "$SNAPSHOT_JSON" | sed -n 's/.*"id"[[:space:]]*:[[:space:]]*"\([^"[:space:]]*\)".*/\1/p' | head -n 1)"
fi
validate_snapshot_id "$SNAPSHOT_ID"
if ((FULL_CHECK)); then
  log 'checking repository metadata and all packed data (--full)'
  restic check --read-data || die 'Restic full check failed'
else
  log 'checking repository metadata'
  restic check || die 'Restic check failed'
fi

VERIFY_ROOT="$(mktemp -d "$TMP_ROOT/system-backup-verify.XXXXXX")"
cleanup() {
  local code=$?
  trap - EXIT
  case "$VERIFY_ROOT" in
    "$TMP_ROOT"/system-backup-verify.*) rm -rf -- "$VERIFY_ROOT" || code=1 ;;
    *) log "ERROR: refusing to clean unvalidated path: $VERIFY_ROOT"; code=1 ;;
  esac
  exit "$code"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

log "restoring metadata and databases for $SNAPSHOT_ID into a temporary directory"
if ((FULL_CHECK)); then
  restic restore "$SNAPSHOT_ID" --target "$VERIFY_ROOT" ||
    die 'Restic full verification restore failed'
else
  restic restore "$SNAPSHOT_ID" --target "$VERIFY_ROOT" --include databases --include metadata ||
    die 'Restic verification restore failed'
fi

METADATA_ROOT="$VERIFY_ROOT/metadata"
DATABASE_ROOT="$VERIFY_ROOT/databases"
CHECKSUM_FILE="$METADATA_ROOT/SHA256SUMS"
INVENTORY_FILE="$METADATA_ROOT/inventory.tsv"
[[ -d "$METADATA_ROOT" && -d "$DATABASE_ROOT" ]] || die 'restored metadata/databases roots are missing'
[[ -s "$CHECKSUM_FILE" ]] || die 'metadata/SHA256SUMS is missing or empty'
[[ -s "$INVENTORY_FILE" ]] || die 'metadata/inventory.tsv is missing or empty'
for token in \
  databases/grade-app/grade_lab.db \
  databases/grade-app/volumes/grade_app_grade_data/grade_lab.db \
  databases/grade-app/volumes/grade-app_grade_data/grade_lab.db \
  databases/grade-app/hosts/Grade-App/grade_lab.db \
  databases/grade-app/hosts/grade_app/grade_lab.db; do
  grep -Fq -- "$token" "$INVENTORY_FILE" || die "inventory missing required staged Grade path: $token"
done

FILTERED_CHECKSUM_FILE="$METADATA_ROOT/SHA256SUMS.restored"
: >"$FILTERED_CHECKSUM_FILE"
CHECKSUM_LINES=0
FILTERED_CHECKSUM_LINES=0
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ -z "$line" || "$line" == \#* ]] && continue
  [[ "$line" =~ ^([[:xdigit:]]{64})[[:space:]]+(\*?)(.+)$ ]] || die 'malformed SHA256SUMS line'
  checksum_path="${BASH_REMATCH[3]}"
  checksum_path="${checksum_path%$'\r'}"
  case "$checksum_path" in ''|/*|..|../*|*/../*) die 'unsafe checksum path' ;; esac
  [[ "$checksum_path" != *$'\r'* ]] || die 'invalid checksum path'
  CHECKSUM_LINES=$((CHECKSUM_LINES + 1))
  checksum_path_without_dot="$checksum_path"
  [[ "$checksum_path_without_dot" == ./* ]] && checksum_path_without_dot="${checksum_path_without_dot#./}"
  case "$checksum_path_without_dot" in ''|/*|..|../*|*/../*|*/..) die 'unsafe checksum path' ;; esac
  case "$checksum_path_without_dot" in
    databases/*|metadata/*)
      printf '%s\n' "$line" >>"$FILTERED_CHECKSUM_FILE"
      FILTERED_CHECKSUM_LINES=$((FILTERED_CHECKSUM_LINES + 1))
      ;;
  esac
done < "$CHECKSUM_FILE"
((CHECKSUM_LINES > 0)) || die 'metadata/SHA256SUMS has no entries'
if ((FULL_CHECK)); then
  (cd "$VERIFY_ROOT" && sha256sum --strict --check "$CHECKSUM_FILE" >/dev/null) ||
    die 'full SHA256SUMS verification failed'
  log "verified all $CHECKSUM_LINES checksum entries"
else
  ((FILTERED_CHECKSUM_LINES > 0)) || die 'metadata/SHA256SUMS has no restored databases/metadata entries'
  (cd "$VERIFY_ROOT" && sha256sum --strict --check "$FILTERED_CHECKSUM_FILE" >/dev/null) ||
    die 'restored databases/metadata SHA256SUMS verification failed'
  log "verified $FILTERED_CHECKSUM_LINES restored databases/metadata checksum entries"
fi

for app_name in unifil-exams canva-api grade-app eron-dashboard mirror-legacy; do
  app_root="$DATABASE_ROOT/$app_name"
  [[ -d "$app_root" ]] || die "missing required database path: databases/$app_name"
  app_count=0
  while IFS= read -r path; do app_count=$((app_count + 1)); done < <(
    find "$app_root" -type f \( -name '*.db' -o -name '*.sqlite' -o -name '*.sqlite3' \) -print
  )
  ((app_count > 0)) || die "no SQLite file under databases/$app_name"
done

for required_grade_path in \
  "$DATABASE_ROOT/grade-app/grade_lab.db" \
  "$DATABASE_ROOT/grade-app/volumes/grade_app_grade_data/grade_lab.db" \
  "$DATABASE_ROOT/grade-app/volumes/grade-app_grade_data/grade_lab.db" \
  "$DATABASE_ROOT/grade-app/hosts/Grade-App/grade_lab.db" \
  "$DATABASE_ROOT/grade-app/hosts/grade_app/grade_lab.db"; do
  [[ -f "$required_grade_path" ]] || die "required staged Grade database is missing: $required_grade_path"
done

SQLITE_FILES=()
while IFS= read -r path; do SQLITE_FILES+=("$path"); done < <(
  find "$DATABASE_ROOT" -type f \( -name '*.db' -o -name '*.sqlite' -o -name '*.sqlite3' \) -print | LC_ALL=C sort
)
SQLITE_COUNT="${#SQLITE_FILES[@]}"
((SQLITE_COUNT > 5)) || die "expected more than five SQLite files, found $SQLITE_COUNT"
GRADE_COUNT=0
for path in "${SQLITE_FILES[@]}"; do
  [[ "$path" == "$DATABASE_ROOT/grade-app/"* ]] && GRADE_COUNT=$((GRADE_COUNT + 1))
  python_check=0
  "$PYTHON_BIN" - "$path" 2>/dev/null <<'PYTHON_INTEGRITY' || python_check=$?
import os
import sqlite3
import sys

path = os.path.abspath(sys.argv[1])
connection = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
try:
    if connection.execute("PRAGMA integrity_check;").fetchone() != ("ok",):
        raise RuntimeError("integrity check failed")
finally:
    connection.close()
PYTHON_INTEGRITY
  ((python_check == 0)) || die "SQLite integrity check failed: $path"
done
((GRADE_COUNT >= 5)) || die "expected root, volume, and host Grade SQLite files, found $GRADE_COUNT"
log "verified $SQLITE_COUNT SQLite files with Python stdlib integrity checks"

SUPABASE_ROOT="$DATABASE_ROOT/supabase"
[[ -d "$SUPABASE_ROOT" ]] || die 'missing databases/supabase'
for dump_name in postgres.dump _supabase.dump; do
  [[ -s "$SUPABASE_ROOT/$dump_name" ]] || die "missing or empty databases/supabase/$dump_name"
done
[[ -s "$SUPABASE_ROOT/globals.sql" ]] || die 'missing or empty databases/supabase/globals.sql'
DUMPS=()
while IFS= read -r path; do DUMPS+=("$path"); done < <(find "$SUPABASE_ROOT" -type f -name '*.dump' -print | LC_ALL=C sort)
DUMP_COUNT="${#DUMPS[@]}"
((DUMP_COUNT > 0)) || die 'no PostgreSQL dumps found'
for path in "${DUMPS[@]}"; do
  if [[ -n "$PG_RESTORE_BIN" ]]; then
    "$PG_RESTORE_BIN" --list "$path" >/dev/null 2>&1 || die "pg_restore --list failed: $path"
  else
    "$DOCKER_BIN" exec -i "$PG_RESTORE_CONTAINER" pg_restore --list <"$path" >/dev/null 2>&1 ||
      die "docker pg_restore --list failed: $path"
  fi
done
log "verified $DUMP_COUNT PostgreSQL dumps and nonempty globals.sql"
log "verification passed for snapshot $SNAPSHOT_ID"
