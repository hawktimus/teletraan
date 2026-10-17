#!/bin/bash
# Usage: photos-drive-sync.sh
# Copies the pictures of one public Google Drive folder into <data folder>/photos/, with a
# manifest.json that lists them. The dashboard shows them in the Photo panel next to the photos
# uploaded in Studio. The folder and the source (upload, drive or both) are read from Dashboard
# Settings in Sanity, so Studio is the one place to choose. The key is GOOGLE_API_KEY in
# local.env. Needs curl and jq (docs/photos-drive.md).
#
# One run, which the timer starts every 15 minutes. It does nothing, and says why in one line,
# when the source is Upload photos, when no folder is named or when there is no key. Whatever
# it finds, it writes photos/status.json, which status-write.sh photos-drive sends to Studio.
set -euo pipefail
. "$(dirname "$0")/lib.sh"

# Pictures bigger than this are skipped, and no more than max_files are kept (the newest)
max_bytes=$((15 * 1024 * 1024))
max_files=200

# A folder link or a bare folder id. The id is the part after /folders/.
folder_pattern='^(?:https://drive\.google\.com/drive/(?:u/[0-9]+/)?folders/)?(?<id>[A-Za-z0-9_-]{10,100})(?:[/?#].*)?$'

for tool in curl jq; do
  if ! command -v "$tool" > /dev/null 2>&1; then
    echo "The $tool command is missing. Install the packages with:" >&2
    echo "  sudo apt install curl jq" >&2
    exit 1
  fi
done

data=$(setting TELETRAAN_DATA)
data=${data:-/var/lib/teletraan/data}
photos="$data/photos"

if [ ! -d "$data" ]; then
  echo "The data folder $data does not exist. See docs/rebuilding-the-computer.md." >&2
  exit 1
fi

project=$(config_value projectId)
dataset=$(config_value dataset)
version=$(config_value apiVersion)

if ! printf '%s' "$project" | grep -Eq '^[a-z0-9]+$' ||
  ! printf '%s' "$dataset" | grep -Eq '^[A-Za-z0-9_-]+$' ||
  ! printf '%s' "$version" | grep -Eq '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'; then
  echo "Could not read the project ID, dataset and API version from dashboard/config.js. Check that projectId, dataset and apiVersion are in that file." >&2
  exit 1
fi

# The web server inside the container must be able to read what is written here
umask 022
mkdir -p "$photos"

# A run that starts while the last one is still going stops at once
exec 9> "$photos/.lock"
if ! flock -n 9; then
  echo "The last run is still going, so this one stops."
  exit 0
fi

# Nothing else is working while this run holds the lock, so a work folder that
# is still here was left by a run that a power cut or a reboot stopped
rm -rf "$photos"/.work.*
work=$(mktemp -d "$photos/.work.XXXXXX")
trap 'rm -rf "$work"' EXIT

# Writes photos/status.json: when this run looked, how it went and how many photos the manifest has.
# The state is one of ok, off, no-folder, no-key, bad-key, api-off and not-shared.
write_status() {
  printf '{"at":"%s","state":"%s","count":%s}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" "$2" > "$work/status.json"
  mv "$work/status.json" "$photos/status.json"
}

# A run that cannot go on for a reason the editors can fix. It leaves the photos as they are,
# tells Studio and ends well, so the status job after it still runs.
stop_with() {
  write_status "$1" "$(manifest_count)"
  echo "photos-drive: $2"
  exit 0
}

manifest_count() {
  jq -r '(.photos | length) // 0' "$photos/manifest.json" 2> /dev/null || echo 0
}

# The source and the folder, as the editors saved them. The ordinary host is used and not the
# cached one, because the answer should be the latest.
query='*[_id == "dashboardSettings"][0] { photoSource, photoDriveFolder }'
status=0
curl --disable --silent --get --max-time 30 --connect-timeout 10 --max-filesize 1000000 --proto '=https' \
  --data-urlencode "query=$query" --data-urlencode 'perspective=published' \
  --output "$work/settings.json" "https://$project.api.sanity.io/v$version/data/query/$dataset" 2> /dev/null || status=$?

