#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

SCRIPT_NAME="${0##*/}"

log() {
  printf '[%s] %s\n' "$SCRIPT_NAME" "$*" >&2
}

die() {
  log "ERROR: $*"
  exit 1
}

usage() {
  cat <<'USAGE'
Usage:
  restore-system-backup.sh --list
  restore-system-backup.sh --inspect SNAPSHOT_ID
  restore-system-backup.sh --extract SNAPSHOT_ID --target TARGET --destination ABS_PATH

Extract is staging-only. ABS_PATH must be a new or empty directory. This
command has no live-replacement mode and never stops, starts, or deletes
anything.

Allowed targets:
  unifil-exams canva-api grade-app eron-dashboard mirror-legacy
  supabase-postgres supabase-storage supabase-functions supabase-snippets
  secrets all
USAGE
}

require_command() {
  local command_name="$1"
  command -v "$command_name" >/dev/null 2>&1 || die "required command not found: $command_name"
}

validate_snapshot_id() {
  local snapshot_id="$1"

  [[ -n "$snapshot_id" ]] || die 'snapshot ID is empty'
  [[ "$snapshot_id" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || die 'invalid snapshot ID'
}

validate_target() {
  case "$1" in
    unifil-exams|canva-api|grade-app|eron-dashboard|mirror-legacy|\
    supabase-postgres|supabase-storage|supabase-functions|supabase-snippets|\
    secrets|all)
      ;;
    *)
      die "unknown target: $1"
      ;;
  esac
}

ACTION=''
SNAPSHOT_ID=''
TARGET=''
DESTINATION=''

