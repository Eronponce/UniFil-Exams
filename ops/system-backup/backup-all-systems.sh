#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
export LC_ALL=C

NAME=server-system-backup
TAG=server-all-systems
log() { printf '[%s] %s\n' "$NAME" "$*" >&2; }
die() { log "ERROR: $*"; exit 1; }
usage() {
  cat <<'USAGE'
Usage: backup-all-systems.sh [--dry-run]
Build the system-wide staging tree and, unless --dry-run is supplied, create
one encrypted Restic snapshot through the configured rclone backend.
USAGE
}

DRY_RUN_REQUESTED=false
case "${1:-}" in
  '') ;;
  --dry-run) DRY_RUN_REQUESTED=true ;;
  --help|-h) usage; exit 0 ;;
  *) usage >&2; die "unknown argument: $1" ;;
esac

require_command() {
  local command_name="$1"
  command -v "$command_name" >/dev/null 2>&1 || die "required command not found: $command_name"
}
require_absolute_path() {
  local label="$1" value="$2"
  [[ "$value" == /* ]] || die "$label must be an absolute path"
  [[ "$value" != *$'\n'* && "$value" != *$'\r'* ]] || die "$label must not contain newlines"
  [[ "$value" != *"/../"* && "$value" != */.. ]] || die "$label must not contain parent traversal"
}
require_container_name() {
  local label="$1" value="$2"
  [[ -n "$value" && "$value" != *[[:space:]]* && "$value" != */* ]] || die "$label is invalid"
}
require_integer() {
  local label="$1" value="$2"
  [[ "$value" =~ ^[0-9]+$ ]] || die "$label must be a non-negative integer"
}
require_directory() {
  local label="$1" path="$2"
  [[ -d "$path" ]] || die "$label not found: $path"
}

USER_HOME="${HOME:-}"
[[ -n "$USER_HOME" ]] || die "HOME is not set"
require_absolute_path HOME "$USER_HOME"
PATH="$USER_HOME/.local/bin:${PATH:-}"
export PATH
CONFIG_FILE="${BACKUP_CONFIG_FILE:-$USER_HOME/.config/server-backup/system-backup.env}"
require_absolute_path BACKUP_CONFIG_FILE "$CONFIG_FILE"
[[ -r "$CONFIG_FILE" ]] || die "configuration file is not readable: $CONFIG_FILE"
# shellcheck disable=SC1090
set -a
source "$CONFIG_FILE"
set +a
DRY_RUN="$DRY_RUN_REQUESTED"

WORK_ROOT="${BACKUP_WORK_ROOT:-/home/eronp/backups/system-wide}"
RESTIC_REPOSITORY="${RESTIC_REPOSITORY:-rclone:unifil-drive:Servidor-Eron/backup-restic}"
RESTIC_PASSWORD_FILE="${RESTIC_PASSWORD_FILE:-$USER_HOME/.config/server-backup/restic-password}"
RESTIC_BIN="${RESTIC_BIN:-restic}"
RCLONE_BIN="${RCLONE_BIN:-rclone}"
DOCKER_BIN="${DOCKER_BIN:-docker}"
PYTHON_BIN="${PYTHON_BIN:-python3}"

UNIFIL_ROOT="${UNIFIL_EXAMS_ROOT:-/home/eronp/UniFil-Exams}"
CANVA_ROOT="${CANVA_API_ROOT:-/home/eronp/Canva_Api}"
MIRROR_DB="${MIRROR_DB_PATH:-/home/eronp/mirror-server/data/mirror.db}"
SUPABASE_ROOT="${SUPABASE_ROOT:-/home/eronp/supabase-docker}"
UNIFIL_DB="${UNIFIL_EXAMS_DB_PATH:-$UNIFIL_ROOT/data/unifil-exams.db}"
CANVA_DB="${CANVA_DB_PATH:-$CANVA_ROOT/data/canvas_bulk_panel.db}"
UNIFIL_UPLOADS="${UNIFIL_UPLOADS_PATH:-$UNIFIL_ROOT/public/uploads}"
UNIFIL_GABARITOS="${UNIFIL_GABARITOS_PATH:-$UNIFIL_ROOT/public/gabaritos}"
CANVA_DATA="${CANVA_DATA_PATH:-$CANVA_ROOT/data}"

UNIFIL_CONTAINER="${UNIFIL_CONTAINER:-unifil-exams-release}"
CANVA_CONTAINER="${CANVA_CONTAINER:-canvas-bulk-panel}"
GRADE_CONTAINER="${GRADE_APP_CONTAINER:-grade-app}"
ERON_CONTAINER="${ERON_DASHBOARD_CONTAINER:-eron-dashboard}"
SUPABASE_CONTAINER="${SUPABASE_DB_CONTAINER:-supabase-db}"
GRADE_DB_PATH="${GRADE_APP_DB_PATH:-/app/grade_lab.db}"
ERON_DB_PATH="${ERON_DASHBOARD_DB_PATH:-/data/metrics.db}"
GRADE_STATE_PATH="${GRADE_APP_STATE_PATH:-/app/state.json}"
GRADE_ANALYSIS_PATH="${GRADE_APP_ANALYSIS_PATH:-/app/data_analysis}"
GRADE_VOLUME_MOUNT="${GRADE_APP_VOLUME_MOUNT:-/app}"
GRADE_ACTIVE_VOLUME="${GRADE_APP_ACTIVE_VOLUME:-grade_app_grade_data}"
GRADE_HISTORICAL_VOLUME="${GRADE_APP_HISTORICAL_VOLUME:-grade-app_grade_data}"
GRADE_APP_IMAGE="${GRADE_APP_IMAGE:-}"
GRADE_HOST_DB_PRIMARY="${GRADE_HOST_DB_PRIMARY:-/home/eronp/Grade-App/grade_lab.db}"
GRADE_HOST_DB_SECONDARY="${GRADE_HOST_DB_SECONDARY:-/home/eronp/grade_app/grade_lab.db}"
SUPABASE_DATABASE="${SUPABASE_DATABASE:-postgres}"
SUPABASE_PSQL_BIN="${SUPABASE_PSQL_BIN:-psql}"
SUPABASE_PG_DUMP_BIN="${SUPABASE_PG_DUMP_BIN:-pg_dump}"
SUPABASE_PG_DUMPALL_BIN="${SUPABASE_PG_DUMPALL_BIN:-pg_dumpall}"

SECRET_FILES="${SECRET_FILES:-}"
KEEP_DAILY="${KEEP_DAILY:-14}"
KEEP_WEEKLY="${KEEP_WEEKLY:-8}"
KEEP_MONTHLY="${KEEP_MONTHLY:-12}"
PRUNE_VALUE="${RESTIC_PRUNE:-${PRUNE:-false}}"

for path_value in \
  "$WORK_ROOT" "$RESTIC_PASSWORD_FILE" "$UNIFIL_ROOT" "$CANVA_ROOT" \
  "$MIRROR_DB" "$SUPABASE_ROOT" "$UNIFIL_DB" "$CANVA_DB" \
  "$UNIFIL_UPLOADS" "$UNIFIL_GABARITOS" "$CANVA_DATA" "$GRADE_DB_PATH" \
  "$ERON_DB_PATH" "$GRADE_STATE_PATH" "$GRADE_ANALYSIS_PATH" "$GRADE_VOLUME_MOUNT" \
  "$GRADE_HOST_DB_PRIMARY" "$GRADE_HOST_DB_SECONDARY"; do
  require_absolute_path configured_path "$path_value"
done
[[ "$WORK_ROOT" != "/" ]] || die "BACKUP_WORK_ROOT must not be the filesystem root"
WORK_ROOT="${WORK_ROOT%/}"
[[ -n "$WORK_ROOT" ]] || die "BACKUP_WORK_ROOT is empty"
[[ "$RESTIC_REPOSITORY" == rclone:* && -n "${RESTIC_REPOSITORY#rclone:}" ]] ||
  die "RESTIC_REPOSITORY must use a non-empty rclone: backend"
[[ "$RESTIC_REPOSITORY" != *[[:space:]]* ]] || die "RESTIC_REPOSITORY must not contain whitespace"
for container_name in "$UNIFIL_CONTAINER" "$CANVA_CONTAINER" "$GRADE_CONTAINER" "$ERON_CONTAINER" "$SUPABASE_CONTAINER"; do
  require_container_name container "$container_name"
done
require_container_name GRADE_ACTIVE_VOLUME "$GRADE_ACTIVE_VOLUME"
require_container_name GRADE_HISTORICAL_VOLUME "$GRADE_HISTORICAL_VOLUME"
[[ -n "$SUPABASE_DATABASE" && "$SUPABASE_DATABASE" != *[[:space:]]* ]] ||
  die "SUPABASE_DATABASE is invalid"
require_integer KEEP_DAILY "$KEEP_DAILY"
require_integer KEEP_WEEKLY "$KEEP_WEEKLY"
require_integer KEEP_MONTHLY "$KEEP_MONTHLY"
case "${PRUNE_VALUE,,}" in
  true|yes|1) PRUNE=true ;;
  false|no|0) PRUNE=false ;;
  *) die "RESTIC_PRUNE/PRUNE must be true or false" ;;
esac

if [[ -n "${BACKUP_RUN_ID:-}" ]]; then
  RUN_ID="$BACKUP_RUN_ID"
  UTC_STAMP="${RUN_ID%%-*}"
else
  UTC_STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
  HOST_FOR_RUN="$(hostname -s 2>/dev/null || hostname)"
  HOST_FOR_RUN="$(printf '%s' "$HOST_FOR_RUN" | tr -cd 'A-Za-z0-9_.-')"
  [[ -n "$HOST_FOR_RUN" ]] || die "hostname is empty or invalid"
  RUN_ID="${UTC_STAMP}-${HOST_FOR_RUN}"
fi
HOST_TAG="$(hostname -s 2>/dev/null || hostname)"
HOST_TAG="$(printf '%s' "$HOST_TAG" | tr -cd 'A-Za-z0-9_.-')"
[[ -n "$HOST_TAG" ]] || die "hostname is empty or invalid"
[[ "$UTC_STAMP" =~ ^[0-9]{8}T[0-9]{6}Z$ ]] || die "run ID must begin with a UTC timestamp"
[[ "$RUN_ID" =~ ^[0-9]{8}T[0-9]{6}Z-[A-Za-z0-9_.-]+$ ]] || die "run ID is invalid"

RUN_PARENT="$WORK_ROOT/staging"
FAILED_ROOT="$WORK_ROOT/failed"
RUN_DIR="$RUN_PARENT/$RUN_ID"
STAGING_DIR="$RUN_DIR/staging"
REMOTE_TMP="/tmp/server-backup-$RUN_ID"
HISTORY_HELPER="server-backup-${RUN_ID}-grade-history"
require_container_name HISTORY_HELPER "$HISTORY_HELPER"
STATUS_DIR="$WORK_ROOT/status"
STATUS_PATH="$STATUS_DIR/latest.env"
STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
SNAPSHOT_ID=""
BACKUP_COMPLETE=false
DRY_RUN_COMPLETE=false
ERROR_STAGE=preflight
for path_value in "$RUN_PARENT" "$FAILED_ROOT" "$RUN_DIR" "$STAGING_DIR"; do
  require_absolute_path generated_path "$path_value"
done

require_command "$DOCKER_BIN"
require_command "$PYTHON_BIN"
for command_name in date hostname tr mkdir chmod rm cp mv find sort sha256sum stat dirname flock awk; do
  require_command "$command_name"
done
if [[ "$DRY_RUN" != true ]]; then
  require_command "$RESTIC_BIN"
  require_command "$RCLONE_BIN"
  [[ -f "$RESTIC_PASSWORD_FILE" && -r "$RESTIC_PASSWORD_FILE" ]] ||
    die "Restic password file is not readable: $RESTIC_PASSWORD_FILE"
  PASSWORD_MODE="$(stat -c '%a' -- "$RESTIC_PASSWORD_FILE")"
  (( 0$PASSWORD_MODE & 077 )) && die "Restic password file must not be group/world accessible: $RESTIC_PASSWORD_FILE"
fi

mkdir -p -- "$WORK_ROOT" "$RUN_PARENT" "$FAILED_ROOT" "$STATUS_DIR"
chmod 700 -- "$WORK_ROOT" "$RUN_PARENT" "$FAILED_ROOT" "$STATUS_DIR"
LOCK_PATH="$WORK_ROOT/backup.lock"
exec 9>"$LOCK_PATH"
flock -n 9 || die "another system-wide backup is already running (lock: $LOCK_PATH)"

RETAIN_RUN=false
CONTAINER_CLEANUP=false
HISTORY_HELPER_CREATED=false
RUN_DIR_CREATED=false
write_status() {
  local result="$1"
  local finished_at="$2"
  local snapshot_id="$3"
  local error_stage="$4"
  local temporary_status="$STATUS_DIR/.latest.env.$RUN_ID.tmp"

  if ! {
    {
      printf 'RESULT=%s\n' "$result"
      printf 'STARTED_AT=%s\n' "$STARTED_AT"
      printf 'FINISHED_AT=%s\n' "$finished_at"
      printf 'SNAPSHOT_ID=%s\n' "$snapshot_id"
      printf 'RUN_ID=%s\n' "$RUN_ID"
      printf 'ERROR_STAGE=%s\n' "$error_stage"
    } > "$temporary_status"
    chmod 600 -- "$temporary_status"
    mv -f -- "$temporary_status" "$STATUS_PATH"
  }; then
    log "WARNING: failed to atomically write health status: $STATUS_PATH"
    return 1
  fi
}
cleanup_container_snapshots() {
  local container_name
  [[ "$CONTAINER_CLEANUP" == true ]] || return 0
  for container_name in "$GRADE_CONTAINER" "$ERON_CONTAINER"; do
    "$DOCKER_BIN" exec "$container_name" rm -rf -- "$REMOTE_TMP" >/dev/null 2>&1 ||
      log "WARNING: failed to remove only temporary container path $container_name:$REMOTE_TMP"
  done
  if [[ "$HISTORY_HELPER_CREATED" == true ]]; then
    "$DOCKER_BIN" rm -f "$HISTORY_HELPER" >/dev/null 2>&1 ||
      log "WARNING: failed to remove only the temporary helper container $HISTORY_HELPER"
  fi
}
cleanup_run_directory() {
  local path_to_remove="$1"
  [[ "$path_to_remove" == "$RUN_PARENT"/* ]] || return 1
  [[ "${path_to_remove#"$RUN_PARENT/"}" != */* ]] || return 1
  rm -rf -- "$path_to_remove"
}
cleanup() {
  local exit_code=$?
  local failed_target
  local finished_at
  trap - EXIT
  cleanup_container_snapshots
if [[ "$RUN_DIR_CREATED" == true && -n "${RUN_DIR:-}" && -d "$RUN_DIR" ]]; then
    if [[ "$RETAIN_RUN" == true ]]; then
      failed_target="$FAILED_ROOT/${RUN_DIR##*/}"
      if [[ -e "$failed_target" ]]; then
        log "ERROR: refusing to overwrite existing failed run directory: $failed_target"
        exit_code=1
      elif ! mv -- "$RUN_DIR" "$failed_target"; then
        log "ERROR: failed to retain failed staging at: $failed_target"
        exit_code=1
      else
        log "retained failed staging: $failed_target"
      fi
    elif ! cleanup_run_directory "$RUN_DIR"; then
      log "ERROR: refusing to clean the exact run directory: $RUN_DIR"
      ERROR_STAGE=cleanup
      exit_code=1
    fi
  fi
  finished_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  if [[ "$BACKUP_COMPLETE" == true && "$exit_code" -eq 0 ]]; then
    write_status success "$finished_at" "$SNAPSHOT_ID" "" || exit_code=1
  elif [[ "$DRY_RUN_COMPLETE" == true && "$exit_code" -eq 0 ]]; then
    write_status dry-run "$finished_at" "" "" || exit_code=1
  elif [[ "$exit_code" -ne 0 ]]; then
    write_status failure "$finished_at" "$SNAPSHOT_ID" "$ERROR_STAGE" || exit_code=1
  fi
  rm -f -- "$STATUS_DIR/.latest.env.$RUN_ID.tmp" 2>/dev/null || true
  exit "$exit_code"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
write_status running "" "" "" || die "could not write initial health status"

[[ ! -e "$RUN_DIR" ]] || die "backup run directory already exists: $RUN_DIR"
mkdir -- "$RUN_DIR"
RUN_DIR_CREATED=true
mkdir -p -- \
  "$STAGING_DIR/databases/unifil-exams" \
  "$STAGING_DIR/databases/canva-api" \
  "$STAGING_DIR/databases/grade-app" \
  "$STAGING_DIR/databases/eron-dashboard" \
  "$STAGING_DIR/databases/mirror-legacy" \
  "$STAGING_DIR/databases/supabase" \
  "$STAGING_DIR/files/unifil-exams/uploads" \
  "$STAGING_DIR/files/unifil-exams/gabaritos" \
  "$STAGING_DIR/files/canva-api/data" \
  "$STAGING_DIR/files/grade-app" \
  "$STAGING_DIR/files/supabase/storage" \
  "$STAGING_DIR/files/supabase/functions" \
  "$STAGING_DIR/files/supabase/snippets" \
  "$STAGING_DIR/secrets" "$STAGING_DIR/metadata" "$RUN_DIR/tmp"
chmod 700 -- "$RUN_DIR" "$STAGING_DIR" "$RUN_DIR/tmp"

require_running() {
  local container_name="$1" state
  state="$("$DOCKER_BIN" inspect --format '{{.State.Running}}' "$container_name" 2>/dev/null || true)"
  [[ "$state" == true ]] || die "Docker container is not running: $container_name"
}
verify_active_grade_volume() {
  local mount_info
  mount_info="$("$DOCKER_BIN" inspect --format '{{json .Mounts}}' "$GRADE_CONTAINER" 2>/dev/null || true)"
  [[ "$mount_info" == *"$GRADE_ACTIVE_VOLUME"* ]] ||
    die "active Grade volume is not mounted on $GRADE_CONTAINER: $GRADE_ACTIVE_VOLUME"
  log "verified active Grade volume: $GRADE_ACTIVE_VOLUME"
}

sqlite_backup_python='
import os
import sqlite3
import sys
source_path, destination_path = sys.argv[1:3]
os.makedirs(os.path.dirname(destination_path), mode=0o700, exist_ok=True)
if os.path.exists(destination_path):
    raise SystemExit("refusing to overwrite an existing SQLite snapshot")
source = sqlite3.connect(f"file:{source_path}?mode=ro", uri=True)
destination = sqlite3.connect(destination_path)
try:
    source.backup(destination)
    result = destination.execute("PRAGMA integrity_check").fetchone()
    if not result or result[0] != "ok":
        raise SystemExit("SQLite snapshot integrity check failed")
finally:
    destination.close()
    source.close()
'

copy_host_sqlite() {
  local label="$1" source_path="$2" destination_path="$3"
  local local_snapshot="$RUN_DIR/tmp/${label}.db"
  [[ -f "$source_path" ]] || die "$label SQLite database not found: $source_path"
  log "creating online SQLite backup for $label"
  if ! printf '%s\n' "$sqlite_backup_python" | "$PYTHON_BIN" - "$source_path" "$local_snapshot"; then
    die "online SQLite backup failed for $label"
  fi
  [[ -s "$local_snapshot" ]] || die "online SQLite backup produced no snapshot for $label"
  cp -- "$local_snapshot" "$destination_path"
}

copy_container_sqlite() {
  local label="$1" container_name="$2" source_path="$3" destination_path="$4"
  local remote_path="$REMOTE_TMP/${label}.db"
  local local_snapshot="$RUN_DIR/tmp/${label}.db"
  CONTAINER_CLEANUP=true
  log "creating online SQLite backup for $label in container $container_name"
  if ! printf '%s\n' "$sqlite_backup_python" |
    "$DOCKER_BIN" exec -i "$container_name" python3 - "$source_path" "$remote_path"; then
    die "online SQLite backup failed for $label"
  fi
  [[ ! -e "$local_snapshot" ]] || die "refusing to overwrite local container snapshot for $label"
  "$DOCKER_BIN" cp "$container_name:$remote_path" "$local_snapshot" ||
    die "docker cp failed for $label"
  [[ -s "$local_snapshot" ]] || die "container SQLite backup produced no snapshot for $label"
  cp -- "$local_snapshot" "$destination_path"
}

prepare_historical_grade_volume() {
  local image
  if [[ -n "$GRADE_APP_IMAGE" ]]; then
    image="$GRADE_APP_IMAGE"
  else
    image="$("$DOCKER_BIN" inspect --format '{{.Config.Image}}' "$GRADE_CONTAINER" 2>/dev/null || true)"
    [[ -n "$image" ]] || die "could not determine the grade-app image for the historical volume"
  fi
  log "starting temporary helper for historical Grade volume $GRADE_HISTORICAL_VOLUME"
  "$DOCKER_BIN" create \
    --name "$HISTORY_HELPER" \
    --mount "type=volume,source=$GRADE_HISTORICAL_VOLUME,destination=$GRADE_VOLUME_MOUNT,readonly" \
    "$image" sleep infinity >/dev/null ||
    die "could not create the historical Grade volume helper"
  HISTORY_HELPER_CREATED=true
  "$DOCKER_BIN" start "$HISTORY_HELPER" >/dev/null ||
    die "could not start the historical Grade volume helper"
}

copy_container_optional() {
  local label="$1" container_name="$2" source_path="$3" destination_path="$4"
  local probe_status
  if "$DOCKER_BIN" exec "$container_name" test -e "$source_path" >/dev/null 2>&1; then
    if "$DOCKER_BIN" exec "$container_name" test -d "$source_path" >/dev/null 2>&1; then
      mkdir -p -- "${destination_path%/*}"
      [[ ! -e "$destination_path" ]] || die "refusing to overwrite optional directory for $label"
      "$DOCKER_BIN" cp "$container_name:$source_path" "$destination_path" ||
        die "docker cp failed for optional $label"
      [[ -d "$destination_path" ]] || die "optional directory copy produced no directory for $label"
    else
      mkdir -p -- "${destination_path%/*}"
      [[ ! -e "$destination_path" ]] || die "refusing to overwrite optional file for $label"
      "$DOCKER_BIN" cp "$container_name:$source_path" "$destination_path" ||
        die "docker cp failed for optional $label"
      [[ -f "$destination_path" ]] || die "optional file copy produced no file for $label"
    fi
  else
    probe_status=$?
    [[ "$probe_status" -eq 1 ]] && log "optional path missing: $source_path" ||
      die "unable to inspect optional path in $container_name: $source_path"
  fi
}

copy_directory() {
  local label="$1" source_directory="$2" destination_directory="$3"
  require_directory "$label source directory" "$source_directory"
  mkdir -p -- "$destination_directory"
  cp -a -- "$source_directory/." "$destination_directory/"
}

copy_top_level_regular_files() {
  local label="$1" source_directory="$2" destination_directory="$3"
  local source_path file_name destination_path
  require_directory "$label source directory" "$source_directory"
  mkdir -p -- "$destination_directory"
  while IFS= read -r -d '' source_path; do
    file_name="${source_path##*/}"
    destination_path="$destination_directory/$file_name"
    [[ ! -e "$destination_path" ]] || die "duplicate static Supabase file: $destination_path"
    cp -a -- "$source_path" "$destination_path"
  done < <(
    find "$source_directory" -mindepth 1 -maxdepth 1 -type f -print0 | sort -z
  )
}

copy_container_directory_required() {
  local label="$1" container_name="$2" source_path="$3" destination_path="$4"
  "$DOCKER_BIN" exec "$container_name" test -d "$source_path" >/dev/null 2>&1 ||
    die "$label not found in container $container_name: $source_path"
  mkdir -p -- "${destination_path%/*}"
  [[ ! -e "$destination_path" ]] || die "refusing to overwrite $label"
  "$DOCKER_BIN" cp "$container_name:$source_path" "$destination_path" ||
    die "docker cp failed for $label"
  [[ -d "$destination_path" ]] || die "$label copy produced no directory"
}

copy_canva_data() {
  local source_directory="$1" destination_directory="$2"
  local relative_path source_path destination_path base_name
  require_directory "Canva data source directory" "$source_directory"
  while IFS= read -r -d '' relative_path; do
    relative_path="${relative_path#./}"
    base_name="${relative_path##*/}"
    case "$base_name" in
      canvas_bulk_panel.db|canvas_bulk_panel.db-wal|canvas_bulk_panel.db-shm) continue ;;
    esac
    source_path="$source_directory/$relative_path"
    destination_path="$destination_directory/$relative_path"
    if [[ -L "$source_path" ]]; then
      die "symbolic links are not allowed in Canva data: $source_path"
    elif [[ -d "$source_path" ]]; then
      mkdir -p -- "$destination_path"
    elif [[ -f "$source_path" ]]; then
      mkdir -p -- "${destination_path%/*}"
      cp -a -- "$source_path" "$destination_path"
    else
      die "unsupported Canva data entry: $source_path"
    fi
  done < <(cd -- "$source_directory" && find . -mindepth 1 -print0 | sort -z)
}

