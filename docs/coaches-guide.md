# Coaches guide

For the coaches. This page says where each coach setting is, what to know before
you change it, and which page has the detail. Students use
docs/using-the-studio.md. Everything under Coaches only in the sidebar is here:
Settings (Dashboard Settings, Look and Teams) and Extra panels.

The Monday feed, the competition feed and the status documents have not been tried
against the live services, because they need keys that only the Mini holds. Their
pages say what to change if an answer looks different.

## Dashboard Settings

One page with tabs along the top. It opens on Screen. Studio also adds a tab
called All fields that shows every tab one under the other. Change a tab and
click Publish, or use Publish all. The detail of every field is in
docs/editing-content.md, "Dashboard Settings".

| Tab | What is in it |
|-----|---------------|
| Screen | The status block, the team name, number and school, motion, speed, frame metal, glint, polish, the screen glitch, the alert, Panel order and the seconds per page, photos, announcements, how many days finished tasks stay and the date the safety day count starts |
| Look | Styles by day, Monday style, Team order, How the look changes, the logo and name effects and the page changes |
| Countdown | The labels and dates for Kickoff and Rollout |
| Calendars | A row for each calendar with its code, name, kind and Show on screen switch, and Group events by kind |
| Presentations | Run presentations, the one switch for booked talks |
| Monday | The boards the Mini reads and how an item becomes a task |
| Competition | When the competition cards come, and a switch for each card |
| Advanced | Night mode, hidden transitions and the connection text on the screen |

The Look tab here is the look rotation. The Look line under Settings in the
sidebar is another page: the colors of the whole screen, the seasonal packs and
the time zone (docs/switch-the-look.md).

Some values have one right answer and are not settings: night mode from 11:30 pm
to 11:30 am, how long a talk waits for its speaker (5 minutes) and how far a talk
may overrun (5 minutes). They are in `dashboard/core/constants.js`. Content
source is not on the page either: the screen always shows what is published, and
`?sample=1` on the address of the screen shows the sample content.

## The status block

The top of the Screen tab says when the Mini last saw a change to the content,
downloaded the calendars, downloaded the slides, read the Monday boards, read the
competition data and started the screen. Each line says how long ago and the
time. You cannot type in it, because the Mini writes it. It says No status yet
until the Mini has a write token, and a line says Not yet for a job the Mini has
not done since the token was added.

