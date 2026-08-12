---
title: Server-wide encrypted Restic backup
tags:
  - operations/backup
  - operations/restic
  - security/recovery
status: active
---

# Server-wide encrypted Restic backup

This runbook covers the encrypted, system-wide backup stored in Restic over
rclone Google Drive. The backup job creates application-consistent exports
while containers remain running. Verification and restore staging are
read-only with respect to live services.

> [!warning]
> The Restic password is the recovery boundary. If the password is lost, the
> encrypted snapshots cannot be decrypted, even if the Google Drive files and
> the rclone OAuth token still exist. Save the password offline and outside the
> same Google Drive account.

## Fixed paths and storage

The operator configuration and password paths are fixed:

- Configuration: <code>~/.config/server-backup/system-backup.env</code>
- Restic password: <code>~/.config/server-backup/restic-password</code>
- Restic repository: <code>rclone:unifil-drive:Servidor-Eron/backup-restic</code>

The repository is encrypted by Restic. Never upload a raw archive, a copied
database, a plaintext secret, or the Restic password with <code>rclone</code>.
The backup/verification tools pass the password file directly to Restic and
do not print its contents.

The verification and restore scripts prepend <code>$HOME/.local/bin</code> to
<code>PATH</code> for noninteractive SSH sessions. Their Restic calls also
pass <code>-o rclone.program=$RCLONE_BIN</code>, so the rclone executable is
explicit even when the SSH service PATH is minimal. The configured
<code>RCLONE_BIN</code> may be overridden for a controlled installation.

The Google Drive connector authorization and the server's rclone OAuth
authorization are separate grants. A connected Google Drive app does not
authorize the <code>unifil-drive</code> rclone remote; reconnecting rclone does
not grant the app access to Drive. If Gmail is used for operational mail or
alerts, its Gmail OAuth grant is a third authorization and is not a substitute
for either Drive grant.

Check the rclone remote without exposing credentials:

~~~bash
rclone listremotes
rclone lsd 'unifil-drive:Servidor-Eron'
~~~

If the remote needs reauthorization, do that on the server with rclone's
normal OAuth flow. Do not paste the OAuth token into this repository or into
the Restic password file.

Recommended local permissions:

~~~bash
chmod 700 "$HOME/.config/server-backup"
chmod 600 "$HOME/.config/server-backup/system-backup.env"
chmod 600 "$HOME/.config/server-backup/restic-password"
~~~

## Snapshot inventory

Every snapshot uses this top-level layout. <code>metadata/inventory.tsv</code>
is the machine-readable inventory for the particular snapshot; the allowlisted
secrets are listed by the backup configuration, not by a broad home-directory
glob.

~~~text
databases/
  unifil-exams/
    *.db, *.sqlite, or *.sqlite3
  canva-api/
    *.db, *.sqlite, or *.sqlite3
  grade-app/
    grade_lab.db                         # Grade application snapshot
    volumes/
      grade_app_grade_data/
        grade_lab.db                     # active Grade artifact
      grade-app_grade_data/
        grade_lab.db                     # orphan historical Grade artifact
    hosts/
      Grade-App/
        grade_lab.db                     # host copy
      grade_app/
        grade_lab.db                     # host copy
  eron-dashboard/
    *.db, *.sqlite, or *.sqlite3
  mirror-legacy/
    *.db, *.sqlite, or *.sqlite3
  supabase/
    postgres.dump
    _supabase.dump
    globals.sql
files/
  unifil-exams/
    uploads/
    gabaritos/
  canva-api/
    data/
  grade-app/
    grade_app_grade_data/
    grade-app_grade_data/
  eron-dashboard/
  mirror-legacy/
  supabase/
    storage/
    functions/
    snippets/
    db-config/
    api/
    pooler/
    db/
secrets/
  <files from the configured, explicit secrets allowlist>
metadata/
  SHA256SUMS
  inventory.tsv
~~~

Inventory meaning:

- <code>databases/&lt;app&gt;/...</code> contains the application SQLite
  snapshots. Verification requires more than five SQLite files, requires a
  database directory for each named application, and runs Python stdlib
  <code>sqlite3</code> <code>PRAGMA integrity_check</code> against every
  <code>*.db</code>, <code>*.sqlite</code>, and <code>*.sqlite3</code> file
  found. The live server does not need a host <code>sqlite3</code> package.
