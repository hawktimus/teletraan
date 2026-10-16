#!/bin/bash
# Usage: status-write.sh content|calendar|slides|monday|frc|kiosk|version|calendar-status|backup|--print|restart N
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
#   status-write.sh version    the build on the wall: the short hash, the date and the branch
#                              of the repository on the Mini (buildCommit, buildDate, buildBranch),
#                              from mini/build.txt when the Mac tool copied the files, else from git
#   status-write.sh backup     the nightly dataset backup finished (backup-dataset.sh)
#   status-write.sh restart N  the watchdog restarted the screen, N times today (watchdog.sh)
#   status-write.sh calendar-status
#                              sends the document that the Calendars page in Studio
#                              shows, which calendar-status.sh made in the data folder
#   status-write.sh --print    writes nothing: prints each time in the document and how
#                              long ago it was, which tools/mini/teletraan-mini shows
#
# Writing needs a token with Editor access, SANITY_WRITE_TOKEN in local.env
# (docs/rebuilding-the-mini.md). With no token this exits quietly, and Studio
# shows No status yet. The token is never printed, and it is handed to curl on
# standard input so it never shows in the process list. --print needs no token,
# because the dataset is public.
set -euo pipefail
. "$(dirname "$0")/lib.sh"

# The document the Studio shows (studio/inputs/status-input.js has the same id)
document=status-mini

usage() {
  echo "Usage: status-write.sh content|calendar|slides|monday|frc|kiosk|version|calendar-status|--print|backup|restart N" >&2
  exit 2
}

[ "$#" -ge 1 ] || usage
if [ "$1" = restart ]; then
  [ "$#" -eq 2 ] || usage
  printf '%s' "$2" | grep -Eq '^[0-9]{1,4}$' || usage
else
  [ "$#" -eq 1 ] || usage
fi

# The field of the document that each job writes
case $1 in
  content) field=lastContentSeenAt ;;
  calendar) field=lastCalendarSyncAt ;;
  slides) field=lastSlidesFetchAt ;;
  monday) field=lastMondaySyncAt ;;
  frc) field=lastFrcSyncAt ;;
  kiosk) field=kioskStartedAt ;;
  version) field=version ;;
  backup) field=lastBackupAt ;;
  restart) field=lastKioskRestartAt ;;
  calendar-status) field=calendar-status ;;
  --print) field=print ;;
  *) usage ;;
esac

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

token=''
if [ "$field" != print ]; then
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
  query='*[!(_type in ["status", "calendarStatus", "mondayStatus", "frcStatus"]) && !(_id match "task-monday-*") && !(_id match "milestone-monday-*")] | order(_updatedAt desc)[0]._updatedAt'
  status=0
  answer=$(curl --silent --max-time 20 --connect-timeout 10 --get "$host/v$version/data/query/$dataset" \
    --data-urlencode "query=$query" --data-urlencode 'perspective=published' 2> /dev/null) || status=$?
  [ "$status" -eq 0 ] || return 0
  printf '%s' "$answer" | sed -n 's/.*"result":"\([^"]*\)".*/\1/p' | head -n 1
}

# The words after a time: how long ago it was, counted the way the Studio counts
# it (studio/inputs/time-text.js). $1 is the time, $2 is now in seconds.
age_text() {
  awk -v text="$1" -v now="$2" 'BEGIN {
    year = substr(text, 1, 4) + 0
    month = substr(text, 6, 2) + 0
    day = substr(text, 9, 2) + 0
    if (month <= 2) year -= 1
    era = int(year / 400)
    yoe = year - era * 400
    shifted = month > 2 ? month - 3 : month + 9
    doy = int((153 * shifted + 2) / 5) + day - 1
    doe = yoe * 365 + int(yoe / 4) - int(yoe / 100) + doy
    then = (era * 146097 + doe - 719468) * 86400 + substr(text, 12, 2) * 3600 + substr(text, 15, 2) * 60 + substr(text, 18, 2)
    minutes = int((now - then) / 60 + 0.5)
    hours = int(minutes / 60 + 0.5)
    if (minutes < 1) print "just now"
    else if (minutes < 60) print minutes (minutes == 1 ? " minute ago" : " minutes ago")
    else if (hours < 48) print hours (hours == 1 ? " hour ago" : " hours ago")
    else print int(hours / 24 + 0.5) " days ago"
  }'
}

# One line of --print: the label, how long ago, and the time. A time the Mini
# has not written yet says Not yet.
time_line() {
  value=$(printf '%s' "$answer" | sed -n "s/.*\"$1\":\"\([^\"]*\)\".*/\1/p" | head -n 1)
  if printf '%s' "$value" | grep -Eq '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z$'; then
    clock=$(printf '%s' "$value" | sed 's/^\(....-..-..\)T\(..:..\).*/\1 \2 UTC/')
    printf '%-26s%s (%s)\n' "$2" "$(age_text "$value" "$now")" "$clock"
  else
    printf '%-26s%s\n' "$2" "Not yet"
  fi
}

