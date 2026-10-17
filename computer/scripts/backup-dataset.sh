#!/bin/bash
# Usage: backup-dataset.sh
# Backs up the Sanity dataset: downloads every document from the Sanity export
# address with curl, packs it with gzip into
# /var/backups/teletraan/production-<date>.ndjson.gz, keeps the newest 14 files
# (old .tar.gz names count too) and deletes the older ones, then tells Studio the
# time (status-write.sh backup, which the Last backup line on Start here shows).
# teletraan-backup.timer runs it at 03:15 every night. It needs only curl and gzip.
#
# The file holds the documents, not the image files, which stay in Sanity's own
# storage. The export needs the write token, SANITY_WRITE_TOKEN in local.env. It is
# handed to curl as a curl config on standard input, so it never shows in the
# process list, and it is never printed. The project and the dataset come from
# dashboard/config.js. TELETRAAN_BACKUP_DIR in local.env moves the folder.
#
# To get a backup back, see "Restoring a backup" in docs/coaches-guide.md:
# import it into a NEW dataset first, never straight over production.
set -euo pipefail
. "$(dirname "$0")/lib.sh"

# How many backups are kept
keep=14

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

project=$(config_value projectId)
if ! printf '%s' "$project" | grep -Eq '^[a-z0-9]+$'; then
  fail "could not read the project from dashboard/config.js."
fi
api=$(config_value apiVersion)
api=${api:-2025-02-19}
api=${api#v}

backups=$(setting TELETRAAN_BACKUP_DIR)
backups=${backups:-/var/backups/teletraan}

command -v curl > /dev/null 2>&1 || fail "curl is not installed. Run: sudo apt install curl"
command -v gzip > /dev/null 2>&1 || fail "gzip is not installed. Run: sudo apt install gzip"

mkdir -p "$backups" 2> /dev/null || fail "could not make the folder $backups. install-backup.sh makes it."
[ -w "$backups" ] || fail "the folder $backups cannot be written by this account. install-backup.sh sets that up."

final="$backups/$dataset-$(date +%F).ndjson.gz"
partial="$final.partial"
headers="$final.partial.headers"
code_file="$final.partial.code"

cleanup() {
  rm -f "$partial" "$headers" "$code_file" 2> /dev/null || true
}

# Half written files from a run that was cut short
rm -f "$backups/$dataset"-*.partial* 2> /dev/null || true
trap cleanup EXIT

# The curl config comes in on standard input, so the token is on no command line.
# The address holds no secret. curl does not fail on a bad status, so that the
# status can be read from the saved headers and named in plain words.
url="https://$project.api.sanity.io/v$api/data/export/$dataset"
{
  rc=0
  {
    printf 'header = "Authorization: Bearer %s"\n' "$token"
    printf 'silent\n'
    printf 'show-error\n'
    printf 'max-time = 3600\n'
  } | curl -K - -D "$headers" "$url" 2> /dev/null || rc=$?
  echo "$rc" > "$code_file"
} | gzip > "$partial" 2> /dev/null || true

curl_code=$(cat "$code_file" 2> /dev/null || echo 1)
http=$(grep '^HTTP/' "$headers" 2> /dev/null | tail -n 1 | sed 's/^HTTP\/[0-9.]* \([0-9]*\).*/\1/' || true)

if [ "$curl_code" != 0 ]; then
  fail "could not reach Sanity (curl code $curl_code). The old backups were kept. Check the network."
fi
case $http in
  200) ;;
  401|403) fail "Sanity said the token cannot read the dataset (status $http). The old backups were kept. Make a new token with read access and put it in local.env." ;;
  *) fail "Sanity did not send the export (status ${http:-unknown}). The old backups were kept. Check the network." ;;
esac

# A file that is empty or not a gzip is not a backup, and must not push a good one out
first=""
if [ -s "$partial" ] && gzip -t "$partial" 2> /dev/null; then
  first=$(gzip -dc "$partial" 2> /dev/null | head -n 1 || true)
fi
if [ -z "$first" ]; then
  fail "the export did not make a readable file. The old backups were kept."
fi
if command -v jq > /dev/null 2>&1; then
  if ! printf '%s' "$first" | jq -e 'type == "object" and has("_id")' > /dev/null 2>&1; then
    fail "the export did not look like documents. The old backups were kept."
  fi
fi
mv -f "$partial" "$final"

# The names carry the date, so the newest sort last. Everything past the newest 14
# goes, whether it is an .ndjson.gz file or an older .tar.gz one.
ls -1 "$backups" | grep -E "^$dataset-[0-9]{4}-[0-9]{2}-[0-9]{2}\.(ndjson|tar)\.gz\$" | sort -r | tail -n +"$((keep + 1))" |
  while read -r old; do
    rm -f "$backups/$old"
  done

echo "backup: wrote $final"

# Best effort: Studio may be unreachable, and the backup is done either way
"$computer/scripts/status-write.sh" backup > /dev/null 2>&1 || echo "backup: could not tell Studio the time." >&2
