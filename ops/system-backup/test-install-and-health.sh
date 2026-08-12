#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

die() {
  printf 'TEST ERROR: %s\n' "$*" >&2
  exit 1
}

assert_file_contains() {
  local needle="$1"
  local file_path="$2"
  grep -Fq -- "$needle" "$file_path" || die "missing expected text in output/file: $needle"
}

assert_file_not_contains() {
  local needle="$1"
  local file_path="$2"
  if grep -Fq -- "$needle" "$file_path"; then
    die 'a protected password value was printed'
  fi
}

assert_mode() {
  local expected_mode="$1"
  local file_path="$2"
  local actual_mode
  actual_mode="$(stat -c '%a' "$file_path")"
  [[ "$actual_mode" == "$expected_mode" ]] || die "unexpected mode for $file_path"
}

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
TMP_BASE="${TMPDIR:-/tmp}"
[[ "$TMP_BASE" == /* ]] || die 'TMPDIR must be an absolute path'
TEST_ROOT="$(mktemp -d "$TMP_BASE/system-backup-test.XXXXXX")"
case "$TEST_ROOT" in
  "$TMP_BASE"/system-backup-test.*) ;;
  *) die 'temporary test directory was outside the validated scope' ;;
esac

cleanup() {
  local exit_code=$?
  if [[ -n "${TEST_ROOT:-}" && -d "$TEST_ROOT" ]]; then
    case "$TEST_ROOT" in
      "$TMP_BASE"/system-backup-test.*)
        rm -rf -- "$TEST_ROOT" || exit_code=1
        ;;
      *)
        printf 'TEST ERROR: refusing to clean an unvalidated path\n' >&2
        exit_code=1
        ;;
    esac
  fi
  exit "$exit_code"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

exec 9>"$TEST_ROOT/test.lock"
flock -n 9 || die 'another installation test is already running'

FAKE_HOME="$TEST_ROOT/home"
FAKE_BIN="$TEST_ROOT/bin"
SOURCE_FIXTURE="$TEST_ROOT/source"
FAKE_REPOSITORY="$TEST_ROOT/repository"
mkdir -p -- "$FAKE_HOME/.local/bin" "$FAKE_BIN" "$SOURCE_FIXTURE" "$FAKE_REPOSITORY"

REAL_PYTHON3="$(command -v python3 2>/dev/null || true)"
[[ -n "$REAL_PYTHON3" ]] || die 'python3 is required to run this test'
ORIGINAL_PATH="${PATH:-}"
export SYSTEM_BACKUP_REAL_PYTHON3="$REAL_PYTHON3"
export SYSTEM_BACKUP_TEST_LOG="$TEST_ROOT/systemctl.log"
export SYSTEM_BACKUP_RESTIC_LOG="$TEST_ROOT/restic.log"
export SYSTEM_BACKUP_RCLONE_LOG="$TEST_ROOT/rclone.log"

FAKE_COMMAND="$TEST_ROOT/fake-command"
printf '%s\n' \
  '#!/usr/bin/env bash' \
  'set -Eeuo pipefail' \
  'command_name="$(basename -- "$0")"' \
  'case "$command_name" in' \
  '  python3) exec "$SYSTEM_BACKUP_REAL_PYTHON3" "$@" ;;' \
  '  restic)' \
  '    rclone_path="$(command -v rclone 2>/dev/null || true)"' \
  '    [[ -n "$rclone_path" ]] || exit 1' \
  '    printf "%s\n" "$RESTIC_REPOSITORY" > "$SYSTEM_BACKUP_RESTIC_LOG"' \
  '    printf "%s\n" "$rclone_path" >> "$SYSTEM_BACKUP_RESTIC_LOG"' \
  '    "$rclone_path" version >/dev/null' \
  "    printf '%s\\n' '[{\"id\":\"test-snapshot\"}]'" \
  '    ;;' \
  '  systemctl)' \
  '    printf "%s\n" "$*" >> "$SYSTEM_BACKUP_TEST_LOG"' \
  '    if [[ "$1" == "--user" && "$2" == "show-environment" ]]; then exit 0; fi' \
  '    exit 0' \
  '    ;;' \
  '  loginctl) printf "%s\n" no ;;' \
  '  rclone) printf "%s\n" "$*" >> "$SYSTEM_BACKUP_RCLONE_LOG"; exit 0 ;;' \
  '  docker) exit 0 ;;' \
  '  *) printf "unexpected fake command: %s\n" "$command_name" >&2; exit 1 ;;' \
  'esac' > "$FAKE_COMMAND"
chmod 0750 -- "$FAKE_COMMAND"
for command_name in docker python3 systemctl loginctl; do
  cp -- "$FAKE_COMMAND" "$FAKE_BIN/$command_name"
  chmod 0750 -- "$FAKE_BIN/$command_name"
done
for command_name in rclone restic; do
  cp -- "$FAKE_COMMAND" "$FAKE_HOME/.local/bin/$command_name"
  chmod 0750 -- "$FAKE_HOME/.local/bin/$command_name"
done

for source_name in install-system-backup.sh server-all-systems-backup.service server-all-systems-backup.timer check-backup-health.sh; do
  cp -- "$SCRIPT_DIR/$source_name" "$SOURCE_FIXTURE/$source_name"
done
printf '%s\n' '#!/usr/bin/env bash' 'set -Eeuo pipefail' 'exit 0' > "$SOURCE_FIXTURE/backup-all-systems.sh"
chmod 0750 -- "$SOURCE_FIXTURE/backup-all-systems.sh"
printf '%s\n' 'BACKUP_REPO=/fixture/repository' 'RESTIC_REPOSITORY=rclone:fixture:system-wide' > "$SOURCE_FIXTURE/system-backup.env.example"

INSTALLER="$SOURCE_FIXTURE/install-system-backup.sh"
HEALTH="$SOURCE_FIXTURE/check-backup-health.sh"
TARGET_CONFIG="$FAKE_HOME/.config/server-backup/system-backup.env"
TARGET_PASSWORD="$FAKE_HOME/.config/server-backup/restic-password"
TARGET_TIMER="$FAKE_HOME/.config/systemd/user/server-all-systems-backup.timer"
TARGET_SERVICE="$FAKE_HOME/.config/systemd/user/server-all-systems-backup.service"
STATUS_FILE="$FAKE_HOME/backups/system-wide/status/latest.env"
TEST_PATH="$FAKE_BIN:$ORIGINAL_PATH"

DRY_RUN_OUTPUT="$TEST_ROOT/dry-run.out"
if ! env HOME="$FAKE_HOME" USER=backup-test PATH="$TEST_PATH" bash "$INSTALLER" --dry-run --repo "$FAKE_REPOSITORY" > "$DRY_RUN_OUTPUT" 2>&1; then
  die 'dry-run unexpectedly failed'
fi
assert_file_contains "TARGET: $FAKE_HOME/.local/libexec/server-backup/backup-all-systems.sh" "$DRY_RUN_OUTPUT"
assert_file_contains "TARGET: $FAKE_HOME/.local/libexec/server-backup/check-backup-health.sh" "$DRY_RUN_OUTPUT"
assert_file_contains "TARGET: $TARGET_CONFIG" "$DRY_RUN_OUTPUT"
assert_file_contains "TARGET: $TARGET_PASSWORD" "$DRY_RUN_OUTPUT"
assert_file_contains "TARGET: $TARGET_SERVICE" "$DRY_RUN_OUTPUT"
assert_file_contains "TARGET: $TARGET_TIMER" "$DRY_RUN_OUTPUT"
assert_file_contains "PREREQUISITE: found rclone ($FAKE_HOME/.local/bin/rclone)" "$DRY_RUN_OUTPUT"
assert_file_contains "PREREQUISITE: found restic ($FAKE_HOME/.local/bin/restic)" "$DRY_RUN_OUTPUT"
[[ ! -e "$FAKE_HOME/.config" ]] || die 'dry-run created user files'

INSTALL_OUTPUT="$TEST_ROOT/install.out"
if ! env HOME="$FAKE_HOME" USER=backup-test PATH="$TEST_PATH" bash "$INSTALLER" --install --repo "$FAKE_REPOSITORY" > "$INSTALL_OUTPUT" 2>&1; then
  die 'first install unexpectedly failed'
fi
[[ -s "$TARGET_CONFIG" && -s "$TARGET_PASSWORD" ]] || die 'install did not create config/password'
assert_mode 600 "$TARGET_CONFIG"
assert_mode 600 "$TARGET_PASSWORD"
assert_file_contains "BACKUP_REPO='$FAKE_REPOSITORY'" "$TARGET_CONFIG"
GENERATED_PASSWORD="$(<"$TARGET_PASSWORD")"
[[ -n "$GENERATED_PASSWORD" ]] || die 'generated password is empty'
assert_file_not_contains "$GENERATED_PASSWORD" "$DRY_RUN_OUTPUT"
assert_file_not_contains "$GENERATED_PASSWORD" "$INSTALL_OUTPUT"

assert_file_contains 'EnvironmentFile=%h/.config/server-backup/system-backup.env' "$TARGET_SERVICE"
assert_file_contains 'Environment="RESTIC_PASSWORD_FILE=%h/.config/server-backup/restic-password"' "$TARGET_SERVICE"
assert_file_contains 'PATH=%h/.local/bin:' "$TARGET_SERVICE"
assert_file_contains 'OnCalendar=*-*-* 03:30:00 America/Sao_Paulo' "$TARGET_TIMER"
assert_file_contains 'Persistent=true' "$TARGET_TIMER"
assert_file_contains 'RandomizedDelaySec=10m' "$TARGET_TIMER"
assert_file_contains 'Unit=server-all-systems-backup.service' "$TARGET_TIMER"
assert_file_contains '--user enable --now server-all-systems-backup.timer' "$SYSTEM_BACKUP_TEST_LOG"

printf '%s\n' 'BACKUP_REPO=/preserved/config' 'RESTIC_REPOSITORY=rclone:fixture:system-wide' > "$TARGET_CONFIG"
printf '%s\n' 'preserved-password-value' > "$TARGET_PASSWORD"
PRESERVED_PASSWORD="$(<"$TARGET_PASSWORD")"
SECOND_INSTALL_OUTPUT="$TEST_ROOT/second-install.out"
if ! env HOME="$FAKE_HOME" USER=backup-test PATH="$TEST_PATH" bash "$INSTALLER" --install --repo "$FAKE_REPOSITORY" > "$SECOND_INSTALL_OUTPUT" 2>&1; then
  die 'second install unexpectedly failed'
fi
assert_file_contains 'BACKUP_REPO=/preserved/config' "$TARGET_CONFIG"
[[ "$(<"$TARGET_PASSWORD")" == "$PRESERVED_PASSWORD" ]] || die 'existing password was not preserved'
assert_file_not_contains "$PRESERVED_PASSWORD" "$SECOND_INSTALL_OUTPUT"

mkdir -p -- "$(dirname -- "$STATUS_FILE")"
RECENT_FINISHED_AT="$(date -u -d '1 hour ago' '+%Y-%m-%dT%H:%M:%SZ')"
STALE_FINISHED_AT="$(date -u -d '40 hours ago' '+%Y-%m-%dT%H:%M:%SZ')"
printf '%s\n' 'BACKUP_REPO=/preserved/config' 'RESTIC_REPOSITORY=rclone:fixture:system-wide' > "$TARGET_CONFIG"
printf '%s\n' 'preserved-password-value' > "$TARGET_PASSWORD"

printf '%s\n' \
  'RESULT=success' \
  'STARTED_AT=2026-08-12T00:00:00Z' \
  "FINISHED_AT=$RECENT_FINISHED_AT" \
  'SNAPSHOT_ID=test-snapshot' \
  'RUN_ID=test-run' \
  'ERROR_STAGE=' > "$STATUS_FILE"
HEALTHY_OUTPUT="$TEST_ROOT/healthy.out"
if ! env HOME="$FAKE_HOME" PATH="$TEST_PATH" bash "$HEALTH" > "$HEALTHY_OUTPUT" 2>&1; then
  die 'healthy health check unexpectedly failed'
fi
assert_file_contains 'STATUS: healthy' "$HEALTHY_OUTPUT"
assert_file_contains 'RESTIC: latest snapshot verified' "$HEALTHY_OUTPUT"
assert_file_contains 'rclone:fixture:system-wide' "$SYSTEM_BACKUP_RESTIC_LOG"
assert_file_contains "$FAKE_HOME/.local/bin/rclone" "$SYSTEM_BACKUP_RESTIC_LOG"
assert_file_contains 'version' "$SYSTEM_BACKUP_RCLONE_LOG"

printf '%s\n' \
  'RESULT=success' \
  'STARTED_AT=2026-08-10T00:00:00Z' \
  "FINISHED_AT=$STALE_FINISHED_AT" \
  'SNAPSHOT_ID=old-snapshot' \
  'RUN_ID=stale-run' \
  'ERROR_STAGE=' > "$STATUS_FILE"
STALE_OUTPUT="$TEST_ROOT/stale.out"
if env HOME="$FAKE_HOME" PATH="$TEST_PATH" bash "$HEALTH" --max-age-hours 30 > "$STALE_OUTPUT" 2>&1; then
  die 'stale health check unexpectedly succeeded'
fi
assert_file_contains 'STATUS: stale' "$STALE_OUTPUT"

printf '%s\n' \
  'RESULT=failed' \
  'STARTED_AT=2026-08-12T00:00:00Z' \
  "FINISHED_AT=$RECENT_FINISHED_AT" \
  'SNAPSHOT_ID=' \
  'RUN_ID=failed-run' \
  'ERROR_STAGE=restic' > "$STATUS_FILE"
FAILED_OUTPUT="$TEST_ROOT/failed.out"
if env HOME="$FAKE_HOME" PATH="$TEST_PATH" bash "$HEALTH" > "$FAILED_OUTPUT" 2>&1; then
  die 'failed health check unexpectedly succeeded'
fi
assert_file_contains 'STATUS: failed' "$FAILED_OUTPUT"
assert_file_contains 'restic' "$FAILED_OUTPUT"

rm -f -- "$STATUS_FILE"
NEVER_RUN_OUTPUT="$TEST_ROOT/never-run.out"
if env HOME="$FAKE_HOME" PATH="$TEST_PATH" bash "$HEALTH" > "$NEVER_RUN_OUTPUT" 2>&1; then
  die 'never-run health check unexpectedly succeeded'
fi
assert_file_contains 'STATUS: never-run' "$NEVER_RUN_OUTPUT"

printf '%s\n' 'PASS: dry-run, idempotent install, preservation, timer, and health states verified'