- The five required Grade database paths are the staged paths shown above;
  <code>metadata/inventory.tsv</code> must record those repository-relative
  paths. It may also record the original host source path in a separate
  column, but verification must not depend on an absolute
  <code>/home/eronp/...</code> token.
- <code>databases/supabase/postgres.dump</code> and
  <code>databases/supabase/_supabase.dump</code> are both checked with
  <code>pg_restore --list</code>; every <code>*.dump</code> below that
  directory is checked and <code>globals.sql</code> must be nonempty. By
  default the check runs through
  <code>docker exec -i supabase-db pg_restore --list</code>, because the live
  server does not require a host <code>pg_restore</code>. An explicit
  <code>PG_RESTORE_BIN</code> can be configured when appropriate.
- <code>files/</code> contains the persistent files for the named
  applications and Supabase storage, functions, snippets, and recovery
  configuration areas. The application database and file areas are kept
  under matching <code>databases/&lt;app&gt;</code> and
  <code>files/&lt;app&gt;</code> roots so a target restore can include both.
- The Grade application has two similarly named persistent artifacts in the
  live inventory:
  <code>grade_app_grade_data</code> is the active artifact, while
  <code>grade-app_grade_data</code> is an orphan historical artifact. Preserve
  both in backup/restore staging until the owner confirms which historical
  data is needed.
- The active/historical Grade database paths reported by the host inventory
  are <code>/home/eronp/Grade-App/grade_lab.db</code> and
  <code>/home/eronp/grade_app/grade_lab.db</code>, respectively. Treat the
  casing and directory name as significant; do not merge them based only on
  the filename.
- <code>secrets/</code> contains only the configured allowlist. It is inside
  encrypted Restic, but an extracted restore destination is plaintext and
  must be protected like production secrets.
- <code>metadata/SHA256SUMS</code> covers the staged data files.
  <code>metadata/inventory.tsv</code> records what the backup engine intended
  to capture and is required for verification.

The following do not need a database backup: the language tool, the Caddy
proxy, Supabase stateless services, and source code. Git repositories and
their deployment configuration rebuild those components. Runtime caches,
<code>node_modules</code>, <code>.next</code>, container images, logs, and
other reproducible artifacts are also excluded unless the explicit inventory
says otherwise.

## First setup and first backup

1. Install Restic, rclone, Python 3, and the system-backup service/timer from
   the primary installation procedure. Give the verifier access to Docker
   and the running <code>supabase-db</code> container for PostgreSQL
   catalogue checks. A host <code>sqlite3</code> or
   <code>pg_restore</code> binary is optional; the default verification path
   uses Python stdlib SQLite checks and
   <code>docker exec -i supabase-db pg_restore --list</code>.
2. Configure <code>unifil-drive</code> with rclone OAuth and confirm the remote
   path without copying any plaintext data.
3. Create the fixed configuration and password files. The configuration must
   point to the fixed repository above; the password file must contain only
   the Restic password and must be stored independently of Drive.
4. Confirm the backup allowlist and the live-path protection list before the
   first run. Do not add an entire home directory as a shortcut.
5. For a user-level systemd timer, enable user lingering for the service
   account. Without lingering, the timer stops when the user logs out:

~~~bash
loginctl enable-linger eronp
loginctl show-user eronp -p Linger
systemctl --user daemon-reload
~~~

6. Run the idempotent installer from the repository. It generates the Restic
   password only when none exists, preserves an existing configuration and
   password, installs the user service/timer, and enables the timer. Safeguard
   the generated password independently before relying on the remote copy.

~~~bash
bash ops/system-backup/install-system-backup.sh --check \
  --repo /home/eronp/UniFil-Exams
bash ops/system-backup/install-system-backup.sh --install \
  --repo /home/eronp/UniFil-Exams
~~~

7. Start one foreground backup through the installed service and inspect its
   journal. The engine initializes the encrypted Restic repository only when
   Restic explicitly reports that the repository does not exist; authentication
   and other repository errors fail closed.

~~~bash
systemctl --user start server-all-systems-backup.service
systemctl --user status server-all-systems-backup.service --no-pager
journalctl --user -u server-all-systems-backup.service --since today --no-pager
~~~

The first successful run must leave a Restic snapshot with all four top-level
directories and an inventory containing the expected database, file, secret,
and metadata entries.

## Health, status, and retention

Use the service, timer, journal, and repository views together:

~~~bash
systemctl --user status server-all-systems-backup.timer --no-pager
systemctl --user list-timers 'server-all-systems-backup.timer'
journalctl --user -u server-all-systems-backup.service --since '7 days ago' --no-pager
restic --repo 'rclone:unifil-drive:Servidor-Eron/backup-restic' \
  --password-file "$HOME/.config/server-backup/restic-password" snapshots
~~~

Retention is a policy decision, not a substitute for verification. The
installed defaults retain 14 daily, 8 weekly, and 12 monthly snapshots.
Pruning is disabled by default; enable it in the configuration only after the
first backup and verification have succeeded.

~~~bash
restic --repo 'rclone:unifil-drive:Servidor-Eron/backup-restic' \
  --password-file "$HOME/.config/server-backup/restic-password" \
  forget --keep-daily 14 --keep-weekly 8 --keep-monthly 12
~~~

Do not prune while investigating a failed verification, a missing password,
an expired OAuth grant, or suspected repository corruption.

## Verification

The default verifies the newest snapshot. It checks Restic repository
metadata, restores only <code>metadata/</code> and <code>databases/</code> into
a new temporary directory, validates only the checksum entries for those
restored roots, requires a nonempty <code>metadata/inventory.tsv</code>,
checks every discovered SQLite file, checks every PostgreSQL dump structure,
and checks that <code>globals.sql</code> is nonempty. This filtered checksum
scope is intentional: the quick restore does not contain
<code>files/</code> or <code>secrets/</code>.

~~~bash
bash ops/system-backup/verify-system-backup.sh
bash ops/system-backup/verify-system-backup.sh --latest
bash ops/system-backup/verify-system-backup.sh --snapshot SNAPSHOT_ID
~~~

<code>--full</code> is explicit because it reads all packed repository data and
restores all snapshot roots and checks the complete checksum manifest; it can
take substantially longer:

~~~bash
bash ops/system-backup/verify-system-backup.sh --full
~~~

The verification directory is a new <code>mktemp</code> directory and is
removed by the verification script after the check. No container is stopped
or restarted.

## Selective restore to staging

List snapshots and inspect a snapshot's paths without extracting file
contents:

~~~bash
bash ops/system-backup/restore-system-backup.sh --list
bash ops/system-backup/restore-system-backup.sh --inspect SNAPSHOT_ID
~~~

Extract only to a dedicated, new or empty absolute staging directory. The
parent directory must already exist. The restore tool rejects protected live
paths, refuses a nonempty destination, has no replace flag, never deletes
anything, and never starts or stops containers.

~~~bash
STAGING=/var/tmp/system-backup-restore-SNAPSHOT_ID
mkdir -m 700 "$STAGING"
bash ops/system-backup/restore-system-backup.sh \
  --extract SNAPSHOT_ID \
  --target unifil-exams \
  --destination "$STAGING"
~~~

The extracted tree preserves the snapshot-relative path. Target routing is:

| Target | Included snapshot path |
| --- | --- |
| <code>unifil-exams</code> | <code>databases/unifil-exams</code> and <code>files/unifil-exams</code> |
| <code>canva-api</code> | <code>databases/canva-api</code> and <code>files/canva-api</code> |
| <code>grade-app</code> | <code>databases/grade-app</code> and <code>files/grade-app</code>, including both Grade artifacts |
| <code>eron-dashboard</code> | <code>databases/eron-dashboard</code> and <code>files/eron-dashboard</code> |
| <code>mirror-legacy</code> | <code>databases/mirror-legacy</code> and <code>files/mirror-legacy</code> |
| <code>supabase-postgres</code> | <code>databases/supabase</code> and <code>files/supabase/{api,pooler,db,db-config}</code> |
| <code>supabase-storage</code> | <code>files/supabase/storage</code> |
| <code>supabase-functions</code> | <code>files/supabase/functions</code> |
| <code>supabase-snippets</code> | <code>files/supabase/snippets</code> |
| <code>secrets</code> | <code>secrets</code> |
| <code>all</code> | the complete snapshot |

For example, after extracting <code>grade-app</code>, compare both
<code>$STAGING/files/grade-app/grade_app_grade_data/</code> and
<code>$STAGING/files/grade-app/grade-app_grade_data/</code> with the
<code>metadata/inventory.tsv</code> and the live inventory. Also review
<code>$STAGING/databases/grade-app/grade_lab.db</code>,
<code>$STAGING/databases/grade-app/volumes/grade_app_grade_data/grade_lab.db</code>,
<code>$STAGING/databases/grade-app/volumes/grade-app_grade_data/grade_lab.db</code>,
and both files below <code>$STAGING/databases/grade-app/hosts/</code>. The
two host database candidates are reviewed separately:

