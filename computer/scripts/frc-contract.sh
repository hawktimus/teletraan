# Read by frc-sync.sh, never run. The addresses, where each value sits in an answer, and the limits.
# Everything that depends on how the two services write their answers is in this
# block: the addresses, and where each value sits in an answer. If a service
# changes something, correct the line here and nowhere else. They were written
# from the public documentation of both services and have not been tried against
# the live services (docs/frc-feed.md, "If an answer looks different").
#
# An address has {team} (frc3229), {number} (3229), {year}, {event}
# (2027ncwak), {match} (2027ncwak_qm12) or {district} (2027nc) in it.
tba_host='https://www.thebluealliance.com/api/v3'
tba_status='/status'
tba_team_events='/team/{team}/events/{year}'
tba_team_matches='/team/{team}/event/{event}/matches'
tba_rankings='/event/{event}/rankings'
tba_alliances='/event/{event}/alliances'
tba_event_teams='/event/{event}/teams/simple'
tba_awards='/team/{team}/awards/{year}'
tba_district_events='/district/{district}/events'
tba_district_rankings='/district/{district}/rankings'
tba_event='/event/{event}'
tba_event_matches='/event/{event}/matches'
tba_event_awards='/event/{event}/awards'
statbotics_host='https://api.statbotics.io/v3'
statbotics_team_year='/team_year/{number}/{year}'
statbotics_match='/match/{match}'

# The district whose events and points are read: the year and then this code
district_code=nc

# How many teams the district championship takes. Leave it empty until it is
# known. The cutoff is then the points of the team at that place in the list.
district_slots=

# Where each value sits in an answer, as jq functions. Each one is given one item
# of the list it belongs to: an event, a match, a ranking and so on.
paths='
def event_key: .key;
def event_name: .name;
def event_short_name: .short_name;
def event_city: .city;
def event_start: .start_date;
def event_end: .end_date;
def event_is_championship: (.event_type == 2 or .event_type == 5);
def match_key: .key;
def match_level: .comp_level;
def match_set: .set_number;
def match_number: .match_number;
def match_time: (.time // .predicted_time);
def match_red_teams: .alliances.red.team_keys;
def match_blue_teams: .alliances.blue.team_keys;
def match_red_score: .alliances.red.score;
def match_blue_score: .alliances.blue.score;
def match_winner: .winning_alliance;
def ranking_list: .rankings;
def ranking_team: .team_key;
def ranking_rank: .rank;
def ranking_played: .matches_played;
def ranking_wins: .record.wins;
def ranking_losses: .record.losses;
def ranking_ties: .record.ties;
def ranking_points: .sort_orders[0];
def alliance_picks: .picks;
def team_key: .key;
def team_nickname: .nickname;
def award_name: .name;
def award_event: .event_key;
def district_ranking_team: .team_key;
def district_rank: .rank;
def district_points_total: .point_total;
def statbotics_epa: .epa.total_points.mean;
def statbotics_red_win: .pred.red_win_prob;
'

# At most this many requests to the two services in one run. A run that stops
# here carries on at the next one.
max_requests=60

# Seconds. The timer starts the script every 5 minutes. With no event on, a run
# is made when the last one was this long ago, and during an event when the last
# was the shorter time ago. The status is written again after refresh_gap even if
# nothing changed, so that the time in it shows the Teletraan computer is still looking.
quiet_gap=$((50 * 60))
event_gap=$((4 * 60))
refresh_gap=$((45 * 60))

# The next matches that get a win chance from Statbotics, the results and the
# daily snapshots kept in the status, and the awards listed
odds_matches=3
results_kept=8
snapshots_kept=120
awards_kept=20

# The time zone of the screen is the one on the Look page. This is used until
# Sanity has been asked.
default_zone=America/New_York

# What an ETag looks like, so nothing else is sent back to the service
etag_pattern='^(W/)?"[A-Za-z0-9._:+/=-]{1,100}"$'
