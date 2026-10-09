#!/bin/sh
# Writes the time of a job that has just finished into the document status-mini
# in Sanity, so that Dashboard Settings can show what the Mini last did. The
# calendar and slides services run it after each job, and kiosk.sh runs it when
# the screen starts. One argument says which job:
#
#   status-write.sh content    the newest change to published content that the Mini can see
#   status-write.sh calendar   the calendars were downloaded
#   status-write.sh slides     the slides were downloaded
#   status-write.sh monday     the Monday boards were read
#   status-write.sh frc        the FRC data was read
#   status-write.sh kiosk      the screen started
#
# Writing needs a token with Editor access, SANITY_WRITE_TOKEN in local.env
# (docs/rebuilding-the-mini.md). With no token this exits quietly, and Studio
# shows No status yet. The token is never printed, and it is handed to curl on
# standard input so it never shows in the process list.
set -eu

deploy=$(cd "$(dirname "$0")/.." && pwd)
repo=$(dirname "$deploy")
config="$repo/dashboard/config.js"
env_file="$deploy/local.env"

# The document the Studio shows (studio/status-input.js has the same id)
document=status-mini

usage() {
  echo "Usage: status-write.sh content|calendar|slides|monday|frc|kiosk" >&2
  exit 2
}

[ "$#" -eq 1 ] || usage

# The field of the document that each job writes
case $1 in
  content) field=lastContentSeenAt ;;
  calendar) field=lastCalendarSyncAt ;;
  slides) field=lastSlidesFetchAt ;;
  monday) field=lastMondaySyncAt ;;
  frc) field=lastFrcSyncAt ;;
  kiosk) field=kioskStartedAt ;;
  *) usage ;;
esac

# The value of a NAME=value line in local.env, without its quotes. Only the
# name asked for is read, because the other lines hold secrets.
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

# curl's exit code in plain words. curl's own messages can include the
# address, so they are not shown.
explain() {
  case $1 in
    6) echo "could not find the server, so the network may be down" ;;
    7) echo "could not connect to the server" ;;
    22) echo "Sanity refused it, so the token may be wrong or may not have Editor access" ;;
    28) echo "Sanity took too long to answer" ;;
    35|51|58|59|60) echo "the secure connection failed" ;;
    *) echo "curl failed with exit code $1" ;;
  esac
}

token=$(setting SANITY_WRITE_TOKEN)

# No token, or the placeholder from local.example.env that starts with [
case $token in
  ''|'['*) exit 0 ;;
esac

# A token is letters, digits and a few signs. Anything else would not be one,
# and must not be put in a curl setting.
if ! printf '%s' "$token" | grep -Eq '^[A-Za-z0-9_.-]+$'; then
  echo "SANITY_WRITE_TOKEN in local.env does not look like a token. Paste it again, with nothing else on the line." >&2
  exit 1
fi

project=$(config_value projectId)
dataset=$(config_value dataset)
version=$(config_value apiVersion)

if ! printf '%s' "$project" | grep -Eq '^[a-z0-9]+$' ||
  ! printf '%s' "$dataset" | grep -Eq '^[A-Za-z0-9_-]+$' ||
  ! printf '%s' "$version" | grep -Eq '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'; then
  echo "Could not read the project ID, dataset and API version from dashboard/config.js." >&2
  exit 1
fi

host="https://$project.api.sanity.io"

# The newest change to a published document, which is what "content update
# seen" means. The documents the Mini writes itself are left out, or every
# write would be the newest change. The dataset is public, so no token is sent.
# Gives nothing when Sanity cannot be asked or has no such document.
newest_update() {
  query='*[!(_type in ["status", "calendarStatus", "mondayStatus", "frcStatus"]) && !(_id match "task-monday-*")] | order(_updatedAt desc)[0]._updatedAt'
  status=0
  answer=$(curl --silent --max-time 20 --connect-timeout 10 --get "$host/v$version/data/query/$dataset" \
    --data-urlencode "query=$query" --data-urlencode 'perspective=published' 2> /dev/null) || status=$?
  [ "$status" -eq 0 ] || return 0
  printf '%s' "$answer" | sed -n 's/.*"result":"\([^"]*\)".*/\1/p' | head -n 1
}

if [ "$field" = lastContentSeenAt ]; then
  value=$(newest_update)
  if ! printf '%s' "$value" | grep -Eq '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z$'; then
    echo "status: could not find the newest change to the content, so nothing was written." >&2
    exit 1
  fi
else
  value=$(date -u +%Y-%m-%dT%H:%M:%SZ)
fi

# Make the document if it is not there yet, then set the one time. Everything
# in the body is a name or a time that was checked above.
body=$(printf '{"mutations":[{"createIfNotExists":{"_id":"%s","_type":"status"}},{"patch":{"id":"%s","set":{"%s":"%s"}}}]}' \
  "$document" "$document" "$field" "$value")

status=0
printf 'header = "Authorization: Bearer %s"\n' "$token" |
  curl --silent --fail --max-time 20 --connect-timeout 10 --config - \
    --request POST --header 'Content-Type: application/json' --data "$body" \
    --output /dev/null "$host/v$version/data/mutate/$dataset" 2> /dev/null || status=$?

if [ "$status" -ne 0 ]; then
  echo "status: could not write $field, $(explain "$status")." >&2
  exit 1
fi
echo "status: wrote $field"