- Active candidate: <code>/home/eronp/Grade-App/grade_lab.db</code>
- Historical/orphan candidate: <code>/home/eronp/grade_app/grade_lab.db</code>

To confirm the active volume before any manual action, inspect mounts and
volume labels without changing them:

~~~bash
docker volume inspect grade_app_grade_data
docker volume inspect grade-app_grade_data
docker inspect GRADE_CONTAINER \
  --format '{{range .Mounts}}{{println .Name .Source .Destination}}{{end}}'
~~~

Choose active versus historical by the current container mount and the
inventory labels, not by filename or casing. If the request is for historical
data, extract the historical artifact to its own new staging directory and
read/copy only from there. Never extract either candidate into
<code>/home/eronp/Grade-App</code> or <code>/home/eronp/grade_app</code>, and
never overwrite any of the five staged <code>grade_lab.db</code> files in the
staging command.

The default restore denylist also protects
<code>/home/eronp/UniFil-Exams</code>, <code>/home/eronp/Canva</code>,
<code>/home/eronp/Canva_Api</code>, <code>/home/eronp/canva-api</code>,
<code>/home/eronp/mirror-server</code>,
<code>/home/eronp/supabase-docker</code>, <code>/home/eronp/Grade-App</code>,
<code>/home/eronp/grade_app</code>, <code>/home/eronp/mirror-pg</code>,
<code>/home/eronp/eron-dashboard</code>,
<code>/home/eronp/Eron_language_tool</code>, and
<code>/home/eronp/logisim-proxy</code>. Keep staging outside all of them.

For secrets, review <code>$STAGING/secrets/</code> with restricted permissions.
Do not copy an extracted secret into chat, logs, tickets, or an unencrypted
cloud folder.

## Manual live-replacement checklist

Live replacement is deliberately outside the restore script. Perform it only
after an explicit change/maintenance approval and a human confirmation of the
snapshot ID, target, and rollback location.

1. Record the incident/change ID, affected service, target, snapshot ID, and
   expected downtime. Run verification first.
2. Extract the target to a new staging directory and review its inventory and
   checksums. Keep the staging directory private.
3. For Grade, explicitly record whether the active
   <code>grade_app_grade_data</code> artifact or the orphan historical
   <code>grade-app_grade_data</code> artifact is being used. Record the source
   path (<code>/home/eronp/Grade-App/grade_lab.db</code> or
   <code>/home/eronp/grade_app/grade_lab.db</code>) and the reason.
4. Confirm the live path is not the extraction destination. Confirm which
   containers or services own the data.
5. At the approved maintenance boundary, stop only the affected application
   or container manually. The restore script does not do this.
6. Move or copy the current live data to a timestamped, access-controlled
   rollback location. Preserve it until post-restore validation succeeds; do
   not delete it as part of the first replacement attempt.
7. Replace only the approved target from the staging tree:
   - SQLite: preserve the current database and replace the database file only
     while its application is stopped; account for any WAL/SHM files.
   - PostgreSQL: review <code>pg_restore --list</code>, restore into the
     approved database, and apply <code>globals.sql</code> only after checking
     roles and ownership.
   - Persistent files: compare the staged tree and copy only the approved
     file area.
   - Secrets: install with the intended owner/mode and rotate any credential
     that may have been exposed during the incident.
8. Start the affected service manually, run its health checks, check logs, and
   perform a representative read/write test.
9. Keep the rollback copy and the verified snapshot until the owner accepts
   the result. Record exactly what changed.

Rollback is the same controlled boundary in reverse: stop the affected
service, restore the preserved live data to its original path, start it,
rerun health checks, and retain evidence. If validation fails, stop and
rollback; do not improvise a second live replacement from an unverified
snapshot.

## Recovery warnings

- A missing Restic password is unrecoverable by Google Drive, the Google Drive
  connector, Gmail, or rclone OAuth. Maintain an offline recovery copy with
  controlled access.
- An expired rclone OAuth grant affects repository access, not encryption
  recovery. Reauthorize the <code>unifil-drive</code> remote separately and
  rerun verification.
- Never use plaintext copies to work around a Restic or OAuth problem.
- An extracted destination contains plaintext restored data. Restrict its
  permissions and have the operator remove it through the approved host
  cleanup process after the incident; the restore script intentionally never
  deletes it.