# Nothing is changed unless Sanity has answered
if [ "$status" -ne 0 ] || ! jq -e 'has("result")' "$work/settings.json" > /dev/null 2>&1; then
  echo "Could not get the settings from Sanity. Nothing was changed. Check that the Teletraan computer is online; the next run tries again." >&2
  exit 1
fi

source_name=$(jq -r '.result.photoSource | strings' "$work/settings.json")
case $source_name in
  drive|both) ;;
  *) stop_with off "the photo source is Upload photos, so nothing was read from Google Drive." ;;
esac

folder=$(jq -r --arg pattern "$folder_pattern" '.result.photoDriveFolder | strings | gsub("^\\s+|\\s+$"; "") | capture($pattern).id // empty' "$work/settings.json" 2> /dev/null | head -n 1)
if [ -z "$folder" ]; then
  stop_with no-folder "no Google Drive folder is named. Paste the folder link on the Photos page in Studio."
fi

key=$(setting GOOGLE_API_KEY)
case $key in
  ''|'['*) stop_with no-key "there is no GOOGLE_API_KEY in local.env yet. See docs/photos-drive.md." ;;
esac
if ! printf '%s' "$key" | grep -Eq '^[A-Za-z0-9_-]{20,100}$'; then
  stop_with bad-key "GOOGLE_API_KEY in local.env does not look like a Google key. Paste it again on the Keys tab of the control page."
fi

# Asks Google for $1 (an address with no key) and saves the answer in $2. The key goes to curl as
# a setting on standard input, so it never shows in the process list. $http_code is the answer's
# status, or 000 when there was none.
ask_google() {
  http_code=$(printf 'url = "%s&key=%s"\n' "$1" "$key" |
    curl --disable --silent --max-time 120 --connect-timeout 10 --max-filesize "$max_bytes" \
      --location --max-redirs 3 --proto '=https' --proto-redir '=https' \
      --config - --output "$2" --write-out '%{http_code}' 2> /dev/null) || http_code=000
}

encode() {
  jq -rn --arg text "$1" '$text | @uri'
}

# Why Google refused, in the words of a state. Only the reason word of the answer is read.
refusal_state() {
  reason=$(jq -r '(.error.errors[0].reason // .error.status // "") | strings' "$1" 2> /dev/null || true)
  case $reason in
    keyInvalid|API_KEY_INVALID|badRequest|INVALID_ARGUMENT) echo bad-key ;;
    accessNotConfigured|SERVICE_DISABLED|API_KEY_SERVICE_BLOCKED) echo api-off ;;
    *) echo not-shared ;;
  esac
}

fields='nextPageToken,files(id,name,mimeType,modifiedTime,size,imageMediaMetadata(width,height))'
list_query="'$folder' in parents and mimeType contains 'image/' and trashed = false"
list_url="https://www.googleapis.com/drive/v3/files?pageSize=$max_files&orderBy=$(encode 'modifiedTime desc')&q=$(encode "$list_query")&fields=$(encode "$fields")"

ask_google "$list_url" "$work/list.json"

case $http_code in
  200) ;;
  400|401|403|404)
    state=$(refusal_state "$work/list.json")
    case $state in
      bad-key) stop_with bad-key "Google did not accept the key. Check GOOGLE_API_KEY on the Keys tab of the control page." ;;
      api-off) stop_with api-off "the Google Drive API is not turned on for the project of the key. See docs/photos-drive.md, step 2." ;;
      *) stop_with not-shared "Google would not list the folder. Share it with Anyone with the link as Viewer, and check the link on the Photos page." ;;
    esac
    ;;
  *)
    echo "Could not list the folder (answer $http_code). Nothing was changed. The next run tries again." >&2
    exit 1
    ;;
esac

if ! jq -e '.files | arrays' "$work/list.json" > /dev/null 2>&1; then
  echo "Google answered with something that is not a list of files. Nothing was changed." >&2
  exit 1
fi

