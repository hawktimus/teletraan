# Read by frc-sync.sh, never run. Reads every address of every team and of the district into the cache.
is_event_key() {
  printf '%s' "$1" | grep -Eq '^[0-9]{4}[a-z0-9]{1,20}$'
}

is_match_key() {
  printf '%s' "$1" | grep -Eq '^[0-9]{4}[a-z0-9]{1,20}_[a-z0-9]{1,12}$'
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
    fi
  done < "$work/team-list.txt"

  # One list of district events and one of district points, for every team
  if [ "$(jq length "$work/teams.json")" -gt 0 ]; then
    district_key="$year$district_code"
    get tba "tba-district-events-$year" "$(fill "$tba_district_events")"
    get tba "tba-district-rankings-$year" "$(fill "$tba_district_rankings")"
  fi
}
