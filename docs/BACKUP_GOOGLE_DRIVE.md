---
title: Google Drive Backup
tags:
  - operations/backup
  - project/unifil-exams
status: active
---

# UniFil Exams — Google Drive backup

This package creates a consistent SQLite snapshot while the Docker app keeps
running, archives it with `public/uploads/` and `public/gabaritos/`, writes
SHA-256 manifests, and uploads the result with `rclone`.

The implementation uses the installed container's Node.js and
`better-sqlite3` `backup()` API through the existing `/app/data` bind mount. It
does not plain-copy the live database, stop the app, restart the app, install
rclone, or install credentials.

> [!warning]
> This host currently has no rclone remote configured. Google Drive access has
> not been tested or used by this package implementation. Configure the remote
> once, then run the installer/checks below.

## Files and defaults

- Source script: `ops/backup/backup-google-drive.sh`
- Installer/check: `ops/backup/install-google-drive-backup.sh`
- User service: `unifil-exams-google-drive-backup.service`
- User timer: `unifil-exams-google-drive-backup.timer`
- Example config: `ops/backup/google-drive-backup.env.example`
- Default repository: `/home/eronp/UniFil-Exams`
- Default container: `unifil-exams-release`
- Default destination example: `unifil-drive:UniFil-Exams/backups`
- Local archives: `/home/eronp/UniFil-Exams/.backups/google-drive/`
- Narrow temporary directory: `/home/eronp/UniFil-Exams/data/.unifil-exams-backup/`

The local archive directory and SQLite staging directory are ignored by Git.
The staging directory is inside the host `data/` bind mount so the container's
online backup API can write the snapshot without touching the live database
file directly.

## One-time rclone OAuth setup

Run this as the same Unix user that will own the systemd user timer. These
commands are intentionally not run by the installer.