# One object for each usable picture, newest first: a safe file name made from the Drive id, and
# the credit and caption when the name is like "Firstname - caption.jpg". A name that does not
# fit has neither, so a file name never reaches the screen by chance. over is true for a picture
# above the size cap.
jq --argjson max_bytes "$max_bytes" --argjson max_files "$max_files" '
  def ext: {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif"}[.];
  def named: (.name // "") | capture("^(?<credit>[A-Za-z][A-Za-z-]{0,13}) - (?<caption>.+)\\.[A-Za-z0-9]+$") // {credit: "", caption: ""};
  [ .files[]
    | select((.id | type) == "string" and (.id | test("^[A-Za-z0-9_-]{1,100}$")))
    | select((.mimeType | type) == "string")
    | select((.mimeType | ext) != null)
    | select(.modifiedTime | type == "string")
    | named as $note
    | {
        id: .id,
        name: (.name // ""),
        file: (.id + "." + (.mimeType | ext)),
        modified: .modifiedTime,
        width: (.imageMediaMetadata.width // 0),
        height: (.imageMediaMetadata.height // 0),
        credit: $note.credit,
        caption: ($note.caption | gsub("^\\s+|\\s+$"; "") | .[0:36]),
        over: (((.size // "0") | tonumber? // 0) > $max_bytes)
      }
  ] | sort_by(.modified) | reverse | .[0:$max_files]' "$work/list.json" > "$work/entries.json"

skipped=$(jq '[.[] | select(.over)] | length' "$work/entries.json")

# A picture is downloaded when it is new or has changed since the manifest was written
: > "$work/fetch.txt"
jq -r '.[] | select(.over | not) | "\(.id) \(.file) \(.modified)"' "$work/entries.json" > "$work/wanted.txt"
while read -r id file modified; do
  [ -n "$id" ] || continue
  old=$(jq -r --arg id "$id" '[.photos[]? | select(.id == $id) | .modified][0] // ""' "$photos/manifest.json" 2> /dev/null || true)
  if [ ! -s "$photos/$file" ] || [ "$old" != "$modified" ]; then
    printf '%s %s\n' "$id" "$file" >> "$work/fetch.txt"
  fi
done < "$work/wanted.txt"

fetched=0
failed=0
while read -r id file; do
  [ -n "$id" ] || continue
  ask_google "https://www.googleapis.com/drive/v3/files/$id?alt=media" "$work/$file"
  if [ "$http_code" = 200 ] && [ -s "$work/$file" ]; then
    mv "$work/$file" "$photos/$file"
    fetched=$((fetched + 1))
  else
    rm -f "$work/$file"
    failed=$((failed + 1))
  fi
done < "$work/fetch.txt"

# The manifest lists the pictures that are on the disk. A picture that could not be downloaded
# and was never saved is left out until the next run.
ls "$photos" | jq -Rn '[inputs]' > "$work/on-disk.json"
jq --slurpfile disk "$work/on-disk.json" --arg at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --arg folder "$folder" '
  { ok: true, fetchedAt: $at, folder: $folder,
    photos: [ .[] | select(.over | not) | select(.file as $file | $disk[0] | index($file)) | del(.over) ] }' "$work/entries.json" > "$work/manifest.json"
mv "$work/manifest.json" "$photos/manifest.json"

# Pictures that left the folder, or were cut by the cap, go
removed=0
for path in "$photos"/*; do
  [ -f "$path" ] || continue
  name=$(basename "$path")
  case $name in
    manifest.json|status.json) continue ;;
  esac
  if ! jq -e --arg name "$name" '[.photos[].file] | index($name)' "$photos/manifest.json" > /dev/null 2>&1; then
    rm -f "$path"
    removed=$((removed + 1))
  fi
done

count=$(manifest_count)
write_status ok "$count"
echo "photos-drive: $count photos, $fetched downloaded, $removed removed, $skipped over 15 MB skipped, $failed failed"

# One failed download does not stop the others, but a failing exit shows up in "systemctl status"
if [ "$failed" -ne 0 ]; then
  exit 1
fi