copy_secrets() {
  local secret_path secret_relative destination_path
  while IFS= read -r secret_path || [[ -n "$secret_path" ]]; do
    [[ -n "$secret_path" ]] || continue
    require_absolute_path SECRET_FILES_entry "$secret_path"
    if [[ ! -e "$secret_path" ]]; then
      log "optional secret missing: $secret_path"
      continue
    fi
    [[ -f "$secret_path" && ! -L "$secret_path" ]] ||
      die "SECRET_FILES entry is not a regular file: $secret_path"
    secret_relative="${secret_path#/}"
    [[ -n "$secret_relative" && "$secret_relative" != ../* && "$secret_relative" != */../* ]] ||
      die "SECRET_FILES entry has unsafe relative form: $secret_path"
    destination_path="$STAGING_DIR/secrets/$secret_relative"
    [[ ! -e "$destination_path" ]] || die "duplicate secret path in SECRET_FILES: $secret_path"
    mkdir -p -- "${destination_path%/*}"
    cp -- "$secret_path" "$destination_path"
    chmod 600 -- "$destination_path"
  done <<< "$SECRET_FILES"
}

write_metadata() {
  local path="$STAGING_DIR/metadata/run.env"
  {
    printf 'BACKUP_FORMAT_VERSION=1\n'
    printf 'RUN_ID=%s\n' "$RUN_ID"
    printf 'HOST_TAG=%s\n' "$HOST_TAG"
    printf 'SNAPSHOT_TAG=%s\n' "$TAG"
    printf 'RESTIC_BACKEND=rclone\n'
    printf 'DRY_RUN=%s\n' "$DRY_RUN"
    printf 'INCLUDED_ROOT=.\n'
    printf 'GRADE_ACTIVE_VOLUME=%s\n' "$GRADE_ACTIVE_VOLUME"
    printf 'GRADE_HISTORICAL_VOLUME=%s\n' "$GRADE_HISTORICAL_VOLUME"
    printf 'GRADE_HOST_DB_PRIMARY=%s\n' "$GRADE_HOST_DB_PRIMARY"
    printf 'GRADE_HOST_DB_SECONDARY=%s\n' "$GRADE_HOST_DB_SECONDARY"
  } > "$path"
  chmod 600 -- "$path"
}
file_digest() {
  local digest_line
  digest_line="$(sha256sum -- "$1")"
  printf '%s' "${digest_line%% *}"
}
write_inventory() {
  local inventory="$STAGING_DIR/metadata/inventory.tsv"
  local entry relative size digest
  {
    printf 'path\ttype\tsize_bytes\tsha256\n'
    while IFS= read -r -d '' entry; do
      relative="${entry#"$STAGING_DIR/"}"
      if [[ -d "$entry" && ! -L "$entry" ]]; then
        printf '%s\tdirectory\t\t\n' "$relative"
      elif [[ -f "$entry" && ! -L "$entry" ]]; then
        size="$(stat -c '%s' -- "$entry")"
        digest="$(file_digest "$entry")"
        printf '%s\tfile\t%s\t%s\n' "$relative" "$size" "$digest"
      else
        die "unsupported staging entry: $entry"
      fi
    done < <(
      find "$STAGING_DIR" -mindepth 1 \
        ! -path "$STAGING_DIR/metadata/inventory.tsv" \
        ! -path "$STAGING_DIR/metadata/SHA256SUMS" -print0 | sort -z
    )
  } > "$inventory"
  chmod 600 -- "$inventory"
}
write_checksums() {
  local sums="$STAGING_DIR/metadata/SHA256SUMS"
  local entry relative digest
  while IFS= read -r -d '' entry; do
    relative="${entry#"$STAGING_DIR/"}"
    digest="$(file_digest "$entry")"
    printf '%s  %s\n' "$digest" "$relative"
  done < <(
    find "$STAGING_DIR" -type f ! -path "$STAGING_DIR/metadata/SHA256SUMS" -print0 | sort -z
  ) > "$sums"
  chmod 600 -- "$sums"
}
print_inventory() {
  local relative entry_type
  while IFS=$'\t' read -r relative entry_type _; do
    [[ "$relative" == path ]] || log "dry-run include: $relative"
  done < "$STAGING_DIR/metadata/inventory.tsv"
}
extract_snapshot_id() {
  "$PYTHON_BIN" - "$1" <<'PY'
import json
import sys

snapshot_id = ""
with open(sys.argv[1], encoding="utf-8") as stream:
    for line in stream:
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        if event.get("message_type") == "summary" and event.get("snapshot_id"):
            snapshot_id = str(event["snapshot_id"])
if not snapshot_id:
    raise SystemExit(1)
print(snapshot_id)
PY
}
ensure_restic_repository() {
  local check_status
  local check_error
  ERROR_STAGE=repository-check
  if "$RESTIC_BIN" "${RESTIC_ARGS[@]}" --no-cache snapshots \
    > "$RUN_DIR/tmp/restic-repository-check.out" \
    2> "$RUN_DIR/tmp/restic-repository-check.err"; then
    return 0
  else
    check_status=$?
  fi
  check_error="$(<"$RUN_DIR/tmp/restic-repository-check.err")"
  if [[ "$check_status" -eq 10 ]] || {
    [[ "$check_status" -eq 1 ]] &&
      [[ "$check_error" == *'unable to open config file: <config/> does not exist'* ]] &&
      [[ "$check_error" == *'Is there a repository at the following location?'* ]]
  }; then
    ERROR_STAGE=repository-init
    log "Restic repository is absent; initializing the encrypted repository"
    "$RESTIC_BIN" "${RESTIC_ARGS[@]}" init \
      > "$RUN_DIR/tmp/restic-init.out" \
      2> "$RUN_DIR/tmp/restic-init.err" ||
      die "Restic repository initialization failed"
  else
    die "Restic repository check failed with status $check_status; refusing to initialize"
  fi
}

for container_name in "$GRADE_CONTAINER" "$ERON_CONTAINER" "$SUPABASE_CONTAINER"; do
  require_running "$container_name"
done
verify_active_grade_volume
require_directory "UniFil Exams root" "$UNIFIL_ROOT"
require_directory "Canva API root" "$CANVA_ROOT"
require_directory "Supabase root" "$SUPABASE_ROOT"

copy_host_sqlite unifil-exams "$UNIFIL_DB" "$STAGING_DIR/databases/unifil-exams/unifil-exams.db"
copy_host_sqlite canva-api "$CANVA_DB" "$STAGING_DIR/databases/canva-api/canvas_bulk_panel.db"
copy_container_sqlite grade-app "$GRADE_CONTAINER" "$GRADE_DB_PATH" "$STAGING_DIR/databases/grade-app/grade_lab.db"
mkdir -p -- \
  "$STAGING_DIR/databases/grade-app/volumes/$GRADE_ACTIVE_VOLUME" \
  "$STAGING_DIR/databases/grade-app/volumes/$GRADE_HISTORICAL_VOLUME" \
  "$STAGING_DIR/databases/grade-app/hosts/Grade-App" \
  "$STAGING_DIR/databases/grade-app/hosts/grade_app"
copy_container_sqlite grade-active-volume "$GRADE_CONTAINER" "$GRADE_DB_PATH" \
  "$STAGING_DIR/databases/grade-app/volumes/$GRADE_ACTIVE_VOLUME/grade_lab.db"
prepare_historical_grade_volume
copy_container_sqlite grade-historical-volume "$HISTORY_HELPER" "$GRADE_VOLUME_MOUNT/grade_lab.db" \
  "$STAGING_DIR/databases/grade-app/volumes/$GRADE_HISTORICAL_VOLUME/grade_lab.db"
copy_host_sqlite grade-host-Grade-App "$GRADE_HOST_DB_PRIMARY" \
  "$STAGING_DIR/databases/grade-app/hosts/Grade-App/grade_lab.db"
copy_host_sqlite grade-host-grade_app "$GRADE_HOST_DB_SECONDARY" \
  "$STAGING_DIR/databases/grade-app/hosts/grade_app/grade_lab.db"
copy_container_sqlite eron-dashboard "$ERON_CONTAINER" "$ERON_DB_PATH" "$STAGING_DIR/databases/eron-dashboard/metrics.db"
copy_host_sqlite mirror-legacy "$MIRROR_DB" "$STAGING_DIR/databases/mirror-legacy/mirror.db"

ERROR_STAGE=supabase-dumps
SUPABASE_DB_QUERY='SELECT datname FROM pg_database WHERE datallowconn AND NOT datistemplate ORDER BY datname'
SUPABASE_DB_LIST="$("$DOCKER_BIN" exec "$SUPABASE_CONTAINER" "$SUPABASE_PSQL_BIN" \
  -U postgres --dbname=postgres -Atqc "$SUPABASE_DB_QUERY")" ||
  die "could not enumerate connectable Supabase databases"
SUPABASE_DB_NAMES=()
while IFS= read -r database_name; do
  [[ -n "$database_name" ]] || continue
  [[ "$database_name" != *$'\t'* && "$database_name" != *$'\r'* && "$database_name" != *$'\n'* ]] ||
    die "Supabase database name cannot be represented safely: $database_name"
  SUPABASE_DB_NAMES+=("$database_name")
done <<< "$SUPABASE_DB_LIST"
[[ "${#SUPABASE_DB_NAMES[@]}" -gt 0 ]] || die "Supabase database enumeration returned no connectable databases"

SUPABASE_DB_INDEX="$STAGING_DIR/metadata/supabase-databases.tsv"
printf 'database_name\tstaged_dump\n' > "$SUPABASE_DB_INDEX"
database_dump_filename() {
  local database_name="$1"
  local digest
  case "$database_name" in
    postgres|_supabase)
      printf '%s.dump' "$database_name"
      ;;
    *)
      digest="$(printf '%s' "$database_name" | sha256sum | awk '{print $1}')"
      printf 'db-%s.dump' "$digest"
      ;;
  esac
}
for database_name in "${SUPABASE_DB_NAMES[@]}"; do
  dump_filename="$(database_dump_filename "$database_name")"
  dump_path="$STAGING_DIR/databases/supabase/$dump_filename"
  [[ ! -e "$dump_path" ]] || die "Supabase dump filename collision: $dump_filename"
  log "creating Supabase custom-format dump for database $database_name"
  "$DOCKER_BIN" exec "$SUPABASE_CONTAINER" "$SUPABASE_PG_DUMP_BIN" \
    -U postgres --format=custom --dbname="$database_name" > "$dump_path" ||
    die "Supabase pg_dump failed for database $database_name"
  [[ -s "$dump_path" ]] || die "Supabase pg_dump produced no dump for database $database_name"
  chmod 600 -- "$dump_path"
  printf '%s\tdatabases/supabase/%s\n' "$database_name" "$dump_filename" >> "$SUPABASE_DB_INDEX"
done
chmod 600 -- "$SUPABASE_DB_INDEX"
log "creating Supabase globals SQL dump"
"$DOCKER_BIN" exec "$SUPABASE_CONTAINER" "$SUPABASE_PG_DUMPALL_BIN" -U postgres --globals-only \
  > "$STAGING_DIR/databases/supabase/globals.sql" || die "Supabase pg_dumpall --globals-only failed"
[[ -s "$STAGING_DIR/databases/supabase/globals.sql" ]] || die "Supabase globals dump is empty"
chmod 600 -- "$STAGING_DIR/databases/supabase/globals.sql"

copy_directory UniFil-uploads "$UNIFIL_UPLOADS" "$STAGING_DIR/files/unifil-exams/uploads"
copy_directory UniFil-gabaritos "$UNIFIL_GABARITOS" "$STAGING_DIR/files/unifil-exams/gabaritos"
mkdir -p -- "$STAGING_DIR/files/canva-api/data"
copy_canva_data "$CANVA_DATA" "$STAGING_DIR/files/canva-api/data"
copy_container_optional grade-state "$GRADE_CONTAINER" "$GRADE_STATE_PATH" "$STAGING_DIR/files/grade-app/state.json"
copy_container_optional grade-analysis "$GRADE_CONTAINER" "$GRADE_ANALYSIS_PATH" "$STAGING_DIR/files/grade-app/data_analysis"
copy_container_optional grade-historical-state "$HISTORY_HELPER" "$GRADE_STATE_PATH" \
  "$STAGING_DIR/files/grade-app/volumes/$GRADE_HISTORICAL_VOLUME/state.json"
copy_container_optional grade-historical-analysis "$HISTORY_HELPER" "$GRADE_ANALYSIS_PATH" \
  "$STAGING_DIR/files/grade-app/volumes/$GRADE_HISTORICAL_VOLUME/data_analysis"
copy_directory Supabase-storage "$SUPABASE_ROOT/volumes/storage" "$STAGING_DIR/files/supabase/storage"
copy_directory Supabase-functions "$SUPABASE_ROOT/volumes/functions" "$STAGING_DIR/files/supabase/functions"
copy_directory Supabase-snippets "$SUPABASE_ROOT/volumes/snippets" "$STAGING_DIR/files/supabase/snippets"
copy_directory Supabase-api "$SUPABASE_ROOT/volumes/api" "$STAGING_DIR/files/supabase/api"
copy_directory Supabase-pooler "$SUPABASE_ROOT/volumes/pooler" "$STAGING_DIR/files/supabase/pooler"
copy_top_level_regular_files Supabase-db-static "$SUPABASE_ROOT/volumes/db" "$STAGING_DIR/files/supabase/db"
copy_container_directory_required Supabase-db-config "$SUPABASE_CONTAINER" \
  /etc/postgresql-custom "$STAGING_DIR/files/supabase/db-config"
copy_secrets
write_metadata
write_inventory
write_checksums

if [[ "$DRY_RUN" == true ]]; then
  print_inventory
  DRY_RUN_COMPLETE=true
  ERROR_STAGE=
  log "dry-run complete; no Restic or rclone operation was attempted"
  exit 0
fi

ERROR_STAGE=rclone-check
"$RCLONE_BIN" version >/dev/null 2>&1 || die "rclone executable failed its local version check"
RESTIC_ARGS=(--repo "$RESTIC_REPOSITORY" --password-file "$RESTIC_PASSWORD_FILE" -o "rclone.program=$RCLONE_BIN")
ensure_restic_repository
log "creating one encrypted Restic snapshot through rclone"
ERROR_STAGE=backup
RETAIN_RUN=true
if ! (
  cd -- "$STAGING_DIR"
  "$RESTIC_BIN" "${RESTIC_ARGS[@]}" backup --json --one-file-system --tag "$TAG" \
    --host "$HOST_TAG" .
) > "$RUN_DIR/tmp/restic-backup.jsonl"; then
  die "Restic upload failed; staging will be retained under $FAILED_ROOT"
fi
RETAIN_RUN=false
if ! SNAPSHOT_ID="$(extract_snapshot_id "$RUN_DIR/tmp/restic-backup.jsonl")"; then
  die "Restic backup returned no snapshot ID"
fi
[[ "$SNAPSHOT_ID" =~ ^[0-9A-Fa-f]+$ ]] || die "Restic returned an invalid snapshot ID"
FORGET_ARGS=(forget --tag "$TAG" --host "$HOST_TAG" --keep-daily "$KEEP_DAILY" --keep-weekly "$KEEP_WEEKLY" --keep-monthly "$KEEP_MONTHLY")
[[ "$PRUNE" == true ]] && FORGET_ARGS+=(--prune)
log "applying Restic retention policy"
ERROR_STAGE=retention
"$RESTIC_BIN" "${RESTIC_ARGS[@]}" "${FORGET_ARGS[@]}" || die "Restic retention policy failed"
BACKUP_COMPLETE=true
ERROR_STAGE=
log "system-wide backup complete: run $RUN_ID"
exit 0
