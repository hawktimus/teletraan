#!/bin/sh
# Shows what the screen does with each calendar in local.env. For every event
# in the next 30 days it prints one line, SHOWN, or HIDDEN with the name of the
# Calendar filter that hides it, and then how many of each. A SHOWN line also
# says where the event is on the Events panel (page 1, page 1 pinned, page 2, or
# later when it is not one of the first eight) and the kind of its calendar. It
# only reads: nothing is saved and nothing is changed. The filters are read
# from Sanity the way the screen reads them, and the events are expanded by the
# dashboard's own calendar code, which needs Node. The Mini does not have Node,
# so run this on a computer that has Node, a copy of the repository and a
# deploy/local.env with the calendar addresses:
#
#   deploy/scripts/check-calendars.sh
#
# The feed addresses are secrets, so nothing here prints one. Every line
# names a calendar by its code only.
set -eu

deploy=$(cd "$(dirname "$0")/.." && pwd)
env_file="$deploy/local.env"
helper="$deploy/scripts/check-calendars.mjs"

if [ ! -f "$env_file" ]; then
  echo "No local.env at $env_file. Copy local.example.env to local.env first." >&2
  exit 1
fi

if ! command -v curl > /dev/null 2>&1; then
  echo "curl is not installed, so nothing can be downloaded." >&2
  exit 1
fi

if ! command -v node > /dev/null 2>&1; then
  echo "Node is not installed. This check needs it, and the Mini does not have it." >&2
  echo "Run it on a computer that has Node, a copy of the repository and a deploy/local.env with the calendar addresses." >&2
  exit 1
fi

# The value of a NAME=value line in local.env, without its quotes.
# The last line wins if a name is repeated.
setting() {
  sed -n "s/^$1=//p" "$env_file" | tail -n 1 | sed "s/^['\"]//; s/['\"]\$//"
}

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

# curl's own messages can include the name of the server, so they are not
# shown. The exit code is explained in plain words instead.
explain() {
  case $1 in
    1) echo "the address, or a redirect from it, is not an https:// address" ;;
    3) echo "the address is not a valid web address" ;;
    6) echo "could not find the server, so the network may be down" ;;
    7) echo "could not connect to the server" ;;
    22) echo "the server said no, so the address may be wrong or expired" ;;
    28) echo "the server took too long to answer" ;;
    35|51|58|59|60) echo "the secure connection failed" ;;
    47) echo "the server redirected too many times" ;;
    63) echo "the download is too big to be a calendar" ;;
    *) echo "curl failed with exit code $1" ;;
  esac
}

# One line in the same shape as the lines the helper prints: a word, the
# calendar code, then the text
say() {
  printf '%-8s%s  %s\n' "$1" "$2" "$3"
}

# Downloads calendar $1 from address $2 into the work folder
fetch_one() {
  id=$1
  url=$2

  case $url in
    webcal://*) url="https://${url#webcal://}" ;;
    http://*)
      say FAIL "$id" "the address starts with http://, which is not secure. Use the https:// address."
      return 1
      ;;
  esac

  # The address goes in on standard input so it never shows in the process
  # list. Redirects are followed but only to https, and a download over
  # 20 MB is not a calendar.
  status=0
  printf 'url = "%s"\n' "$url" |
    curl --fail --silent --show-error --max-time 60 \
      --location --max-redirs 3 --proto '=https' --proto-redir '=https' --max-filesize 20000000 \
      --config - --output "$work/$id.ics" 2>/dev/null || status=$?

  if [ "$status" -ne 0 ]; then
    say FAIL "$id" "download failed, $(explain "$status")"
    return 1
  fi

  # An address that has expired can answer with a web page instead of a calendar
  if ! grep -q 'BEGIN:VCALENDAR' "$work/$id.ics" || ! grep -q 'END:VCALENDAR' "$work/$id.ics"; then
    say FAIL "$id" "the download is not a complete calendar"
    return 1
  fi
}

names=$(sed -n 's/^\(CALENDAR_[A-Za-z0-9_][A-Za-z0-9_]*_URL\)=.*/\1/p' "$env_file")

if [ -z "$names" ]; then
  echo "No CALENDAR_<ID>_URL lines in local.env, nothing to check."
  exit 0
fi

# The filters and the other settings come from the same query the screen asks.
# Sanity is read without a login, as the screen does.
address=$(node "$helper" address)
status=0
curl --fail --silent --show-error --max-time 20 --output "$work/sanity.json" "$address" 2>/dev/null || status=$?

if [ "$status" -ne 0 ] || ! grep -q '"result"' "$work/sanity.json"; then
  echo "Could not read the Calendar filters from Sanity, so nothing was checked." >&2
  echo "Run check-connection.sh to see which part is not working." >&2
  exit 1
fi

failed=0
downloaded=""

for name in $names; do
  id=${name#CALENDAR_}
  id=$(printf '%s' "${id%_URL}" | tr 'A-Z' 'a-z')
  url=$(setting "$name")

  case $url in
    ''|'['*)
      say SKIP "$id" "no address set yet"
      continue
      ;;
  esac

  if fetch_one "$id" "$url"; then
    downloaded="$downloaded $id"
  else
    failed=$((failed + 1))
  fi
done

# The page of an event depends on all the calendars, so they are checked after
# every download is done. The folder is where the downloads are.
for id in $downloaded; do
  if ! node "$helper" "$work/sanity.json" "$id" "$work/$id.ics" "$work"; then
    failed=$((failed + 1))
  fi
done

if [ "$failed" -ne 0 ]; then
  exit 1
fi
