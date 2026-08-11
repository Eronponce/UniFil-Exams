#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

log() {
  printf '[unifil-exams-backup] %s\n' "$*" >&2
}

die() {
  log "ERROR: $*"
  exit 1
}

require_command() {
  local command_name="$1"
  command -v "$command_name" >/dev/null 2>&1 || die "required command not found: $command_name"
}

USER_HOME="${HOME:-}"
[[ -n "$USER_HOME" ]] || die "HOME is not set"

CONFIG_FILE="${BACKUP_CONFIG_FILE:-$USER_HOME/.config/unifil-exams/google-drive-backup.env}"
[[ -r "$CONFIG_FILE" ]] || die "configuration file is not readable: $CONFIG_FILE"

# shellcheck disable=SC1090
set -a
source "$CONFIG_FILE"
set +a

UNIFIL_EXAMS_REPO="${UNIFIL_EXAMS_REPO:-/home/eronp/UniFil-Exams}"
UNIFIL_EXAMS_REPO="${UNIFIL_EXAMS_REPO%/}"
BACKUP_CONTAINER="${BACKUP_CONTAINER:-unifil-exams-release}"
RCLONE_DESTINATION="${RCLONE_DESTINATION:-}"
RCLONE_BIN="${RCLONE_BIN:-rclone}"
DOCKER_BIN="${DOCKER_BIN:-docker}"
BACKUP_LOCAL_DIR="${BACKUP_LOCAL_DIR:-$UNIFIL_EXAMS_REPO/.backups/google-drive}"

CONTAINER_DATA_DIR="${CONTAINER_DATA_DIR:-/app/data}"

