#!/bin/bash
# Usage: news-sync.sh [--dry-run]
# Reads the FIRST community blog feed (https://community.firstinspires.org/rss.xml), keeps the
# newest headlines in the categories chosen on the FRC news page in Studio, and writes them into
# the document frc-news in Sanity. The FRC news panel and the ticker read that document. Only
# the headline, the link, the date and the categories are kept: never the description or the
# article. Needs curl and jq (docs/frc-news.md). The feed is read with awk (news-rss.awk).
#
# One run, which the timer starts every 2 hours. It stops quietly when news is turned off in
# Settings or when there is no write token. When the feed cannot be read, the old list stays and
# lastError says why in plain words. --dry-run prints the document and writes nothing.
#
# The write token is SANITY_WRITE_TOKEN in local.env. It is handed to curl on standard input,
# so it never shows in the process list, and it is never printed.
set -euo pipefail
. "$(dirname "$0")/lib.sh"

feed_url=https://community.firstinspires.org/rss.xml
document=frc-news
max_items=10
max_title=140
default_categories='["FRC","Control System"]'

dry_run=no
case ${1:-} in
  '') ;;
  --dry-run) dry_run=yes ;;
  *)
    echo "Usage: $0 [--dry-run]" >&2
    exit 1
    ;;
esac
[ "$#" -le 1 ] || { echo "Usage: $0 [--dry-run]" >&2; exit 1; }

for tool in curl jq awk; do
  if ! command -v "$tool" > /dev/null 2>&1; then
    echo "The $tool command is missing. Install the packages with:" >&2
    echo "  sudo apt install curl jq" >&2
    exit 1
  fi
done

# curl's exit code in plain words. curl's own messages can include the address, so they are
# not shown.
explain() {
  case $1 in
    6) echo "could not find the server, so the network may be down" ;;
    7) echo "could not connect to the server" ;;
    22) echo "the server refused it" ;;
    28) echo "the server took too long to answer" ;;
    35|51|58|59|60) echo "the secure connection failed" ;;
    63) echo "the answer is too big" ;;
    *) echo "curl failed with exit code $1" ;;
  esac
}

write_token=$(setting SANITY_WRITE_TOKEN)
if [ "$dry_run" = no ]; then
  case $write_token in
    ''|'['*)
      echo "news: SANITY_WRITE_TOKEN is not in local.env yet, so nothing was read. See docs/frc-news.md."
      exit 0
      ;;
  esac
  if ! printf '%s' "$write_token" | grep -Eq '^[A-Za-z0-9_.-]+$'; then
    echo "SANITY_WRITE_TOKEN in local.env does not look like a token. Paste it again, with nothing else on the line." >&2
    exit 1
  fi
fi

data=$(setting TELETRAAN_DATA)
data=${data:-/var/lib/teletraan/data}
news="$data/news"
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
host="https://$project.api.sanity.io"

umask 022
mkdir -p "$news"

# A run that starts while the last one is still going stops at once
exec 9> "$news/.lock"
if ! flock -n 9; then
  echo "The last run is still going, so this one stops."
  exit 0
fi

rm -rf "$news"/.work.*
work=$(mktemp -d "$news/.work.XXXXXX")
trap 'rm -rf "$work"' EXIT

# Sends a body of mutations. The token goes to curl as a setting on standard input.
send() {
  printf 'header = "Authorization: Bearer %s"\n' "$write_token" |
    curl --disable --silent --fail --max-time 30 --connect-timeout 10 --proto '=https' --config - \
      --request POST --header 'Content-Type: application/json' --data-binary "@$1" \
      --output /dev/null "$host/v$version/data/mutate/$dataset" 2> /dev/null
}

# The old list stays. Only lastError changes, so the page in Studio can say why.
fail() {
  echo "news: $1" >&2
  if [ "$dry_run" = no ]; then
    jq -n --arg id "$document" --arg error "$1" \
      '{mutations: [
        {createIfNotExists: {_id: $id, _type: "frcNews", items: [], hiddenItems: []}},
        {patch: {id: $id, set: {lastError: $error}}}]}' > "$work/error.json"
    status=0
    send "$work/error.json" || status=$?
    if [ "$status" -ne 0 ]; then
      echo "news: could not write the error to Sanity, $(explain "$status")." >&2
    fi
  fi
  exit 1
}

