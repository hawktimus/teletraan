# Read by frc-sync.sh, never run. Reads every address of every team and of the district into the cache.
is_event_key() {
  printf '%s' "$1" | grep -Eq '^[0-9]{4}[a-z0-9]{1,20}$'
}

is_match_key() {
  printf '%s' "$1" | grep -Eq '^[0-9]{4}[a-z0-9]{1,20}_[a-z0-9]{1,12}$'
}

# The rating of one team for the field strength: kept field_keep_hours, then asked for again. field-times.json says when each
# was read. A team Statbotics does not know gets an empty answer, so it is not asked for again in every run.
read_rating() {
  rating_number=$1
  rating_name="statbotics-team-$year-$rating_number"
  rating_file="$cache/$rating_name.json"

  rating_time=$(jq -r --arg name "$rating_name" '.[$name] // 0' "$field_times" 2> /dev/null || echo 0)
  case $rating_time in
    ''|*[!0-9]*) rating_time=0 ;;
  esac
  if [ -f "$rating_file" ] && [ $((now - rating_time)) -ge 0 ] && [ $((now - rating_time)) -lt $((field_keep_hours * 3600)) ]; then
    printf '%s\n' "$rating_name" >> "$work/seen.txt"
    return 0
  fi

  team_number=$rating_number
  get statbotics "$rating_name" "$(fill "$statbotics_team_year")" field
  if [ "$outcome" = missing ]; then
    echo '{}' > "$rating_file"
  fi
  if [ -f "$rating_file" ] && { [ "$outcome" = changed ] || [ "$outcome" = same ] || [ "$outcome" = missing ]; }; then
    jq --arg name "$rating_name" --argjson time "$now" '.[$name] = $time' "$field_times" > "$field_times.new" && mv -f "$field_times.new" "$field_times"
  fi
}