[[ "$UNIFIL_EXAMS_REPO" == /* ]] || die "UNIFIL_EXAMS_REPO must be an absolute path"
[[ "$BACKUP_LOCAL_DIR" == /* ]] || die "BACKUP_LOCAL_DIR must be an absolute path"
[[ "$CONTAINER_DATA_DIR" == /* ]] || die "CONTAINER_DATA_DIR must be an absolute container path"
[[ -n "$BACKUP_CONTAINER" && "$BACKUP_CONTAINER" != *[[:space:]]* ]] || die "BACKUP_CONTAINER is invalid"
[[ -n "$RCLONE_DESTINATION" ]] || die "RCLONE_DESTINATION is required"
[[ "$RCLONE_DESTINATION" == *:* ]] || die "RCLONE_DESTINATION must have the form remote:path"
[[ "$RCLONE_DESTINATION" != *[[:space:]]* ]] || die "RCLONE_DESTINATION must not contain whitespace"
[[ -n "${RCLONE_DESTINATION%%:*}" ]] || die "RCLONE_DESTINATION has an empty remote name"

HOST_DATA_DIR="$UNIFIL_EXAMS_REPO/data"
HOST_DB_PATH="$HOST_DATA_DIR/unifil-exams.db"
HOST_UPLOADS_DIR="$UNIFIL_EXAMS_REPO/public/uploads"
HOST_GABARITOS_DIR="$UNIFIL_EXAMS_REPO/public/gabaritos"

# The SQLite snapshot must be created inside the host directory mounted at
# /app/data. Keep this directory fixed and narrow so the container can see it.
EXPECTED_TEMP_DIR="$HOST_DATA_DIR/.unifil-exams-backup"
if [[ "${BACKUP_TEMP_DIR:-$EXPECTED_TEMP_DIR}" != "$EXPECTED_TEMP_DIR" ]]; then
  die "BACKUP_TEMP_DIR must remain $EXPECTED_TEMP_DIR so Docker can see the snapshot"
fi
BACKUP_TEMP_DIR="$EXPECTED_TEMP_DIR"
CONTAINER_TEMP_ROOT="$CONTAINER_DATA_DIR/.unifil-exams-backup"
CONTAINER_DB_PATH="$CONTAINER_DATA_DIR/unifil-exams.db"

for required in "$DOCKER_BIN" "$RCLONE_BIN" flock tar sha256sum hostname date tr mkdir chmod rm cp find sort; do
  require_command "$required"
done

[[ -d "$UNIFIL_EXAMS_REPO" ]] || die "repository directory not found: $UNIFIL_EXAMS_REPO"
[[ -d "$HOST_DATA_DIR" ]] || die "data directory not found: $HOST_DATA_DIR"
[[ -f "$HOST_DB_PATH" ]] || die "SQLite database not found: $HOST_DB_PATH"
[[ -d "$HOST_UPLOADS_DIR" ]] || die "uploads directory not found: $HOST_UPLOADS_DIR"
[[ -d "$HOST_GABARITOS_DIR" ]] || die "gabaritos directory not found: $HOST_GABARITOS_DIR"

CONTAINER_RUNNING="$("$DOCKER_BIN" inspect --format '{{.State.Running}}' "$BACKUP_CONTAINER" 2>/dev/null || true)"
[[ "$CONTAINER_RUNNING" == "true" ]] || die "Docker container is not running: $BACKUP_CONTAINER"

mkdir -p -- "$BACKUP_TEMP_DIR" "$BACKUP_LOCAL_DIR"
chmod 700 -- "$BACKUP_TEMP_DIR" "$BACKUP_LOCAL_DIR"

LOCK_PATH="$BACKUP_TEMP_DIR/backup.lock"
exec 9>"$LOCK_PATH"
if ! flock -n 9; then
  die "another backup is already running (lock: $LOCK_PATH)"
fi

RUN_ID="$(date -u +%Y%m%dT%H%M%S%NZ)-$(hostname -s | tr -cd 'A-Za-z0-9_.-')"
[[ "$RUN_ID" != *- ]] || die "hostname is empty or invalid"
RUN_DIR="$BACKUP_TEMP_DIR/$RUN_ID"
mkdir -- "$RUN_DIR"

cleanup() {
  local exit_code=$?

  if [[ -n "${RUN_DIR:-}" && -d "$RUN_DIR" ]]; then
    case "$RUN_DIR" in
      "$BACKUP_TEMP_DIR"/*)
        if ! rm -rf -- "$RUN_DIR"; then
          log "ERROR: failed to clean temporary run directory: $RUN_DIR"
          exit_code=1
        fi
        ;;
      *)
        log "ERROR: refusing to clean a path outside the backup temp directory: $RUN_DIR"
        exit_code=1
        ;;
    esac
  fi

  exit "$exit_code"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

STAGING_DIR="$RUN_DIR/archive-root"
SNAPSHOT_DB="$RUN_DIR/unifil-exams.db"
CONTAINER_RUN_DIR="$CONTAINER_TEMP_ROOT/$RUN_ID"
CONTAINER_SNAPSHOT_DB="$CONTAINER_RUN_DIR/unifil-exams.db"
mkdir -p -- "$STAGING_DIR/data" "$STAGING_DIR/public"

log "creating an online SQLite backup from $CONTAINER_DB_PATH"
if ! "$DOCKER_BIN" exec "$BACKUP_CONTAINER" node - "$CONTAINER_DB_PATH" "$CONTAINER_SNAPSHOT_DB" <<'NODE'
"use strict";

const Database = require("better-sqlite3");
const fs = require("node:fs");

const sourcePath = process.argv[2];
const destinationPath = process.argv[3];

if (!sourcePath || !destinationPath) {
  throw new Error("source and destination database paths are required");
}

if (fs.existsSync(destinationPath)) {
  throw new Error("refusing to overwrite existing snapshot: " + destinationPath);
}

let source;

(async () => {
  try {
    source = new Database(sourcePath, { fileMustExist: true, readonly: true });
    await source.backup(destinationPath);
  } finally {
    if (source) {
      source.close();
    }
  }

  const snapshot = new Database(destinationPath, { fileMustExist: true, readonly: true });
  try {
    const row = snapshot.prepare("PRAGMA integrity_check").get();
    const result = row && row["integrity_check"];
    if (result !== "ok") {
      throw new Error("snapshot integrity check failed: " + String(result));
    }
  } finally {
    snapshot.close();
  }
})().catch((error) => {
  console.error("online SQLite backup failed: " + error.message);
  process.exitCode = 1;
});
NODE
then
  die "online SQLite backup failed; no application restart was attempted"
fi
[[ -s "$SNAPSHOT_DB" ]] || die "online SQLite backup produced no host snapshot: $SNAPSHOT_DB"

cp -- "$SNAPSHOT_DB" "$STAGING_DIR/data/unifil-exams.db"
cp -a -- "$HOST_UPLOADS_DIR" "$STAGING_DIR/public/"
cp -a -- "$HOST_GABARITOS_DIR" "$STAGING_DIR/public/"

TIMESTAMP_UTC="${RUN_ID%%-*}"
HOSTNAME_SAFE="${RUN_ID#*-}"
ARCHIVE_NAME="unifil-exams-${TIMESTAMP_UTC}-${HOSTNAME_SAFE}.tar.gz"
ARCHIVE_PATH="$BACKUP_LOCAL_DIR/$ARCHIVE_NAME"
CHECKSUM_NAME="$ARCHIVE_NAME.sha256"
CHECKSUM_PATH="$BACKUP_LOCAL_DIR/$CHECKSUM_NAME"
MANIFEST_PATH="$STAGING_DIR/MANIFEST.sha256"

[[ ! -e "$ARCHIVE_PATH" && ! -e "$CHECKSUM_PATH" ]] || die "refusing to overwrite an existing archive: $ARCHIVE_PATH"

{
  printf '# SHA-256 manifest for files in %s\n' "$ARCHIVE_NAME"
  printf '# Paths are relative to the archive root.\n'
  (
    cd -- "$STAGING_DIR"
    LC_ALL=C find data public -type f -print0 |
      LC_ALL=C sort -z |
      while IFS= read -r -d '' relative_path; do
        sha256sum -- "$relative_path"
      done
  )
} > "$MANIFEST_PATH"

tar -C "$STAGING_DIR" -czf "$ARCHIVE_PATH" -- data public MANIFEST.sha256
(
  cd -- "$BACKUP_LOCAL_DIR"
  sha256sum -- "$ARCHIVE_NAME"
) > "$CHECKSUM_PATH"

REMOTE_BASE="${RCLONE_DESTINATION%/}"
log "uploading archive and checksum to $REMOTE_BASE"
if ! "$RCLONE_BIN" copyto "$ARCHIVE_PATH" "$REMOTE_BASE/$ARCHIVE_NAME"; then
  die "archive upload failed; local archive retained at $ARCHIVE_PATH"
fi
if ! "$RCLONE_BIN" copyto "$CHECKSUM_PATH" "$REMOTE_BASE/$CHECKSUM_NAME"; then
  die "checksum upload failed; local archive and checksum retained at $ARCHIVE_PATH and $CHECKSUM_PATH"
fi

log "backup complete: $ARCHIVE_PATH"
