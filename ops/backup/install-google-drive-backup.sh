#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

usage() {
  cat <<'USAGE'
Usage: install-google-drive-backup.sh [--check|--dry-run|--install] [--repo PATH]

Modes:
  --check      Validate source files and host prerequisites; make no changes.
  --dry-run    List scoped target paths and prerequisite status; make no changes.
  --install    Install the user service, timer, script, and first-run config,
               then enable the timer with systemd --user.

Options:
  --repo PATH  Repository path written to a new config file.
  --help       Show this help.

The installer never installs rclone credentials and never prints OAuth tokens.
USAGE
}

MODE="check"
DEPLOY_REPO="${UNIFIL_EXAMS_REPO:-/home/eronp/UniFil-Exams}"

while (($# > 0)); do
  case "$1" in
    --check)
      MODE="check"
      ;;
    --dry-run)
      MODE="dry-run"
      ;;
    --install)
      MODE="install"
      ;;
    --repo)
      (($# >= 2)) || { printf '%s\n' 'ERROR: --repo requires a path' >&2; exit 2; }
      DEPLOY_REPO="$2"
      shift
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

[[ "$DEPLOY_REPO" == /* ]] || { printf '%s\n' 'ERROR: --repo must be an absolute path' >&2; exit 2; }
[[ "$DEPLOY_REPO" != *$'\n'* && "$DEPLOY_REPO" != *$'\r'* ]] || { printf '%s\n' 'ERROR: --repo contains a line break' >&2; exit 2; }

USER_HOME="${HOME:-}"
[[ -n "$USER_HOME" ]] || { printf '%s\n' 'ERROR: HOME is not set' >&2; exit 2; }

SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd -P)"
SOURCE_BACKUP_SCRIPT="$SCRIPT_DIR/backup-google-drive.sh"
SOURCE_ENV_EXAMPLE="$SCRIPT_DIR/google-drive-backup.env.example"
SOURCE_SERVICE="$SCRIPT_DIR/unifil-exams-google-drive-backup.service"
SOURCE_TIMER="$SCRIPT_DIR/unifil-exams-google-drive-backup.timer"

CONFIG_DIR="$USER_HOME/.config/unifil-exams"
SYSTEMD_USER_DIR="$USER_HOME/.config/systemd/user"
LIBEXEC_DIR="$USER_HOME/.local/libexec/unifil-exams"
TARGET_ENV="$CONFIG_DIR/google-drive-backup.env"
TARGET_SERVICE="$SYSTEMD_USER_DIR/unifil-exams-google-drive-backup.service"
TARGET_TIMER="$SYSTEMD_USER_DIR/unifil-exams-google-drive-backup.timer"
TARGET_BACKUP_SCRIPT="$LIBEXEC_DIR/backup-google-drive.sh"
TIMER_UNIT="unifil-exams-google-drive-backup.timer"

check_source_files() {
  local source_file
  for source_file in "$SOURCE_BACKUP_SCRIPT" "$SOURCE_ENV_EXAMPLE" "$SOURCE_SERVICE" "$SOURCE_TIMER"; do
    if [[ -s "$source_file" ]]; then
      printf 'SOURCE: ok %s\n' "$source_file"
    else
      printf 'SOURCE: missing %s\n' "$source_file"
      return 1
    fi
  done
}

check_prerequisites() {
  local missing=0
  local command_name
  local command_path
  local required_commands=(bash docker rclone flock tar sha256sum hostname date tr mkdir chmod rm cp find sort mktemp install awk systemctl)

  for command_name in "${required_commands[@]}"; do
    if command_path="$(command -v "$command_name" 2>/dev/null)"; then
      printf 'PREREQUISITE: found %s (%s)\n' "$command_name" "$command_path"
    else
      printf 'PREREQUISITE: missing %s\n' "$command_name"
      missing=1
    fi
  done

  return "$missing"
}

print_plan() {
  printf 'MODE: %s\n' "$MODE"
  printf 'REPOSITORY: %s\n' "$DEPLOY_REPO"
  printf 'TARGET: %s\n' "$TARGET_BACKUP_SCRIPT"
  printf 'TARGET: %s\n' "$TARGET_ENV"
  printf 'TARGET: %s\n' "$TARGET_SERVICE"
  printf 'TARGET: %s\n' "$TARGET_TIMER"
  printf 'SYSTEMD: user daemon-reload and enable --now %s (install only)\n' "$TIMER_UNIT"
  printf '%s\n' 'SAFETY: no repository data read in dry-run; no credentials or OAuth tokens installed or printed'
}

check_source_files || exit 1
print_plan

if ! check_prerequisites; then
  if [[ "$MODE" != "dry-run" ]]; then
    printf '%s\n' 'ERROR: prerequisites are incomplete; no files were changed' >&2
    exit 1
  fi
  printf '%s\n' 'DRY-RUN: missing prerequisites are reported but do not block this plan-only check'
fi

if [[ "$MODE" == "dry-run" ]]; then
  exit 0
fi

if [[ "$MODE" == "check" ]]; then
  [[ -d "$DEPLOY_REPO" ]] || { printf 'CHECK: repository directory missing %s\n' "$DEPLOY_REPO" >&2; exit 1; }
  [[ -d "$DEPLOY_REPO/data" ]] || { printf 'CHECK: data directory missing %s/data\n' "$DEPLOY_REPO" >&2; exit 1; }
  [[ -d "$DEPLOY_REPO/public/uploads" ]] || { printf 'CHECK: uploads directory missing %s/public/uploads\n' "$DEPLOY_REPO" >&2; exit 1; }
  [[ -d "$DEPLOY_REPO/public/gabaritos" ]] || { printf 'CHECK: gabaritos directory missing %s/public/gabaritos\n' "$DEPLOY_REPO" >&2; exit 1; }
  printf '%s\n' 'CHECK: repository directory layout is present'
  printf '%s\n' 'CHECK: no files changed and no systemd command was run'
  exit 0
fi

if [[ "$MODE" != "install" ]]; then
  printf 'ERROR: unsupported mode: %s\n' "$MODE" >&2
  exit 2
fi

[[ -d "$DEPLOY_REPO" ]] || { printf 'ERROR: repository directory missing: %s\n' "$DEPLOY_REPO" >&2; exit 1; }
[[ -d "$DEPLOY_REPO/data" ]] || { printf 'ERROR: data directory missing: %s/data\n' "$DEPLOY_REPO" >&2; exit 1; }
[[ -d "$DEPLOY_REPO/public/uploads" ]] || { printf 'ERROR: uploads directory missing: %s/public/uploads\n' "$DEPLOY_REPO" >&2; exit 1; }
[[ -d "$DEPLOY_REPO/public/gabaritos" ]] || { printf 'ERROR: gabaritos directory missing: %s/public/gabaritos\n' "$DEPLOY_REPO" >&2; exit 1; }

install -d -m 0750 -- "$CONFIG_DIR" "$SYSTEMD_USER_DIR" "$LIBEXEC_DIR"
install -m 0750 -- "$SOURCE_BACKUP_SCRIPT" "$TARGET_BACKUP_SCRIPT"
install -m 0644 -- "$SOURCE_SERVICE" "$TARGET_SERVICE"
install -m 0644 -- "$SOURCE_TIMER" "$TARGET_TIMER"

if [[ -e "$TARGET_ENV" ]]; then
  printf 'CONFIG: preserved existing %s\n' "$TARGET_ENV"
else
  TEMP_CONFIG="$(mktemp "$CONFIG_DIR/google-drive-backup.env.tmp.XXXXXX")"
  trap 'if [[ -n "${TEMP_CONFIG:-}" && -e "$TEMP_CONFIG" ]]; then rm -f -- "$TEMP_CONFIG"; fi' EXIT
  awk -v repo="$DEPLOY_REPO" '
    /^UNIFIL_EXAMS_REPO=/ { print "UNIFIL_EXAMS_REPO=" repo; next }
    { print }
  ' "$SOURCE_ENV_EXAMPLE" > "$TEMP_CONFIG"
  install -m 0600 -- "$TEMP_CONFIG" "$TARGET_ENV"
  rm -f -- "$TEMP_CONFIG"
  TEMP_CONFIG=""
  printf 'CONFIG: created %s without credentials\n' "$TARGET_ENV"
fi

systemctl --user daemon-reload
systemctl --user enable --now "$TIMER_UNIT"

printf '%s\n' 'INSTALL: completed scoped user installation'
printf 'INSTALL: manual invocation is %s\n' "$TARGET_BACKUP_SCRIPT"
