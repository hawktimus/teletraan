#!/bin/sh
# Downloads every calendar listed in local.env into <data folder>/calendars.
# The feed addresses are secrets, so nothing here prints one. Messages name a
# calendar by its id only.
set -eu

deploy=$(cd "$(dirname "$0")/.." && pwd)
env_file="$deploy/local.env"

if [ ! -f "$env_file" ]; then
  echo "No local.env at $env_file. Copy local.example.env to local.env first." >&2
  exit 1
fi

# The value of a NAME=value line in local.env, without its quotes.
# The last line wins if a name is repeated.
setting() {
  sed -n "s/^$1=//p" "$env_file" | tail -n 1 | sed "s/^['\"]//; s/['\"]\$//"
}

data=$(setting TELETRAAN_DATA)
data=${data:-/var/lib/teletraan/data}
folder="$data/calendars"

if [ ! -d "$data" ]; then
  echo "The data folder $data does not exist. See docs/rebuilding-the-mini.md." >&2
  exit 1
fi

# Files written here must be readable by the web server inside the container
umask 022
mkdir -p "$folder"

# A power cut during a download leaves its temporary file behind. A file this
# old cannot be a download in progress, because each one gives up after 60
# seconds.
find "$folder" -name '.download.*' -mmin +10 -exec rm -f {} +

temp=""
trap 'rm -f "$temp"' EXIT

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

# The old file is only replaced by a complete download that looks like a
# calendar. Anything else leaves it alone.
fetch_one() {
  id=$1
  url=$2

  case $url in
    webcal://*) url="https://${url#webcal://}" ;;
    http://*)
      echo "calendar $id: the address starts with http://, which is not secure. Use the https:// address." >&2
      return 1
      ;;
  esac

  # Made in the same folder so the final move is a rename, which is atomic
  temp=$(mktemp "$folder/.download.XXXXXX")
  chmod 644 "$temp" # mktemp makes the file private

  # The address goes in on standard input so it never shows in the process
  # list. Redirects are followed but only to https, and a download over
  # 20 MB is not a calendar.
  status=0
  printf 'url = "%s"\n' "$url" |
    curl --fail --silent --show-error --max-time 60 \
      --location --max-redirs 3 --proto '=https' --proto-redir '=https' --max-filesize 20000000 \
      --config - --output "$temp" 2>/dev/null || status=$?

  if [ "$status" -ne 0 ]; then
    echo "calendar $id: download failed, $(explain "$status"). Keeping the old file." >&2
    return 1
  fi

  # An address that has expired can answer with a web page instead of a calendar
  if ! grep -q 'BEGIN:VCALENDAR' "$temp" || ! grep -q 'END:VCALENDAR' "$temp"; then
    echo "calendar $id: the download is not a complete calendar. Keeping the old file." >&2
    return 1
  fi

  mv -f "$temp" "$folder/$id.ics"
  echo "calendar $id: updated"
}

names=$(sed -n 's/^\(CALENDAR_[A-Za-z0-9_][A-Za-z0-9_]*_URL\)=.*/\1/p' "$env_file")

if [ -z "$names" ]; then
  echo "No CALENDAR_<ID>_URL lines in local.env, nothing to download."
  exit 0
fi

failed=0

for name in $names; do
  id=${name#CALENDAR_}
  id=$(printf '%s' "${id%_URL}" | tr 'A-Z' 'a-z')
  url=$(setting "$name")

  case $url in
    ''|'['*)
      echo "calendar $id: no address set yet, skipped"
      continue
      ;;
  esac

  if ! fetch_one "$id" "$url"; then
    failed=$((failed + 1))
  fi
  rm -f "$temp" # nothing is left behind after a failed download
done

# A failing exit shows up in "systemctl status", but one bad calendar does
# not stop the others
if [ "$failed" -ne 0 ]; then
  exit 1
fi
