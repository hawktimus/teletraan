# Coaches guide

For the coaches. This page says where each coach setting is, what to know before
you change it, and which page has the detail. Students use
docs/students.md. Everything under Coaches only in the sidebar is here:
Settings (Dashboard Settings, Look, Teams, Views and Themes) and Extra panels.

The Monday feed, the competition feed and the status documents have not been tried
against the live services, because they need keys that only the Teletraan computer holds. Their
pages say what to change if an answer looks different.

## Where things are

This is the table of the README. A file you want to change is in one of these folders. docs/where-things-are.md names every file, and docs/paths.md says where each file was before the folders were reorganized.

| Folder | What it holds |
|--------|---------------|
| `dashboard/` | The TV page: `index.html`, `core/` (the modules with no page in them), `panels/<id>/` (each panel's `panel.js` and `panel.css`), `styles/<theme>/` (original, cybertron and retro), `themes/` (color files and seasonal packs), `layouts/` and `data/` |
| `studio/` | The Studio: `schemas/` (one file for each kind of content), `inputs/` (custom inputs, pages and the lists that copy the dashboard's), `tools/` (Publish all, the view defaults and the buttons), `structure.js` (the sidebar) and `static/` (made by the build, never committed) |
| `control/` | The control page service (Node, standard library only) and its pages: updates, rollback, what is on the wall, the keys and the log (docs/control-page.md) |
| `computer/` | Everything that runs on the Teletraan computer: `install.sh`, `scripts/` (every script starts with `lib.sh`), `systemd/`, `nginx/`, `sudoers/`, `git/`, `console/`, `docker-compose.yml` and `local.example.env` |
| `tools/` | Things a coach runs on a Mac: `computer/` (the Mac tool), `mac/` (the Ship app), `screenshots.mjs`, `sweep.sh` with `sweep-words.txt`, `serve.py`, `frc-fixture.mjs`, the pages `icons.html`, `logo.html` and `zones.html`, and `perf/` |
| `tests/` | Every test, one file for each module or script, and `run.mjs` to run them all |
| `docs/` | The guides. `docs/paths.md` lists where every file moved to, `docs/where-things-are.md` is the long map and `docs/changelog.md` says what each round changed |

## Dashboard Settings

One page with tabs along the top. It opens on Screen. Studio also adds a tab
called All fields that shows every tab one under the other. Change a tab and
click Publish, or use Publish all. The detail of every field is in
docs/editing-content.md, "Dashboard Settings".

| Tab | What is in it |
|-----|---------------|
| Screen | The status block, the team name, number and school, motion, speed, frame metal, glint, polish, the screen glitch, the alert, the seconds per page and per ticker line, photos, announcements, how many days finished tasks stay and the date the safety day count starts |
| Look | The order of the views, the name and title of General, the logo and name effects and the page changes |
| Countdown | The labels and dates for Kickoff and Rollout |
| Calendars | A row for each calendar with its code, name, kind and Show on screen switch, and Group events by kind |
| Presentations | Run presentations, the one switch for booked talks |
| Monday | The boards the Teletraan computer reads and how an item becomes a task |
| Competition | When the competition cards come, and a switch for each card |
| Advanced | Night mode, hidden transitions and the connection text on the screen |

The Look tab here has the order of the views and the name of the General view
(see Views and themes below). The Look line under Settings in the sidebar is another page:
the colors of the whole screen, the seasonal packs and the time zone
(docs/switch-the-look.md).

Some values have one right answer and are not settings: night mode from 11:30 pm
to 11:30 am, how long a talk waits for its speaker (5 minutes) and how far a talk
may overrun (5 minutes). They are in `dashboard/core/constants.js`. Content
source is not on the page either: the screen always shows what is published, and
`?sample=1` on the address of the screen shows the sample content.

## The status block

The top of the Screen tab says when the Teletraan computer last saw a change to the content,
downloaded the calendars, downloaded the slides, read the Monday boards, read the
competition data and started the screen. Each line says how long ago and the
time. You cannot type in it, because the computer writes it. It says No status yet
until the computer has a write token, and a line says Not yet for a job the computer has
not done since the token was added.

A line that stays old for much longer than its timer means the job is failing or
its timer is off. Start with the log of that job (computer/README.md, "Everyday
commands").

## The write token

`SANITY_WRITE_TOKEN` is a token from the Sanity project that is allowed to write.
The Teletraan computer uses it to write what it did: the status block, the Calendars page, the
Monday tasks and the competition data. Without it the computer works as before and the
status block says No status yet.

- Make it at sanity.io/manage: open the project, then API, Tokens, Add API token.
  Give it Editor access and copy it before you leave the page, because Sanity
  shows it once. The team mentor says yes first.
- It lives in one place: the file `computer/local.env` on the Teletraan computer, on its own line,
  in single quotes. Git ignores that file and only the computer's account can read it.
- It never goes in the repository, in Studio, in a doc, in a chat or in a message.
  A token with Editor access can change anything in the dataset. If one leaks,
  delete it at sanity.io/manage and make a new one.
- After it is added, run the install scripts again, so that the units that call
  `status-write.sh` are copied into place. The commands are in
  docs/rebuilding-the-computer.md, "Showing what the computer did in Studio".

## The three keys

`computer/local.env` on the Teletraan computer holds three keys, besides the calendar lines. This
page names them and never holds a value.

| Name | What it lets the Teletraan computer do | Where it is made | Steps |
|------|--------------------------|------------------|-------|
| `SANITY_WRITE_TOKEN` | Write to Sanity | sanity.io/manage | docs/rebuilding-the-computer.md, "Showing what the computer did in Studio" |
| `MONDAY_API_TOKEN` | Read the Monday boards | Monday, Developers, My access tokens | docs/rebuilding-the-computer.md, step 18, and docs/monday.md |
| `TBA_AUTH_KEY` | Read the competition data | The Blue Alliance, Account, Read API Keys | docs/rebuilding-the-computer.md, step 17, and docs/frc-feed.md |

A script that does not find its key does nothing, says so in one line and ends
without an error. `computer/local.example.env` has each line with a placeholder. The
calendar addresses are in the same file, one `CALENDAR_<ID>_URL` line each
(docs/calendar-links.md). None of them goes in the repository, in Studio or in a
message.

## Views and themes

A view is what plays on the TV for a few minutes: General, Prime, Nova or Family. A theme is how the screen is drawn. Every view looks the same in every theme. Settings has two lines for them, Views and Themes (docs/views-and-themes.md, docs/views.md).

A view is one document that always exists, so you cannot add, copy or delete one. General has the standard arrangement: the banner, the main panel, the countdown over the side panel, and the ticker. Prime, Nova and Family have the bar arrangement: the banner with the war clock across the top, a thin column at the left, one main panel and the ticker, and no side panel. Nova is turned left to right because the Nova team has Mirror switched on.

A view opens on a map of the screen. Click a letter or its box and that part opens below the map. The letters are the ones on Start here. Above the map is a picker that moves to another view.

| Letter | Part | What is there |
|--------|------|---------------|
| A | Banner | The name in the view tag, the team, the arrangement (standard or bar), Mirror, the view tag, the team chip and the colors |
| B | Main panel | The minutes the view stays (1 to 30) and the rows the main panel plays, top to bottom, and then over again |
| C | Countdown | Where the countdown sits. The title and the dates of Kickoff and Rollout come from Dashboard Settings, Countdown tab, and are the same in every view |
| D | Side panel | The rows the small panel plays, on its own timer. Only the standard arrangement has it |
| E | Ticker | A link that opens Tips and News. The ticker shows every published tip and news item in order |

The order of the views and the name and title of General are on the Look tab of Dashboard Settings (Order of the views, Name of the General view, Title of the General view). A view left out of the order never plays. The swap, the pull apart and re-form of the frames, plays at every change of view, and its length, the name effect and the flying hawk keep the numbers of the Screen documents (Screens, the second line of the sidebar), which are kept for that. Outlined name is a switch on the team document: off draws the team name solid, and both teams are off to start with.

### The rows of the main panel

A row is a panel and, if you want, the seconds. Without seconds the row follows Seconds per page on the Screen tab of Dashboard Settings. The Photo row has no seconds of its own. It has Photos (1 to 20, starting at 4) and Seconds per photo (5 to 60, starting at 10), and the time it stays up is the two multiplied, shown beside them. Four photos of 10 seconds stay up 40 seconds.

- Panel: the large panels (Tasks, Upcoming events, Daily Agenda, Subteam spotlight, Sponsor feature, Photo, Leadership, Team leads, Subteam roster and Extra panel) and the Monday rows: Tasks by team and department, Done by team, Status by department, Overall progress, Timeline by team and Board by team (docs/monday.md, "The eleven panels"). Upcoming events is one row that scrolls from its first four events to the next four.
- The team of a row is the team of its view. A Monday tasks row with no department plays one page for each Team lead that has On the Monday board switched on. A Monday row with nothing to show, such as a department with no tasks, is skipped (docs/monday.md).
- Monday style: the style the Screen takes while a Monday row plays. It is a field of the Screen documents (Screens, the second line of the sidebar). The screen swaps into it when the first Monday row begins and back to the theme of the day when the next row is not a Monday row.
- The competition cards still come in by themselves from two days before an event, as the Competition tab says. They are not rows.
- When an alert, an announcement, a talk or the night screen has the screen, the minutes stand still. The view that was interrupted comes back at the panel that was next.

### Which theme plays on which day

Settings, Themes has a picker for each day, Monday to Sunday (the field Theme of each weekday). The day is the calendar day in the time zone on the Look page. The screen picks the theme of the day when it starts and at the next change of view after midnight, so a screen that restarts lands on the same theme. Retro is a copy of Original until it is designed.

### The first time a view opens

A view with no main panel rows is filled once from the Screens that were in use before the views: rows of Prime go to Prime, rows of Nova to Nova and rows with no team to General. A view that finds no rows starts with the starting rows in `studio/tools/view-defaults.js`. Click Publish all afterwards. The Screens, the Panel order, Styles by day, Team order and Monday style in Dashboard Settings are hidden now, with what was saved in them, and the screen does not read them for the rows.

To see a theme or a team for 2 minutes without saving anything, open the menu next to Publish on Dashboard Settings (the three dots) and click one of the Preview buttons (docs/hidden-transitions.md, "Preview a look"). The Now showing tab of the control page can also show a view, hold a panel or try a theme for a few minutes (docs/control-page.md).

## Monday setup

The Teletraan computer reads the team's two Monday boards, Robotics Tasks and Milestones, as often as How
often on the Monday tab says (5 to 120 minutes, 30 to start with), and keeps their items in
Sanity (docs/monday.md). It needs the team mentor's yes at the first step.

1. Make the token in Monday and add it to `computer/local.env` on the Teletraan computer as
   `MONDAY_API_TOKEN` (docs/rebuilding-the-computer.md, step 18).
2. On the computer, install the packages if they are missing (ask the team mentor first), then
   the timer, then check the token. Run the timer line again after every update that changes
   `computer/systemd`, because the timer now wakes the script every 5 minutes:

       sudo apt install curl jq
       sudo /opt/teletraan/computer/scripts/install-monday.sh
       /opt/teletraan/computer/scripts/monday-sync.sh --check

3. Wait 5 minutes. Open Dashboard Settings, Monday tab. The block at the top says who the
   token belongs to, when the Teletraan computer last read Monday, how often, how many reads it used today
   and how many tasks it made. The two boards and every column are already set. If tasks do
   not show up, go down "If nothing shows up" in docs/monday.md.

What each column does, when a task shows on the TV, the daily read budget and the eleven
panels are all in docs/monday.md. Show on TV is the one thing you can change on a task in
Studio: turn it off and the task leaves the TV and moves to Hidden, and the Teletraan computer keeps your
choice. Show owner first names on the TV starts off.

The tasks and the board names are public, like the rest of the dataset (docs/monday.md, "The
dataset is public").

## Monday Tasks and Monday Boards

Both are under TASKS in the sidebar. Nobody types a task: the Teletraan computer makes each one
from an item on a Monday board, and the screen shows only those.

- Monday Tasks has two lists, On the TV and Hidden, each sorted by board. A task
  opens read only, except for Show on TV. Hidden holds every task that is not on the
  TV, because Show on TV is off, Show on screen is off or Hide after has passed. A
  task is in one list only.
- A task typed by hand, and every task made before the board was connected, is in
  Hidden with Manual (not shown) in its line. The screen never shows it. It stays
  until someone deletes it.
- Monday Boards lists every board the token can see, with its items and when the
  computer last read it, and says which boards Dashboard Settings has chosen. The name of
  a chosen board opens its tasks in the same two lists. Choose boards opens Dashboard
  Settings, at the Task board block of its Monday tab. A second list, Milestones, holds the
  milestones the Teletraan computer made. Nobody can change them there.

A Monday row shows only when it has something to draw, so a team with no tasks from
the board has no Monday rows (docs/monday.md, "The eleven panels").

## The Calendars page

Calendars, under Events, shows each calendar the Teletraan computer downloads: its kind, when it
last worked, why it failed, and the next 40 events with SHOWN or HIDDEN. A hidden
event names the Calendar filter that hides it. Each event has Hide this one and
Hide all like this, which make a rule under Calendar filters, and Show again, which
deletes a rule the page made.

- Left: a button for each row of Dashboard Settings, Calendars, with its kind, the
  number of events in the next 30 days and how many a rule hides. A calendar with no
  kind has no chip on its events. The page says Kind: no chip, and the kind is set in
  Dashboard Settings, on the Calendars tab.
- Right: the facts of the calendar you picked, then up to 40 events in date order.
- A red line is a problem. "Download failed, the server said no" usually means BAND
  gave the calendar a new link (docs/calendar-links.md, "Change a link"). The TV
  keeps the events of the last good download.
- Nothing yet means the Teletraan computer has not written the page's document, which needs the
  write token. Events not listed means the computer downloaded the calendar but did
  not list its events, usually because Node is not installed on it
  (docs/calendars-page.md, "Node on the computer").

The dataset is public, and so is the document behind this page. It holds the
titles, dates and times of the next 40 events of every calendar, and that includes
the events that a Calendar filter hides from the TV. Anyone who asks the dataset
for it can read those titles. It holds no calendar address, no token and no
location. Do not put anything private in the title of a BAND event. The status
documents of the Teletraan computer, Monday and the competition feed are public in the same way.

## The Events panel

The Events panel shows the next 4 events. After its seconds the list scrolls up
and shows the 4 after them for the same seconds. With 4 events or fewer there is no
second page and no scroll.

- Kind: each calendar row in Dashboard Settings, Calendars can have a kind
  (Meetings, Competitions, Outreach or Deadlines), and starts with none. An event
  from a calendar with a kind has a small chip with that kind before the title.
  With no kind there is no chip.
- Group events by kind: off to start with. Off, both pages are in date order. On,
  page one has the next 4 Meetings, Deadlines and Other events, and page two the
  next 4 Competitions and Outreach events.
- Pin to page one: a switch on an Always show rule in Calendar filters, stored as
  `force`. It says: show this event even when it is not one of the next 8. A pinned
  event is first on page one, with a small pin after its title, whatever the kind
  of its calendar. At most 3 events are pinned, and the ones that start first win.
  A Hide rule does not have the switch.

Detail: docs/editing-content.md, "The two pages of the Events panel", and
docs/calendar-filters.md, "Pinning an event".

## Team leads and Leadership

Both panels show rows, four to a panel at the standard portrait size. A row has
the framed photo at the left, the name beside it and an optional line under it, and a
chip at the right end. On Leadership the chip is the Role you typed, and on Team leads
the lead's name has TEAM LEAD under it in the team color. The line shows when a page
holds three people or fewer.

- Leadership shows the coaches, then the captains, then the mentors, each group in
  Order. Two coaches and two captains fill the four rows. With more people, the
  panel shows the next rows each time it comes round.
- Team leads has a row for each subteam, in Order: the name of the lead, TEAM LEAD
  under it, and the subteam name in the chip at the right end. Twelve subteams are three panels of
  four, and the panel shows the next four each time it comes round. A subteam with
  no lead shows its own name and [lead], so a gap can be seen from across the room.
- The photo of a lead is the Photo on its Team lead entry. An entry with no photo
  shows the photo of the person in Leadership with the same name, and with no
  match the row shows the silhouette. Turn off Show photo on screen on the entry
  to show the silhouette whatever Leadership has.

The Portraits box in the Screen tab changes the photos and never the text. The
Leadership portrait size and the Team leads and Roster portrait size go from 60 to
220: 100 is a portrait that fills a row of four. Above 100 the rows get taller, so
a page holds 3 people (to 138), 2 (to 200) or 1 (to 220), and the panels
show the next rows each time they come round. The two sizes are set apart, and the
Roster portrait stays at 100. Portrait shape (Square, Rounded or Circle) and Portrait
frame (Metal, Thin line or None) are the same on all three panels. The
table and the way to pick a value are in docs/editing-content.md, under "Portraits".

## Hidden effects by hours

Two rare surprises replace a page change of the large panel now and then: the
desktop reveal, with a blue screen, and red eyes. They are in Dashboard Settings,
Advanced tab.

- Allow hidden transitions: the master switch, on to start with. Off, none plays,
  not even a pushed one.
- Desktop reveal every (hours) and Red eyes every (hours): about once in this many
  hours of screen time, from 1 to 1000, and both start at 60. It is a chance, so 60
  hours is an average and not a timetable. To make one rarer, raise its hours.
- After any of them has played, none comes by chance for 4 hours.
- A settings page saved before the hours existed has them empty, and it keeps its
  old percent until you fill the hours in and publish.

To play one now, open the menu next to Publish on Dashboard Settings and click Play
desktop reveal or Play red eyes. The TV plays it within about 20 seconds.
Detail: docs/hidden-transitions.md.

## The collapse and rebuild sequence

Both hidden effects use the same collapse. After the glitch the words fade, and every
piece of metal that is drawn on its own lets go, tips and falls into a loose pile
along the bottom, with a bounce. It stays there while the blue screen or the red eyes
play over it, and the next page of each panel is swapped in unseen. Then a line-drawn
cube rises, turns, pulses twice and shrinks to a point, and the pieces rise from the
pile in the opposite order and fly back to their places. The words fade in again. The
collapse, the cube and the rise take 5.5 seconds. Nothing else on the screen moves
meanwhile, and the pages wait. No part of it is a setting. Detail:
docs/hidden-transitions.md, "The frames collapse and come back". A change of look
or of Monday card is a different move, the swap (docs/layouts.md, "The swap").

## Mouse control in presentations

A speaker with no clicker can use the mouse (docs/presentations.md, "On the day").

- A left click, or a tap, does what Page Down does: it starts the talk on the title
  card, moves to the next slide, and on the last slide shows the Thank you card.
- A right click does what Page Up does.
- The middle button and the second click of a double click do nothing.
- While a talk is on the screen the right click does not open the browser menu, and
  the pointer stays hidden.
- If the card says Slides are not ready, any click on it ends the talk at once, and
  the TV starts its pages again from the first one.

The one setting is Run presentations, in the Presentations tab. Off, the TV never
takes over for a talk.

## The boot screen

A text drawing fills the TV above the login prompt while the Teletraan computer starts, until the
kiosk takes over. A second drawing, with the words "shutting down", shows while the
computer shuts down or reboots. They are the files `computer/console/startup.txt` and
`computer/console/shutdown.txt`, plain text made for the console of a 1080p TV.

`sudo /opt/teletraan/computer/scripts/install-console.sh` puts the first in
`/etc/issue` and turns on the unit that prints the second. Run it again after
`startup.txt` changes, because `/etc/issue` is a copy of it. A change to
`shutdown.txt` needs nothing. The steps and the way back are in
docs/rebuilding-the-computer.md, step 13.

## The Nova trim fields

A team document has six Trim choices, in Settings, Teams, that make a team look
like itself beyond its colors and the mirror. Each is one of two. Prime has the
first of each, which is how the screen has always looked, and Nova has the other.
A team saved before the trim existed looks like Prime. Outlined name is a switch
in the same box. Off draws the team name solid, and it is off on both teams. The
older choices Team name look and Bird pose are hidden and the screen does not read
them: the icon is always the usual Hawktimus mark.

| Field | Prime | Nova |
|-------|-------|------|
| Bolts | Hex nuts | Round rivets with a slot |
| Cut corners | Top left and bottom right | Top right and bottom left |
| Header end | Notch | Slant at 60 degrees |
| Page grid | Lines | Dots |
| Ticker label | Cut plate | Thin bar |
| Countdown color | Red | The team's neon |

A change to the trim of the team on the screen draws the frames again within a few
seconds. docs/add-the-nova-team.md has the steps and docs/layouts.md, "Team trim",
says how each is drawn.

## The competition feed

The Teletraan computer reads the public competition data of each team and keeps it in Sanity, and
the screen draws seven cards from it (docs/frc-feed.md).

- Key: `TBA_AUTH_KEY` in `computer/local.env` on the Teletraan computer. After it is added, install
  the timer and check the key (docs/rebuilding-the-computer.md, step 17):

      sudo /opt/teletraan/computer/scripts/install-frc.sh
      /opt/teletraan/computer/scripts/frc-sync.sh --check

- Teams: a team is read when it is Active and has a Team number in Settings,
  Teams. A team without a number is left out, and that is not an error.
- Competition mode: Dashboard Settings, Competition tab. Auto shows each card in the
  time of its own. Always shows every card that is on and has something to show,
  whatever the date. Off shows none. Auto is the start. A switch for each card is on
  to start with, and a card that is off never shows, except in Preview competition.
- Preview competition, on the Start here page, shows all seven cards for 2 minutes
  on made-up data, with no key and no internet.

| Card | What it shows | When it comes in Auto |
|------|---------------|-----------------------|
| Season timeline | The coming dates, each with the days left | All season, while a date is ahead |
| Last season at a glance | The record, the rank at each event and the rating line | Before the first event starts |
| Live rank | The rank, the record and the ranking points | From two days before an event to its last day |
| Next match | The match, its time, the two alliances and the chance to win | The same days, and first |
| Results strip | The last 8 matches with their scores | The same days |
| Alliance board | The alliance number and its partners | The same days, once the selection is made |
| District points | The points and the rank against the cutoff | All season once the first event has started |

A card with nothing to show is left out of the rotation, so a computer with no key
shows no competition card. The data is public: team numbers, nicknames, match
numbers and times, scores, ranks, award names and ratings, and no person's name.

## The version on the wall and the sweep

The last line of the status block, On the wall, says which build the screen runs, such as `v14 · a1b2c3d`: the release number and the first seven characters of the commit. The control page makes the number when it installs a release, and the Mac tool does the same through the installer (docs/control-page.md). The control page shows the same text on every tab. A computer that has no release number, such as a plain checkout, shows the hash and the day of the commit. To see the build on the TV, open the address with `?debug=1` on the end: it shows in the bottom left corner at 20 px, the one text smaller than the usual smallest size.

The sweep keeps names out of the repository that do not belong there: AI tools, films,
shows and franchises, and lines that credit a tool or a co-author. `tools/sweep.sh` looks
through the files git tracks for each word in `tools/sweep-words.txt` and exits with 1 and
the file and line of each hit. The word list is the only file that may hold them. Run it
by hand, or turn on the check before every push, once on each computer you push from:

    git config core.hooksPath .githooks

After that a push stops when the sweep finds something. Take the word out and push again.
A test that has to name a word builds it from pieces, so the sweep does not find it there.

## The watchdog

The screen puts the time in its page title every 30 seconds. Every 2 minutes the
computer asks the browser for that title (on the Teletraan computer's own address 127.0.0.1:9222,
which nothing else can reach). If the title is more than 3 minutes old, the page
is gone or the browser is not running, the computer restarts the screen. The status
block in Dashboard Settings, Screen tab, shows Screen restarts today.

- It restarts at most once in 10 minutes.
- When a third restart would fall inside one hour, it does not restart again. It
  writes the count and the time to the status block and waits until the Teletraan computer boots.
  That means something is broken, such as a bad deploy. Look at
  `sudo journalctl -u teletraan-watchdog.service -n 30`, fix it, then reboot the
  computer or delete `/var/lib/teletraan/data/watchdog-state`.
- The count is kept in `watchdog-state` in the data folder.
- A browser started less than 3 minutes ago is left alone while it loads.

## Backups

Every night at 03:15 (the Teletraan computer's time) the computer exports the whole dataset to
`/var/backups/teletraan/production-<date>.tar.gz`, keeps the newest 14 and deletes
the older ones. The status block shows Last backup. It needs the write token in
`local.env` and the Sanity tool in `studio/` (`npm install` there once). A failed
export keeps the old backups.

Restoring a backup. Never import straight over production. Import into a new
dataset first, look at it, and only then decide what to do:

    cd /opt/teletraan/studio
    npx sanity dataset create restore-test
    npx sanity dataset import /var/backups/teletraan/production-<date>.tar.gz restore-test

Open the new dataset to check it. Moving the screen to it means changing the
dataset name in `dashboard/config.js` and `studio/project.js`, which is a change
for the team mentor.

## Announcements

TASKS, Announcements holds the lines for the bar under the banner. Start here has a Post an
announcement button that opens a new one starting now and ending in two hours. Each has a text
of up to 90 characters, a start, an end, an optional team and a level (Notice or Important).
It shows while it is live and the team on the banner matches. With two live, the bar swaps
every 12 seconds. This is not the full-screen announcement of Dashboard Settings, which Play
announcements plays. docs/announcements.md has both.

## Where the detail is

- docs/editing-content.md: every field, kind of content and tab
- docs/rebuilding-the-computer.md: setting up the Teletraan computer, the steps for each key and the
  boot screen
- docs/announcements.md: the announcement bar, and how it differs from Play announcements
- docs/monday.md: the Monday boards, how an item becomes a task and what is public
- docs/frc-feed.md: the competition data, the seven cards and the Preview button
- docs/calendars-page.md: the Calendars page and what the computer writes for it
- docs/calendar-filters.md and docs/calendar-links.md: the rules, and adding a
  calendar
- docs/layouts.md: the layouts, the swap, the Monday cards and team trim
- docs/switch-the-look.md: the Weekday schedule, the Look page and the seasonal packs
- docs/hidden-transitions.md: the hidden effects, the frames that fall and come
  back, and the Preview buttons
- docs/presentations.md: booking talks, the clicker and the mouse
- docs/add-the-nova-team.md: the Nova team and its trim
- computer/README.md: the scripts and timers on the computer
