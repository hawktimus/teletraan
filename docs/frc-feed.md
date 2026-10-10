# FRC feed

For the coaches and the students who look after the Mini. The Mini reads the
public competition data of each team and keeps it in Sanity, so the screen can
show the season, the next match, the last results, the rank and the ratings.
This page says what it reads, what it writes, how often, what to do when it
stops, and then what the screen does with it: the seven competition cards, the
setting that says when they come, and the Preview competition button.

None of it has been tried against the live services. The addresses and the
places in the answers were written from the public documentation of The Blue
Alliance (the read API, version 3) and of Statbotics. If one is wrong, see "If an
answer looks different" below.

## What it reads

The Blue Alliance:

- the team's events for the season
- for each of those events that is not over: the team's matches, the rankings,
  the alliances and the teams that attend
- the team's awards for the season
- the events of the North Carolina district, and the district rankings

Statbotics:

- the team's rating for the season (EPA)
- the rating of the other teams in the next match
- the chance of winning for the next 3 matches

The teams are the Team documents in Studio. A team's key is `frc` and its Team
number, so number 3229 is `frc3229`. A team with no number is left out, and so is
a team that The Blue Alliance does not know. Neither is an error. A team that is
switched off (Active) is not read. The season is the current year in the Time
zone on the Look page.

## What it writes

One document in Sanity with the fixed id `frc-status` and the type `frcStatus`.
`deploy/scripts/frc-sync.sh` replaces it as a whole. Its fields:

- `season`, `lastSyncAt` (the time of the last write), `lastError` (plain words,
  or nothing) and `notes` (things that are not errors, such as Statbotics being
  skipped)
- `districtEvents`: the district's events, with `championship` true on the
  district championship
