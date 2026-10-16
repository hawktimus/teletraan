#!/bin/sh
# Backs up the Sanity dataset: runs "sanity dataset export" (the command line
# tool in studio/node_modules) into /var/backups/teletraan/production-<date>.tar.gz,
# keeps the newest 14 files and deletes the older ones, then tells Studio the
# time (status-write.sh backup, which the Last backup line on Start here shows).
# teletraan-backup.timer runs it at 03:15 every night.
#
# The export needs the write token, SANITY_WRITE_TOKEN in local.env. It is handed
# to the tool in its environment and not on its command line, so it never shows
# in the process list, and it is never printed. The dataset name comes from
# dashboard/config.js. TELETRAAN_BACKUP_DIR in local.env moves the folder.
#
# To get a backup back, see "Restoring a backup" in docs/coaches-guide.md:
# import it into a NEW dataset first, never straight over production.
set -eu

mini=$(cd "$(dirname "$0")/.." && pwd)
repo=$(dirname "$mini")
config="$repo/dashboard/config.js"
env_file="$mini/local.env"

# How many backups are kept
keep=14

# The value of a NAME=value line in local.env, without its quotes. Only the
# name asked for is read, because the other lines hold secrets.
setting() {
  [ -f "$env_file" ] || return 0
  sed -n "s/^$1=//p" "$env_file" | tail -n 1 | sed "s/^['\"]//; s/['\"]\$//"
}

# The quoted value of "name: 'value'," in dashboard/config.js
config_value() {
  [ -f "$config" ] || return 0
  sed -n "s/^[[:space:]]*$1:[[:space:]]*'\([^']*\)'.*/\1/p" "$config" | head -n 1
}

fail() {
  echo "backup: $*" >&2
  exit 1
}

token=$(setting SANITY_WRITE_TOKEN)
case $token in
  ''|'['*) fail "SANITY_WRITE_TOKEN is not in local.env, so the dataset cannot be exported." ;;
esac
if ! printf '%s' "$token" | grep -Eq '^[A-Za-z0-9_.-]+$'; then
  fail "SANITY_WRITE_TOKEN in local.env does not look like a token. Paste it again, with nothing else on the line."
fi

dataset=$(config_value dataset)
if ! printf '%s' "$dataset" | grep -Eq '^[A-Za-z0-9_-]+$'; then
  fail "could not read the dataset from dashboard/config.js."
fi

backups=$(setting TELETRAAN_BACKUP_DIR)
backups=${backups:-/var/backups/teletraan}

sanity="$repo/studio/node_modules/.bin/sanity"
if [ ! -x "$sanity" ]; then
  fail "the Sanity tool is not installed in $repo/studio. Ask the team mentor to run npm install there, then run this again."
fi

mkdir -p "$backups" 2> /dev/null || fail "could not make the folder $backups. install-backup.sh makes it."
[ -w "$backups" ] || fail "the folder $backups cannot be written by this account. install-backup.sh sets that up."

final="$backups/$dataset-$(date +%F).tar.gz"
partial="$final.partial"

# A half written file from a run that was cut short
rm -f "$backups/$dataset"-*.partial 2> /dev/null || true

# The tool finds the project in studio/sanity.cli.js, so it runs from there.
# DO_NOT_TRACK keeps it from sending usage figures from the Mini.
status=0
(cd "$repo/studio" && SANITY_AUTH_TOKEN="$token" DO_NOT_TRACK=1 "$sanity" dataset export "$dataset" "$partial" --overwrite > /dev/null 2>&1) || status=$?
if [ "$status" -ne 0 ]; then
  rm -f "$partial" 2> /dev/null || true
  fail "the export failed (exit code $status). The old backups were kept. Check the token and the network."
fi

# A file that is empty or not a gzip is not a backup, and must not push a good one out
if [ ! -s "$partial" ] || ! gzip -t "$partial" 2> /dev/null; then
  rm -f "$partial" 2> /dev/null || true
  fail "the export did not make a readable file. The old backups were kept."
fi
mv -f "$partial" "$final"

# The names carry the date, so the newest sort last. Everything past the newest 14 goes.
ls -1 "$backups" | grep -E "^$dataset-[0-9]{4}-[0-9]{2}-[0-9]{2}\.tar\.gz\$" | sort -r | tail -n +"$((keep + 1))" |
  while read -r old; do
    rm -f "$backups/$old"
  done

echo "backup: wrote $final"

# Best effort: Studio may be unreachable, and the backup is done either way
"$mini/scripts/status-write.sh" backup > /dev/null 2>&1 || echo "backup: could not tell Studio the time." >&2