while (($# > 0)); do
  case "$1" in
    --list)
      ACTION='list'
      shift
      ;;
    --inspect)
      (($# >= 2)) || die '--inspect requires a snapshot ID'
      ACTION='inspect'
      SNAPSHOT_ID="$2"
      shift 2
      ;;
    --extract)
      (($# >= 2)) || die '--extract requires a snapshot ID'
      ACTION='extract'
      SNAPSHOT_ID="$2"
      shift 2
      ;;
    --target)
      (($# >= 2)) || die '--target requires a target'
      TARGET="$2"
      shift 2
      ;;
    --destination)
      (($# >= 2)) || die '--destination requires an absolute path'
      DESTINATION="$2"
      shift 2
      ;;
    --replace|--live|--apply)
      die 'live replacement is not supported; use a separately confirmed manual runbook step'
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      usage >&2
      die "unknown argument: $1"
      ;;
  esac
done

[[ -n "$ACTION" ]] || {
  usage >&2
  die 'one action is required'
}

USER_HOME="${HOME:-}"
[[ -n "$USER_HOME" ]] || die 'HOME is not set'
export PATH="$USER_HOME/.local/bin:${PATH:-}"

CONFIG_FILE="${SYSTEM_BACKUP_CONFIG_FILE:-${BACKUP_CONFIG_FILE:-$USER_HOME/.config/server-backup/system-backup.env}}"
PASSWORD_FILE="${SYSTEM_BACKUP_PASSWORD_FILE:-${BACKUP_PASSWORD_FILE:-$USER_HOME/.config/server-backup/restic-password}}"

[[ "$CONFIG_FILE" == /* ]] || die 'configuration path must be absolute'
[[ "$PASSWORD_FILE" == /* ]] || die 'password path must be absolute'
[[ -f "$CONFIG_FILE" && -r "$CONFIG_FILE" ]] || die "configuration file is not readable: $CONFIG_FILE"
[[ -f "$PASSWORD_FILE" && -r "$PASSWORD_FILE" ]] || die "Restic password file is not readable: $PASSWORD_FILE"
[[ -s "$PASSWORD_FILE" ]] || die "Restic password file is empty: $PASSWORD_FILE"

CONFIG_PATH="$CONFIG_FILE"
PASSWORD_PATH="$PASSWORD_FILE"

# shellcheck disable=SC1090
set -a
source "$CONFIG_PATH"
set +a

CONFIG_FILE="$CONFIG_PATH"
PASSWORD_FILE="$PASSWORD_PATH"
unset RESTIC_PASSWORD RESTIC_PASSWORD_COMMAND 2>/dev/null || true

EXPECTED_RESTIC_REPOSITORY='rclone:unifil-drive:Servidor-Eron/backup-restic'
CONFIGURED_RESTIC_REPOSITORY="${RESTIC_REPOSITORY:-$EXPECTED_RESTIC_REPOSITORY}"
CONFIGURED_PASSWORD_FILE="${RESTIC_PASSWORD_FILE:-$PASSWORD_FILE}"
[[ "$CONFIGURED_RESTIC_REPOSITORY" == "$EXPECTED_RESTIC_REPOSITORY" ]] || die 'RESTIC_REPOSITORY must be rclone:unifil-drive:Servidor-Eron/backup-restic'
[[ "$CONFIGURED_PASSWORD_FILE" == "$PASSWORD_FILE" ]] || die "RESTIC_PASSWORD_FILE must be $PASSWORD_FILE"

RESTIC_BIN="${SYSTEM_BACKUP_RESTIC_BIN:-${RESTIC_BIN:-restic}}"
RCLONE_BIN="${SYSTEM_BACKUP_RCLONE_BIN:-${RCLONE_BIN:-rclone}}"
TMP_ROOT="${SYSTEM_BACKUP_TMPDIR:-${TMPDIR:-/tmp}}"
TMP_ROOT="${TMP_ROOT%/}"
DEFAULT_LIVE_ROOTS='/home/eronp/UniFil-Exams:/home/eronp/Canva:/home/eronp/Canva_Api:/home/eronp/canva-api:/home/eronp/mirror-server:/home/eronp/supabase-docker:/home/eronp/Grade-App:/home/eronp/grade_app:/home/eronp/mirror-pg:/home/eronp/eron-dashboard:/home/eronp/Eron_language_tool:/home/eronp/logisim-proxy'
LIVE_ROOTS_RAW="${SYSTEM_BACKUP_LIVE_ROOTS:-${BACKUP_LIVE_ROOTS:-${DEFAULT_LIVE_ROOTS}}}"

[[ -n "$TMP_ROOT" && "$TMP_ROOT" == /* && -d "$TMP_ROOT" ]] || die 'temporary directory must be an existing absolute path'
[[ -n "$LIVE_ROOTS_RAW" ]] || die 'live path protection list is empty'

for required in "$RESTIC_BIN" "$RCLONE_BIN" readlink find mkdir; do
  require_command "$required"
done

restic() {
  "$RESTIC_BIN" --repo "$EXPECTED_RESTIC_REPOSITORY" --password-file "$PASSWORD_FILE" \
    -o "rclone.program=$RCLONE_BIN" "$@"
}

case "$ACTION" in
  list)
    [[ -z "$SNAPSHOT_ID" && -z "$TARGET" && -z "$DESTINATION" ]] || die '--list cannot be combined with snapshot, target, or destination options'
    restic snapshots || die 'unable to list Restic snapshots'
    exit 0
    ;;
  inspect)
    [[ -z "$TARGET" && -z "$DESTINATION" ]] || die '--inspect cannot be combined with target or destination options'
    validate_snapshot_id "$SNAPSHOT_ID"
    log "listing snapshot contents for $SNAPSHOT_ID; file contents are not printed"
    restic ls --long "$SNAPSHOT_ID" || die 'unable to inspect Restic snapshot'
    exit 0
    ;;
  extract)
    validate_snapshot_id "$SNAPSHOT_ID"
    validate_target "$TARGET"
    [[ -n "$DESTINATION" ]] || die '--extract requires --destination ABS_PATH'
    [[ "$DESTINATION" == /* ]] || die '--destination must be an absolute path'
    DESTINATION="${DESTINATION%/}"
    [[ -n "$DESTINATION" && "$DESTINATION" != '/' ]] || die '--destination cannot be the filesystem root'
    ;;
  *)
    die 'unsupported action'
    ;;
esac

DESTINATION_CANONICAL="$(readlink -m -- "$DESTINATION")"
[[ "$DESTINATION_CANONICAL" == /* && "$DESTINATION_CANONICAL" != '/' ]] || die 'destination path is invalid'

IFS=':' read -r -a LIVE_ROOTS <<< "$LIVE_ROOTS_RAW"
for live_root in "${LIVE_ROOTS[@]}"; do
  [[ -n "$live_root" && "$live_root" == /* ]] || die 'every protected live path must be absolute'
  live_root="${live_root%/}"
  [[ -n "$live_root" && "$live_root" != '/' ]] || die 'protected live path cannot be the filesystem root'
  live_root_canonical="$(readlink -m -- "$live_root")"
  case "$DESTINATION_CANONICAL" in
    "$live_root_canonical"|"$live_root_canonical"/*)
      die "refusing a destination at or below protected live path: $live_root_canonical"
      ;;
  esac
done

case "$DESTINATION_CANONICAL" in
  /|/tmp|/var|/home|/root|/etc|/opt|/srv|/usr)
    die 'refusing a broad system directory; choose a dedicated restore staging directory'
    ;;
esac

if [[ -L "$DESTINATION" ]]; then
  die 'destination must not be a symbolic link'
fi

if [[ -e "$DESTINATION" ]]; then
  [[ -d "$DESTINATION" ]] || die 'destination exists and is not a directory'
  existing_child="$(find "$DESTINATION" -mindepth 1 -maxdepth 1 -print -quit)"
  [[ -z "$existing_child" ]] || die 'destination must be new or empty; refusing to overwrite existing data'
else
  destination_parent="${DESTINATION%/*}"
  [[ -n "$destination_parent" ]] || destination_parent='/'
  [[ -d "$destination_parent" ]] || die 'destination parent directory does not exist'
  mkdir -- "$DESTINATION" || die 'unable to create the new restore destination'
fi

INCLUDE_PATHS=()
case "$TARGET" in
  unifil-exams|canva-api|grade-app|eron-dashboard|mirror-legacy)
    INCLUDE_PATHS=("databases/$TARGET" "files/$TARGET")
    ;;
  supabase-postgres)
    INCLUDE_PATHS=(
      'databases/supabase'
      'files/supabase/api'
      'files/supabase/pooler'
      'files/supabase/db'
      'files/supabase/db-config'
    )
    ;;
  supabase-storage)
    INCLUDE_PATHS=('files/supabase/storage')
    ;;
  supabase-functions)
    INCLUDE_PATHS=('files/supabase/functions')
    ;;
  supabase-snippets)
    INCLUDE_PATHS=('files/supabase/snippets')
    ;;
  secrets)
    INCLUDE_PATHS=('secrets')
    ;;
  all)
    INCLUDE_PATHS=()
    ;;
esac

log "extracting target $TARGET from snapshot $SNAPSHOT_ID into $DESTINATION"
RESTORE_ARGS=(restore "$SNAPSHOT_ID" --target "$DESTINATION")
for include_path in "${INCLUDE_PATHS[@]}"; do
  RESTORE_ARGS+=(--include "$include_path")
done
restic "${RESTORE_ARGS[@]}" ||
  die 'Restic extraction failed; this script did not delete or replace the destination'

log 'extraction complete; no live path was modified'
