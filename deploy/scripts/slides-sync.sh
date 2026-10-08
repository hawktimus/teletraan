#!/bin/sh
# Downloads the slides of the talks that are coming up and saves each deck as
# numbered pictures in <data folder>/slides/<talk id>/, with a manifest.json
# that says whether it worked. The dashboard shows the pictures during the
# talk. The talks are read from Sanity, so the Mini needs the internet. Needs
# poppler-utils, curl and jq (docs/rebuilding-the-mini.md).
#
#   slides-sync.sh                  one run, which the timer starts every 2 minutes
#   slides-sync.sh --test <link>    downloads one deck into a temporary folder,
#                                   prints what it found and deletes it again
set -eu

deploy=$(cd "$(dirname "$0")/.." && pwd)
repo=$(dirname "$deploy")
config="$repo/dashboard/config.js"
env_file="$deploy/local.env"

# Seconds. The slides of a talk are downloaded from 36 hours before it starts
# until 30 minutes after, and once more when it is 20 minutes away. The folder
# is kept for 24 hours after the talk ends.
ahead=$((36 * 60 * 60))
behind=$((30 * 60))
refresh_within=$((20 * 60))
keep_after_end=$((24 * 60 * 60))

# A deck with more pages than this is cut short
max_pages=60

# A Google Slides link, with the id of the deck after /d/. Anything else is not
# a deck and is skipped.
link_pattern='^https://docs\.google\.com/presentation/d/(?<id>[A-Za-z0-9_-]{10,})(?:[/?#].*)?$'

# The value of a NAME=value line in local.env, without its quotes
setting() {
  [ -f "$env_file" ] || return 0
  sed -n "s/^$1=//p" "$env_file" | tail -n 1 | sed "s/^['\"]//; s/['\"]\$//"
}

# The quoted value of "name: 'value'," in dashboard/config.js. The project
# ID, the dataset and the API version are kept there and nowhere else.
config_value() {
  [ -f "$config" ] || return 0
  sed -n "s/^[[:space:]]*$1:[[:space:]]*'\([^']*\)'.*/\1/p" "$config" | head -n 1
}

# curl's exit code in plain words, short enough for manifest.json
explain() {
  case $1 in
    6|7) echo "could not reach Google" ;;
    28) echo "the download took too long" ;;
    35|51|58|59|60) echo "the secure connection failed" ;;
    63) echo "the deck is too big" ;;
    *) echo "the download failed" ;;
  esac
}

# Makes $1 an empty folder that the web server inside the container may read
empty_folder() {
  rm -rf "$1"
  mkdir "$1"
}

# Downloads deck $1 as a PDF and turns it into the pictures 001.jpg, 002.jpg
# and so on in folder $2. Returns 1 with the reason in $failure when it can't.
# Leaves the number of pages in $pages and the size of the PDF in $pdf_bytes.
make_deck() {
  deck=$1
  folder=$2
  pdf="$folder/download.pdf"
  failure=""
  pages=0
  pdf_bytes=0

  # curl keeps no cookies unless it is told to, and --disable makes it ignore
  # any settings file of the account
  status=0
  curl --disable --silent --max-time 90 --max-filesize 40000000 \
    --location --max-redirs 5 --proto '=https' --proto-redir '=https' \
    --output "$pdf" "https://docs.google.com/presentation/d/$deck/export/pdf" 2> /dev/null || status=$?

  if [ "$status" -ne 0 ]; then
    failure=$(explain "$status")
    return 1
  fi

  # A deck that is not shared answers with a web page to sign in
  if [ "$(head -c 4 "$pdf" 2> /dev/null)" != '%PDF' ]; then
    failure="not shared"
    return 1
  fi
  pdf_bytes=$(wc -c < "$pdf" | tr -d ' ')

  # pdftoppm names the pictures page-1.jpg or page-01.jpg, depending on how
  # many pages the deck has, so they are renamed in order afterwards
  status=0
  timeout 120 pdftoppm -jpeg -jpegopt quality=85 -scale-to-x 1920 -scale-to-y -1 \
    -f 1 -l "$max_pages" "$pdf" "$folder/page" > /dev/null 2>&1 || status=$?
  rm -f "$pdf"

  if [ "$status" -ne 0 ]; then
    failure="could not make pictures"
    return 1
  fi

  for picture in "$folder"/page-*.jpg; do
    [ -f "$picture" ] || continue
    pages=$((pages + 1))
    mv "$picture" "$folder/$(printf '%03d' "$pages").jpg"
  done

  if [ "$pages" -eq 0 ]; then
    failure="the deck has no pages"
    return 1
  fi
}