A line that stays old for much longer than its timer means the job is failing or
its timer is off. Start with the log of that job (deploy/README.md, "Everyday
commands").

## The write token

`SANITY_WRITE_TOKEN` is a token from the Sanity project that is allowed to write.
The Mini uses it to write what it did: the status block, the Calendars page, the
Monday tasks and the competition data. Without it the Mini works as before and the
status block says No status yet.

- Make it at sanity.io/manage: open the project, then API, Tokens, Add API token.
  Give it Editor access and copy it before you leave the page, because Sanity
  shows it once. The team mentor says yes first.
- It lives in one place: the file `deploy/local.env` on the Mini, on its own line,
  in single quotes. Git ignores that file and only the Mini's account can read it.
- It never goes in the repository, in Studio, in a doc, in a chat or in a message.
  A token with Editor access can change anything in the dataset. If one leaks,
  delete it at sanity.io/manage and make a new one.
- After it is added, run the install scripts again, so that the units that call
  `status-write.sh` are copied into place. The commands are in
  docs/rebuilding-the-mini.md, "Showing what the Mini did in Studio".

## The three keys

`deploy/local.env` on the Mini holds three keys, besides the calendar lines. This
page names them and never holds a value.

| Name | What it lets the Mini do | Where it is made | Steps |
|------|--------------------------|------------------|-------|
| `SANITY_WRITE_TOKEN` | Write to Sanity | sanity.io/manage | docs/rebuilding-the-mini.md, "Showing what the Mini did in Studio" |
| `MONDAY_API_TOKEN` | Read the Monday boards | Monday, Developers, My access tokens | docs/rebuilding-the-mini.md, step 18, and docs/monday.md |
| `TBA_AUTH_KEY` | Read the competition data | The Blue Alliance, Account, Read API Keys | docs/rebuilding-the-mini.md, step 17, and docs/frc-feed.md |

A script that does not find its key does nothing, says so in one line and ends
without an error. `deploy/local.example.env` has each line with a placeholder. The
calendar addresses are in the same file, one `CALENDAR_<ID>_URL` line each
(docs/calendar-links.md). None of them goes in the repository, in Studio or in a
message.

## The look rotation

The screen goes through looks by itself. A look is a style and a team. These are
in Dashboard Settings, Look tab, with the name each is stored under:

- Styles by day (`dailyStyles`): the styles in order, one for each calendar day,
  and then over again. Original and then Cybertron to start with. The day is read
  in the time zone on the Look page, so a screen that restarts lands on the same
  style.
- Monday style (`mondayStyle`): the style while the Monday cards are up. Minimal to
  start with.
- Team order (`teamOrder`): the teams in the order they take the screen. Prime and
  then Nova to start with. Only teams that are switched on count.
- How the look changes (`lookSwap`): Assemble, Slats or Cut. Assemble takes the
  screen apart and builds it again, Slats turns the panels and keeps the frames, and
  Cut changes at once.

A cycle goes through the teams in order. For each team it runs a pass of its
panels in the style of the day, then a pass of its Monday cards in the Monday
style if the team has any, and then it swaps to the next team. A team with no
Monday cards skips that pass. A swap waits for the end of a pass and never happens
during an alert, an announcement or a talk. The style and the team change
together.

Next look now, on the Start here page, moves to the next pass at once. A second
press while the Monday cards are up moves past them. To see a style or a team for
2 minutes without saving anything, open the menu next to Publish on Dashboard
Settings (the three dots) and click one of the Preview buttons
(docs/hidden-transitions.md, "Preview a look").

The old Style and Team mode settings are hidden. The screen reads them only while
the lists above are empty. Detail: docs/layouts.md, "The look rotation".

## Monday setup

The Mini reads the team's Monday boards every 10 minutes and keeps their items in
Sanity as tasks (docs/monday.md). It needs the team mentor's yes at the first step.

1. Make the token in Monday: click your picture at the top right, open Developers,
   then My access tokens. Use the token of an account that can see only the team's
   boards.
2. Add it to `deploy/local.env` on the Mini as `MONDAY_API_TOKEN`, in single quotes
   on its own line (docs/rebuilding-the-mini.md, step 18).
3. On the Mini, install the packages if they are missing (ask the team mentor
   first), then the timer, then check the token:

       sudo apt install curl jq
       sudo /opt/teletraan/deploy/scripts/install-monday.sh
       /opt/teletraan/deploy/scripts/monday-sync.sh --check

4. Wait 10 minutes. Open Dashboard Settings, Monday tab. The block at the top says
   who the token belongs to and when the Mini last read Monday.
5. Under Boards click Add item. Pick the board by name, the team and the status
   column. Change the three status labels to the words the board uses. The
   priority, due date, owner and subteam columns are optional. If a list cannot be
   read, the box is a plain one: type the board number or the column id.
6. Click Publish. Within 10 minutes the tasks are in Tasks, From the board.

Show on TV is a switch on every task. On a task from the board it is the one thing
you can change: turn it off and the task leaves the TV and the three Monday cards
and moves to Hidden, and the Mini keeps your choice. Show owner first names on the
TV starts off. On, a task keeps the first name of the first owner of its item.

The tasks and the board names are public, like the rest of the dataset. Anyone who
asks Sanity can read the task names, the names of every board the token can see
and, with the owner switch on, the first names (docs/monday.md, "The dataset is
public").

## Pinned tasks

Tasks is a folder with three lists, and its plus button says Pin a task.

- Pinned: the tasks typed in Studio, and every task made before the board was
  connected.
- From the board: the tasks the Mini makes from Monday. They open read only, except
  for Show on TV.
- Hidden: every task that is not on the TV, because Show on TV is off, Show on
  screen is off or Hide after has passed. A task is in one list only.

In the same status, pinned tasks come before tasks from the board, and each group
keeps the Order field. A team gets the Monday cards only when it has tasks from the
board, so pinned tasks alone do not start them (docs/layouts.md, "The Monday
cards").

## The Calendars page

Calendars, under Events, shows each calendar the Mini downloads: when it last
worked, why it failed, and the next 12 events with SHOWN or HIDDEN. A hidden event
names the Calendar filter that hides it. The page only shows. Nothing on it can be
changed.

- Left: a button for each row of Dashboard Settings, Calendars, with the number of
  events in the next 30 days and how many a rule hides.
- Right: the facts of the calendar you picked, then up to 12 events in date order.
- A red line is a problem. "Download failed, the server said no" usually means BAND
  gave the calendar a new link (docs/calendar-links.md, "Change a link"). The TV
  keeps the events of the last good download.
- Nothing yet means the Mini has not written the page's document, which needs the
  write token. Events not listed means the Mini downloaded the calendar but did
  not list its events, usually because Node is not installed on it
  (docs/calendars-page.md, "Node on the Mini").

The dataset is public, and so is the document behind this page. It holds the
titles, dates and times of the next 12 events of every calendar, and that includes
the events that a Calendar filter hides from the TV. Anyone who asks the dataset
for it can read those titles. It holds no calendar address, no token and no
location. Do not put anything private in the title of a BAND event. The status
documents of the Mini, Monday and the competition feed are public in the same way.

## The Events panel

The Events panel shows the next 4 events, and the page that follows it in the
rotation shows the 4 after them. With 4 events or fewer there is no second page.

- Kind: each calendar row in Dashboard Settings, Calendars has a kind (Meetings,
  Competitions, Outreach, Deadlines or Other, and Other to start with). Each event
  has a small chip with the kind of its calendar before the title.
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

Both panels show rows, four to a panel. A row has the framed photo at the left,
the name beside it and the role at the right end in the team color.

- Leadership is one panel: the coaches, then the captains, then the mentors, each
  group in Order, and the first four show. Two coaches and two captains fill it.
- Team leads has a row for each subteam, in Order: the name of the lead, and the
  subteam with LEAD after it at the right end. Twelve subteams are three panels of
  four, and the panel shows the next four each time it comes round. A subteam with
  no lead shows its own name and [lead], so a gap can be seen from across the room.
- The photo of a lead is the photo of the person in Leadership with the same name.
  With no match the row shows the silhouette.

Portrait size, percent in the Screen tab changes the photos and never the text
(docs/editing-content.md, "Photos of people").

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

## The break and reassemble sequence

Both hidden effects end the same way. The screen comes back whole with the next
page of each panel. Then the words fade, and every piece of metal that is drawn on
its own lets go, tips and falls into a loose pile along the bottom. A line-drawn
cube rises out of the pile and pulses twice. On the second pulse the pieces lift
out in the opposite order and fly back to their places, and the cube shrinks away.
The fall, the cube and the lift take 5 seconds at the most, and then the content
builds in again. Nothing else on the screen moves meanwhile, and the pages wait.
No part of it is a setting. Detail: docs/hidden-transitions.md, "The frames fall
and come back".

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

A text drawing fills the TV above the login prompt while the Mini starts, until the
kiosk takes over. A second drawing, with the words "shutting down", shows while the
Mini shuts down or reboots. They are the files `deploy/console/startup.txt` and
`deploy/console/shutdown.txt`, plain text made for the console of a 1080p TV.

`sudo /opt/teletraan/deploy/scripts/install-console.sh` puts the first in
`/etc/issue` and turns on the unit that prints the second. Run it again after
`startup.txt` changes, because `/etc/issue` is a copy of it. A change to
`shutdown.txt` needs nothing. The steps and the way back are in
docs/rebuilding-the-mini.md, step 13.

## The Nova trim fields

A team document has eight Trim choices, in Settings, Teams, that make a team look
like itself beyond its colors and the mirror. Each is one of two. Prime has the
first of each, which is how the screen has always looked, and Nova has the other.
A team saved before the trim existed looks like Prime.

| Field | Prime | Nova |
|-------|-------|------|
| Bolts | Hex nuts | Round rivets with a slot |
| Cut corners | Top left and bottom right | Top right and bottom left |
| Header end | Notch | Slant at 60 degrees |
| Page grid | Lines | Dots |
| Bird pose | Auto | Flight |
| Team name look | Solid letters | Outlined letters |
| Ticker label | Cut plate | Thin bar |
| Countdown color | Red | The team's neon |

A change to the trim of the team on the screen draws the frames again within a few
seconds. docs/add-the-nova-team.md has the steps and docs/layouts.md, "Team trim",
says how each is drawn.

## The competition feed

The Mini reads the public competition data of each team and keeps it in Sanity, and
the screen draws seven cards from it (docs/frc-feed.md).

- Key: `TBA_AUTH_KEY` in `deploy/local.env` on the Mini. After it is added, install
  the timer and check the key (docs/rebuilding-the-mini.md, step 17):

      sudo /opt/teletraan/deploy/scripts/install-frc.sh
      /opt/teletraan/deploy/scripts/frc-sync.sh --check

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

A card with nothing to show is left out of the rotation, so a Mini with no key
shows no competition card. The data is public: team numbers, nicknames, match
numbers and times, scores, ranks, award names and ratings, and no person's name.

## Where the detail is

- docs/editing-content.md: every field, kind of content and tab
- docs/rebuilding-the-mini.md: setting up the Mini, the steps for each key and the
  boot screen
- docs/monday.md: the Monday boards, how an item becomes a task and what is public
- docs/frc-feed.md: the competition data, the seven cards and the Preview button
- docs/calendars-page.md: the Calendars page and what the Mini writes for it
- docs/calendar-filters.md and docs/calendar-links.md: the rules, and adding a
  calendar
- docs/layouts.md: the look rotation, the Monday cards and team trim
- docs/hidden-transitions.md: the hidden effects, the frames that fall and come
  back, and the Preview buttons
- docs/presentations.md: booking talks, the clicker and the mouse
- docs/add-the-nova-team.md: the Nova team and its trim
- deploy/README.md: the scripts and timers on the Mini
