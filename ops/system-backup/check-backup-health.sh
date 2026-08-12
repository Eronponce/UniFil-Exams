#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

usage() {
  cat <<'USAGE'
Usage: check-backup-health.sh [--max-age-hours HOURS]

Checks the latest system-backup status file and, when configured, the latest
Restic snapshot. The default maximum successful-run age is 30 hours.
USAGE
}

health_fail() {
  printf 'STATUS: %s\n' "$1"
  printf 'DETAIL: %s\n' "$2"
  exit 1
}

MAX_AGE_HOURS="30"
while (($# > 0)); do
  case "$1" in
    --max-age-hours)
      (($# >= 2)) || { printf '%s\n' 'ERROR: --max-age-hours requires a number' >&2; exit 2; }
      MAX_AGE_HOURS="$2"
      shift
      ;;
    --max-age-hours=*)
      MAX_AGE_HOURS="${1#--max-age-hours=}"
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      printf 'ERROR: unknown argument: %s\n' "$1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

[[ "$MAX_AGE_HOURS" =~ ^[0-9]+([.][0-9]+)?$ ]] || {
  printf '%s\n' 'ERROR: --max-age-hours must be a non-negative number' >&2
  exit 2
}
MAX_AGE_SECONDS="$(awk -v hours="$MAX_AGE_HOURS" 'BEGIN { printf "%.0f", hours * 3600 }')"
[[ "$MAX_AGE_SECONDS" =~ ^[0-9]+$ ]] || {
  printf '%s\n' 'ERROR: could not calculate max age'
  exit 2
}

USER_HOME="${HOME:-}"
[[ -n "$USER_HOME" && "$USER_HOME" == /* ]] || {
  printf '%s\n' 'ERROR: HOME must be an absolute path' >&2
  exit 2
}
PATH="$USER_HOME/.local/bin:${PATH:-}"
export PATH

STATUS_FILE="${SYSTEM_BACKUP_STATUS_FILE:-${BACKUP_STATUS_FILE:-$USER_HOME/backups/system-wide/status/latest.env}}"
CONFIG_FILE="${SYSTEM_BACKUP_CONFIG_FILE:-$USER_HOME/.config/server-backup/system-backup.env}"
PASSWORD_FILE="${RESTIC_PASSWORD_FILE:-$USER_HOME/.config/server-backup/restic-password}"
[[ "$STATUS_FILE" == /* && "$CONFIG_FILE" == /* && "$PASSWORD_FILE" == /* ]] || {
  printf '%s\n' 'ERROR: health paths must be absolute' >&2
  exit 2
}

if [[ ! -e "$STATUS_FILE" ]]; then
  printf 'STATUS: never-run\n'
  printf 'DETAIL: status file does not exist\n'
  exit 1
fi
[[ -r "$STATUS_FILE" ]] || health_fail failed 'status file is not readable'

read_env_value() {
  local wanted_key="$1"
  local file_path="$2"
  local key
  local value

  while IFS='=' read -r key value || [[ -n "$key" || -n "$value" ]]; do
    key="${key%$'\r'}"
    value="${value%$'\r'}"
    if [[ "$key" == "$wanted_key" ]]; then
      case "$value" in
        "'"*"'") value="${value:1:${#value}-2}" ;;
        '"'*'"') value="${value:1:${#value}-2}" ;;
      esac
      printf '%s' "$value"
      return 0
    fi
  done < "$file_path"

  return 1
}

RESULT="$(read_env_value RESULT "$STATUS_FILE" 2>/dev/null || true)"
FINISHED_AT="$(read_env_value FINISHED_AT "$STATUS_FILE" 2>/dev/null || true)"
ERROR_STAGE="$(read_env_value ERROR_STAGE "$STATUS_FILE" 2>/dev/null || true)"

case "${RESULT,,}" in
  success|succeeded|ok|healthy|complete|completed)
    ;;
  *)
    if [[ "$ERROR_STAGE" =~ ^[A-Za-z0-9_.:-]+$ && -n "$ERROR_STAGE" ]]; then
      health_fail failed "engine result failed at ${ERROR_STAGE}"
    fi
    health_fail failed 'engine result is not successful'
    ;;
esac

parse_timestamp() {
  local timestamp="$1"
  local epoch

  [[ -n "$timestamp" ]] || return 1
  if ! epoch="$(date -u -d "$timestamp" +%s 2>/dev/null)"; then
    return 1
  fi
  [[ "$epoch" =~ ^[0-9]+$ ]] || return 1
  printf '%s' "$epoch"
}

FINISHED_EPOCH="$(parse_timestamp "$FINISHED_AT" 2>/dev/null || true)"
[[ -n "$FINISHED_EPOCH" ]] || health_fail failed 'FINISHED_AT is missing or invalid'

NOW_EPOCH="$(date -u +%s)"
AGE_SECONDS=$((NOW_EPOCH - FINISHED_EPOCH))
((AGE_SECONDS < 0)) && AGE_SECONDS=0
if ((AGE_SECONDS > MAX_AGE_SECONDS)); then
  printf 'STATUS: stale\n'
  printf 'DETAIL: last successful run is older than %.2f hours\n' "$MAX_AGE_HOURS"
  exit 1
fi

TEMP_RESTIC_OUTPUT=""
TEMP_RESTIC_ERROR=""
cleanup_temporary_files() {
  local exit_code=$?

  if [[ -n "$TEMP_RESTIC_OUTPUT" && -e "$TEMP_RESTIC_OUTPUT" ]]; then
    rm -f -- "$TEMP_RESTIC_OUTPUT" || exit_code=1
  fi
  if [[ -n "$TEMP_RESTIC_ERROR" && -e "$TEMP_RESTIC_ERROR" ]]; then
    rm -f -- "$TEMP_RESTIC_ERROR" || exit_code=1
  fi

  exit "$exit_code"
}
trap cleanup_temporary_files EXIT

RESTIC_STATE="skipped"
if [[ -e "$CONFIG_FILE" ]]; then
  [[ -r "$CONFIG_FILE" ]] || health_fail failed 'Restic configuration is not readable'
  RESTIC_BIN="$(command -v restic 2>/dev/null || true)"
  RCLONE_BIN="$(command -v rclone 2>/dev/null || true)"
  [[ -n "$RESTIC_BIN" ]] || health_fail failed 'Restic executable is unavailable'
  RESTIC_REPOSITORY="$(read_env_value RESTIC_REPOSITORY "$CONFIG_FILE" 2>/dev/null || true)"
  if [[ -z "$RESTIC_REPOSITORY" ]]; then
    RESTIC_REPOSITORY="$(read_env_value RESTIC_REPO "$CONFIG_FILE" 2>/dev/null || true)"
  fi

  if [[ -z "$RESTIC_REPOSITORY" || ! -r "$PASSWORD_FILE" ]]; then
    health_fail failed 'Restic configuration is incomplete'
  fi
  if [[ "${RESTIC_REPOSITORY,,}" == rclone:* && -z "$RCLONE_BIN" ]]; then
    health_fail failed 'rclone executable is unavailable for the Restic repository'
  fi

  TEMP_RESTIC_OUTPUT="$(mktemp)"
  TEMP_RESTIC_ERROR="$(mktemp)"
  if ! RESTIC_PASSWORD_FILE="$PASSWORD_FILE" RESTIC_REPOSITORY="$RESTIC_REPOSITORY" \
    "$RESTIC_BIN" snapshots --latest 1 --json > "$TEMP_RESTIC_OUTPUT" 2> "$TEMP_RESTIC_ERROR"; then
    health_fail failed 'latest Restic snapshot check failed'
  fi

  if ! python3 - "$TEMP_RESTIC_OUTPUT" >/dev/null 2>&1 <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as stream:
    payload = json.load(stream)

if isinstance(payload, list):
    valid = bool(payload) and isinstance(payload[0], dict) and bool(payload[0].get("id"))
elif isinstance(payload, dict):
    valid = bool(payload.get("id"))
else:
    valid = False

raise SystemExit(0 if valid else 1)
PY
  then
    health_fail failed 'latest Restic snapshot is unavailable'
  fi
  RESTIC_STATE="verified"
fi

printf '%s\n' 'STATUS: healthy'
printf 'DETAIL: last successful run is within %.2f hours\n' "$MAX_AGE_HOURS"
if [[ "$RESTIC_STATE" == verified ]]; then
  printf '%s\n' 'RESTIC: latest snapshot verified'
else
  printf '%s\n' 'RESTIC: check skipped (Restic or config unavailable)'
fi
