# Match13 forecasts

Match13 (https://match13.com, made by Connor Horn) rates every FRC team and forecasts every match. The Teletraan
computer reads it for our teams and shows two cards on the TV.

## What it gives

- **Forecast** (title FORECAST). For each of our teams: the most likely finishing rank at the event, the range from the
  5th to the 95th percentile of the simulation drawn as a bar on a rank axis, the average ranking points, and the chance
  of the top 8 in words (nearly sure, likely, possible, unlikely). The foot line says how many runs the simulation
  had and the day. The chance of the top 8 is in words because the simulation gives three points of the finish and not
  every one.
- **Chances** (title CHANCES). For each of our teams: the chance of the District Championship and of the World
  Championship as a percentage with a bar, the district rank and points, and the cutline (about how many points the
  last seat needs). A team with a seat says QUALIFIED or LOCKED IN, and a team out of reach says OUT OF REACH.
- For the cards of the matches (next match and the schedule), core/match13.js has two functions: `matchForecastFor(matchKey)`
  gives the win chance, the scores and the chance of each ranking point of one match, and `fieldStrengthFor(eventKey)`
  gives how strong the teams of an event are. Both give nothing when Match13 has no numbers.

The cards come in the same windows as the other competition cards. Forecast comes from two days before an event to
its last day. Chances comes once the first event of the season has begun, and only after its switch is turned on: it is off to
start with, so a new Dashboard Settings does not show it. A Dashboard Settings that already says on keeps showing it until a coach
switches it off once on the Competition page. Each has a switch on the Competition page in
Studio, and Preview competition shows both on sample data (`dashboard/data/sample/match13.json`, marked SAMPLE).
A card with no numbers is not shown at all.

## The metrics cards

Two more cards, Team metrics (one team, a page at a time) and Compare (Prime and Nova side by side), join this file with frc-status
(docs/frc-feed.md, "The two metrics cards"). They come in Before and after and in Always, and Team metrics can also be a row. The Match13
numbers on them, with the field of the file they come from:

| Metric | Field |
|--------|-------|
| xP rating | `teams.<number>.xp` |
| Among all teams: TOP 32% | `100 - teams.<number>.percentile`, rounded |
| Season rank | `teams.<number>.rank` |
| At the event: 6TH OF 36 | the place of the team in `events.<key>.field.top`, by xP, and `field.teamCount` |
| Auto, teleop and endgame points | `xAuto`, `xTele` and `xEnd` |
| OPR, DPR and EPA | `opr`, `dpr` and `epa` |
| Win chance and expected score of the next match | `events.<key>.matches[].pred` (`winProb`, `redScore`, `blueScore`), for the alliance the team is on |
| Partner and opponent average | `events.<key>.matches[].teams.<number>` (xP before the match) when it is there for every team, otherwise the EPA of frc-status |
| Events of the season | `teams.<number>.history[]`: `xpStart`, `xpEnd` and `districtPoints` |

A number Match13 did not send is left out and the card says NOT YET. The sample file has made up numbers for the sample teams and says SAMPLE.
The team that plays a match is found in frc-status, because this file does not say which alliance a team is on.

## Where it is stored, and why not in Sanity

The Sanity dataset is public: anyone who knows the project can read it. Match13 marks its answers private
(`Cache-Control: private`), so nothing from Match13 goes to Sanity. `match13-sync.sh` writes one small file,
`match13.json` (under 200 KB), into the data folder of the Teletraan computer (`/var/lib/teletraan/data`). The web
server shows that folder, read only, at `/dashboard/data/live/`, and the screen reads `data/live/match13.json` every
10 minutes. The file holds team numbers and numbers, no names. The copy of the dashboard on port 3229 can read it too, so
the file is as private as the team's own network. It is not on the internet and not in Sanity.

The only thing sent to Sanity is a time, a state and a count (`match13At`, `match13State`, `match13Count` in the
document `status-mini`), so Studio can say when the last read was.

## The key

Match13 gives each account up to 10 keys. A key looks like `m13_live_` and some letters and digits. You see it once.

1. Sign in at https://www.match13.com/account and make a key. Copy it at once. If you lose it, make a new one.
2. Open the control page (http://teletraan.local:3229/control/), Settings, the Keys section, the line Match13 key.
   Type the key (the typing is hidden) and save. The same line is in the Mac tool (Keys and calendars). Never put the
   key in the repository, in a document in Sanity, in a chat or in an email.
3. Run the Mac tool once with `update`, so the timer is installed, or run
   `sudo /opt/teletraan/computer/scripts/install-match13.sh` on the Teletraan computer.
4. On the control page, Status, press Sync Match13 now. It says Done, or why not. The line Last Match13 read shows
   the time. Studio, Competition, shows it too.

The key is only ever sent to `actions.match13.com`, in a header, and is never printed or logged.

## The limits, and being polite

All the keys of one account share 60 requests a minute, 1000 an hour and 30000 a week. Every request counts, an
answer of 304 and an error too. Match13 can revoke a key that is used badly, so the script is careful:

- It asks at most 20 times in a run, and only for the events of our teams that are on or within 14 days (three
  events at most), the standings of our district, and each team.
- It runs every 30 minutes while an event is on or within 14 days, and every 6 hours otherwise. The timer wakes every
  30 minutes and the script decides.
- It sends the ETag of each answer back, so an answer that has not changed costs a small 304.
- It says who it is: the User-Agent names Teletraan I and the team.
- A 429 stops the run and the script waits as long as Match13 asks (`Retry-After`). A server error stops the run
  and the script waits an hour. A refused key (401) stops it and the script waits six hours, or starts again as soon as
  a different key is saved.
- A 404 is normal. It means Match13 has not simulated the event yet, or has no data. The card says so in plain words.

The district is `fnc` (North Carolina). To use another, add `MATCH13_DISTRICT='fnc'` to `local.env` on the Teletraan
computer with another code.

## If something does not show

| What you see | What to do |
|--------------|------------|
| Studio says No Match13 key yet | Add the key (step 2 above), then press Sync Match13 now. |
| Studio says Match13 did not accept the key | Make a new key on the account page and save it in the Keys section. |
| Studio says Match13 asked the computer to wait | Nothing. It reads again by itself. Too many keys or readers share the account. |
| The cards do not come | Forecast needs a simulation of the event, which Match13 makes only while it is live. Chances needs the district standings. Press Sync Match13 now and look at the log on the control page. |
| An amber STALE chip in the header | The file is more than 12 hours old. Check the Status tab, Last Match13 read. |

## What has not been tried

The script and the cards were built from real answers of the API and its published description. They have not been
run on the Teletraan computer. The first real run is the one you start with Sync Match13 now.
