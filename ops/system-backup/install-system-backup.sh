#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

usage() {
  cat <<'USAGE'
Usage: install-system-backup.sh [--dry-run|--check|--install] [--repo ABSOLUTE_PATH]

Modes:
  --dry-run    List exact user-scoped targets and host checks; make no changes.
  --check      Validate source files, host prerequisites, and the repository path.
  --install    Install the user service, timer, scripts, config, and password,
               then enable the timer with systemd --user.

Options:
  --repo PATH  Absolute repository path written to a newly-created config.
  --help       Show this help.

Existing config and password files are always preserved. The installer never
prints a generated password or reads repository data.
USAGE
}

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

MODE="check"
REPOSITORY_PATH="${UNIFIL_EXAMS_REPO:-/home/eronp/UniFil-Exams}"
MODE_SET=0

while (($# > 0)); do
  case "$1" in
    --dry-run|--check|--install)
      ((MODE_SET == 0)) || { printf '%s\n' 'ERROR: choose only one mode' >&2; exit 2; }
      MODE="${1#--}"
      MODE_SET=1
      ;;
    --repo)
      (($# >= 2)) || { printf '%s\n' 'ERROR: --repo requires an absolute path' >&2; exit 2; }
      REPOSITORY_PATH="$2"
      shift
      ;;
    --repo=*)
      REPOSITORY_PATH="${1#--repo=}"
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

[[ "$REPOSITORY_PATH" == /* ]] || { printf '%s\n' 'ERROR: --repo must be an absolute path' >&2; exit 2; }
[[ "$REPOSITORY_PATH" != *$'\n'* && "$REPOSITORY_PATH" != *$'\r'* ]] || {
  printf '%s\n' 'ERROR: --repo contains a line break' >&2
  exit 2
}

USER_HOME="${HOME:-}"
[[ -n "$USER_HOME" ]] || { printf '%s\n' 'ERROR: HOME is not set' >&2; exit 2; }
[[ "$USER_HOME" == /* ]] || { printf '%s\n' 'ERROR: HOME must be an absolute path' >&2; exit 2; }
[[ "$USER_HOME" != *$'\n'* && "$USER_HOME" != *$'\r'* ]] || {
  printf '%s\n' 'ERROR: HOME contains a line break' >&2
  exit 2
}
PATH="$USER_HOME/.local/bin:${PATH:-}"
export PATH

LOGIN_USER="${USER:-}"
if [[ -z "$LOGIN_USER" ]]; then
  LOGIN_USER="$(id -un 2>/dev/null || true)"
fi
[[ "$LOGIN_USER" =~ ^[A-Za-z0-9._-]+$ ]] || {
  printf '%s\n' 'ERROR: could not determine a safe login user name' >&2
  exit 2
}

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
SOURCE_BACKUP_SCRIPT="$SCRIPT_DIR/backup-all-systems.sh"
SOURCE_ENV_EXAMPLE="$SCRIPT_DIR/system-backup.env.example"
SOURCE_SERVICE="$SCRIPT_DIR/server-all-systems-backup.service"
SOURCE_TIMER="$SCRIPT_DIR/server-all-systems-backup.timer"

CONFIG_DIR="$USER_HOME/.config/server-backup"
SYSTEMD_USER_DIR="$USER_HOME/.config/systemd/user"
LIBEXEC_DIR="$USER_HOME/.local/libexec/server-backup"
TARGET_BACKUP_SCRIPT="$LIBEXEC_DIR/backup-all-systems.sh"
TARGET_HEALTH_SCRIPT="$LIBEXEC_DIR/check-backup-health.sh"
TARGET_CONFIG="$CONFIG_DIR/system-backup.env"
TARGET_PASSWORD="$CONFIG_DIR/restic-password"
TARGET_SERVICE="$SYSTEMD_USER_DIR/server-all-systems-backup.service"
TARGET_TIMER="$SYSTEMD_USER_DIR/server-all-systems-backup.timer"
TIMER_UNIT="server-all-systems-backup.timer"

print_plan() {
  printf 'MODE: %s\n' "$MODE"
  printf 'REPOSITORY: %s\n' "$REPOSITORY_PATH"
  printf 'SOURCE: %s\n' "$SOURCE_BACKUP_SCRIPT"
  printf 'SOURCE: %s\n' "$SOURCE_ENV_EXAMPLE"
  printf 'TARGET: %s\n' "$TARGET_BACKUP_SCRIPT"
  printf 'TARGET: %s\n' "$TARGET_HEALTH_SCRIPT"
  printf 'TARGET: %s\n' "$TARGET_CONFIG"
  printf 'TARGET: %s\n' "$TARGET_PASSWORD"
  printf 'TARGET: %s\n' "$TARGET_SERVICE"
  printf 'TARGET: %s\n' "$TARGET_TIMER"
  printf 'SYSTEMD: systemctl --user daemon-reload and enable --now %s (install only)\n' "$TIMER_UNIT"
}

check_source_files() {
  local source_file
  local failed=0

  for source_file in "$SOURCE_BACKUP_SCRIPT" "$SOURCE_ENV_EXAMPLE" "$SOURCE_SERVICE" "$SOURCE_TIMER" "$SCRIPT_DIR/check-backup-health.sh"; do
    if [[ -s "$source_file" ]]; then
      printf 'SOURCE: ok %s\n' "$source_file"
    else
      printf 'SOURCE: missing %s\n' "$source_file"
      failed=1
    fi
  done

  return "$failed"
}

check_prerequisites() {
  local missing=0
  local command_name
  local command_path
  local required_commands=(bash rclone restic docker python3 systemctl loginctl flock install mktemp chmod mkdir cp id)

  for command_name in "${required_commands[@]}"; do
    if command_path="$(command -v "$command_name" 2>/dev/null)"; then
      printf 'PREREQUISITE: found %s (%s)\n' "$command_name" "$command_path"
    else
      printf 'PREREQUISITE: missing %s\n' "$command_name"
      missing=1
    fi
  done

  if command -v systemctl >/dev/null 2>&1; then
    if systemctl --user show-environment >/dev/null 2>&1; then
      printf '%s\n' 'PREREQUISITE: systemd user session: available'
    else
      printf '%s\n' 'PREREQUISITE: systemd user session: unavailable'
      missing=1
    fi
  fi

  if command -v loginctl >/dev/null 2>&1; then
    local linger_state
    if linger_state="$(loginctl show-user "$LOGIN_USER" -p Linger --value 2>/dev/null)"; then
      case "${linger_state,,}" in
        yes)
          printf '%s\n' 'LINGER: yes'
          ;;
        no)
          printf '%s\n' 'LINGER: no'
          printf 'sudo loginctl enable-linger %s\n' "$LOGIN_USER"
          ;;
        *)
          printf 'LINGER: unknown (%s)\n' "${linger_state//$'\n'/ }"
          ;;
      esac
    else
      printf '%s\n' 'LINGER: unknown (loginctl query failed)'
    fi
  else
    printf '%s\n' 'LINGER: unknown (loginctl unavailable)'
  fi

  return "$missing"
}

shell_quote() {
  local value="$1"
  value="${value//\'/\'\\\'\'}"
  printf "'%s'" "$value"
}

render_config() {
  local line
  local key
  local replaced=0
  local quoted_repository
  quoted_repository="$(shell_quote "$REPOSITORY_PATH")"

  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ "$line" =~ ^[[:space:]]*(export[[:space:]]+)?(BACKUP_REPO|REPO_PATH|UNIFIL_EXAMS_REPO|PROJECT_REPO|SOURCE_REPO|BACKUP_SOURCE_ROOT|SOURCE_ROOT)[[:space:]]*= ]]; then
      key="${BASH_REMATCH[2]}"
      printf '%s=%s\n' "$key" "$quoted_repository"
      replaced=1
    else
      printf '%s\n' "$line"
    fi
  done < "$SOURCE_ENV_EXAMPLE"

  if ((replaced == 0)); then
    printf 'BACKUP_REPO=%s\n' "$quoted_repository"
  fi
}

TEMP_CONFIG=""
TEMP_PASSWORD=""
cleanup_temporary_files() {
  local exit_code=$?

  if [[ -n "$TEMP_CONFIG" && -e "$TEMP_CONFIG" ]]; then
    rm -f -- "$TEMP_CONFIG" || exit_code=1
  fi
  if [[ -n "$TEMP_PASSWORD" && -e "$TEMP_PASSWORD" ]]; then
    rm -f -- "$TEMP_PASSWORD" || exit_code=1
  fi

  exit "$exit_code"
}
trap cleanup_temporary_files EXIT

print_plan

if ! check_source_files; then
  if [[ "$MODE" == "dry-run" ]]; then
    printf '%s\n' 'DRY-RUN: source files are incomplete; no files changed'
    exit 1
  fi
  die 'required system-backup source files are incomplete'
fi

if ! check_prerequisites; then
  if [[ "$MODE" == "dry-run" ]]; then
    printf '%s\n' 'DRY-RUN: prerequisites are incomplete; no files changed'
    exit 0
  fi
  die 'prerequisites are incomplete; no files were changed'
fi

case "$MODE" in
  dry-run)
    printf '%s\n' 'DRY-RUN: no files changed and no systemd command was run'
    exit 0
    ;;
  check)
    [[ -d "$REPOSITORY_PATH" ]] || die "repository directory missing: $REPOSITORY_PATH"
    printf '%s\n' 'CHECK: repository path is present'
    printf '%s\n' 'CHECK: no files changed and no systemd command was run'
    exit 0
    ;;
  install)
    [[ -d "$REPOSITORY_PATH" ]] || die "repository directory missing: $REPOSITORY_PATH"
    ;;
  *)
    printf 'ERROR: unsupported mode: %s\n' "$MODE" >&2
    exit 2
    ;;
esac

install -d -m 0750 -- "$CONFIG_DIR" "$SYSTEMD_USER_DIR" "$LIBEXEC_DIR"
exec 9<"$CONFIG_DIR"
flock -n 9 || die "another system-backup installation is already running"

install -m 0750 -- "$SOURCE_BACKUP_SCRIPT" "$TARGET_BACKUP_SCRIPT"
install -m 0750 -- "$SCRIPT_DIR/check-backup-health.sh" "$TARGET_HEALTH_SCRIPT"
install -m 0644 -- "$SOURCE_SERVICE" "$TARGET_SERVICE"
install -m 0644 -- "$SOURCE_TIMER" "$TARGET_TIMER"

if [[ -e "$TARGET_CONFIG" || -L "$TARGET_CONFIG" ]]; then
  printf 'CONFIG: preserved existing %s\n' "$TARGET_CONFIG"
else
  TEMP_CONFIG="$(mktemp "$CONFIG_DIR/system-backup.env.tmp.XXXXXX")"
  render_config > "$TEMP_CONFIG"
  install -m 0600 -- "$TEMP_CONFIG" "$TARGET_CONFIG"
  rm -f -- "$TEMP_CONFIG"
  TEMP_CONFIG=""
  printf 'CONFIG: created %s without credentials\n' "$TARGET_CONFIG"
fi

if [[ -e "$TARGET_PASSWORD" || -L "$TARGET_PASSWORD" ]]; then
  printf 'PASSWORD: preserved existing %s\n' "$TARGET_PASSWORD"
else
  TEMP_PASSWORD="$(mktemp "$CONFIG_DIR/restic-password.tmp.XXXXXX")"
  python3 -c 'import secrets; print(secrets.token_urlsafe(48))' > "$TEMP_PASSWORD"
  chmod 0600 -- "$TEMP_PASSWORD"
  install -m 0600 -- "$TEMP_PASSWORD" "$TARGET_PASSWORD"
  rm -f -- "$TEMP_PASSWORD"
  TEMP_PASSWORD=""
  printf 'PASSWORD: generated %s\n' "$TARGET_PASSWORD"
fi

systemctl --user daemon-reload
systemctl --user enable --now "$TIMER_UNIT"

printf '%s\n' 'INSTALL: completed scoped user installation'
printf 'INSTALL: timer enabled: %s\n' "$TIMER_UNIT"
