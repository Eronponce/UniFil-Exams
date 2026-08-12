#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
VERIFY_SCRIPT="$SCRIPT_DIR/verify-system-backup.sh"
RESTORE_SCRIPT="$SCRIPT_DIR/restore-system-backup.sh"
TEST_TMP_PARENT="${TMPDIR:-/tmp}"
[[ "$TEST_TMP_PARENT" == /* && -d "$TEST_TMP_PARENT" ]] || { printf 'ERROR: TMPDIR must be absolute\n' >&2; exit 1; }
REAL_PYTHON_BIN="$(command -v python3 || command -v python || true)"
[[ -n "$REAL_PYTHON_BIN" ]] || { printf 'ERROR: Python is required for this harness\n' >&2; exit 1; }

TEST_ROOT="$(mktemp -d "$TEST_TMP_PARENT/system-backup-test.XXXXXX")"
cleanup() {
  local code=$?
  trap - EXIT
  case "$TEST_ROOT" in
    "$TEST_TMP_PARENT"/system-backup-test.*) rm -rf -- "$TEST_ROOT" || code=1 ;;
    *) printf 'ERROR: refusing to clean unvalidated test path: %s\n' "$TEST_ROOT" >&2; code=1 ;;
  esac
  exit "$code"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }
assert_contains() { grep -Fq -- "$2" "$1" || fail "expected [$2] in $1"; }
assert_not_contains() { ! grep -Fq -- "$2" "$1" || fail "did not expect [$2] in $1"; }
expect_failure() {
  local output_file="$1"
  shift
  if "$@" >"$output_file" 2>&1; then fail "expected command to fail: $*"; fi
}

MOCK_DIR="$TEST_ROOT/mock"
FIXTURE_ROOT="$TEST_ROOT/fixture"
CONFIG_DIR="$TEST_ROOT/config"
TMP_AREA="$TEST_ROOT/tmp"
LIVE_ROOT="$TEST_ROOT/live"
HOME_ROOT="$TEST_ROOT/home"
MOCK_LOG="$TEST_ROOT/mock.log"
SECRET_MARKER='TOP_SECRET_SENTINEL_DO_NOT_PRINT'
mkdir -p "$MOCK_DIR" "$FIXTURE_ROOT/metadata" "$CONFIG_DIR" "$TMP_AREA" "$LIVE_ROOT" "$HOME_ROOT"
: >"$MOCK_LOG"

CONFIG_FILE="$CONFIG_DIR/system-backup.env"
PASSWORD_FILE="$CONFIG_DIR/restic-password"
printf '%s\n' '# test-only configuration; fixed repository defaults are intentional' >"$CONFIG_FILE"
printf '%s\n' 'test-only-restic-password' >"$PASSWORD_FILE"

DB_RELATIVE_PATHS=(
  databases/unifil-exams/unifil-exams.db
  databases/canva-api/canva-api.db
  databases/grade-app/grade_lab.db
  databases/grade-app/volumes/grade_app_grade_data/grade_lab.db
  databases/grade-app/volumes/grade-app_grade_data/grade_lab.db
  databases/grade-app/hosts/Grade-App/grade_lab.db
  databases/grade-app/hosts/grade_app/grade_lab.db
  databases/eron-dashboard/eron-dashboard.db
  databases/mirror-legacy/mirror-legacy.db
)
for relative_path in "${DB_RELATIVE_PATHS[@]}"; do
  mkdir -p "$(dirname -- "$FIXTURE_ROOT/$relative_path")"
done
export FIXTURE_ROOT
"$REAL_PYTHON_BIN" - <<'PY_CREATE_DATABASES'
import os
import sqlite3

root = os.environ["FIXTURE_ROOT"]
paths = [
    "databases/unifil-exams/unifil-exams.db",
    "databases/canva-api/canva-api.db",
    "databases/grade-app/grade_lab.db",
    "databases/grade-app/volumes/grade_app_grade_data/grade_lab.db",
    "databases/grade-app/volumes/grade-app_grade_data/grade_lab.db",
    "databases/grade-app/hosts/Grade-App/grade_lab.db",
    "databases/grade-app/hosts/grade_app/grade_lab.db",
    "databases/eron-dashboard/eron-dashboard.db",
    "databases/mirror-legacy/mirror-legacy.db",
]
for relative_path in paths:
    database_path = os.path.join(root, relative_path)
    connection = sqlite3.connect(database_path)
    connection.execute("create table fixture (name text)")
    connection.execute("insert into fixture values (?)", (relative_path,))
    connection.commit()
    connection.close()
PY_CREATE_DATABASES

mkdir -p "$FIXTURE_ROOT/databases/supabase" \
  "$FIXTURE_ROOT/files/unifil-exams/uploads" "$FIXTURE_ROOT/files/unifil-exams/gabaritos" \
  "$FIXTURE_ROOT/files/canva-api/data" "$FIXTURE_ROOT/files/grade-app/grade_app_grade_data" \
  "$FIXTURE_ROOT/files/grade-app/grade-app_grade_data" "$FIXTURE_ROOT/files/eron-dashboard" \
  "$FIXTURE_ROOT/files/mirror-legacy" "$FIXTURE_ROOT/files/supabase/storage" \
  "$FIXTURE_ROOT/files/supabase/functions" "$FIXTURE_ROOT/files/supabase/snippets" \
  "$FIXTURE_ROOT/files/supabase/db-config" "$FIXTURE_ROOT/files/supabase/api" \
  "$FIXTURE_ROOT/files/supabase/pooler" "$FIXTURE_ROOT/files/supabase/db" \
  "$FIXTURE_ROOT/secrets"
printf 'postgres dump fixture\n' >"$FIXTURE_ROOT/databases/supabase/postgres.dump"
printf 'supabase dump fixture\n' >"$FIXTURE_ROOT/databases/supabase/_supabase.dump"
printf 'CREATE ROLE fixture_owner;\n' >"$FIXTURE_ROOT/databases/supabase/globals.sql"
for relative_path in \
  files/unifil-exams/uploads/payload.txt files/unifil-exams/gabaritos/payload.txt \
  files/canva-api/data/payload.txt files/grade-app/grade_app_grade_data/payload.txt \
  files/grade-app/grade-app_grade_data/payload.txt files/eron-dashboard/payload.txt \
  files/mirror-legacy/payload.txt files/supabase/storage/payload.txt \
  files/supabase/functions/payload.txt files/supabase/snippets/payload.txt \
  files/supabase/db-config/payload.txt files/supabase/api/payload.txt \
  files/supabase/pooler/payload.txt files/supabase/db/payload.txt; do
  printf 'fixture %s\n' "$relative_path" >"$FIXTURE_ROOT/$relative_path"
done
printf '%s\n' "$SECRET_MARKER" >"$FIXTURE_ROOT/secrets/allowed.env"

{
  printf 'kind\ttarget\tsource\tpath\n'
  printf 'sqlite\tunifil-exams\t/home/eronp/UniFil-Exams/data/unifil-exams.db\tdatabases/unifil-exams/unifil-exams.db\n'
  printf 'sqlite\tcanva-api\t/home/eronp/Canva/data/canva-api.db\tdatabases/canva-api/canva-api.db\n'
  printf 'sqlite\tgrade-app\t/home/eronp/Grade-App/grade_lab.db\tdatabases/grade-app/grade_lab.db\n'
  printf 'sqlite\tgrade-app\tgrade_app_grade_data\tdatabases/grade-app/volumes/grade_app_grade_data/grade_lab.db\n'
  printf 'sqlite\tgrade-app\tgrade-app_grade_data\tdatabases/grade-app/volumes/grade-app_grade_data/grade_lab.db\n'
  printf 'sqlite\tgrade-app\t/home/eronp/Grade-App/grade_lab.db\tdatabases/grade-app/hosts/Grade-App/grade_lab.db\n'
  printf 'sqlite\tgrade-app\t/home/eronp/grade_app/grade_lab.db\tdatabases/grade-app/hosts/grade_app/grade_lab.db\n'
  printf 'sqlite\teron-dashboard\t/home/eronp/eron-dashboard/eron.db\tdatabases/eron-dashboard/eron-dashboard.db\n'
  printf 'sqlite\tmirror-legacy\t/home/eronp/mirror-server/mirror.db\tdatabases/mirror-legacy/mirror-legacy.db\n'
  printf 'postgres\tsupabase\t/home/eronp/supabase-docker/postgres.dump\tdatabases/supabase/postgres.dump\n'
  printf 'postgres\tsupabase\t/home/eronp/supabase-docker/_supabase.dump\tdatabases/supabase/_supabase.dump\n'
  printf 'postgres-globals\tsupabase\t/home/eronp/supabase-docker/globals.sql\tdatabases/supabase/globals.sql\n'
  printf 'file\tall\tallowlist\tfiles/\n'
  printf 'secret\tsecrets\tallowlist\tsecrets/allowed.env\n'
} >"$FIXTURE_ROOT/metadata/inventory.tsv"
(
  cd -- "$FIXTURE_ROOT"
  find databases files secrets -type f -print | LC_ALL=C sort | while IFS= read -r path; do sha256sum "$path"; done
) >"$FIXTURE_ROOT/metadata/SHA256SUMS"

cat >"$MOCK_DIR/restic" <<'MOCK_RESTIC'
#!/usr/bin/env bash
set -Eeuo pipefail
printf 'restic %s\n' "$*" >>"$MOCK_LOG"
command_name=''
for argument in "$@"; do
  case "$argument" in check|snapshots|restore|ls) command_name="$argument"; break ;; esac
done
case "$command_name" in
  check) exit 0 ;;
  snapshots)
    if [[ " $* " == *' --json '* ]]; then printf '[{"id":"snapshot-12345678"}]\n'; else printf 'snapshot-12345678 2026-08-12T12:00:00Z\n'; fi
    ;;
  ls)
    printf 'snapshot-12345678 metadata/inventory.tsv\n'
    printf 'snapshot-12345678 secrets/allowed.env\n'
    ;;
  restore)
    target=''
    includes=()
    while (($#)); do
      case "$1" in
        --repo|--password-file|-o) shift 2 ;;
        --target) target="$2"; shift 2 ;;
        --include) includes+=("$2"); shift 2 ;;
        restore) shift ;;
        *) shift ;;
      esac
    done
    [[ -n "$target" ]] || exit 1
    if ((${#includes[@]} == 0)); then
      cp -a "$FIXTURE_ROOT/." "$target/"
    else
      for include_path in "${includes[@]}"; do
        [[ -e "$FIXTURE_ROOT/$include_path" ]] || continue
        mkdir -p "$target/$(dirname -- "$include_path")"
        cp -a "$FIXTURE_ROOT/$include_path" "$target/$include_path"
      done
    fi
    if [[ -n "${MOCK_OMIT_PATH-}" ]]; then
      rm -f -- "$target/$MOCK_OMIT_PATH"
    fi
    ;;
  *) exit 1 ;;
esac
MOCK_RESTIC

cat >"$MOCK_DIR/docker" <<'MOCK_DOCKER'
#!/usr/bin/env bash
set -Eeuo pipefail
printf 'docker %s\n' "$*" >>"$MOCK_LOG"
[[ "${1:-}" == exec && "${2:-}" == -i && "${3:-}" == supabase-db &&
   "${4:-}" == pg_restore && "${5:-}" == --list ]] || exit 1
cat >/dev/null
MOCK_DOCKER

cat >"$MOCK_DIR/pg_restore" <<'MOCK_PG_RESTORE'
#!/usr/bin/env bash
set -Eeuo pipefail
printf 'pg_restore %s\n' "$*" >>"$MOCK_LOG"
[[ "${1:-}" == --list && -s "${2:-}" ]] || exit 1
MOCK_PG_RESTORE

cat >"$MOCK_DIR/python3" <<'MOCK_PYTHON'
#!/usr/bin/env bash
set -Eeuo pipefail
printf 'python %s\n' "$*" >>"$MOCK_LOG"
exec "$REAL_PYTHON_BIN" "$@"
MOCK_PYTHON

cat >"$MOCK_DIR/rclone" <<'MOCK_RCLONE'
#!/usr/bin/env bash
set -Eeuo pipefail
exit 0
MOCK_RCLONE
chmod 700 "$MOCK_DIR"/*
export MOCK_LOG REAL_PYTHON_BIN

run_with_env() {
  env -u SYSTEM_BACKUP_PG_RESTORE_BIN -u PG_RESTORE_BIN \
    SYSTEM_BACKUP_CONFIG_FILE="$CONFIG_FILE" \
    SYSTEM_BACKUP_PASSWORD_FILE="$PASSWORD_FILE" \
    SYSTEM_BACKUP_RESTIC_BIN="${SYSTEM_BACKUP_RESTIC_BIN:-$MOCK_DIR/restic}" \
    SYSTEM_BACKUP_RCLONE_BIN="$MOCK_DIR/rclone" \
    SYSTEM_BACKUP_PYTHON_BIN="$MOCK_DIR/python3" \
    SYSTEM_BACKUP_DOCKER_BIN="$MOCK_DIR/docker" \
    SYSTEM_BACKUP_TMPDIR="$TMP_AREA" \
    SYSTEM_BACKUP_LIVE_ROOTS="$LIVE_ROOT" \
    MOCK_OMIT_PATH="${MOCK_OMIT_PATH-}" \
    HOME="$HOME_ROOT" "$@"
}
run_with_explicit_pg() {
  SYSTEM_BACKUP_CONFIG_FILE="$CONFIG_FILE" \
  SYSTEM_BACKUP_PASSWORD_FILE="$PASSWORD_FILE" \
  SYSTEM_BACKUP_RESTIC_BIN="$MOCK_DIR/restic" \
  SYSTEM_BACKUP_RCLONE_BIN="$MOCK_DIR/rclone" \
  SYSTEM_BACKUP_PYTHON_BIN="$MOCK_DIR/python3" \
  SYSTEM_BACKUP_PG_RESTORE_BIN="$MOCK_DIR/pg_restore" \
  SYSTEM_BACKUP_TMPDIR="$TMP_AREA" \
  SYSTEM_BACKUP_LIVE_ROOTS="$LIVE_ROOT" \
  HOME="$HOME_ROOT" "$@"
}

DEFAULT_OUTPUT="$TEST_ROOT/verify-default.out"
if ! run_with_env bash "$VERIFY_SCRIPT" --latest >"$DEFAULT_OUTPUT" 2>&1; then
  sed -n '1,120p' "$DEFAULT_OUTPUT" >&2
  fail 'default verification command failed'
fi
cp -- "$MOCK_LOG" "$TEST_ROOT/default.mock.log"
assert_contains "$TEST_ROOT/default.mock.log" '-o rclone.program='
assert_contains "$TEST_ROOT/default.mock.log" 'restore snapshot-12345678'
assert_contains "$TEST_ROOT/default.mock.log" 'python '
assert_contains "$TEST_ROOT/default.mock.log" 'docker exec -i supabase-db pg_restore --list'
assert_not_contains "$TEST_ROOT/default.mock.log" '--read-data'
assert_not_contains "$DEFAULT_OUTPUT" "$SECRET_MARKER"
[[ "$(grep -c '^python ' "$TEST_ROOT/default.mock.log")" == '9' ]] || fail 'expected nine Python SQLite checks'
[[ "$(grep -c '^docker ' "$TEST_ROOT/default.mock.log")" == '2' ]] || fail 'expected two Docker pg_restore checks'
printf 'PASS: default verification checks all SQLite files and both Supabase dumps\n'

# Production resolves RESTIC_BIN to the bare command name "restic". Keep this
# regression test so the shell wrapper cannot shadow and recursively call
# itself again.
BARE_RESTIC_OUTPUT="$TEST_ROOT/verify-bare-restic.out"
if ! PATH="$MOCK_DIR:$PATH" SYSTEM_BACKUP_RESTIC_BIN=restic \
  run_with_env bash "$VERIFY_SCRIPT" --snapshot snapshot-12345678 \
  >"$BARE_RESTIC_OUTPUT" 2>&1; then
  sed -n '1,120p' "$BARE_RESTIC_OUTPUT" >&2
  fail 'bare restic command verification failed'
fi
assert_not_contains "$BARE_RESTIC_OUTPUT" "$SECRET_MARKER"
printf 'PASS: bare restic command does not recurse through the wrapper\n'

MISSING_DB_OUTPUT="$TEST_ROOT/missing-db.out"
MOCK_OMIT_PATH='databases/canva-api/canva-api.db'
export MOCK_OMIT_PATH
expect_failure "$MISSING_DB_OUTPUT" run_with_env bash "$VERIFY_SCRIPT" --latest
unset MOCK_OMIT_PATH
assert_contains "$MISSING_DB_OUTPUT" 'restored databases/metadata SHA256SUMS verification failed'
printf 'PASS: missing required SQLite path fails verification\n'

EXPLICIT_OUTPUT="$TEST_ROOT/verify-explicit-pg.out"
run_with_explicit_pg bash "$VERIFY_SCRIPT" --snapshot snapshot-12345678 >"$EXPLICIT_OUTPUT" 2>&1
assert_contains "$MOCK_LOG" 'pg_restore --list'
assert_not_contains "$EXPLICIT_OUTPUT" "$SECRET_MARKER"
printf 'PASS: explicit pg_restore command path\n'

FULL_OUTPUT="$TEST_ROOT/verify-full.out"
run_with_env bash "$VERIFY_SCRIPT" --full >"$FULL_OUTPUT" 2>&1
assert_contains "$MOCK_LOG" 'check --read-data'
assert_not_contains "$FULL_OUTPUT" "$SECRET_MARKER"
printf 'PASS: --full is explicit and requests --read-data\n'

MISSING_FILE_OUTPUT="$TEST_ROOT/missing-file.out"
MOCK_OMIT_PATH='files/canva-api/data/payload.txt'
export MOCK_OMIT_PATH
expect_failure "$MISSING_FILE_OUTPUT" run_with_env bash "$VERIFY_SCRIPT" --full
unset MOCK_OMIT_PATH
assert_contains "$MISSING_FILE_OUTPUT" 'full SHA256SUMS verification failed'
printf 'PASS: full verification catches a missing file outside the quick restore scope\n'

LIST_OUTPUT="$TEST_ROOT/list.out"
run_with_env bash "$RESTORE_SCRIPT" --list >"$LIST_OUTPUT" 2>&1
assert_contains "$LIST_OUTPUT" 'snapshot-12345678'
INSPECT_OUTPUT="$TEST_ROOT/inspect.out"
run_with_env bash "$RESTORE_SCRIPT" --inspect snapshot-12345678 >"$INSPECT_OUTPUT" 2>&1
assert_contains "$MOCK_LOG" 'ls --long snapshot-12345678'
assert_not_contains "$INSPECT_OUTPUT" "$SECRET_MARKER"
printf 'PASS: list and inspect are non-mutating\n'

INVALID_OUTPUT="$TEST_ROOT/invalid-target.out"
INVALID_DESTINATION="$TEST_ROOT/invalid-target"
expect_failure "$INVALID_OUTPUT" run_with_env bash "$RESTORE_SCRIPT" --extract snapshot-12345678 --target not-allowed --destination "$INVALID_DESTINATION"
assert_contains "$INVALID_OUTPUT" 'unknown target'
[[ ! -e "$INVALID_DESTINATION" ]] || fail 'invalid target created a destination'

NONEMPTY_DESTINATION="$TEST_ROOT/nonempty"
mkdir -p "$NONEMPTY_DESTINATION"
printf 'keep me\n' >"$NONEMPTY_DESTINATION/keep.txt"
NONEMPTY_OUTPUT="$TEST_ROOT/nonempty.out"
expect_failure "$NONEMPTY_OUTPUT" run_with_env bash "$RESTORE_SCRIPT" --extract snapshot-12345678 --target unifil-exams --destination "$NONEMPTY_DESTINATION"
assert_contains "$NONEMPTY_OUTPUT" 'new or empty'
assert_contains "$NONEMPTY_DESTINATION/keep.txt" 'keep me'

LIVE_OUTPUT="$TEST_ROOT/live.out"
before_live_log_lines="$(wc -l <"$MOCK_LOG")"
expect_failure "$LIVE_OUTPUT" run_with_env bash "$RESTORE_SCRIPT" --extract snapshot-12345678 --target grade-app --destination "$LIVE_ROOT"
after_live_log_lines="$(wc -l <"$MOCK_LOG")"
assert_contains "$LIVE_OUTPUT" 'protected live path'
[[ "$before_live_log_lines" == "$after_live_log_lines" ]] || fail 'protected live path reached Restic'
printf 'PASS: allowlist, empty-destination protection, and live-path boundary\n'

STAGING_ROOT="$TEST_ROOT/staging"
mkdir -p "$STAGING_ROOT"
for target_name in unifil-exams canva-api grade-app eron-dashboard mirror-legacy supabase-postgres supabase-storage supabase-functions supabase-snippets secrets all; do
  target_destination="$STAGING_ROOT/$target_name"
  target_output="$TEST_ROOT/extract-$target_name.out"
  run_with_env bash "$RESTORE_SCRIPT" --extract snapshot-12345678 --target "$target_name" --destination "$target_destination" >"$target_output" 2>&1
  assert_not_contains "$target_output" "$SECRET_MARKER"
done
[[ -f "$STAGING_ROOT/unifil-exams/files/unifil-exams/uploads/payload.txt" ]] || fail 'unifil uploads extraction missing'
[[ -f "$STAGING_ROOT/unifil-exams/files/unifil-exams/gabaritos/payload.txt" ]] || fail 'unifil gabaritos extraction missing'
[[ -f "$STAGING_ROOT/unifil-exams/databases/unifil-exams/unifil-exams.db" ]] || fail 'unifil database extraction missing'
[[ -f "$STAGING_ROOT/canva-api/files/canva-api/data/payload.txt" ]] || fail 'Canva data extraction missing'
[[ -f "$STAGING_ROOT/canva-api/databases/canva-api/canva-api.db" ]] || fail 'Canva database extraction missing'
[[ -f "$STAGING_ROOT/grade-app/files/grade-app/grade_app_grade_data/payload.txt" ]] || fail 'active Grade files extraction missing'
[[ -f "$STAGING_ROOT/grade-app/files/grade-app/grade-app_grade_data/payload.txt" ]] || fail 'historical Grade files extraction missing'
[[ -f "$STAGING_ROOT/grade-app/databases/grade-app/grade_lab.db" ]] || fail 'Grade root database extraction missing'
[[ -f "$STAGING_ROOT/grade-app/databases/grade-app/hosts/grade_app/grade_lab.db" ]] || fail 'Grade database extraction missing'
[[ -f "$STAGING_ROOT/eron-dashboard/files/eron-dashboard/payload.txt" ]] || fail 'dashboard files extraction missing'
[[ -f "$STAGING_ROOT/eron-dashboard/databases/eron-dashboard/eron-dashboard.db" ]] || fail 'dashboard database extraction missing'
[[ -f "$STAGING_ROOT/mirror-legacy/files/mirror-legacy/payload.txt" ]] || fail 'mirror files extraction missing'
[[ -f "$STAGING_ROOT/mirror-legacy/databases/mirror-legacy/mirror-legacy.db" ]] || fail 'mirror database extraction missing'
[[ -f "$STAGING_ROOT/supabase-postgres/databases/supabase/postgres.dump" ]] || fail 'Supabase dump extraction missing'
[[ -f "$STAGING_ROOT/supabase-postgres/databases/supabase/_supabase.dump" ]] || fail 'Supabase secondary dump extraction missing'
[[ -f "$STAGING_ROOT/supabase-postgres/files/supabase/db/payload.txt" ]] || fail 'Supabase recovery config extraction missing'
[[ -f "$STAGING_ROOT/supabase-postgres/files/supabase/api/payload.txt" ]] || fail 'Supabase API config extraction missing'
[[ -f "$STAGING_ROOT/supabase-postgres/files/supabase/pooler/payload.txt" ]] || fail 'Supabase pooler config extraction missing'
[[ -f "$STAGING_ROOT/supabase-postgres/files/supabase/db-config/payload.txt" ]] || fail 'Supabase DB config extraction missing'
[[ -f "$STAGING_ROOT/supabase-storage/files/supabase/storage/payload.txt" ]] || fail 'Supabase storage extraction missing'
[[ -f "$STAGING_ROOT/supabase-functions/files/supabase/functions/payload.txt" ]] || fail 'Supabase functions extraction missing'
[[ -f "$STAGING_ROOT/supabase-snippets/files/supabase/snippets/payload.txt" ]] || fail 'Supabase snippets extraction missing'
[[ -f "$STAGING_ROOT/secrets/secrets/allowed.env" ]] || fail 'secret extraction missing'
assert_not_contains "$TEST_ROOT/extract-secrets.out" "$SECRET_MARKER"
printf 'PASS: every allowed target extracts its database/files scope to staging\n'

for root in UniFil-Exams Canva Canva_Api mirror-server supabase-docker Grade-App grade_app mirror-pg eron-dashboard Eron_language_tool logisim-proxy; do
  assert_contains "$RESTORE_SCRIPT" "/home/eronp/$root"
done
if grep -Eq '(^|[[:space:]])(docker|docker-compose|systemctl|rm)([[:space:]]|$)' "$RESTORE_SCRIPT"; then
  fail 'restore script contains a live-service or deletion command'
fi
printf 'PASS: default live-root denylist and no live mutation path\n'
printf 'ALL TESTS PASSED\n'
