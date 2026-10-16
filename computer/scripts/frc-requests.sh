# Read by frc-sync.sh, never run. Asking the two services, with their ETags.
# curl's exit code in plain words. curl's own messages can include the address,
# so they are not shown.
explain() {
  case $1 in
    6) echo "could not find the server, so the network may be down" ;;
    7) echo "could not connect to the server" ;;
    28) echo "the server took too long to answer" ;;
    35|51|58|59|60) echo "the secure connection failed" ;;
    63) echo "the answer is too big" ;;
    *) echo "curl failed with exit code $1" ;;
  esac
}

service_name() {
  if [ "$1" = tba ]; then
    echo "The Blue Alliance"
  else
    echo "Statbotics"
  fi
}

# A value that is missing, or still the placeholder from local.example.env that
# starts with [, means the feed is not set up yet. The timer's run ends without an
# error then, so the service does not show as failed. A run by hand fails.
not_set_up() {
  echo "$1 is not in local.env yet, so nothing was read. See docs/frc-feed.md."
  if [ "$mode" = timer ]; then
    exit 0
  fi
  exit 1
}

# A key is letters, digits and a few signs. Anything else would not be one, and
# must not be put in a curl setting.
looks_like_key() {
  if ! printf '%s' "$2" | grep -Eq '^[A-Za-z0-9_.-]+$'; then
    echo "$1 in local.env does not look like a key. Paste it again, with nothing else on the line." >&2
    exit 1
  fi
}

note() {
  printf '%s\n' "$1" >> "$work/notes.txt"
}

problem() {
  printf '%s\n' "$1" >> "$work/errors.txt"
}

fill() {
  printf '%s' "$1" | sed -e "s/{team}/$team_key/g" -e "s/{number}/$team_number/g" -e "s/{year}/$year/g" \
    -e "s/{event}/$event_key/g" -e "s/{match}/$match_key/g" -e "s/{district}/$district_key/g"
}

# Keeps or forgets the ETag of answer $1, from the headers in file $2
keep_etag() {
  etag=$(sed -n 's/^[Ee][Tt][Aa][Gg]: *//p' "$2" | tr -d '\r' | tail -n 1)
  if printf '%s' "$etag" | grep -Eq "$etag_pattern"; then
    jq --arg name "$1" --arg etag "$etag" '.[$name] = $etag' "$etags" > "$etags.new" && mv -f "$etags.new" "$etags"
  else
    forget_etag "$1"
  fi
}

forget_etag() {
  jq --arg name "$1" 'del(.[$name])' "$etags" > "$etags.new" && mv -f "$etags.new" "$etags"
}

# The secret part of a request: The Blue Alliance wants the key in a header.
# curl reads it on standard input, so it never shows in the process list.
secret_settings() {
  if [ "$1" = tba ]; then
    printf 'header = "X-TBA-Auth-Key: %s"\n' "$tba_key"
  fi
}

# Asks one service for one address, once in a cycle. $1 is tba or statbotics, $2
# is the name the answer is kept under in the cache folder and $3 is the address
# after the host. Leaves one word in $outcome: changed, same (as last time, or
# already read in this cycle), missing (the service has nothing there), failed,
# or stopped (nothing was asked).
get() {
  service=$1
  name=$2
  where=$3
  file="$cache/$name.json"
  outcome=stopped
  printf '%s\n' "$name" >> "$work/seen.txt"

  if grep -Fxq -- "$name" "$cycle"; then
    outcome=same
    return 0
  fi
  if [ -n "$stopped" ]; then
    return 0
  fi
  if [ "$service" = statbotics ] && [ "$statbotics_off" = yes ]; then
    return 0
  fi
  if [ "$requests" -ge "$max_requests" ]; then
    stopped=capped
    return 0
  fi
  requests=$((requests + 1))

  if [ "$service" = tba ]; then
    address="$tba_host$where"
  else
    address="$statbotics_host$where"
  fi

  # An ETag is only sent with the answer it belongs to still on disk
  sent=$(jq -r --arg name "$name" '.[$name] // empty' "$etags" 2> /dev/null || true)
  if [ ! -f "$file" ] || ! printf '%s' "$sent" | grep -Eq "$etag_pattern"; then
    sent=""
  fi
  set --
  if [ -n "$sent" ]; then
    set -- --header "If-None-Match: $sent"
  fi

  curl_status=0
  answer_code=$(secret_settings "$service" |
    curl --disable --silent --max-time 30 --connect-timeout 10 --max-filesize 5000000 \
      --proto '=https' --dump-header "$work/headers.txt" --output "$work/answer.json" \
      --write-out '%{http_code}' "$@" --config - "$address" 2> /dev/null) || curl_status=$?

  if [ "$curl_status" -ne 0 ]; then
    outcome=failed
    problem "$(service_name "$service") did not answer, $(explain "$curl_status")."
    failures=$((failures + 1))
    if [ "$failures" -ge 3 ]; then
      stopped=network
    fi
    return 0
  fi
  failures=0

  case $answer_code in
    [0-9][0-9][0-9]) ;;
    *) answer_code=000 ;;
  esac

  case $answer_code in
    200)
      if ! jq empty "$work/answer.json" > /dev/null 2>&1; then
        outcome=failed
        problem "$(service_name "$service") sent an answer that is not data ($name)."
        return 0
      fi
      if [ -f "$file" ] && cmp -s "$work/answer.json" "$file"; then
        outcome=same
      else
        mv -f "$work/answer.json" "$file"
        outcome=changed
      fi
      keep_etag "$name" "$work/headers.txt"
      printf '%s\n' "$name" >> "$cycle"
      ;;
    304)
      if [ -f "$file" ]; then
        outcome=same
        printf '%s\n' "$name" >> "$cycle"
      else
        forget_etag "$name"
        outcome=failed
        problem "$(service_name "$service") said nothing had changed, but the earlier answer is gone ($name)."
      fi
      ;;
    404)
      rm -f "$file"
      forget_etag "$name"
      outcome=missing
      printf '%s\n' "$name" >> "$cycle"
      ;;
    401|403)
      outcome=failed
      if [ "$service" = tba ]; then
        stopped=refused
        problem "The Blue Alliance refused the key. Check TBA_AUTH_KEY in local.env."
      else
        statbotics_off=yes
        note "Statbotics refused the request, so ratings and win chances were skipped."
      fi
      ;;
    429)
      outcome=failed
      stopped=limit
      problem "$(service_name "$service") says there were too many requests, so this run stopped. It goes on at the next run."
      ;;
    *)
      outcome=failed
      problem "$(service_name "$service") answered with code $answer_code ($name)."
      ;;
  esac
}