For a workstation with a browser, use a Google OAuth Desktop client ID and
secret created for this purpose. Enter them interactively; do not commit them
to this repository. The current rclone Google Drive flow warns that its shared
client is being retired during 2026, so relying on the shared default is not
recommended. See the official [rclone Google Drive setup](https://rclone.org/drive/) page for
the client setup details.

```bash
rclone config
# n                         (new remote)
# name> unifil-drive
# Storage> drive
# client_id>                (paste your OAuth Desktop client ID)
# client_secret>            (paste your OAuth Desktop client secret)
# scope> 1                  (Full access all files)
# service_account_file>     (press Enter)
# Edit advanced config? n
# Use web browser to automatically authenticate rclone with remote? y
# Configure this as a Shared Drive (Team Drive)? n
# Keep this "unifil-drive" remote? y
```

When rclone asks for the remote name or storage type using slightly different
prompt text, use the same values: remote name `unifil-drive`, storage `drive`,
scope `1`, and the client ID/secret entered only at the interactive prompts.
Leave the service-account path blank, complete the browser consent flow, answer
`n` for Shared Drive unless this is a Shared Drive, and keep the remote with
`y`.

For a headless server, answer `n` to the browser question on the server. Follow the
server's displayed authorization instructions. On a browser-enabled machine
with the same rclone version, the usual helper command is:

```bash
rclone authorize drive
```

Copy the generated token JSON into the server's pending rclone prompt. Finish
the server-side `rclone config` flow and verify only the remote name/path. The
helper is documented at the official [rclone authorize](https://rclone.org/commands/rclone_authorize/) page.

```bash
rclone listremotes
rclone lsd 'unifil-drive:UniFil-Exams'
```

Do not paste the token into this repository, the backup env file, a shell
history entry, or a ticket. rclone stores OAuth configuration in its own user
configuration. This package does not read it for display and never prints it.

## Destination and configuration

Create or edit the installed, user-only config:

```bash
install -d -m 0750 "$HOME/.config/unifil-exams"
install -m 0600 ops/backup/google-drive-backup.env.example \
  "$HOME/.config/unifil-exams/google-drive-backup.env"
```

Set these values, at minimum:

```env
UNIFIL_EXAMS_REPO=/home/eronp/UniFil-Exams
BACKUP_CONTAINER=unifil-exams-release
RCLONE_DESTINATION=unifil-drive:UniFil-Exams/backups
```

`RCLONE_DESTINATION` is an rclone `remote:path`. The path may be changed to a
different folder, for example `unifil-drive:UniFil-Exams/production-backups`. Optional
`RCLONE_BIN`, `DOCKER_BIN`, and `BACKUP_LOCAL_DIR` variables are
documented in the example file. Do not override the narrow temporary
directory: it must remain under the host `data/` bind mount.

## Install the daily timer

From the repository checkout:

```bash
bash ops/backup/install-google-drive-backup.sh --dry-run --repo /home/eronp/UniFil-Exams
bash ops/backup/install-google-drive-backup.sh --check --repo /home/eronp/UniFil-Exams
bash ops/backup/install-google-drive-backup.sh --install --repo /home/eronp/UniFil-Exams
```

The installer writes only these scoped user paths:

- `~/.local/libexec/unifil-exams/backup-google-drive.sh`
- `~/.config/unifil-exams/google-drive-backup.env` (created once; an existing
  config is preserved)
- `~/.config/systemd/user/unifil-exams-google-drive-backup.service`
- `~/.config/systemd/user/unifil-exams-google-drive-backup.timer`

It then runs `systemctl --user daemon-reload` and enables/starts only the timer.
No `sudo`, system-wide unit, cron entry, rclone install, credential copy, or
OAuth-token output is involved.

The timer runs once per day at **03:15 in `America/Sao_Paulo`** and has
`Persistent=true`, so a missed run is started when the user systemd instance
returns.

## Manual test and checks

Manual execution and the systemd service call the same installed script:

```bash
"$HOME/.local/libexec/unifil-exams/backup-google-drive.sh"
```

Before the first manual run, confirm the container is running and the rclone
remote exists. The script itself verifies the container and directories, takes
the online SQLite backup, creates a timestamped UTC/hostname archive such as
`unifil-exams-20260811T031500123456789Z-server.tar.gz`, and writes its adjacent
`*.tar.gz.sha256` checksum. The archive also contains `MANIFEST.sha256` with
checksums for the included files.

Check timer/service state and logs:

```bash
systemctl --user status unifil-exams-google-drive-backup.timer
systemctl --user list-timers 'unifil-exams-google-drive-backup.timer'
journalctl --user -u unifil-exams-google-drive-backup.service --since today --no-pager
```

To run through systemd immediately without changing the schedule:

```bash
systemctl --user start unifil-exams-google-drive-backup.service
```

If an upload fails, the local archive and checksum are intentionally retained
under `.backups/google-drive/` and the script exits nonzero. The script uses a
non-blocking `flock`, cleans only its run-specific staging directory with an
exit/signal trap, and never runs `rclone delete`, `purge`, or `sync`.

## Restore procedure

Restore only during a planned maintenance window. The application must be
stopped before replacing SQLite or restoring upload directories.

1. Select an archive and its adjacent checksum, then verify the archive before
   extraction:

   ```bash
   REPO=/home/eronp/UniFil-Exams
   ARCHIVE="$REPO/.backups/google-drive/unifil-exams-<UTC>-<hostname>.tar.gz"
   CHECKSUM="$ARCHIVE.sha256"
   (cd "$(dirname "$ARCHIVE")" && sha256sum --check "$(basename "$CHECKSUM")")
   ```

2. Extract into a new temporary directory and inspect the archive manifest:

   ```bash
   RESTORE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/unifil-exams-restore.XXXXXX")"
   trap 'rm -rf -- "$RESTORE_DIR"' EXIT
   tar -xzf "$ARCHIVE" -C "$RESTORE_DIR" --no-same-owner
   cat "$RESTORE_DIR/MANIFEST.sha256"
   ```

3. Stop the app and timer before replacement:

   ```bash
   systemctl --user stop unifil-exams-google-drive-backup.timer
   cd "$REPO"
   docker compose stop app
   ```

4. Preserve the current paths as a rollback copy, then restore the three
   archive paths. Use a unique suffix; do not delete the rollback copy until
   the app has been verified.

   ```bash
   RESTORE_STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
   mv -- "$REPO/data/unifil-exams.db" "$REPO/data/unifil-exams.db.pre-restore-$RESTORE_STAMP"
   mv -- "$REPO/public/uploads" "$REPO/public/uploads.pre-restore-$RESTORE_STAMP"
   mv -- "$REPO/public/gabaritos" "$REPO/public/gabaritos.pre-restore-$RESTORE_STAMP"
   cp -a -- "$RESTORE_DIR/data/unifil-exams.db" "$REPO/data/unifil-exams.db"
   cp -a -- "$RESTORE_DIR/public/uploads" "$REPO/public/uploads"
   cp -a -- "$RESTORE_DIR/public/gabaritos" "$REPO/public/gabaritos"
   rm -f -- "$REPO/data/unifil-exams.db-wal" "$REPO/data/unifil-exams.db-shm"
   ```

5. Start the app, verify the database and uploads in the UI, then re-enable the
   timer:

   ```bash
   docker compose start app
   systemctl --user start unifil-exams-google-drive-backup.timer
   ```

If the restore is not acceptable, stop the app again and move the three
`*.pre-restore-<timestamp>` paths back into place. Remote retention/deletion is
disabled by default; this package does not automatically remove old remote or
local archives. Any future retention policy must be reviewed and scheduled as
a separate, explicit operation.