# The switches and the hidden links, as the editors saved them. The dataset is public, so no
# token is sent. The ordinary host is used and not the cached one.
query='*[_id == "dashboardSettings"][0] { newsEnabled, newsCategories, newsHiddenLinks }'
status=0
curl --disable --silent --get --max-time 30 --connect-timeout 10 --max-filesize 1000000 --proto '=https' \
  --data-urlencode "query=$query" --data-urlencode 'perspective=published' \
  --output "$work/settings.json" "$host/v$version/data/query/$dataset" 2> /dev/null || status=$?

if [ "$status" -ne 0 ] || ! jq -e 'has("result")' "$work/settings.json" > /dev/null 2>&1; then
  echo "Could not get the settings from Sanity. Nothing was changed. Check that the Teletraan computer is online; the next run tries again." >&2
  exit 1
fi

if [ "$(jq -r '.result.newsEnabled' "$work/settings.json")" = false ]; then
  echo "news: FRC news is turned off in Settings, so nothing was read."
  exit 0
fi

# Categories are compared in lower case. An empty or missing list means the default.
jq -c --argjson default "$default_categories" '
  [(.result.newsCategories | arrays | .[] | strings | gsub("^\\s+|\\s+$"; "") | select(length > 0) | ascii_downcase)]
  | if length == 0 then ($default | map(ascii_downcase)) else unique end' "$work/settings.json" > "$work/wanted.json"
jq -c '[(.result.newsHiddenLinks | arrays | .[] | strings | gsub("^\\s+|\\s+$"; ""))] | .[0:200]' "$work/settings.json" > "$work/hidden.json"

status=0
http_code=$(curl --disable --silent --location --max-redirs 3 --max-time 30 --connect-timeout 10 \
  --max-filesize 2000000 --proto '=https' --proto-redir '=https' \
  --user-agent 'Teletraan-I/1.0 (FRC team 3229 wall dashboard; reads headlines only)' \
  --header 'Accept: application/rss+xml, application/xml, text/xml' \
  --output "$work/feed.xml" --write-out '%{http_code}' "$feed_url" 2> /dev/null) || status=$?

if [ "$status" -ne 0 ]; then
  fail "Could not read the FIRST community blog, $(explain "$status"). The list on the screen is the last good one."
fi
if [ "$http_code" != 200 ]; then
  fail "The FIRST community blog answered with $http_code instead of the feed. The list on the screen is the last good one."
fi

awk -f "$computer/scripts/news-rss.awk" < "$work/feed.xml" > "$work/rows.txt" || true
if ! grep -q '^item$' "$work/rows.txt"; then
  fail "The FIRST community blog feed had no items. The list on the screen is the last good one."
fi

