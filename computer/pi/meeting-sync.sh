#!/bin/bash
# Usage: meeting-sync.sh [--watch]
# The presentations of the Raspberry Pi: it lists one public Google Drive folder, newest added first, and keeps every
# Google Slides deck and PowerPoint file (.pptx, .ppt) of it as numbered pictures on the disk of the Pi, so a deck opens
# at once from Meeting on the home screen (computer/pi/meeting/, computer/pi/README.md, "Meeting"). The Pi has its own;
# it does not use the list, the pictures or the settings of the Teletraan computer at school.
#
# The folder is MEETING_DRIVE_FOLDER in /opt/teletraan/local.env (a link or a folder id). When that line is not there,
# the folder of Dashboard Settings in Sanity is read, which only reads it. The key is GOOGLE_API_KEY in local.env.
# Needs poppler-utils, curl and jq.
#
#   meeting-sync.sh            one look at the folder, and every deck that is new or changed is made
#   meeting-sync.sh --watch    looks every 15 seconds until it is stopped, which is what the service
#                              runs, or at once when Meeting is opened (launch.sh touches .wake in the folder).
#                              The decks are made beside it, so a long deck never holds the list up.
#
# The pictures are made ahead, as soon as a deck is in the folder and whatever the TV is showing, so that opening one
# from the list reads the disk and waits for nothing. The pictures are 1920 wide; a deck over 150 pages is cut short.
set -euo pipefail
. "$(dirname "$0")/../scripts/lib.sh"

every=15           # seconds between two looks at the folder with --watch
folder_minutes=5   # the folder read from Sanity is used this long before Sanity is asked again
retry_minutes=2    # a deck that could not be made is tried again after this
max_decks=50       # the newest added are kept
max_pages=150      # a deck with more pages is cut short

slides_type='application/vnd.google-apps.presentation'
powerpoint_type='application/vnd.openxmlformats-officedocument.presentationml.presentation'
old_powerpoint_type='application/vnd.ms-powerpoint'

# A folder link or a bare folder id, as photos-drive-sync.sh reads it
folder_pattern='^(?:https://drive\.google\.com/drive/(?:u/[0-9]+/)?folders/)?(?<id>[A-Za-z0-9_-]{10,100})(?:[/?#].*)?$'

case ${1:-} in
  '') watch=no ;;
  --watch) watch=yes ;;
  *)
    echo "Usage: $0 [--watch]" >&2
    exit 1
    ;;
esac

for tool in curl jq pdftoppm; do
  if ! command -v "$tool" > /dev/null 2>&1; then
    echo "The $tool command is missing. Install the packages with:" >&2
    echo "  sudo apt install poppler-utils curl jq" >&2
    exit 1
  fi
done

# The pictures and the list of the Pi: not the data folder of the dashboard, which is the Teletraan computer's way
decks=${TELETRAAN_MEETING:-/var/lib/teletraan/meeting}

project=$(config_value projectId)
dataset=$(config_value dataset)
version=$(config_value apiVersion)

if ! printf '%s' "$project" | grep -Eq '^[a-z0-9]+$' ||
  ! printf '%s' "$dataset" | grep -Eq '^[A-Za-z0-9_-]+$' ||
  ! printf '%s' "$version" | grep -Eq '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'; then
  echo "Could not read the project ID, dataset and API version from dashboard/config.js. Check that projectId, dataset and apiVersion are in that file." >&2
  exit 1
fi

# The web server must be able to read what is written here
umask 022
mkdir -p "$decks"

# One list pass at a time. With --watch the lock is held until the service stops.
exec 9> "$decks/.lock"
if ! flock -n 9; then
  echo "Another decks-sync is looking at the folder, so this one stops."
  exit 0
fi

rm -rf "$decks"/.work.list.*
work=$(mktemp -d "$decks/.work.list.XXXXXX")
trap 'rm -rf "$work"' EXIT

now_text() {
  date -u +%Y-%m-%dT%H:%M:%SZ
}

encode() {
  jq -rn --arg text "$1" '$text | @uri'
}

