#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
BACKUP_SCRIPT="$SCRIPT_DIR/backup-all-systems.sh"
TEST_PARENT="${TMPDIR:-/tmp}"
[[ "$TEST_PARENT" == /* ]] || { printf 'test temp directory must be absolute\n' >&2; exit 1; }
TEST_ROOT="$(mktemp -d "$TEST_PARENT/system-backup-test.XXXXXX")"
[[ "$TEST_ROOT" == "$TEST_PARENT"/system-backup-test.* ]] || exit 1

cleanup_test_root() {
  local exit_code=$?
  trap - EXIT
  if [[ -n "${TEST_ROOT:-}" && -d "$TEST_ROOT" && "$TEST_ROOT" == "$TEST_PARENT"/system-backup-test.* ]]; then
    rm -rf -- "$TEST_ROOT"
  else
    printf 'refusing to clean an unexpected test path\n' >&2
    exit_code=1
  fi
  exit "$exit_code"
}
trap cleanup_test_root EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

fail() { printf 'SELF-TEST ERROR: %s\n' "$*" >&2; exit 1; }
assert_file() { [[ -f "$1" ]] || fail "expected file is missing"; }
assert_directory() { [[ -d "$1" ]] || fail "expected directory is missing"; }
assert_absent() { [[ ! -e "$1" ]] || fail "unexpected path exists"; }
assert_contains() { grep -F -- "$2" "$1" >/dev/null 2>&1 || fail "expected text is missing"; }
assert_absent_text() {
  if grep -F -- "$2" "$1" >/dev/null 2>&1; then fail "unexpected text was found"; fi
}

create_sqlite_fixture() {
  python3 - "$1" <<'PY'
import sqlite3
import sys

connection = sqlite3.connect(sys.argv[1])
try:
    connection.execute("CREATE TABLE fixture (id INTEGER PRIMARY KEY, value TEXT NOT NULL)")
    connection.execute("INSERT INTO fixture(value) VALUES ('fixture-row')")
    connection.commit()
finally:
    connection.close()
PY
}

write_mock_docker() {
  cat > "$MOCK_BIN/docker" <<'MOCK_DOCKER'
#!/usr/bin/env bash
set -Eeuo pipefail
log_path="${MOCK_LOG:?}"
docker_root="${MOCK_DOCKER_ROOT:?}"
fixture_root="${FIXTURE_ROOT:?}"
printf 'docker' >> "$log_path"
printf ' %s' "$@" >> "$log_path"
printf '\n' >> "$log_path"

command_name="${1:-}"
shift || true
case "$command_name" in
  inspect)
    if [[ "$*" == *Config.Image* ]]; then
      printf 'mock/grade-app:test\n'
    elif [[ "$*" == *json*Mounts* ]]; then
      printf '[{"Name":"grade_app_grade_data","Destination":"/app"}]\n'
    else
      printf 'true\n'
    fi
    ;;
  create)
    helper_name=''
    while [[ "${1:-}" != '' ]]; do
      case "$1" in
        --name) helper_name="$2"; shift 2 ;;
        --mount) shift 2 ;;
        *) shift ;;
      esac
    done
    [[ -n "$helper_name" ]] || exit 2
    mkdir -p -- "$docker_root/$helper_name/app/data_analysis"
    cp -- "$fixture_root/grade_history.db" "$docker_root/$helper_name/app/grade_lab.db"
    printf '{"historical":true}\n' > "$docker_root/$helper_name/app/state.json"
    printf 'historical-analysis\n' > "$docker_root/$helper_name/app/data_analysis/result.json"
    printf '%s\n' "$helper_name"
    ;;
  start)
    [[ -n "${1:-}" ]] || exit 2
    ;;
  rm)
    if [[ "${1:-}" == -f ]]; then
      helper_name="${2:-}"
      [[ "$helper_name" == server-backup-*-grade-history ]] || exit 2
      rm -rf -- "$docker_root/$helper_name"
    else
      [[ "${1:-}" == -rf && "${2:-}" == -- ]] || exit 2
      temporary_path="${3:-}"
      container_name="${4:-}"
      [[ "$temporary_path" == /tmp/server-backup-* ]] || exit 2
      rm -rf -- "$docker_root/$container_name$temporary_path"
    fi
    ;;
  exec)
    [[ "${1:-}" != -i ]] || shift
    container_name="${1:-}"
    shift
    subcommand="${1:-}"
    shift
    case "$subcommand" in
      test)
        operator="${1:-}"
        test_path="${2:-}"
        case "$operator" in
          -e) [[ -e "$docker_root/$container_name$test_path" ]] ;;
          -d) [[ -d "$docker_root/$container_name$test_path" ]] ;;
          *) exit 2 ;;
        esac
        ;;
      python3)
        [[ "${1:-}" == - ]] || exit 2
        remote_path="${3:-}"
        cat >/dev/null
        if [[ "$container_name" == *grade-history* ]]; then
          fixture_database="$fixture_root/grade_history.db"
        else
          fixture_database="$fixture_root/grade_active.db"
        fi
        mkdir -p -- "$(dirname -- "$docker_root/$container_name$remote_path")"
        cp -- "$fixture_database" "$docker_root/$container_name$remote_path"
        ;;
      psql)
        [[ "$*" == *"-U postgres"* && "$*" == *"pg_database"* ]] || exit 2
        printf 'postgres\n_supabase\n'
        ;;
      pg_dump)
        [[ "$*" == *"-U postgres"* && "$*" == *"--format=custom"* ]] || exit 2
        database_name=''
        for argument in "$@"; do
          case "$argument" in --dbname=*) database_name="${argument#--dbname=}" ;; esac
        done
        [[ -n "$database_name" ]] || exit 2
        printf 'MOCK-CUSTOM-DUMP-%s\n' "$database_name"
        ;;
      pg_dumpall)
        [[ "$*" == *"-U postgres"* && "$*" == *"--globals-only"* ]] || exit 2
        printf 'CREATE ROLE mock_backup_role;\n'
        ;;
      *) exit 2 ;;
    esac
    ;;
  cp)
    source_spec="${1:-}"
    destination_path="${2:-}"
    container_name="${source_spec%%:*}"
    remote_path="${source_spec#*:}"
    [[ -n "$container_name" && "$remote_path" == /* ]] || exit 2
    [[ -e "$docker_root/$container_name$remote_path" ]] || exit 2
    cp -a -- "$docker_root/$container_name$remote_path" "$destination_path"
    ;;
  *) exit 2 ;;
esac
MOCK_DOCKER
  chmod 700 -- "$MOCK_BIN/docker"
}

write_mock_rclone() {
  cat > "$MOCK_BIN/rclone" <<'MOCK_RCLONE'
#!/usr/bin/env bash
set -Eeuo pipefail
log_path="${MOCK_LOG:?}"
printf 'rclone' >> "$log_path"
printf ' %s' "$@" >> "$log_path"
printf '\n' >> "$log_path"
for argument in "$@"; do
  case "$argument" in copy|copyto|sync|move|cat|mount) exit 91 ;; esac
done
[[ "${1:-}" == version ]] || exit 2
MOCK_RCLONE
  chmod 700 -- "$MOCK_BIN/rclone"
}

write_mock_restic() {
  cat > "$MOCK_BIN/restic" <<'MOCK_RESTIC'
#!/usr/bin/env bash
set -Eeuo pipefail
log_path="${MOCK_LOG:?}"
state_path="${MOCK_STATE:?}"
printf 'restic' >> "$log_path"
printf ' %s' "$@" >> "$log_path"
printf '\n' >> "$log_path"
arguments=("$@")
subcommand=''
repository=''
rclone_program=''
for ((index = 0; index < ${#arguments[@]}; index += 1)); do
  case "${arguments[index]}" in
    snapshots|init|backup|forget) subcommand="${arguments[index]}" ;;
    --repo) repository="${arguments[index + 1]:-}" ;;
    -o)
      option_value="${arguments[index + 1]:-}"
      rclone_program="${option_value#rclone.program=}"
      ;;
  esac
done
[[ "$repository" == rclone:unifil-drive:Servidor-Eron/backup-restic ]] || exit 3
[[ -n "$rclone_program" ]] || exit 4
case "$subcommand" in
  snapshots)
    if [[ -e "$state_path.repo" ]]; then
      exit 0
    fi
    printf '%s\n' \
      'Fatal: unable to open config file: <config/> does not exist' \
      'Is there a repository at the following location?' >&2
    exit 1
    ;;
  init)
    : > "$state_path.repo"
    printf 'init\n' >> "$state_path"
    ;;
  backup)
    printf 'restic-cwd=%s\n' "$PWD" >> "$log_path"
    printf 'backup\n' >> "$state_path"
    [[ "${MOCK_RESTIC_FAIL_BACKUP:-0}" == 1 ]] && exit 42
    "$rclone_program" version >/dev/null 2>&1
    printf '{"message_type":"summary","snapshot_id":"abcdef123456"}\n'
    ;;
  forget) printf 'forget\n' >> "$state_path" ;;
  *) exit 5 ;;
esac
MOCK_RESTIC
  chmod 700 -- "$MOCK_BIN/restic"
}

MOCK_BIN="$TEST_ROOT/mock-bin"
MOCK_LOG="$TEST_ROOT/mock.log"
MOCK_STATE="$TEST_ROOT/mock.state"
MOCK_DOCKER_ROOT="$TEST_ROOT/mock-docker"
FIXTURE_ROOT="$TEST_ROOT/fixtures"
WORK_ROOT="$TEST_ROOT/work"
CONFIG_FILE="$TEST_ROOT/system-backup.env"
PASSWORD_FILE="$TEST_ROOT/restic-password"
mkdir -p -- "$MOCK_BIN" "$MOCK_DOCKER_ROOT" "$FIXTURE_ROOT" "$WORK_ROOT"
: > "$MOCK_LOG"
: > "$MOCK_STATE"

UNIFIL_ROOT="$FIXTURE_ROOT/unifil"
CANVA_ROOT="$FIXTURE_ROOT/canva"
SUPABASE_ROOT="$FIXTURE_ROOT/supabase"
mkdir -p -- \
  "$UNIFIL_ROOT/data" "$UNIFIL_ROOT/public/uploads" "$UNIFIL_ROOT/public/gabaritos" \
  "$CANVA_ROOT/data/nested" "$SUPABASE_ROOT/volumes/storage" \
  "$SUPABASE_ROOT/volumes/functions" "$SUPABASE_ROOT/volumes/snippets" \
  "$SUPABASE_ROOT/volumes/api" "$SUPABASE_ROOT/volumes/pooler" \
  "$SUPABASE_ROOT/volumes/db/data"
UNIFIL_DB="$UNIFIL_ROOT/data/unifil-exams.db"
CANVA_DB="$CANVA_ROOT/data/canvas_bulk_panel.db"
MIRROR_DB="$FIXTURE_ROOT/mirror.db"
GRADE_ACTIVE_DB="$FIXTURE_ROOT/grade_active.db"
GRADE_HISTORY_DB="$FIXTURE_ROOT/grade_history.db"
METRICS_DB="$FIXTURE_ROOT/metrics.db"
GRADE_HOST_PRIMARY="$FIXTURE_ROOT/Grade-App/grade_lab.db"
GRADE_HOST_SECONDARY="$FIXTURE_ROOT/grade_app/grade_lab.db"
mkdir -p -- "$(dirname -- "$GRADE_HOST_PRIMARY")" "$(dirname -- "$GRADE_HOST_SECONDARY")"
create_sqlite_fixture "$UNIFIL_DB"
create_sqlite_fixture "$CANVA_DB"
create_sqlite_fixture "$MIRROR_DB"
create_sqlite_fixture "$GRADE_ACTIVE_DB"
create_sqlite_fixture "$GRADE_HISTORY_DB"
create_sqlite_fixture "$METRICS_DB"
cp -- "$GRADE_ACTIVE_DB" "$GRADE_HOST_PRIMARY"
cp -- "$GRADE_HISTORY_DB" "$GRADE_HOST_SECONDARY"
printf 'upload\n' > "$UNIFIL_ROOT/public/uploads/upload.txt"
printf 'gabarito\n' > "$UNIFIL_ROOT/public/gabaritos/key.txt"
printf 'retain\n' > "$CANVA_ROOT/data/keep.txt"
printf 'nested\n' > "$CANVA_ROOT/data/nested/value.txt"
printf 'raw-wal\n' > "$CANVA_ROOT/data/canvas_bulk_panel.db-wal"
printf 'raw-shm\n' > "$CANVA_ROOT/data/canvas_bulk_panel.db-shm"
printf 'storage\n' > "$SUPABASE_ROOT/volumes/storage/object.txt"
printf 'function\n' > "$SUPABASE_ROOT/volumes/functions/function.sql"
printf 'snippet\n' > "$SUPABASE_ROOT/volumes/snippets/snippet.sql"
printf 'api\n' > "$SUPABASE_ROOT/volumes/api/config.yml"
printf 'pooler\n' > "$SUPABASE_ROOT/volumes/pooler/pooler.yml"
printf 'init\n' > "$SUPABASE_ROOT/volumes/db/init.sql"
printf 'migration\n' > "$SUPABASE_ROOT/volumes/db/migration.sql"
printf 'RAW-PGDATA-MUST-NOT-BACKUP\n' > "$SUPABASE_ROOT/volumes/db/data/PG_VERSION"

mkdir -p -- \
  "$MOCK_DOCKER_ROOT/grade-app/app/data_analysis" \
  "$MOCK_DOCKER_ROOT/eron-dashboard/data" \
  "$MOCK_DOCKER_ROOT/supabase-db/etc/postgresql-custom"
cp -- "$GRADE_ACTIVE_DB" "$MOCK_DOCKER_ROOT/grade-app/app/grade_lab.db"
cp -- "$METRICS_DB" "$MOCK_DOCKER_ROOT/eron-dashboard/data/metrics.db"
printf '{"active":true}\n' > "$MOCK_DOCKER_ROOT/grade-app/app/state.json"
printf 'active-analysis\n' > "$MOCK_DOCKER_ROOT/grade-app/app/data_analysis/result.json"
printf 'shared-preload\n' > "$MOCK_DOCKER_ROOT/supabase-db/etc/postgresql-custom/postgresql.conf"

SECRET_CANVA="$FIXTURE_ROOT/Canva_Api/.env"
SECRET_MIRROR="$FIXTURE_ROOT/mirror-pg/.env"
SECRET_SUPABASE="$FIXTURE_ROOT/supabase-docker/.env"
MISSING_SECRET="$FIXTURE_ROOT/missing:optional.env"
mkdir -p -- "$(dirname -- "$SECRET_CANVA")" "$(dirname -- "$SECRET_MIRROR")" "$(dirname -- "$SECRET_SUPABASE")"
printf 'FAKE_SECRET_CONTENT_MUST_NOT_PRINT\n' > "$SECRET_CANVA"
printf 'FAKE_MIRROR_CONTENT_MUST_NOT_PRINT\n' > "$SECRET_MIRROR"
printf 'FAKE_SUPABASE_CONTENT_MUST_NOT_PRINT\n' > "$SECRET_SUPABASE"
printf 'FAKE_PASSWORD_CONTENT_MUST_NOT_PRINT\n' > "$PASSWORD_FILE"
chmod 600 -- "$PASSWORD_FILE"
write_mock_docke
write_mock_rclone
write_mock_restic

cat > "$CONFIG_FILE" <<EOF
BACKUP_WORK_ROOT=$WORK_ROOT
RESTIC_REPOSITORY=rclone:unifil-drive:Servidor-Eron/backup-restic
RESTIC_PASSWORD_FILE=$PASSWORD_FILE
RESTIC_BIN=$MOCK_BIN/restic
RCLONE_BIN=$MOCK_BIN/rclone
DOCKER_BIN=$MOCK_BIN/docke
PYTHON_BIN=$(command -v python3)
UNIFIL_EXAMS_ROOT=$UNIFIL_ROOT
CANVA_API_ROOT=$CANVA_ROOT
MIRROR_DB_PATH=$MIRROR_DB
SUPABASE_ROOT=$SUPABASE_ROOT
UNIFIL_EXAMS_DB_PATH=$UNIFIL_DB
CANVA_DB_PATH=$CANVA_DB
CANVA_DATA_PATH=$CANVA_ROOT/data
UNIFIL_UPLOADS_PATH=$UNIFIL_ROOT/public/uploads
UNIFIL_GABARITOS_PATH=$UNIFIL_ROOT/public/gabaritos
GRADE_APP_DB_PATH=/app/grade_lab.db
ERON_DASHBOARD_DB_PATH=/data/metrics.db
GRADE_APP_STATE_PATH=/app/state.json
GRADE_APP_ANALYSIS_PATH=/app/data_analysis
GRADE_APP_VOLUME_MOUNT=/app
GRADE_APP_ACTIVE_VOLUME=grade_app_grade_data
GRADE_APP_HISTORICAL_VOLUME=grade-app_grade_data
GRADE_HOST_DB_PRIMARY=$GRADE_HOST_PRIMARY
GRADE_HOST_DB_SECONDARY=$GRADE_HOST_SECONDARY
SUPABASE_PSQL_BIN=psql
SUPABASE_PG_DUMP_BIN=pg_dump
SUPABASE_PG_DUMPALL_BIN=pg_dumpall
SECRET_FILES='$SECRET_CANVA
$SECRET_MIRROR
$SECRET_SUPABASE
$MISSING_SECRET'
KEEP_DAILY=14
KEEP_WEEKLY=8
KEEP_MONTHLY=12
RESTIC_PRUNE=false
EOF
chmod 600 -- "$CONFIG_FILE"

run_backup() {
  local run_id="$1" output_path="$2"
  shift 2
  env \
    MOCK_LOG="$MOCK_LOG" MOCK_STATE="$MOCK_STATE" MOCK_DOCKER_ROOT="$MOCK_DOCKER_ROOT" \
    FIXTURE_ROOT="$FIXTURE_ROOT" BACKUP_CONFIG_FILE="$CONFIG_FILE" BACKUP_RUN_ID="$run_id" \
    bash "$BACKUP_SCRIPT" "$@" > "$output_path" 2>&1
}

assert_status() {
  local expected_result="$1" expected_stage="$2"
  assert_file "$WORK_ROOT/status/latest.env"
  assert_contains "$WORK_ROOT/status/latest.env" "RESULT=$expected_result"
  assert_contains "$WORK_ROOT/status/latest.env" "ERROR_STAGE=$expected_stage"
  assert_absent "$WORK_ROOT/status/.latest.env.20260812T120002Z-success.tmp"
}

EXISTING_RUN="$WORK_ROOT/staging/20260812T115959Z-existing"
mkdir -p -- "$EXISTING_RUN/staging"
printf 'sentinel\n' > "$EXISTING_RUN/staging/sentinel.txt"
EXISTING_OUTPUT="$TEST_ROOT/existing-run.out"
if run_backup 20260812T115959Z-existing "$EXISTING_OUTPUT"; then
  fail "pre-existing run directory was unexpectedly accepted"
fi
assert_file "$EXISTING_RUN/staging/sentinel.txt"

DRY_OUTPUT="$TEST_ROOT/dry-run.out"
run_backup 20260812T120000Z-dry "$DRY_OUTPUT" --dry-run
assert_contains "$DRY_OUTPUT" "dry-run include: databases/supabase/_supabase.dump"
assert_contains "$DRY_OUTPUT" "dry-run include: databases/grade-app/grade_lab.db"
assert_contains "$DRY_OUTPUT" "dry-run include: databases/grade-app/volumes/grade_app_grade_data/grade_lab.db"
assert_contains "$DRY_OUTPUT" "dry-run include: databases/grade-app/volumes/grade-app_grade_data/grade_lab.db"
assert_contains "$DRY_OUTPUT" "dry-run include: databases/grade-app/hosts/Grade-App/grade_lab.db"
assert_contains "$DRY_OUTPUT" "dry-run include: databases/grade-app/hosts/grade_app/grade_lab.db"
assert_contains "$DRY_OUTPUT" "dry-run include: files/supabase/api"
assert_contains "$DRY_OUTPUT" "dry-run include: files/supabase/pooler"
assert_contains "$DRY_OUTPUT" "dry-run include: files/supabase/db/init.sql"
assert_contains "$DRY_OUTPUT" "dry-run include: files/supabase/db-config"
assert_contains "$DRY_OUTPUT" "dry-run include: secrets"
assert_absent_text "$DRY_OUTPUT" "FAKE_SECRET_CONTENT_MUST_NOT_PRINT"
assert_absent_text "$DRY_OUTPUT" "RAW-PGDATA-MUST-NOT-BACKUP"
assert_status dry-run ''
assert_absent "$WORK_ROOT/staging/20260812T120000Z-dry"

FAILED_OUTPUT="$TEST_ROOT/failed-upload.out"
if env \
  MOCK_LOG="$MOCK_LOG" MOCK_STATE="$MOCK_STATE" MOCK_DOCKER_ROOT="$MOCK_DOCKER_ROOT" \
  FIXTURE_ROOT="$FIXTURE_ROOT" MOCK_RESTIC_FAIL_BACKUP=1 \
  BACKUP_CONFIG_FILE="$CONFIG_FILE" BACKUP_RUN_ID=20260812T120001Z-failed \
  bash "$BACKUP_SCRIPT" > "$FAILED_OUTPUT" 2>&1; then
  fail "mocked Restic upload unexpectedly succeeded"
fi
assert_absent_text "$FAILED_OUTPUT" "FAKE_SECRET_CONTENT_MUST_NOT_PRINT"
assert_status failure backup
FAILED_STAGING="$WORK_ROOT/failed/20260812T120001Z-failed/staging"
assert_file "$FAILED_STAGING/databases/grade-app/grade_lab.db"
assert_file "$FAILED_STAGING/databases/grade-app/volumes/grade_app_grade_data/grade_lab.db"
assert_file "$FAILED_STAGING/databases/grade-app/volumes/grade-app_grade_data/grade_lab.db"
assert_file "$FAILED_STAGING/databases/grade-app/hosts/Grade-App/grade_lab.db"
assert_file "$FAILED_STAGING/databases/grade-app/hosts/grade_app/grade_lab.db"
assert_file "$FAILED_STAGING/databases/supabase/postgres.dump"
assert_file "$FAILED_STAGING/databases/supabase/_supabase.dump"
assert_file "$FAILED_STAGING/databases/supabase/globals.sql"
assert_file "$FAILED_STAGING/files/supabase/api/config.yml"
assert_file "$FAILED_STAGING/files/supabase/pooler/pooler.yml"
assert_file "$FAILED_STAGING/files/supabase/db/init.sql"
assert_absent "$FAILED_STAGING/files/supabase/db/data"
assert_file "$FAILED_STAGING/files/supabase/db-config/postgresql.conf"
assert_file "$FAILED_STAGING/secrets$SECRET_CANVA"
assert_file "$FAILED_STAGING/secrets$SECRET_MIRROR"
assert_file "$FAILED_STAGING/secrets$SECRET_SUPABASE"
assert_absent_text "$FAILED_STAGING/metadata/run.env" "FAKE_SECRET_CONTENT_MUST_NOT_PRINT"
assert_absent_text "$FAILED_STAGING/metadata/SHA256SUMS" "RAW-PGDATA-MUST-NOT-BACKUP"
assert_absent_text "$FAILED_OUTPUT" "FAKE_MIRROR_CONTENT_MUST_NOT_PRINT"

SUCCESS_OUTPUT="$TEST_ROOT/success.out"
run_backup 20260812T120002Z-success "$SUCCESS_OUTPUT"
assert_status success ''
assert_contains "$WORK_ROOT/status/latest.env" "SNAPSHOT_ID=abcdef123456"
assert_absent "$WORK_ROOT/staging/20260812T120002Z-success"
assert_absent "$WORK_ROOT/failed/20260812T120002Z-success"
assert_absent_text "$SUCCESS_OUTPUT" "FAKE_SECRET_CONTENT_MUST_NOT_PRINT"
assert_contains "$MOCK_LOG" "restic --repo rclone:unifil-drive:Servidor-Eron/backup-restic"
assert_contains "$MOCK_LOG" "backup --json --one-file-system --tag server-all-systems"
assert_contains "$MOCK_LOG" "restic-cwd=$WORK_ROOT/staging/20260812T120002Z-success"
assert_contains "$MOCK_LOG" "--format=custom"
assert_contains "$MOCK_LOG" "--dbname=_supabase"
assert_contains "$MOCK_LOG" "--globals-only"
assert_contains "$MOCK_LOG" "--tag server-all-systems"
assert_contains "$MOCK_LOG" "--keep-daily 14"
assert_contains "$MOCK_LOG" "--keep-weekly 8"
assert_contains "$MOCK_LOG" "--keep-monthly 12"
assert_absent_text "$MOCK_LOG" "--prune"
if grep -E 'rclone (copy|copyto|sync|move|cat|mount)' "$MOCK_LOG" >/dev/null 2>&1; then
  fail "mocked flow attempted a plaintext rclone transfer"
fi
assert_contains "$SUCCESS_OUTPUT" "verified active Grade volume: grade_app_grade_data"
assert_contains "$MOCK_LOG" "grade-app_grade_data"
backup_count="$(grep -c '^backup$' "$MOCK_STATE")"
forget_count="$(grep -c '^forget$' "$MOCK_STATE")"
init_count="$(grep -c '^init$' "$MOCK_STATE")"
[[ "$backup_count" -eq 2 ]] || fail "unexpected Restic backup invocation count"
[[ "$forget_count" -eq 1 ]] || fail "unexpected Restic forget invocation count"
[[ "$init_count" -eq 1 ]] || fail "unexpected Restic init invocation count"
printf 'system backup self-test passed\n'
