#!/bin/bash
# Usage: decks-sync.sh [--watch]
# Lists the presentations of one Google Drive folder and saves each one as numbered
# pictures in <data folder>/decks/<Drive id>/, with decks/manifest.json that lists them. The
# dashboard shows the list on the TV and on the control page, and plays the one that is picked
# (docs/presentations-drive.md). Google Slides and PowerPoint files (.pptx) are read. The folder
# is the Google Drive folder of the Presentations tab of Dashboard Settings in Sanity. There are two
# ways to read it:
#   a public folder   (Anyone with the link, Viewer) is read with GOOGLE_API_KEY in local.env, the
#                     one the Drive photos use
#   a private folder  is read through a Google Apps Script that runs as one person who can open the
#                     folder, when DECKS_SCRIPT_URL and DECKS_SCRIPT_SECRET are in local.env
#                     (computer/apps-script/decks-feed.gs, docs/presentations-drive.md). Only Google
#                     Slides decks come this way.
# Needs poppler-utils, coreutils (base64), curl and jq.
#
#   decks-sync.sh            one look at the folder, and every deck that is new or changed is made
#   decks-sync.sh --watch    looks every 20 seconds until it is stopped, which is what the service
#                            runs. The decks are made beside it, so a long deck never holds the list up.
#
# The list and the pictures are made by two passes with a lock each. The list pass asks Google
# for the files and writes the manifest. The picture pass downloads each deck that is new or has
# changed as a PDF and cuts it into pictures.
set -euo pipefail
. "$(dirname "$0")/lib.sh"

every=20           # seconds between two looks at the folder with --watch
folder_minutes=5   # the folder read from Sanity is used this long before Sanity is asked again
retry_minutes=2    # a deck that could not be made is tried again after this
max_decks=30       # the newest are kept
max_pages=120      # a deck with more pages is cut short

slides_type='application/vnd.google-apps.presentation'
powerpoint_type='application/vnd.openxmlformats-officedocument.presentationml.presentation'

# The address of a deployed Apps Script, for a personal Google account and for a Workspace one
script_pattern='^https://script\.google\.com/(a/macros/[A-Za-z0-9.-]+|macros)/s/[A-Za-z0-9_-]+/exec$'
script_url=""
script_secret=""

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

for tool in curl jq pdftoppm base64; do
  if ! command -v "$tool" > /dev/null 2>&1; then
    echo "The $tool command is missing. Install the packages with:" >&2
    echo "  sudo apt install poppler-utils curl jq" >&2
    exit 1
  fi
done

data=$(setting TELETRAAN_DATA)
data=${data:-/var/lib/teletraan/data}
decks="$data/decks"

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

# Asks the Apps Script for $1 (the part of the address after the question mark, with no secret) and
# saves the answer in $2. The secret goes to curl as a setting on standard input, so it never shows
# in the process list. $http_code is the status of the answer, or 000 when there was none.
ask_script() {
  http_code=$(printf 'url = "%s?%s&secret=%s"\n' "$script_url" "$1" "$script_secret" |
    curl --disable --silent --max-time 60 --connect-timeout 10 --max-filesize 2000000 \
      --location --max-redirs 5 --proto '=https' --proto-redir '=https' \
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
  kept="$decks/.folder"
  if [ -f "$kept" ] && [ -z "$(find "$kept" -mmin +"$folder_minutes")" ]; then
    folder=$(head -n 1 "$kept")
    return 0
  fi

  status=0
  curl --disable --silent --get --max-time 30 --connect-timeout 10 --max-filesize 1000000 --proto '=https' \
    --data-urlencode 'query=*[_id == "dashboardSettings"][0] { presentationDriveFolder }' --data-urlencode 'perspective=published' \
    --output "$work/settings.json" "https://$project.${SANITY_READ_HOST:-apicdn}.sanity.io/v$version/data/query/$dataset" 2> /dev/null || status=$?

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

# Turns the answer of Google or of the script ($1, a list of files in the Drive API's shape) into
# decks/.list.json: one object for each deck, newest first. The name on the screen is the file name
# without .pptx, cut to 60 characters. The id becomes a folder name and part of an address, so only
# the characters Google uses in an id pass.
write_list() {
  jq --arg slides "$slides_type" --arg powerpoint "$powerpoint_type" --argjson max "$max_decks" '
    [ .files[]
      | select((.id | type) == "string" and (.id | test("^[A-Za-z0-9_-]{10,100}$")))
      | select(.mimeType == $slides or .mimeType == $powerpoint)
      | select(.modifiedTime | type == "string")
      | { id: .id,
          name: ((.name // "") | tostring | sub("\\.pptx$"; ""; "i") | gsub("[[:cntrl:]]"; " ") | gsub("^\\s+|\\s+$"; "") | .[0:60]),
          kind: (if .mimeType == $slides then "slides" else "powerpoint" end),
          modified: .modifiedTime }
      | select(.name != "")
    ] | sort_by(.modified) | reverse | .[0:$max]' "$1" > "$work/list.json"
  mv "$work/list.json" "$decks/.list.json"
}

# Asks the Apps Script for the list. States: bad-script when the address is not an Apps Script's or
# the answer is not from the script, bad-secret, wrong-folder, offline when it could not be reached.
script_list() {
  if ! printf '%s' "$script_url" | grep -Eq "$script_pattern"; then
    state=bad-script
    return 0
  fi
  if ! printf '%s' "$script_secret" | grep -Eq '^[A-Za-z0-9_-]{16,100}$'; then
    state=bad-secret
    return 0
  fi

  ask_script "action=list&folder=$folder" "$work/answer.json"
  case $http_code in
    200) ;;
    4??) state=bad-script; return 0 ;;
    *) return 0 ;;
  esac
  # Google answers a page to sign in to when the script is not open to Anyone
  if ! jq -e 'type == "object"' "$work/answer.json" > /dev/null 2>&1; then
    state=bad-script
    return 0
  fi
  case $(jq -r '.error | strings' "$work/answer.json" 2> /dev/null || true) in
    '') ;;
    denied) state=bad-secret; return 0 ;;
    wrong-folder) state=wrong-folder; return 0 ;;
    *) return 0 ;;
  esac
  if ! jq -e '.files | arrays' "$work/answer.json" > /dev/null 2>&1; then
    return 0
  fi

  write_list "$work/answer.json"
  state=ok
}