# The 14 days before an event: the rating of every team that comes, and the win chance of the matches of the team. $1 is the
# event, $2 the key of the team being read. Does nothing outside those days, when the roster is not there or when Statbotics
# is switched off for the run.
read_field() {
  field_event_key=$1
  field_team_key=$2
  roster_file="$cache/tba-teams-$field_event_key.json"
  [ -f "$roster_file" ] || return 0

  in_window=$(jq -r --arg today "$today" --arg key "$field_event_key" --argjson days "$preview_days" "$paths"'
    def day: strptime("%Y-%m-%d") | mktime / 86400 | floor;
    [.[]? | objects | select(event_key == $key)][0]
    | if . == null then "no"
      else (((event_start | day) - ($today | day)) as $left | if $left >= 1 and $left <= $days then "yes" else "no" end) end' "$events_file" 2> /dev/null || echo no)
  [ "$in_window" = yes ] || return 0

  printf '%s\n' "$field_event_key" >> "$work/field-events.txt"
  jq -r "$paths"'
    [.[]? | objects | team_key | strings | select(test("\\Afrc[1-9][0-9]{0,4}\\z")) | ltrimstr("frc")] | unique[]' "$roster_file" > "$work/field-teams.txt"

  # The matches of the team that are still to play, in the order they are played
  matches_file="$cache/tba-matches-$field_team_key-$field_event_key.json"
  : > "$work/field-matches.txt"
  if [ -f "$matches_file" ]; then
    jq -r --argjson count "$scheduled_kept" "$paths$helpers"'
      [.[]? | objects
        | select((match_key | type) == "string" and (match_key | test("\\A[0-9]{4}[a-z0-9]{1,20}_qm[0-9]{1,3}\\z")))
        | select(played | not)]
      | sort_by(match_order)[0:$count][] | match_key' "$matches_file" > "$work/field-matches.txt"
  fi

  while read -r number; do
    read_rating "$number"
  done < "$work/field-teams.txt"

  while read -r match_key; do
    is_match_key "$match_key" || continue
    get statbotics "statbotics-match-$match_key" "$(fill "$statbotics_match")" field
  done < "$work/field-matches.txt"
}

read_everything() {
  jq -r '.[] | "\(.code) \(.number)"' "$work/teams.json" > "$work/team-list.txt"
  echo "frc: reading $(jq length "$work/teams.json") team(s) for the $year season"

  while read -r code number; do
    team_key="frc$number"
    team_number=$number
    events_file="$cache/tba-events-$year-$team_key.json"

    get tba "tba-events-$year-$team_key" "$(fill "$tba_team_events")"

    # A team that The Blue Alliance does not know is left out without an error.
    # When the answer could not be had and there is nothing from before,
    # the team stays in the status with nothing in it.
    if [ ! -f "$events_file" ]; then
      if [ "$outcome" = missing ] || [ "$outcome" = same ]; then
        echo "team $code: not found on The Blue Alliance, skipped"
        jq -c --arg code "$code" 'map(select(.code != $code))' "$work/teams.json" > "$work/teams.new"
        mv -f "$work/teams.new" "$work/teams.json"
      fi
      continue
    fi

    # The events that are not over, earliest first. jq has checked the keys. They
    # are checked again because they become part of an address and a file name.
    jq -r --arg today "$today" "$paths"'
      [.[]? | objects
        | select((event_key | type) == "string" and (event_key | test("\\A[0-9]{4}[a-z0-9]{1,20}\\z")))
        | select((event_end | type) == "string" and event_end >= $today)]
      | sort_by(event_start)[] | event_key' "$events_file" > "$work/open.txt"

    echo "team $code: $(jq 'if type == "array" then length else 0 end' "$events_file") event(s) this season, $(grep -c . "$work/open.txt" || true) not over"

    while read -r event_key; do
      is_event_key "$event_key" || continue
      get tba "tba-matches-$team_key-$event_key" "$(fill "$tba_team_matches")"
      get tba "tba-rankings-$event_key" "$(fill "$tba_rankings")"
      get tba "tba-alliances-$event_key" "$(fill "$tba_alliances")"
      get tba "tba-teams-$event_key" "$(fill "$tba_event_teams")"
    done < "$work/open.txt"

    get tba "tba-awards-$year-$team_key" "$(fill "$tba_awards")"
    get statbotics "statbotics-team-$year-$team_number" "$(fill "$statbotics_team_year")"

    # The win chance of the next few matches of the event that is on or next
    focus=$(head -n 1 "$work/open.txt")
    if is_event_key "$focus" && [ -f "$cache/tba-matches-$team_key-$focus.json" ]; then
      jq -r --argjson count "$odds_matches" "$paths$helpers"'
        [.[]? | objects
          | select((match_key | type) == "string" and (match_key | test("\\A[0-9]{4}[a-z0-9]{1,20}_[a-z0-9]{1,12}\\z")))
          | select(played | not)]
        | sort_by(match_order)[0:$count][] | match_key' "$cache/tba-matches-$team_key-$focus.json" > "$work/upcoming.txt"

      while read -r match_key; do
        is_match_key "$match_key" || continue
        get statbotics "statbotics-match-$match_key" "$(fill "$statbotics_match")"
      done < "$work/upcoming.txt"

      # The rating of the other teams in the next match, to show beside each of them. The team being
      # read has its own already.
      next_match=$(head -n 1 "$work/upcoming.txt")
      if is_match_key "$next_match"; then
        jq -r --arg match "$next_match" --arg own "$team_key" "$paths"'
          [.[]? | objects | select(match_key == $match)
            | ((match_red_teams // []) + (match_blue_teams // []))[]? | strings
            | select(test("\\Afrc[1-9][0-9]{0,4}\\z")) | select(. != $own) | ltrimstr("frc")]
          | unique[]' "$cache/tba-matches-$team_key-$focus.json" > "$work/others.txt"

        own_number=$team_number
        while read -r team_number; do
          get statbotics "statbotics-team-$year-$team_number" "$(fill "$statbotics_team_year")"
        done < "$work/others.txt"
        team_number=$own_number
      fi

      read_field "$focus" "$team_key"
    fi
  done < "$work/team-list.txt"

  # One list of district events and one of district points, for every team
  if [ "$(jq length "$work/teams.json")" -gt 0 ]; then
    district_key="$year$district_code"
    get tba "tba-district-events-$year" "$(fill "$tba_district_events")"
    get tba "tba-district-rankings-$year" "$(fill "$tba_district_rankings")"
  fi
}