# manifest.json of a deck that worked. $1 is its folder. $2 is true when this
# download was made close to the start of the talk, and false when it was not.
write_good_manifest() {
  ls "$1" | grep '^[0-9][0-9][0-9]\.jpg$' |
    jq -Rn --arg fetched_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --argjson refreshed "$2" \
      '{ ok: true, pages: [inputs], fetchedAt: $fetched_at, refreshed: $refreshed }' > "$1/manifest.json"
}

# manifest.json of a deck that did not work. $1 is its folder, $2 is the reason.
write_failed_manifest() {
  jq -n --arg error "$2" --arg fetched_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{ ok: false, error: $error, fetchedAt: $fetched_at }' > "$1/manifest.json"
}

# Says what a manifest.json is: good, unrefreshed (good, but not yet downloaded
# close to the start of the talk) or failed. A file that can't be read is failed.
manifest_state() {
  jq -r 'if .ok != true then "failed" elif .refreshed == true then "good" else "unrefreshed" end' "$1" 2> /dev/null || echo failed
}

# Says why the slides of a talk need downloading, or nothing if they do not.
# $1 is the talk's folder, $2 its deck and $3 the seconds until it starts.
why_fetch() {
  manifest="$1/manifest.json"

  # A different deck is a link that was corrected after the first download
  if [ ! -f "$manifest" ] || [ "$(cat "$1/.deck" 2> /dev/null)" != "$2" ]; then
    echo first
    return 0
  fi

  case $(manifest_state "$manifest") in
    failed)
      # The timer runs every 2 minutes, so this tries again at the next run.
      # A minute is left for the download of the run before.
      if [ -n "$(find "$manifest" -mmin +1)" ]; then
        echo retry
      fi
      ;;
    unrefreshed)
      # Never once the talk has started, because the pictures may be on the
      # screen at that moment
      if [ "$3" -gt 0 ] && [ "$3" -le "$refresh_within" ]; then
        echo refresh
      fi
      ;;
  esac
}

# Swaps the finished folder $1 in for the old one of talk $2 with renames, so
# the dashboard never finds a deck that is half written
put_in_place() {
  if [ -d "$slides/$2" ]; then
    mv "$slides/$2" "$work/old"
  fi
  mv "$1" "$slides/$2"
  rm -rf "$work/old"
}

for tool in curl jq pdftoppm; do
  if ! command -v "$tool" > /dev/null 2>&1; then
    echo "The $tool command is missing. Install the packages with:" >&2
    echo "  sudo apt install poppler-utils curl jq" >&2
    exit 1
  fi
done

test_link=""
case ${1:-} in
  '') ;;
  --test)
    test_link=${2:-}
    if [ -z "$test_link" ]; then
      echo "Give the link of the deck after --test." >&2
      exit 1
    fi
    ;;
  *)
    echo "Usage: $0 [--test <link of a Google Slides deck>]" >&2
    exit 1
    ;;
esac

work=""
trap 'rm -rf "$work"' EXIT