# Asks Google for $1 (an address with no key) and saves the answer in $2. The key goes to curl as
# a setting on standard input, so it never shows in the process list. $http_code is the answer's
# status, or 000 when there was none.
ask_google() {
  http_code=$(printf 'url = "%s&key=%s"\n' "$1" "$key" |
    curl --disable --silent --max-time 30 --connect-timeout 10 --max-filesize 2000000 \
      --location --max-redirs 3 --proto '=https' --proto-redir '=https' \
      --config - --output "$2" --write-out '%{http_code}' 2> /dev/null) || http_code=000
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

# The folder id the editors saved, in $folder, or nothing when no folder is named. Sanity is asked
# when the answer kept in .folder is older than folder_minutes. When Sanity cannot be reached the
# answer from before is used, so the list keeps working through a short break.
read_folder() {
  # MEETING_DRIVE_FOLDER first: the Pi names its own folder. A line that is not a folder link names no folder.
  own=$(setting MEETING_DRIVE_FOLDER)
  if [ -n "$own" ]; then
    folder=$(printf '%s' "$own" | jq -Rr --arg pattern "$folder_pattern" 'gsub("^\\s+|\\s+$"; "") | capture($pattern).id // empty' 2> /dev/null | head -n 1)
    return 0
  fi

  kept="$decks/.folder"
  if [ -f "$kept" ] && [ -z "$(find "$kept" -mmin +"$folder_minutes")" ]; then
    folder=$(head -n 1 "$kept")
    return 0
  fi

  status=0
  curl --disable --silent --get --max-time 30 --connect-timeout 10 --max-filesize 1000000 --proto '=https' \
    --data-urlencode 'query=*[_id == "dashboardSettings"][0] { presentationDriveFolder }' --data-urlencode 'perspective=published' \
    --output "$work/settings.json" "https://$project.api.sanity.io/v$version/data/query/$dataset" 2> /dev/null || status=$?

  if [ "$status" -ne 0 ] || ! jq -e 'has("result")' "$work/settings.json" > /dev/null 2>&1; then
    [ -f "$kept" ] || return 1
    folder=$(head -n 1 "$kept")
    return 0
  fi

  folder=$(jq -r --arg pattern "$folder_pattern" '.result.presentationDriveFolder | strings | gsub("^\\s+|\\s+$"; "") | capture($pattern).id // empty' "$work/settings.json" 2> /dev/null | head -n 1)
  printf '%s\n' "$folder" > "$work/folder"
  mv "$work/folder" "$kept"
}

# Writes decks/manifest.json from the list of the folder (.list.json) and the decks that are on
# the disk. $1 is the state of the last look and $2 a folder to work in. Each deck is one of:
#   ready      its pictures are on the disk. updating is true while a newer version is being made.
#   preparing  it is new and its pictures are not made yet
#   failed     it could not be made, and error says why
compose() {
  for path in "$decks"/*/manifest.json; do
    [ -f "$path" ] || continue
    jq -c --arg id "$(basename "$(dirname "$path")")" \
      '{ id: $id, ok: (.ok == true), modified: (.modified // ""), pages: ((.pages // []) | length), error: (.error // "") }' "$path" 2> /dev/null || true
  done | jq -s '.' > "$2/have.json"

  [ -f "$decks/.list.json" ] || echo '[]' > "$decks/.list.json"

  jq --slurpfile have "$2/have.json" --arg state "$1" --arg at "$(now_text)" --arg folder "${folder:-}" '
    ($have[0] | map({ key: .id, value: . }) | from_entries) as $disk
    | { ok: ($state == "ok"), state: $state, checkedAt: $at, folder: $folder,
        decks: [ .[]
          | $disk[.id] as $made
          | . + (
              if $made == null then { state: "preparing", pages: 0 }
              elif $made.ok and $made.modified == .modified then { state: "ready", pages: $made.pages }
              elif $made.ok then { state: "ready", pages: $made.pages, updating: true }
              elif $made.modified == .modified then { state: "failed", pages: 0, error: $made.error }
              else { state: "preparing", pages: 0 } end) ] }' "$decks/.list.json" > "$2/manifest.json"
  mv "$2/manifest.json" "$decks/manifest.json"
}

# One look at the folder. It leaves the state in $state: ok, no-folder, no-key, bad-key, api-off,
# not-shared, or offline when Sanity or Google could not be reached. Only ok and no-folder change
# the list. Any other state leaves the decks from before, so they can still be played.
list_pass() {
  state=offline
  folder=""
  if ! read_folder; then
    return 0
  fi

  if [ -z "$folder" ]; then
    state=no-folder
    echo '[]' > "$work/list.json"
    mv "$work/list.json" "$decks/.list.json"
    return 0
  fi

  key=$(setting GOOGLE_API_KEY)
  case $key in
    ''|'['*) state=no-key; return 0 ;;
  esac
  if ! printf '%s' "$key" | grep -Eq '^[A-Za-z0-9_-]{20,100}$'; then
    state=bad-key
    return 0
  fi

  fields='files(id,name,mimeType,createdTime,modifiedTime)'
  list_query="'$folder' in parents and trashed = false and (mimeType = '$slides_type' or mimeType = '$powerpoint_type' or mimeType = '$old_powerpoint_type')"
  list_url="https://www.googleapis.com/drive/v3/files?pageSize=100&orderBy=$(encode 'createdTime desc')&q=$(encode "$list_query")&fields=$(encode "$fields")"
  ask_google "$list_url" "$work/answer.json"

  case $http_code in
    200) ;;
    400|401|403|404) state=$(refusal_state "$work/answer.json"); return 0 ;;
    *) return 0 ;;
  esac
  if ! jq -e '.files | arrays' "$work/answer.json" > /dev/null 2>&1; then
    return 0
  fi

  # One object for each deck, newest first. The name on the screen is the file name without
  # .pptx, cut to 60 characters. The id becomes a folder name and part of an address, so only
  # the characters Google uses in an id pass.
  jq --arg slides "$slides_type" --arg powerpoint "$powerpoint_type" --arg oldpowerpoint "$old_powerpoint_type" --argjson max "$max_decks" '
    [ .files[]
      | select((.id | type) == "string" and (.id | test("^[A-Za-z0-9_-]{10,100}$")))
      | select(.mimeType == $slides or .mimeType == $powerpoint or .mimeType == $oldpowerpoint)
      | select((.modifiedTime | type == "string") and (.createdTime | type == "string"))
      | { id: .id,
          name: ((.name // "") | tostring | sub("\\.pptx?$"; ""; "i") | gsub("[[:cntrl:]]"; " ") | gsub("^\\s+|\\s+$"; "") | .[0:60]),
          kind: (if .mimeType == $slides then "slides" else "powerpoint" end),
          created: .createdTime,
          modified: .modifiedTime }
      | select(.name != "")
    ] | sort_by(.created) | reverse | .[0:$max]' "$work/answer.json" > "$work/list.json"
  mv "$work/list.json" "$decks/.list.json"
  state=ok
}

# curl's exit code in plain words, short enough for the manifest
explain() {
  case $1 in
    6|7) echo "could not reach Google" ;;
    28) echo "the download took too long" ;;
    35|51|58|59|60) echo "the secure connection failed" ;;
    63) echo "the deck is too big" ;;
    *) echo "the download failed" ;;
  esac
}

# Downloads deck $1 as a PDF and turns it into the pictures 001.jpg, 002.jpg and so on in folder
# $2. Google makes the PDF for a Google Slides deck and for a PowerPoint file alike. Returns 1
# with the reason in $failure when it can't. Leaves the number of pages in $pages.
make_deck() {
  pdf="$2/download.pdf"
  failure=""
  pages=0

  status=0
  curl --disable --silent --max-time 120 --max-filesize 80000000 \
    --location --max-redirs 5 --proto '=https' --proto-redir '=https' \
    --output "$pdf" "https://docs.google.com/presentation/d/$1/export/pdf" 2> /dev/null || status=$?

  if [ "$status" -ne 0 ]; then
    failure=$(explain "$status")
    return 1
  fi

  # A file that is not shared answers with a web page to sign in
  if [ "$(head -c 4 "$pdf" 2> /dev/null)" != '%PDF' ]; then
    failure="not shared"
    return 1
  fi

  status=0
  timeout 300 pdftoppm -jpeg -jpegopt quality=85 -scale-to-x 1920 -scale-to-y -1 \
    -f 1 -l "$max_pages" "$pdf" "$2/page" > /dev/null 2>&1 || status=$?
  rm -f "$pdf"

  if [ "$status" -ne 0 ]; then
    failure="could not make pictures"
    return 1
  fi

  # pdftoppm names the pictures page-1.jpg or page-01.jpg, depending on how many pages the deck
  # has, so they are renamed in order afterwards
  for picture in "$2"/page-*.jpg; do
    [ -f "$picture" ] || continue
    pages=$((pages + 1))
    mv "$picture" "$2/$(printf '%03d' "$pages").jpg"
  done

  if [ "$pages" -eq 0 ]; then
    failure="the deck has no pages"
    return 1
  fi
}

# Says why deck $1, changed at $2, needs making, or nothing if it does not
why_make() {
  manifest="$decks/$1/manifest.json"
  if [ ! -f "$manifest" ]; then
    echo new
    return 0
  fi
  if [ "$(jq -r '.modified // ""' "$manifest" 2> /dev/null || true)" != "$2" ]; then
    echo changed
    return 0
  fi
  if [ "$(jq -r '.ok == true' "$manifest" 2> /dev/null || echo false)" != true ] && [ -n "$(find "$manifest" -mmin +"$retry_minutes")" ]; then
    echo retry
  fi
}

# Makes every deck of the list that is new or changed, one after the other, and takes away the
# folders of the decks that left the Drive folder. A finished folder is swapped in with renames,
# so the dashboard never finds a deck that is half written. A deck that worked stays when its new
# version cannot be made. $1 is the state the manifest is written with.
picture_pass() {
  exec 8> "$decks/.pictures.lock"
  if ! flock -n 8; then
    return 0
  fi

  rm -rf "$decks"/.work.pictures.*
  making=$(mktemp -d "$decks/.work.pictures.XXXXXX")
  made=0
  failed=0

  jq -r '.[] | "\(.id) \(.modified)"' "$decks/.list.json" > "$making/wanted.txt"
  while read -r id modified; do
    case $id in
      ''|*[!A-Za-z0-9_-]*) continue ;;
    esac
    reason=$(why_make "$id" "$modified")
    [ -n "$reason" ] || continue

    rm -rf "$making/new"
    mkdir "$making/new"
    if make_deck "$id" "$making/new"; then
      ls "$making/new" | grep '^[0-9][0-9][0-9]\.jpg$' |
        jq -Rn --arg at "$(now_text)" --arg modified "$modified" '{ ok: true, pages: [inputs], fetchedAt: $at, modified: $modified }' > "$making/new/manifest.json"
      made=$((made + 1))
    else
      failed=$((failed + 1))
      if [ "$reason" = changed ] && [ "$(jq -r '.ok == true' "$decks/$id/manifest.json" 2> /dev/null || echo false)" = true ]; then
        echo "deck $id: could not make the new version, $failure. Keeping the one from before."
        continue
      fi
      rm -rf "$making/new"
      mkdir "$making/new"
      jq -n --arg error "$failure" --arg at "$(now_text)" --arg modified "$modified" '{ ok: false, error: $error, fetchedAt: $at, modified: $modified }' > "$making/new/manifest.json"
      echo "deck $id: no pictures, $failure"
    fi

    rm -rf "$making/old"
    if [ -d "$decks/$id" ]; then
      mv "$decks/$id" "$making/old"
    fi
    mv "$making/new" "$decks/$id"
    rm -rf "$making/old"
    compose "$1" "$making"
  done < "$making/wanted.txt"

  removed=0
  for path in "$decks"/*/; do
    [ -d "$path" ] || continue
    name=$(basename "$path")
    if ! jq -e --arg id "$name" 'any(.[]; .id == $id)' "$decks/.list.json" > /dev/null 2>&1; then
      rm -rf "$path"
      removed=$((removed + 1))
    fi
  done

  if [ $((made + failed + removed)) -gt 0 ]; then
    compose "$1" "$making"
    echo "meeting: $made made, $failed failed, $removed removed"
  fi
  rm -rf "$making"
  [ "$failed" -eq 0 ]
}

# What the last look found, in one line. With --watch it is printed only when it changes.
summary() {
  case $state in
    ok) echo "meeting: $(jq '.decks | length' "$decks/manifest.json") in the folder" ;;
    no-folder) echo "meeting: no Google Drive folder is named. Put MEETING_DRIVE_FOLDER=<the folder link> in /opt/teletraan/local.env." ;;
    no-key) echo "meeting: there is no GOOGLE_API_KEY in local.env yet. See docs/photos-drive.md." ;;
    bad-key) echo "meeting: Google did not accept the key. Check GOOGLE_API_KEY in local.env." ;;
    api-off) echo "meeting: the Google Drive API is not turned on for the project of the key. See docs/photos-drive.md, step 2." ;;
    not-shared) echo "meeting: Google would not list the folder. Share it with Anyone with the link as Viewer." ;;
    *) echo "meeting: Sanity or Google could not be reached. The decks from before stay." ;;
  esac
}

if [ "$watch" = no ]; then
  list_pass
  compose "$state" "$work"
  summary
  picture_pass "$state"
  exit $?
fi

said=""
while true; do
  list_pass || state=offline
  compose "$state" "$work" || true

  line=$(summary 2> /dev/null || true)
  if [ "$line" != "$said" ]; then
    echo "$line"
    said=$line
  fi

  # The pictures are made beside the loop. A pass that is still going keeps its lock, and the new one stops at once.
  (picture_pass "$state") 9>&- &

  # Waits for the next look, or less when Meeting was opened (launch.sh touches .wake), so that the list is current when it shows
  waited=0
  while [ "$waited" -lt "$every" ] && [ ! -e "$decks/.wake" ]; do
    sleep 1
    waited=$((waited + 1))
  done
  rm -f "$decks/.wake"
done