- `teams`, one for each team that was read:
  - `team` (the team's code), `number`, `key`
  - `events`: key, name, city, start and end date, the rank, number of teams
    ranked, matches played, record and ranking points the team had there, and the
    team's rating (`epa`) while the event was on. The rating is read while the event
    is on, kept after it, and empty before it starts
  - `focusEvent`: the first event that is not over, which the fields below are about
  - `nextMatch`: match, label, level, number, time, the team's alliance colour,
    `red` and `blue` (team number, nickname and rating of each; a rating is empty
    when Statbotics has none), `redWinProbability` (0 to 1, or nothing when
    Statbotics has none)
  - `results`: the last 8 matches played, oldest first: match, label, alliance
    colour, `scoreFor`, `scoreAgainst`, `won` (true, false, or nothing for a tie)
  - `ranking`: event, rank, teams ranked, matches played, record, ranking points
  - `alliance`: event, alliance number and partners (number, nickname and, when
    it was read, rating), once the selection is made. The number is empty when the
    team was not picked. Only the teams of the next match have a rating.
  - `awards`: name and event
  - `epa`: the rating
  - `districtPoints`: total, rank and `cutoff` (see "The district cutoff")
  - `snapshots`: one entry a day with the date, the rating and the district
    points, 120 entries at most
  - `lastSeason`: the events of the season before, kept when the year changes

A value that is not known is empty. Nothing is made up to fill a gap. The ranking
points are the first sort value in the rankings of The Blue Alliance, which is
the ranking score of the event.

## The dataset is public

Anyone can ask Sanity for this document, because the dataset is public. It holds
only what is already public on the two sites: team numbers, team nicknames, match
numbers and times, scores, ranks, award names and ratings. It holds no person's
name. The award winners are not copied and neither are the long team names. The
key and the token are never written in it or in any file.

## The keys

- `TBA_AUTH_KEY` in `deploy/local.env` on the Mini. The Blue Alliance wants it in
  a header on every request. The script hands it to curl on standard input, so it
  never shows in the process list, and it is never printed or saved. How to make
  one: docs/rebuilding-the-mini.md, step 17.
- `SANITY_WRITE_TOKEN` in the same file, the one the status block uses
  (docs/rebuilding-the-mini.md, "Showing what the Mini did in Studio").
- Statbotics needs no key. If it ever answers with a refusal, the script skips
  Statbotics for that run and says so in `notes`.

Without the key or the token the script does nothing, says so in one line, and
ends without an error, so the service does not show as failed.

## When it runs

`teletraan-frc.timer` starts the script 2 minutes after the Mini boots and then
every 5 minutes. The script looks at the time of its last run and at the dates of
the events it saw, and ends at once unless it is time:

- while a team has an event on, from its first day to its last day, in the Time
  zone on the Look page: at least 4 minutes after the last run, so about every
  5 minutes
- otherwise: at least 50 minutes after the last run, so about once an hour
- always, after a run that was stopped by the limit below

There is one timer and not two (hourly, and every 5 minutes during an event)
because one timer is one thing to install and one thing to look at. A Mini that
was off at the hour catches up at its next wake, because the script goes by the
time of its last run and not by the clock. The wakes that end at once cost
nothing. A run by hand with `--now` ignores the time.

## Limits

- At most 60 requests to The Blue Alliance and Statbotics in one run. The
  question to Sanity does not count. A run that reaches 60 writes what it has,
  puts a note in the status, and the next run, 5 minutes later, carries on with
  the first address it has not read. A pass over all the addresses is finished
  before a new one starts.
- Every answer is kept in `frc/cache/` in the data folder with its ETag in
  `frc/etags.json`. The next request sends the ETag back in `If-None-Match`, and
  the service answers 304 when nothing changed. A 304 still counts as a request.
  Statbotics sends no ETag, so its answers are read again each time.
- Nothing is written to Sanity when nothing changed. About every 45 minutes it is
  written anyway, so that `lastSyncAt` shows the Mini is still looking.
  Status-mini (Dashboard Settings, the status block) gets the time of every run
  that worked, written or not.
- Three requests in a row that get no answer stop the run, because the network
  may be down. A refused key stops it at once. "Too many requests" from a service
  stops it too, and it carries on at the next run.
- A run that went wrong keeps what it read before. The last error is in `lastError`.

## Trying it

On the Mini:

    /opt/teletraan/deploy/scripts/frc-sync.sh --check
    /opt/teletraan/deploy/scripts/frc-sync.sh --now
    sudo journalctl -u teletraan-frc.service -n 30
    systemctl list-timers 'teletraan-frc*'

`--check` asks The Blue Alliance one question and says whether the key works and
whether the token is in `local.env`. It writes nothing. `--now` does a whole run
at once, whatever the time, and prints a line for each team and for the write. The
journal has what the timer's runs said.

## If something is wrong

| What you see | What to do |
|--------------|------------|
| `--check` says The Blue Alliance refused the key | The key is wrong or was deleted. Make a new one on the account page and put it in `local.env`. |
| The script says `TBA_AUTH_KEY is not in local.env yet` | Add the line (docs/rebuilding-the-mini.md, step 17). |
| `team nova: not found on The Blue Alliance, skipped` | The Team number in Studio is wrong, or the team has no page yet. Check Teams. |
| `team nova: no team number, skipped` | The team has no Team number in Studio. Add it if the team should be read. |
| The notes say Statbotics refused the request | Nothing to do. Ratings and win chances come back when it stops refusing. |
| Nothing happens and the timer is listed | Normal when it is not time. Run it with `--now`. |
| `lastError` says an answer is not data, or the status has gaps | A service changed how it answers. See the next part. |

## If an answer looks different

Every address and every place in an answer is in one block near the top of
`deploy/scripts/frc-sync.sh`. The addresses are `tba_` and `statbotics_` lines
with `{team}`, `{year}`, `{event}`, `{match}`, `{number}` and `{district}` where
the script puts the values. The places are the `def` lines in `paths`, such as
`def match_red_score: .alliances.red.score;`. They are jq, and each one is given
one item, such as one match.

The last real answer of each address is kept in the data folder, so there is no
need to ask the service by hand and no key is typed anywhere:

    ls /var/lib/teletraan/data/frc/cache
    jq . /var/lib/teletraan/data/frc/cache/tba-rankings-2027ncwak.json | head -40

The file names are `tba-events-<year>-<team key>`, `tba-matches-<team key>-<event>`,
`tba-rankings-<event>`, `tba-alliances-<event>`, `tba-teams-<event>`,
`tba-awards-<year>-<team key>`, `tba-district-events-<year>`,
`tba-district-rankings-<year>`, `statbotics-team-<year>-<number>` and
`statbotics-match-<match>`. Compare what is there with the line in the block,
correct that one line and run `frc-sync.sh --now`. An address that no longer
exists is not kept, so for that case read the documentation of the service.

`tools/test-frc-script.mjs` uses made-up answers with the same places. If a place
changes in the block, change it in the made-up answers too, and run the test
(docs/where-things-are.md, "Checking your work").

## The district cutoff

The district rankings give each team's points but not how many points get a team
into the district championship. `district_slots` in the block is the number of
teams the championship takes. It is empty until that number is known. Once it is
set, the cutoff is the points of the team at that place in the district list.
Until then `cutoff` is empty and nothing is shown.

## The cards on the screen

The screen reads the document `frc-status` with the rest of the content, and draws
it as seven cards in the large panel. Each card is a panel in
`dashboard/panels/competition-*`, drawn as plain SVG at the size of the large
panel, with no text under 44px and no line thinner than 3px. A card shows the
data of the team that is on the screen. A team that the Mini did not read has no
cards. Nothing on a card is made up: what the Mini did not find is a dash or is
left out, and a sentence says so.

| Card | Header | What it shows | When it comes in Auto |
|------|--------|---------------|-----------------------|
| Season timeline | SEASON | A line from today to the last coming date. The dates are the next date of the countdown (Kickoff, then Rollout), each event of the team that is not over, and the state championship, each a dot with the days left. | All season, while there is a date ahead. |
| Last season at a glance | the year, such as 2026 | The record of the whole season, the rank at each event, and the EPA after each event as a short line. | Before the first event of the season starts, when the Mini has kept last season. |
| Live rank | RANK | The rank as the biggest number, how many teams are ranked, the record and the ranking points. | From two days before an event to its last day. |
| Next match | MATCH | The match and its time, the three teams on each alliance with their EPA, which side the team is on, and the chance that red wins as one bar split red and blue. | The same days, and it comes first. |
| Results strip | RESULTS | The last 8 matches as chips in red or blue, the colour the team was on, with the score and a tick for a win. A lost match is dimmer. | The same days. |
| Alliance board | ALLIANCE | The number of the alliance and the teams on it. | The same days, once the selection has been made. |
| District points | DISTRICT | The points, the rank and a bar that fills toward the cutoff for the state championship. | All season once the first event has started, when the Mini has the points. |

The days of an event are in the time zone on the Look page, from the first day to
the last day. The state championship is on the timeline when the district list
has it. The district points card shows no bar until `district_slots` is set (see
"The district cutoff"), and says so.

A header can say more. Sample data says SAMPLE. Data the Mini wrote more than 2
hours ago says how old it is, such as 5 HR OLD, so a Mini that has stopped
reading does not pass for live.

When a card is asked to draw and has nothing to show, it says one sentence:

- Next match: No match is scheduled yet.
- Live rank: There is no rank yet. Rankings start after the first match.
- Results strip: No matches have been played yet.
- Alliance board: Alliance selection has not happened yet. If the selection did
  not pick the team: The team was not picked for an alliance.
- Season timeline: No dates are coming up yet.
- District points: There are no district points yet.
- Last season at a glance: There are no results from last season yet.

A card with nothing to show is not put in the rotation at all, so a screen with no
key on the Mini shows no competition card. The sentences are for the card asked
for by hand (`?show=competition-rank` on the address) and for a card that loses
its data while it waits for its turn.

## When the cards come

The Competition tab of Dashboard Settings has the setting. Competition cards is
one of three:

- Auto: each card comes in the time of its own, in the last column of the table.
  On the days of an event the cards take priority: the large panel shows a card,
  then an ordinary panel, then a card, and so on, starting with the next match.
  On the two days before an event, and for the cards that run all season, the
  cards are spread evenly through the ordinary panels and come once in each time
  round.
- Always: every card that is switched on and has something to show, whatever the
  date. Use it to try the cards, or if the team wants them up all the time.
- Off: no card.

Each card has a switch of its own, all on to start with. A card that is switched
off is never put in the rotation, in any mode (Preview competition shows all of
them). The Panel order list does not have the cards:
they come in and go out by the mode, the switches and the data. How long a card
stays follows Seconds per page, like every other panel. The small panel and the
ticker are not touched, and the cards look the same in every style and layout,
because they are drawn at the size of the large panel and scaled with it.

`withCompetition` in `dashboard/core/competition.js` is called each time the large
panel chooses its next page, with the list of panels from Panel order. It returns
the list with the due cards in it. A problem with the data leaves the list as it
was and is written once to the console, so the rotation never stops because of
the competition data.

The look rotation (docs/layouts.md, "The look rotation") follows the same list.
The cards come in the pass of panels of each team, once in each pass, with the
data of the team that has the pass. A Monday pass has its own list, so no
competition card comes in it.

The first block of the tab shows what the Mini last did: when it last read the
data, how many events it found for each team, any note and the last error. With
no document yet it says No connection yet and what to add to `local.env`.

## Preview competition

The button on the Start here page shows the seven cards on sample data, so the
team can see them before the season, with no key and no internet. Click it and,
within a few seconds:

- The screen waits while an alert, an announcement, a talk, night mode, a demo or
  a hidden transition has it, and starts when it is free, if the click is still
  less than a minute old.
- It reads the sample competition data in `dashboard/data/sample/content.json`.
  The numbers of the other teams are made up and written in brackets, such as
  [1121], and the headers say SAMPLE.
- The large panel shows every card in order of priority, each for an equal share
  of 2 minutes (about 17 seconds), whatever the mode and the switches say. Then it
  goes back to its own list.
- Nothing is read from Sanity or from the Mini, and nothing is written. One
  click is handled once: the click that was handled is kept in the browser, so a
  Mini that restarts never runs it again.

`core/competition-preview.js` decides, and `core/competition-preview-run.js` gives
it the real screen. `tools/test-competition.mjs` checks it.

## Changing a card

Each card is a folder with a script and a stylesheet in `dashboard/panels/`, and
`core/competition-draw.js` has what they share. The numbers in the script are
pixels in a body of 1096 by 512. If you change a size or a word, run
`node tools/test-competition.mjs`: it checks that no text is under 44px, that no
text leaves the body or runs into the text beside it even with the longest names,
and that every card is in `registry.js`, in `competition.js` and in the Studio.