# One look at the folder. It leaves the state in $state: ok, no-folder, no-key, bad-key, api-off,
# not-shared, bad-script, bad-secret, wrong-folder, or offline when Sanity or Google could not be
# reached. Only ok and no-folder change the list. Any other state leaves the decks from before, so they can still be played.
list_pass() {
  state=offline
  folder=""
  script_url=$(setting DECKS_SCRIPT_URL)
  script_secret=$(setting DECKS_SCRIPT_SECRET)
  if ! read_folder; then
    return 0
  fi

  if [ -z "$folder" ]; then
    state=no-folder
    echo '[]' > "$work/list.json"
    mv "$work/list.json" "$decks/.list.json"
    return 0
  fi

  if [ -n "$script_url" ]; then
    script_list
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

  fields='files(id,name,mimeType,modifiedTime)'
  list_query="'$folder' in parents and trashed = false and (mimeType = '$slides_type' or mimeType = '$powerpoint_type')"
  list_url="https://www.googleapis.com/drive/v3/files?pageSize=100&orderBy=$(encode 'modifiedTime desc')&q=$(encode "$list_query")&fields=$(encode "$fields")"
  ask_google "$list_url" "$work/answer.json"

  case $http_code in
    200) ;;
    400|401|403|404) state=$(refusal_state "$work/answer.json"); return 0 ;;
    *) return 0 ;;
  esac
  if ! jq -e '.files | arrays' "$work/answer.json" > /dev/null 2>&1; then
    return 0
  fi

  write_list "$work/answer.json"
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

# Takes the hidden slides (Skip slide in Google Slides) out of the pictures of deck $1 in folder $2.
# The PDF holds every slide, so the Apps Script says how many slides the deck has and which are hidden,
# and those pictures are removed and the rest are numbered again. Only a deck read through the script
# can be checked, so a public folder shows every slide. Returns 1 with the reason in $failure when the
# script cannot say or the answer does not fit the pictures, so a hidden slide is never shown by
# mistake and a slide that should show is never dropped by mistake. Leaves the new count in $pages.
drop_hidden_slides() {
  [ -n "$script_url" ] || return 0

  ask_script "action=skipped&id=$1&folder=$folder" "$2/skipped.json"
  if [ "$http_code" != 200 ] || ! jq -e '(.count | type == "number") and (.skipped | type == "array")' "$2/skipped.json" > /dev/null 2>&1; then
    rm -f "$2/skipped.json"
    failure="the script cannot name the hidden slides, update it (docs/presentations-drive.md)"
    return 1
  fi

  slide_count=$(jq -r '.count | floor' "$2/skipped.json")
  hidden=$(jq -r '[.skipped[] | numbers | floor | select(. >= 1 and . <= $total)] | unique | .[]' --argjson total "$slide_count" "$2/skipped.json")
  rm -f "$2/skipped.json"
  hidden_count=$(printf '%s' "$hidden" | grep -c '[0-9]' || true)
  [ "$hidden_count" -gt 0 ] || return 0

  expected=$slide_count
  [ "$expected" -le "$max_pages" ] || expected=$max_pages
  if [ "$pages" -eq "$expected" ]; then
    for number in $hidden; do
      rm -f "$2/$(printf '%03d' "$number").jpg"
    done
  elif [ "$slide_count" -le "$max_pages" ] && [ "$pages" -eq $((slide_count - hidden_count)) ]; then
    # Google already left the hidden slides out of this PDF
    return 0
  else
    failure="the pictures do not match the slides of the deck"
    return 1
  fi

  pages=0
  for picture in "$2"/[0-9][0-9][0-9].jpg; do
    [ -f "$picture" ] || continue
    pages=$((pages + 1))
    target="$2/$(printf '%03d' "$pages").jpg"
    [ "$picture" = "$target" ] || mv "$picture" "$target"
  done
  if [ "$pages" -eq 0 ]; then
    failure="every slide of the deck is hidden"
    return 1
  fi
}