if [ -n "$test_link" ]; then
  work=$(mktemp -d "${TMPDIR:-/tmp}/teletraan-slides.XXXXXX")
  deck=$(printf '%s\n' "$test_link" | jq -Rr --arg link_pattern "$link_pattern" 'capture($link_pattern).id' | head -n 1)

  case $deck in
    ''|*[!A-Za-z0-9_-]*)
      echo "FAIL  that is not a Google Slides link. It starts with https://docs.google.com/presentation/d/"
      exit 1
      ;;
  esac

  empty_folder "$work/deck"
  if make_deck "$deck" "$work/deck"; then
    pictures=$(cat "$work/deck"/*.jpg | wc -c | tr -d ' ')
    echo "OK    $pages pages, $((pdf_bytes / 1024)) KB as a PDF, $((pictures / 1024)) KB as pictures"
    exit 0
  fi

  echo "FAIL  $failure"
  exit 1
fi

data=$(setting TELETRAAN_DATA)
data=${data:-/var/lib/teletraan/data}
slides="$data/slides"

if [ ! -d "$data" ]; then
  echo "The data folder $data does not exist. See docs/rebuilding-the-mini.md." >&2
  exit 1
fi

project=$(config_value projectId)
dataset=$(config_value dataset)
version=$(config_value apiVersion)

if [ -z "$project" ] || [ -z "$dataset" ] || [ -z "$version" ]; then
  echo "Could not read the project ID, dataset and API version from dashboard/config.js." >&2
  exit 1
fi

# They become part of a web address
case "$project$dataset$version" in
  *[!A-Za-z0-9_-]*)
    echo "The project ID, dataset or API version in dashboard/config.js has a character that does not belong in a web address." >&2
    exit 1
    ;;
esac

# The web server inside the container must be able to read what is written here
umask 022
mkdir -p "$slides"

# A run that starts while the last one is still going stops at once
exec 9> "$slides/.lock"
if ! flock -n 9; then
  echo "The last run is still going, so this one stops."
  exit 0
fi

# Nothing else is working while this run holds the lock, so a work folder that
# is still here was left by a run that a power cut or a reboot stopped
rm -rf "$slides"/.work.*
work=$(mktemp -d "$slides/.work.XXXXXX")

# Every published talk, with the seconds until it starts (negative once it has
# started). Sanity works the seconds out, so this script reads no dates. The
# ordinary host is used and not the cached one, because the answer depends on
# the moment it is asked.
query='*[_type == "presentation" && !(_id in path("drafts.**"))] {
  _id, status, deckLink, minutes,
  "startsIn": dateTime(start) - dateTime(now())
}'

status=0
curl --disable --silent --get --max-time 30 --max-filesize 10000000 --proto '=https' \
  --data-urlencode "query=$query" --data-urlencode 'perspective=published' \
  --output "$work/answer.json" "https://$project.api.sanity.io/v$version/data/query/$dataset" 2> /dev/null || status=$?

# Nothing is deleted or changed unless Sanity has answered with a list
if [ "$status" -ne 0 ] || ! jq -e '.result | arrays' "$work/answer.json" > /dev/null 2>&1; then
  echo "Could not get the list of talks from Sanity. Nothing was changed." >&2
  exit 1
fi

# One line for each talk that is due: its id, its deck and the seconds until it
# starts. A deck of - means the link is not a Google Slides link.
jq -r --arg link_pattern "$link_pattern" --argjson ahead "$ahead" --argjson behind "$behind" '
  .result[]
  | select((._id | type) == "string" and (._id | test("^[A-Za-z0-9_-]{1,100}$")))
  | select(.status == "scheduled")
  | select((.startsIn | type) == "number")
  | select(.startsIn > (0 - $behind) and .startsIn < $ahead)
  | ((.deckLink | strings | capture($link_pattern).id) // "-") as $deck
  | "\(._id) \($deck) \(.startsIn | floor)"
' "$work/answer.json" > "$work/talks.txt"

failed=0

while read -r id deck starts; do
  if [ "$deck" = - ]; then
    echo "talk $id: the slides link is not a Google Slides link, skipped"
    continue
  fi

  # jq has checked these. They are checked again because they become a folder
  # name and part of a web address.
  if [ -z "$starts" ]; then
    continue
  fi
  case "$id$deck$starts" in
    *[!A-Za-z0-9_-]*) continue ;;
  esac

  reason=$(why_fetch "$slides/$id" "$deck" "$starts")
  if [ -z "$reason" ]; then
    continue
  fi

  empty_folder "$work/new"
  if make_deck "$deck" "$work/new"; then
    refreshed=false
    if [ "$starts" -le "$refresh_within" ]; then
      refreshed=true
    fi
    write_good_manifest "$work/new" "$refreshed"
    printf '%s\n' "$deck" > "$work/new/.deck"
    put_in_place "$work/new" "$id"
    echo "talk $id: $pages slides saved"
    continue
  fi

  failed=$((failed + 1))

  # A deck that worked stays when the second download fails
  if [ "$reason" = refresh ]; then
    echo "talk $id: could not download the slides again, $failure. Keeping the ones from before."
    continue
  fi

  empty_folder "$work/new"
  write_failed_manifest "$work/new" "$failure"
  printf '%s\n' "$deck" > "$work/new/.deck"
  put_in_place "$work/new" "$id"
  echo "talk $id: no slides, $failure"
done < "$work/talks.txt"

# The talks whose folders stay: every talk in the list, whatever its status,
# unless it ended more than 24 hours ago. A talk with no readable start stays.
keep=$(jq -r --argjson after "$keep_after_end" '
  .result[]
  | select((._id | type) == "string")
  | select((.startsIn | type) != "number" or .startsIn + (((.minutes | numbers) // 15) * 60) + $after > 0)
  | ._id
' "$work/answer.json")

for folder in "$slides"/*/; do
  [ -d "$folder" ] || continue
  name=$(basename "$folder")
  if ! printf '%s\n' "$keep" | grep -Fqx -- "$name"; then
    rm -rf "$folder"
    echo "talk $name: slides removed, the talk ended long ago or is no longer in Sanity"
  fi
done

# One bad deck does not stop the others, but a failing exit shows up in
# "systemctl status"
if [ "$failed" -ne 0 ]; then
  exit 1
fi
