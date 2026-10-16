# Read by frc-sync.sh, never run. The --check and --event runs.
# The --check run: asks The Blue Alliance one question and writes nothing
run_check() {
  folder=$(mktemp -d "${TMPDIR:-/tmp}/frc-check.XXXXXX")
  trap 'rm -rf "$folder"' EXIT
  failed=0

  status=0
  code=$(printf 'header = "X-TBA-Auth-Key: %s"\n' "$tba_key" |
    curl --disable --silent --max-time 30 --connect-timeout 10 --proto '=https' \
      --output "$folder/answer.json" --write-out '%{http_code}' --config - "$tba_host$tba_status" 2> /dev/null) || status=$?

  if [ "$status" -ne 0 ]; then
    echo "FAIL  The Blue Alliance did not answer, $(explain "$status")"
    failed=1
  elif [ "$code" = 200 ]; then
    echo "OK    The Blue Alliance accepts the key (season $(jq -r '.current_season | numbers' "$folder/answer.json" 2> /dev/null))"
  elif [ "$code" = 401 ] || [ "$code" = 403 ]; then
    echo "FAIL  The Blue Alliance refused the key. Check TBA_AUTH_KEY in local.env."
    failed=1
  else
    echo "FAIL  The Blue Alliance answered with code $code"
    failed=1
  fi

  case $write_token in
    ''|'['*)
      echo "FAIL  SANITY_WRITE_TOKEN is not in local.env, so nothing can be written to Sanity"
      failed=1
      ;;
    *) echo "OK    SANITY_WRITE_TOKEN is in local.env" ;;
  esac

  exit "$failed"
}

# One past event into a file. The file holds the answers of The Blue Alliance as they came, in one
# object, and tools/frc-fixture.mjs turns it into the shape of the sample content. The key is sent
# the way the other requests send it, on standard input, and is never shown.
run_event() {
  if ! printf '%s' "$wanted_event" | grep -Eq '^[0-9]{4}[a-z0-9]{1,20}$'; then
    echo "The event key looks like 2026ncwak: the year and then the event code, in small letters." >&2
    exit 1
  fi
  if [ ! -d "$(dirname "$wanted_file")" ]; then
    echo "The folder for $wanted_file does not exist." >&2
    exit 1
  fi

  event_work=$(mktemp -d "${TMPDIR:-/tmp}/frc-event.XXXXXX")
  trap 'rm -rf "$event_work"' EXIT

  # Reads one address into $event_work/$1.json. $3 is optional when the answer may be missing.
  # Stops the run with a plain sentence when the answer cannot be had.
  read_event_part() {
    part=$1
    where=$2
    curl_status=0
    part_code=$(printf 'header = "X-TBA-Auth-Key: %s"\n' "$tba_key" |
      curl --disable --silent --max-time 30 --connect-timeout 10 --max-filesize 20000000 --proto '=https' \
        --output "$event_work/$part.json" --write-out '%{http_code}' --config - "$tba_host$where" 2> /dev/null) || curl_status=$?

    if [ "$curl_status" -ne 0 ]; then
      echo "The Blue Alliance did not answer for $part, $(explain "$curl_status")." >&2
      exit 1
    fi
    case $part_code in
      200) jq empty "$event_work/$part.json" > /dev/null 2>&1 || { echo "The Blue Alliance sent an answer that is not data ($part)." >&2; exit 1; } ;;
      404) if [ "${3:-}" = optional ]; then echo '[]' > "$event_work/$part.json"; else echo "The Blue Alliance has no $part for $wanted_event." >&2; exit 1; fi ;;
      401|403) echo "The Blue Alliance refused the key. Check TBA_AUTH_KEY in local.env." >&2; exit 1 ;;
      *) echo "The Blue Alliance answered with code $part_code ($part)." >&2; exit 1 ;;
    esac
  }

  event_address() {
    printf '%s' "$1" | sed "s/{event}/$wanted_event/g"
  }

  read_event_part event "$(event_address "$tba_event")"
  read_event_part matches "$(event_address "$tba_event_matches")"
  read_event_part rankings "$(event_address "$tba_rankings")" optional
  read_event_part alliances "$(event_address "$tba_alliances")" optional
  read_event_part teams "$(event_address "$tba_event_teams")"
  read_event_part awards "$(event_address "$tba_event_awards")" optional

  # The points of the district, when the event belongs to one. The code is checked before it is used in an address.
  district_found=$(jq -r '.district.key | strings' "$event_work/event.json" 2> /dev/null || true)
  echo '[]' > "$event_work/district.json"
  if printf '%s' "$district_found" | grep -Eq '^[0-9]{4}[a-z]{2,4}$'; then
    read_event_part district "$(printf '%s' "$tba_district_rankings" | sed "s/{district}/$district_found/g")" optional
  fi

  jq -n --slurpfile event "$event_work/event.json" --slurpfile matches "$event_work/matches.json" \
    --slurpfile rankings "$event_work/rankings.json" --slurpfile alliances "$event_work/alliances.json" \
    --slurpfile teams "$event_work/teams.json" --slurpfile awards "$event_work/awards.json" \
    --slurpfile district "$event_work/district.json" \
    '{source: "The Blue Alliance", event: $event[0], matches: $matches[0], rankings: $rankings[0], alliances: $alliances[0], teams: $teams[0], awards: $awards[0], districtRankings: $district[0]}' \
    > "$wanted_file.new"
  mv -f "$wanted_file.new" "$wanted_file"

  echo "Wrote $wanted_event to $wanted_file ($(jq '.matches | length' "$wanted_file") matches, $(jq '.teams | length' "$wanted_file") teams)."
  echo "Next: node tools/frc-fixture.mjs $wanted_file"
  exit 0
}