# Downloads deck $1 as a PDF and turns it into the pictures 001.jpg, 002.jpg and so on in folder
# $2. Google makes the PDF for a Google Slides deck and for a PowerPoint file alike. Returns 1
# with the reason in $failure when it can't. Leaves the number of pages in $pages.
make_deck() {
  pdf="$2/download.pdf"
  failure=""
  pages=0

  status=0
  if [ -n "$script_url" ]; then
    # The script sends the PDF as base64 text, or a short JSON error
    if [ -z "$folder" ]; then
      failure="no folder is named"
      return 1
    fi
    printf 'url = "%s?action=pdf&id=%s&folder=%s&secret=%s"\n' "$script_url" "$1" "$folder" "$script_secret" |
      curl --disable --silent --max-time 180 --connect-timeout 10 --max-filesize 110000000 \
        --location --max-redirs 5 --proto '=https' --proto-redir '=https' \
        --config - --output "$2/download.b64" 2> /dev/null || status=$?
    if [ "$status" -ne 0 ]; then
      failure=$(explain "$status")
      return 1
    fi
    if [ "$(head -c 1 "$2/download.b64" 2> /dev/null)" = '{' ]; then
      rm -f "$2/download.b64"
      failure="the script could not read the deck"
      return 1
    fi
    base64 -d < "$2/download.b64" > "$pdf" 2> /dev/null || true
    rm -f "$2/download.b64"
  else
    curl --disable --silent --max-time 120 --max-filesize 80000000 \
      --location --max-redirs 5 --proto '=https' --proto-redir '=https' \
      --output "$pdf" "https://docs.google.com/presentation/d/$1/export/pdf" 2> /dev/null || status=$?

    if [ "$status" -ne 0 ]; then
      failure=$(explain "$status")
      return 1
    fi
  fi

  # A file that is not shared answers with a web page to sign in
  if [ "$(head -c 4 "$pdf" 2> /dev/null)" != '%PDF' ]; then
    failure="not shared"
    [ -z "$script_url" ] || failure="the script sent something else than a deck"
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

  drop_hidden_slides "$1" "$2"
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
    echo "decks: $made made, $failed failed, $removed removed"
  fi
  rm -rf "$making"
  [ "$failed" -eq 0 ]
}

# What the last look found, in one line. With --watch it is printed only when it changes.
summary() {
  case $state in
    ok) echo "decks: $(jq '.decks | length' "$decks/manifest.json") in the folder" ;;
    no-folder) echo "decks: no Google Drive folder is named. Paste the folder link in the Presentations tab of Dashboard Settings." ;;
    no-key) echo "decks: there is no GOOGLE_API_KEY in local.env yet. See docs/photos-drive.md." ;;
    bad-key) echo "decks: Google did not accept the key. Check GOOGLE_API_KEY in local.env." ;;
    api-off) echo "decks: the Google Drive API is not turned on for the project of the key. See docs/photos-drive.md, step 2." ;;
    not-shared) echo "decks: Google would not list the folder. Share it with Anyone with the link as Viewer." ;;
    bad-script) echo "decks: DECKS_SCRIPT_URL in local.env is not the address of the Apps Script, or the script is not open to Anyone. See docs/presentations-drive.md." ;;
    bad-secret) echo "decks: the script did not accept the secret. DECKS_SCRIPT_SECRET in local.env has to be the SECRET property of the script." ;;
    wrong-folder) echo "decks: the script is set up for another Drive folder. FOLDER_ID in the script has to be the folder named in Dashboard Settings." ;;
    *) echo "decks: Sanity or Google could not be reached. The decks from before stay." ;;
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
  sleep "$every"
done
