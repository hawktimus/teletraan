#!/bin/sh
# Makes <data folder>/calendar-status.json, the document that the Calendars page
# in Studio shows, from what fetch-calendars.sh left in calendar-sync.txt: for
# each calendar, when it was last downloaded and why a download failed. With Node
# on the Mini it also lists the coming events of each calendar, SHOWN or HIDDEN
# with the name of the Calendar filter that hides it, using the dashboard's own
# calendar code, so the list is what the screen does. Without Node it writes the
# first part and says so in the document. status-write.sh calendar-status sends
# the file to Sanity.
#
# The feed addresses are secrets and this script never sees one: the sync file
# and the calendar files hold none. Nothing here prints one.
set -eu

deploy=$(cd "$(dirname "$0")/.." && pwd)
env_file="$deploy/local.env"
helper="$deploy/scripts/calendar-status.mjs"

# The value of a NAME=value line in local.env, without its quotes. Only the
# name asked for is read, because the other lines hold secrets.
setting() {
  [ -f "$env_file" ] || return 0
  sed -n "s/^$1=//p" "$env_file" | tail -n 1 | sed "s/^['\"]//; s/['\"]\$//"
}

data=$(setting TELETRAAN_DATA)
data=${data:-/var/lib/teletraan/data}
sync_file="$data/calendar-sync.txt"
status_file="$data/calendar-status.json"

if [ ! -f "$sync_file" ]; then
  echo "calendar status: fetch-calendars.sh has not run yet, so there is nothing to report."
  exit 0
fi

work=$(mktemp -d)
temp=""
trap 'rm -rf "$work" "$temp"' EXIT
document="$work/document.json"

now=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# The document with no events, from the lines of the sync file. Every value is
# checked before it is written, so nothing from a file can break the JSON.
# $1 says why no events are listed.
document_without_events() {
  printf '{"_id":"calendar-status","_type":"calendarStatus","updatedAt":"%s","eventsNote":"%s","calendars":[' "$now" "$1"

  separator=""
  seen=""
  while IFS='|' read -r code fetched error || [ -n "$code" ]; do
    printf '%s\n' "$code" | grep -Eq '^[a-z0-9_]+$' || continue
    case " $seen " in *" $code "*) continue ;; esac
    seen="$seen $code"
    printf '%s\n' "$fetched" | grep -Eq '^([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:]+Z)?$' || fetched=""
    printf '%s\n' "$error" | grep -Eq "^[A-Za-z0-9 ,.:/()_'-]{0,120}\$" || error="the download failed"

    printf '%s{"_key":"%s","code":"%s"' "$separator" "$code" "$code"
    [ -z "$fetched" ] || printf ',"fetchedAt":"%s"' "$fetched"
    [ -z "$error" ] || printf ',"error":"%s"' "$error"
    printf '}'
    separator=","
  done < "$sync_file"

  printf ']}\n'
}

# The dashboard files are modules, and dashboard/package.json says so. Node 18 and
# newer read them that way, and an older Node stops on the first import.
node_is_new_enough() {
  version=$(node --version 2> /dev/null) || return 1
  version=${version#v}
  major=${version%%.*}
  case $major in
    ''|*[!0-9]*) return 1 ;;
  esac
  [ "$major" -ge 18 ]
}

# Asks Sanity for the Calendar filters the way the screen does, and lets the
# Node file list the events. Gives back 1 when Sanity gave no answer and 2 when
# Node failed. Node says why in the log of the calendar service.
document_with_events() {
  address=$(node "$helper" address) || return 2
  curl --fail --silent --max-time 20 --output "$work/sanity.json" "$address" 2> /dev/null || return 1
  grep -q '"result"' "$work/sanity.json" || return 1
  node "$helper" build "$work/sanity.json" "$sync_file" "$data/calendars" > "$document" || return 2
  [ -s "$document" ] || return 2
}

reason=""
if ! command -v node > /dev/null 2>&1; then
  reason="Node is not installed on the Mini, so it does not list the coming events"
elif ! node_is_new_enough; then
  reason="Node on the Mini is too old to read the dashboard code, so it does not list the coming events. It needs version 18 or newer"
else
  outcome=0
  document_with_events || outcome=$?
  case $outcome in
    0) ;;
    1) reason="The Mini could not read the Calendar filters from Sanity, so it did not list the coming events" ;;
    *) reason="Node could not list the coming events, and the log of the calendar service says why" ;;
  esac
fi

if [ -n "$reason" ]; then
  document_without_events "$reason" > "$document"
fi

# Made in the data folder so the final move is a rename, which is atomic
temp=$(mktemp "$data/.calendar-status.XXXXXX")
cp "$document" "$temp"
mv -f "$temp" "$status_file"
echo "calendar status: wrote calendar-status.json"