if [ "$field" = print ]; then
  query="*[_id == \"$document\"][0]{lastContentSeenAt, lastCalendarSyncAt, lastSlidesFetchAt, lastMondaySyncAt, lastFrcSyncAt, kioskStartedAt}"
  status=0
  answer=$(curl --silent --max-time 20 --connect-timeout 10 --get "$host/v$version/data/query/$dataset" \
    --data-urlencode "query=$query" --data-urlencode 'perspective=published' 2> /dev/null) || status=$?
  if [ "$status" -ne 0 ]; then
    echo "status: could not read $document, $(explain "$status")." >&2
    exit 1
  fi

  case $answer in
    *'"result":null'*)
      echo "No status yet. Nothing has written $document."
      exit 0
      ;;
    *'"result":{'*) ;;
    *)
      echo "status: Sanity did not answer with the status document." >&2
      exit 1
      ;;
  esac

  now=$(date -u +%s)
  time_line lastContentSeenAt 'Last content update seen'
  time_line lastCalendarSyncAt 'Last calendar sync'
  time_line lastSlidesFetchAt 'Last slides fetch'
  time_line lastMondaySyncAt 'Last Monday sync'
  time_line lastFrcSyncAt 'Last FRC data sync'
  time_line kioskStartedAt 'Screen started'
  exit 0
fi

body=""

if [ "$field" = calendar-status ]; then
  # The document calendar-status.sh made. Studio reads it, so it has to be that
  # document, and small enough to send on a command line. Nothing is sent when
  # it is not there, because then there was no calendar run to report.
  data=$(setting TELETRAAN_DATA)
  file="${data:-/var/lib/teletraan/data}/calendar-status.json"
  [ -f "$file" ] || exit 0

  size=$(( $(wc -c < "$file") ))
  if [ "$size" -gt 100000 ]; then
    echo "status: calendar-status.json is too big, so nothing was written." >&2
    exit 1
  fi

  text=$(cat "$file")
  case $text in
    '{"_id":"calendar-status","_type":"calendarStatus",'*) ;;
    *)
      echo "status: calendar-status.json is not the calendar status document, so nothing was written." >&2
      exit 1
      ;;
  esac
  body=$(printf '{"mutations":[{"createOrReplace":%s}]}' "$text")
elif [ "$field" = lastContentSeenAt ]; then
  value=$(newest_update)
  if ! printf '%s' "$value" | grep -Eq '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z$'; then
    echo "status: could not find the newest change to the content, so nothing was written." >&2
    exit 1
  fi
elif [ "$field" = version ]; then
  # The Mac tool copies the files without the .git folder, so it leaves mini/build.txt with the
  # hash, the date and the branch of the repository it copied. A Mini that pulls has no such file
  # (pull.sh removes it) and git is asked. Each answer is checked, because it goes into a JSON body.
  stamp="$mini/build.txt"
  if [ -f "$stamp" ]; then
    commit=$(sed -n 's/^commit=//p' "$stamp" | head -n 1)
    built=$(sed -n 's/^date=//p' "$stamp" | head -n 1)
    branch=$(sed -n 's/^branch=//p' "$stamp" | head -n 1)
  else
    commit=$(git -C "$repo" rev-parse --short HEAD 2> /dev/null) || exit 0
    built=$(git -C "$repo" log -1 --format=%cs 2> /dev/null) || exit 0
    branch=$(git -C "$repo" rev-parse --abbrev-ref HEAD 2> /dev/null) || exit 0
  fi
  if ! printf '%s' "$commit" | grep -Eq '^[0-9a-f]{4,40}$' ||
    ! printf '%s' "$built" | grep -Eq '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' ||
    ! printf '%s' "$branch" | grep -Eq '^[A-Za-z0-9._/-]{1,100}$'; then
    echo "status: git did not give a hash, a date and a branch, so nothing was written." >&2
    exit 1
  fi
  field=buildCommit
  body=$(printf '{"mutations":[{"createIfNotExists":{"_id":"%s","_type":"status"}},{"patch":{"id":"%s","set":{"buildCommit":"%s","buildDate":"%s","buildBranch":"%s"}}}]}' \
    "$document" "$document" "$commit" "$built" "$branch")
else
  value=$(date -u +%Y-%m-%dT%H:%M:%SZ)
fi

# The watchdog also sets the number of restarts today, a number and not a time
if [ "$1" = restart ]; then
  body=$(printf '{"mutations":[{"createIfNotExists":{"_id":"%s","_type":"status"}},{"patch":{"id":"%s","set":{"kioskRestarts":%s,"%s":"%s"}}}]}' \
    "$document" "$document" "$2" "$field" "$value")
fi

# Make the document if it is not there yet, then set the one time. Everything
# in the body is a name or a time that was checked above.
if [ -z "$body" ]; then
  body=$(printf '{"mutations":[{"createIfNotExists":{"_id":"%s","_type":"status"}},{"patch":{"id":"%s","set":{"%s":"%s"}}}]}' \
    "$document" "$document" "$field" "$value")
fi

status=0
printf 'header = "Authorization: Bearer %s"\n' "$token" |
  curl --silent --fail --max-time 20 --connect-timeout 10 --config - \
    --request POST --header 'Content-Type: application/json' --data "$body" \
    --output /dev/null "$host/v$version/data/mutate/$dataset" 2> /dev/null || status=$?

if [ "$status" -ne 0 ]; then
  echo "status: could not write $field, $(explain "$status")." >&2
  exit 1
fi
if [ "$field" = buildCommit ]; then echo "status: wrote the build"; else echo "status: wrote $field"; fi
