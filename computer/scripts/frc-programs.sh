# Read by frc-sync.sh, never run. The jq programs that build the status document.
# The helpers the filters share. They are logic and not API paths, so they are
# not in frc-contract.sh.
helpers='
def level_rank: if type == "string" then (({"qm": 0, "ef": 1, "qf": 2, "sf": 3, "f": 4})[.] // 5) else 5 end;
def match_order: [(match_level | level_rank), (match_set // 0), (match_number // 0)];
def played: ((match_red_score // -1) >= 0) and ((match_blue_score // -1) >= 0);
'

# The document. It has team numbers, nicknames, scores and ranks, and no people:
# the names of award winners and the long team names of the service are left out.
build='
def listing: if type == "array" then map(select(type == "object")) else [] end;
def numeric: if type == "number" then . else null end;
def lines($text): [$text | split("\n")[] | select(. != "")];
def stored($name): $bundle[0][$name];
def keyed:
  if type == "array" then
    to_entries | map(.value |= keyed | if (.value | type) == "object" then .value + {_key: (.key | tostring)} else .value end)
  elif type == "object" then map_values(keyed)
  else . end;
def iso: if type == "number" then (floor | todate) else null end;
def number_of: ltrimstr("frc") | tonumber? // null;

def match_label:
  (match_number | tostring) as $n
  | if match_level == "qm" then "Q" + $n
    elif match_level == "f" then "F" + $n
    else ((match_level // "") | ascii_upcase) + ((match_set // 0) | tostring) + "-" + $n end;

def epa_of($number):
  stored("statbotics-team-" + $year + "-" + $number)
  | if type == "object" then statbotics_epa | numeric else null end
  | if . == null then null else ((. * 100 | round) / 100) end;

def nickname($roster; $key): [$roster | listing[] | select(team_key == $key) | team_nickname | strings][0];
def person($roster; $key): {number: ($key | number_of), nickname: nickname($roster; $key), epa: epa_of($key | ltrimstr("frc"))};
def people($roster; $keys): [($keys // [])[] | strings | person($roster; .)];

def on_team($keys; $key): ($keys // []) | any(.[]; . == $key);
def color_of($key):
  if on_team(match_red_teams; $key) then "red"
  elif on_team(match_blue_teams; $key) then "blue"
  else null end;

def result_of($key):
  color_of($key) as $color
  | (match_winner // "") as $winner
  | {
      match: match_key,
      label: match_label,
      alliance: $color,
      scoreFor: (if $color == "red" then match_red_score elif $color == "blue" then match_blue_score else null end),
      scoreAgainst: (if $color == "red" then match_blue_score elif $color == "blue" then match_red_score else null end),
      won: (if $color == null or $winner == "" then null else $winner == $color end)
    };

def next_of($key; $roster):
  color_of($key) as $color
  | (stored("statbotics-match-" + match_key) | if type == "object" then statbotics_red_win | numeric else null end) as $odds
  | {
      match: match_key,
      label: match_label,
      level: match_level,
      number: match_number,
      time: (match_time | iso),
      alliance: $color,
      red: people($roster; match_red_teams),
      blue: people($roster; match_blue_teams),
      redWinProbability: $odds
    };

def rankings_of($event):
  stored("tba-rankings-" + ($event | event_key)) | if type == "object" then ranking_list | listing else [] end;

def ranking_fields($event; $key):
  rankings_of($event) as $list
  | ([$list[] | select(ranking_team == $key)][0]) as $row
  | if $row == null then null
    else {
      rank: ($row | ranking_rank | numeric),
      teamsRanked: ($list | length),
      matchesPlayed: ($row | ranking_played | numeric),
      record: ($row | {wins: ranking_wins, losses: ranking_losses, ties: ranking_ties}),
      rankingPoints: ($row | ranking_points | numeric)
    } end;

def empty_ranking: {rank: null, teamsRanked: null, matchesPlayed: null, record: null, rankingPoints: null};

# The rating of the team during an event: read while the event is on, kept after it, and none before it
def event_epa($event; $key; $old):
  if ($event | event_start) > $today then null
  elif ($event | event_end) >= $today then epa_of($key | ltrimstr("frc"))
  else (($old.epa // null) | numeric) end;

# The short name TBA gives an event, in an object of its own so that an event without one has no field
def short_name_of($event):
  ($event | event_short_name) as $short
  | if ($short | type) == "string" and ($short | length) > 0 then {shortName: $short} else {} end;

# The rank of an event that is over is no longer asked for. What was written
# while it was on stays, and is taken from the status written last time.
def event_entry($event; $key; $old):
  (if ($event | event_end) >= $today then ranking_fields($event; $key) else null end) as $fresh
  | {
      key: ($event | event_key),
      name: ($event | event_name),
      city: ($event | event_city),
      startDate: ($event | event_start),
      endDate: ($event | event_end),
      epa: event_epa($event; $key; $old)
    } + short_name_of($event) + ($fresh // (if $old == null then empty_ranking else ($old | {rank, teamsRanked, matchesPlayed, record, rankingPoints}) end));

def alliance_of($event; $key; $roster):
  stored("tba-alliances-" + ($event | event_key)) | listing as $list
  | if ($list | length) == 0 then null
    else ([range(0; $list | length) | select(($list[.] | (alliance_picks // [])) | any(.[]; . == $key))][0]) as $at
      | {
          event: ($event | event_key),
          number: (if $at == null then null else $at + 1 end),
          picks: (if $at == null then [] else people($roster; $list[$at] | alliance_picks) end)
        }
    end;

# A team in the schedule or the field: the number, the nickname, the rating, and from Statbotics the record of the
# season and which way the rating is going. A trend is only told when the start of the season is known.
def trend_of($stats):
  if ($stats | type) != "object" then ""
  else
    ($stats | statbotics_epa | numeric) as $now
    | ($stats | statbotics_epa_start | numeric) as $start
    | if $now == null or $start == null then ""
      elif $now - $start >= $trend_points then "rising"
      elif $start - $now >= $trend_points then "falling"
      else "" end
  end;

def record_of($stats):
  if ($stats | type) != "object" then null
  else ($stats | {wins: (statbotics_wins | numeric), losses: (statbotics_losses | numeric), ties: (statbotics_ties | numeric)}) end;

def scout($roster; $key):
  stored("statbotics-team-" + $year + "-" + ($key | ltrimstr("frc"))) as $stats
  | person($roster; $key) + {record: record_of($stats), trend: trend_of($stats)};

def scouts($roster; $keys; $skip): [($keys // [])[] | strings | select(. != $skip) | scout($roster; .)];

# The qualification matches the team has still to play at the event, with the win chance of the alliance of the team when
# Statbotics has one. No matches is the schedule that is not posted yet.
def schedule_of($focus_key; $key; $roster; $to_play):
  {
    event: $focus_key,
    matches: [$to_play[] | select(match_level == "qm")][0:$scheduled_kept] | map(
      color_of($key) as $color
      | (stored("statbotics-match-" + match_key) | if type == "object" then statbotics_red_win | numeric else null end) as $odds
      | {
          match: match_key,
          label: match_label,
          number: match_number,
          time: (match_time | iso),
          alliance: $color,
          partners: (if $color == "red" then scouts($roster; match_red_teams; $key) elif $color == "blue" then scouts($roster; match_blue_teams; $key) else [] end),
          opponents: (if $color == "red" then scouts($roster; match_blue_teams; "") elif $color == "blue" then scouts($roster; match_red_teams; "") else [] end),
          winProbability: (if $odds == null or $color == null then null elif $color == "red" then $odds else (1 - $odds) end)
        })
  };

# The teams that come to the event with their rating, best first. Only for an event whose ratings were read in the window of this run
# window (field-events.txt), and only when at least two teams have one.
def field_of($focus_key; $roster):
  if (lines($field_events) | index($focus_key)) == null then null
  else
    ([$roster | listing[] | team_key | strings | select(test("\\Afrc[1-9][0-9]{0,4}\\z")) | person($roster; .)]) as $teams
    | if ($teams | map(select(.epa != null)) | length) < 2 then null
      else {event: $focus_key, teams: ($teams | sort_by(-(.epa // -1000000))[0:$field_kept])} end
  end;

def awards_of($key):
  [stored("tba-awards-" + $year + "-" + $key) | listing[] | {name: award_name, event: award_event}] | .[0:$awards_kept];

def district_rows: stored("tba-district-rankings-" + $year) | listing;

def district_of($key):
  district_rows as $rows
  | ([$rows[] | select(district_ranking_team == $key)][0]) as $row
  | if $row == null then null
    else {
      total: ($row | district_points_total | numeric),
      rank: ($row | district_rank | numeric),
      cutoff: (if $slots == null then null else ($rows | map(district_points_total // 0) | sort | reverse | .[$slots - 1]) end)
    } end;

def district_events:
  [stored("tba-district-events-" + $year) | listing | sort_by(event_start)[]
    | {key: event_key, name: event_name, city: event_city, startDate: event_start, endDate: event_end, championship: event_is_championship} + short_name_of(.)]
  | .[0:30];

def snapshot_list($old):
  [$old | listing[]
    | select((.date | type) == "string" and (.date | test("^[0-9]{4}-[0-9]{2}-[0-9]{2}$")))
    | {date, epa: (.epa | numeric), districtPoints: (.districtPoints | numeric)}];

# One snapshot a day, which the last run of the day keeps
def with_today($snapshots; $epa; $points):
  if $epa == null and $points == null then $snapshots
  else (($snapshots | map(select(.date != $today))) + [{date: $today, epa: $epa, districtPoints: $points}]) | sort_by(.date) | .[(0 - $snapshots_kept):]
  end;

($answer[0].result.previous | if type == "object" then . else {} end) as $previous
| ($previous.teams | listing) as $previous_teams

# When the season changes, the events of the old one are kept for the glance back
| def last_season($old):
  ($previous.season | numeric) as $was
  | ($old.events | listing) as $events
  | if $was != null and $was != ($year | tonumber) and ($events | length) > 0
    then {season: $was, events: $events}
    else ($old.lastSeason | if type == "object" then . else null end) end;

def team_doc($team):
  $team.key as $key
  | ([$previous_teams[] | select(.team == $team.code)][0] // {}) as $old
  | (stored("tba-events-" + $year + "-" + $key) | listing | map(select((event_key | type) == "string")) | sort_by(event_start)) as $all
  | ([$all[] | select((event_end // "") >= $today)][0]) as $focus
  | ($focus | if . == null then null else event_key end) as $focus_key
  | (if $focus == null then [] else stored("tba-matches-" + $key + "-" + $focus_key) | listing | map(select((match_key | type) == "string")) | sort_by(match_order) end) as $matches
  | (if $focus == null then null else stored("tba-teams-" + $focus_key) end) as $roster
  | ($matches | map(select(played))) as $done
  | ($matches | map(select(played | not))) as $to_play
  | [$all[] | . as $event | event_entry($event; $key; ([$old.events | listing[] | select(.key == ($event | event_key))][0]))] as $events
  | ($events | map(select(.key == $focus_key)) | .[0]) as $focus_event
  | {
      team: $team.code,
      number: ($team.number | tonumber),
      key: $key,
      events: $events,
      focusEvent: $focus_key,
      nextMatch: ($to_play[0] | if . == null then null else next_of($key; $roster) end),
      results: ($done | .[(0 - $results_kept):] | map(result_of($key))),
      ranking: (if $focus_event == null or $focus_event.rank == null then null
        else {event: $focus_key} + ($focus_event | {rank, teamsRanked, matchesPlayed, record, rankingPoints}) end),
      alliance: (if $focus == null then null else alliance_of($focus; $key; $roster) end),
      awards: awards_of($key),
      schedule: (if $focus == null then null else schedule_of($focus_key; $key; $roster; $to_play) end),
      field: (if $focus == null then null else field_of($focus_key; $roster) end),
      epa: epa_of($team.number),
      districtPoints: district_of($key)
    } as $doc
  | $doc + {
      snapshots: with_today(snapshot_list($old.snapshots); $doc.epa; ($doc.districtPoints | if . == null then null else .total end)),
      lastSeason: last_season($old)
    };

{
    _id: "frc-status",
    _type: "frcStatus",
    season: ($year | tonumber),
    lastSyncAt: $now,
    lastError: (lines($errors) | unique | if length == 0 then null else (.[0:3] | join("; ") | .[0:300]) end),
    notes: lines($notes),
    districtEvents: district_events,
    teams: [$teams[0][] | team_doc(.)]
  }
| keyed
'