now_iso=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# One object for each item with a headline, an address and a date. The newest are kept, and
# the ones an editor hid go to hiddenItems so Studio can offer to show them again.
if ! jq -R -n -c \
  --arg id "$document" --arg now "$now_iso" --argjson max "$max_items" --argjson longest "$max_title" \
  --slurpfile wanted "$work/wanted.json" --slurpfile hidden "$work/hidden.json" '
  def letter: if (. >= 32 and . < 55296) or (. > 57343 and . < 1114112) then [.] | implode else " " end;
  def hex: ascii_downcase | explode | map(if . >= 97 then . - 87 else . - 48 end) | reduce .[] as $digit (0; . * 16 + $digit);
  def entities:
    gsub("\u0001d(?<n>[0-9]{1,7});"; "\(.n | tonumber | letter)")
    | gsub("\u0001x(?<h>[0-9A-Fa-f]{1,6});"; "\(.h | hex | letter)");
  def plain: entities | gsub("<[^>]*>"; " ") | gsub("\\s+"; " ") | gsub("^\\s+|\\s+$"; "");
  def cut($n): if length <= $n then . else (.[0:$n - 3] | sub("\\s+\\S*$"; "")) + "..." end;
  def months: {jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11};
  def zones: {gmt: 0, ut: 0, utc: 0, z: 0, est: -300, edt: -240, cst: -360, cdt: -300, mst: -420, mdt: -360, pst: -480, pdt: -420};
  def offset($zone):
    if $zone == null then 0
    elif ($zone | test("^[+-][0-9]{4}$")) then
      (($zone[1:3] | tonumber) * 60 + ($zone[3:5] | tonumber)) * (if $zone[0:1] == "-" then -1 else 1 end)
    else (zones[$zone | ascii_downcase] // 0) end;
  def rfc_date:
    try (capture("(?<d>[0-9]{1,2}) (?<mon>[A-Za-z]{3})[A-Za-z]* (?<y>[0-9]{4}) (?<h>[0-9]{1,2}):(?<mi>[0-9]{2})(:(?<s>[0-9]{2}))? ?(?<z>[+-][0-9]{4}|[A-Za-z]+)?")
      | ([(.y | tonumber), months[.mon | ascii_downcase], (.d | tonumber), (.h | tonumber), (.mi | tonumber), ((.s // "0") | tonumber), 0, 0] | mktime) - (offset(.z) * 60) | todate)
    catch null;
  def item_date:
    (.["dc:date"] // "") as $iso
    | if ($iso | test("^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\\.[0-9]+)?Z$")) then $iso[0:19] + "Z"
      elif (.pubDate // "") != "" and ((.pubDate | rfc_date) != null) then (.pubDate | rfc_date)
      elif ($iso | test("^[0-9]{4}-[0-9]{2}-[0-9]{2}$")) then $iso + "T00:00:00Z"
      else null end;
  def mentions_systemcore: test("system ?core"; "i");

  [inputs | split("\t")] as $rows
  | reduce $rows[] as $row ([];
      if $row[0] == "item" then . + [{categories: []}]
      elif length == 0 or ($row | length) < 2 then .
      elif $row[0] == "category" then .[-1].categories += [$row[1]]
      else .[-1][$row[0]] = $row[1] end)
  | map(
      (.title // "" | plain | cut($longest)) as $title
      | (.link // "" | gsub("^\\s+|\\s+$"; "")) as $link
      | ([.categories[] | plain | cut(30) | select(length > 0)] | unique | .[0:8]) as $categories
      | item_date as $date
      | select($title != "" and ($link | test("^https?://[^ ]{4,280}$")) and $date != null)
      | {title: $title, link: $link, date: $date, categories: $categories,
         systemcore: (($title + " " + ($categories | join(" "))) | mentions_systemcore), source: "FIRST"})
  | . as $usable
  | map(select(.categories | map(ascii_downcase) | any(. as $have | $wanted[0] | any(. == $have))))
  | unique_by(.link)
  | sort_by(.date) | reverse
  | . as $found
  | ($hidden[0]) as $away
  | def is_hidden: .link as $link | $away | any(. == $link);
    {usable: ($usable | length),
     document: {_id: $id, _type: "frcNews", lastSyncAt: $now,
       items: ([$found[] | select(is_hidden | not)] | .[0:$max]),
       hiddenItems: ([$found[] | select(is_hidden)] | .[0:$max])}}
  ' "$work/rows.txt" > "$work/read.json"; then
  fail "The feed could not be read as a list of headlines. The list on the screen is the last good one."
fi

# Items were there, but none had a headline, an address and a date: the feed changed shape or was cut
# short. A feed whose items are all in other categories is fine and writes an empty list.
if [ "$(jq '.usable' "$work/read.json")" -eq 0 ]; then
  fail "The FIRST community blog feed had items, but none with a headline, a link and a date. The list on the screen is the last good one."
fi
jq -c '.document' "$work/read.json" > "$work/news.json"

count=$(jq '.items | length' "$work/news.json")

if [ "$dry_run" = yes ]; then
  jq . "$work/news.json"
  exit 0
fi

jq -n --slurpfile document "$work/news.json" '{mutations: [{createOrReplace: $document[0]}]}' > "$work/mutation.json"
status=0
send "$work/mutation.json" || status=$?
if [ "$status" -ne 0 ]; then
  if [ "$status" -eq 22 ]; then
    echo "news: Sanity refused the list, so the token may be wrong or may not have Editor access." >&2
  else
    echo "news: could not write the list, $(explain "$status")." >&2
  fi
  exit 1
fi

# For status-write.sh news, which tells Studio and the control page when this run finished
printf '{"at":"%s","count":%s}\n' "$now_iso" "$count" > "$news/status.json"
echo "news: $count headlines written"
