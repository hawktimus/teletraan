# The Calendars page

For the coaches and students who want to know what the calendars bring in. The
Calendars page in Studio, under Events, lists the coming events that the Teletraan
computer downloaded from BAND. It is a list to look at. The only thing you change
here is whether one event shows on the TV.

## Reading the page

- Top: a line of help, and a note that the calendar links are secret and live on
  the control page, Keys tab. They are not kept in Studio.
- Below it: when the calendars were last downloaded ("Last downloaded 4 minutes
  ago from 6 calendars"), and one line for each calendar. A calendar either works
  or failed, and a failed one gives the reason in plain words. "Download failed,
  the server said no" usually means BAND gave the calendar a new link: see
  docs/calendar-links.md, "Change a link". The TV keeps the events of the last good
  download.
- If the Teletraan computer has no calendar links, a notice says: No calendars are
  set up on the Teletraan computer. Add the links on the control page, Keys tab.
  Nothing yet means the computer has not written the list. It writes it after every
  calendar run, which is every 15 minutes. Events not listed means the computer
  downloaded a calendar but did not list its events. The usual reason is that Node
  is not installed on it, see below.
- Filters: pick one calendar, type a word to search the title, the place or the
  calendar, or turn on Hidden only to see what the TV does not show.
- The events: grouped by day, with Today and Tomorrow first and then the date.
  Each one has its time, title, place, calendar and, when the calendar has a kind,
  a chip. No kind, no chip. The kind is set in Dashboard Settings, on the
  Calendars tab. An event that lasts all day says All day.
- Past events are never listed. An event that already ended earlier today is
  listed in grey as Earlier today. An event that began on an earlier day and is
  still on is listed under Today.
- Rules: a section at the bottom that opens. It tells each Calendar filter in a
  plain sentence, and has a link to Calendar filters, where the rules are edited.

The list holds the next 40 events of each calendar, in the next 30 days.

## What an event says

- Shows on the TV: the TV shows it.
- Hidden by you: you switched it off here.
- Hidden, with "Hidden by the rule" and its name: a Calendar filter hides it. Open
  Rules to read the rule.
- The calendar is hidden: the calendar is switched off in Dashboard Settings, so
  the TV shows none of it. Switch the calendar on there.
- Earlier today: it is over. There is nothing to change.

## The Show and Hide switch

Each event has a switch. On means the TV shows it. Click it to hide that one event.
Click it again, or click Undo, to show it again.

- A click does not reach the TV at once. It makes a draft. The page then says:
  Click Publish all to apply. The TV changes when you click Publish all in the
  top bar, like every other change in Studio.
- The switch works on one event only. A meeting that repeats every week keeps its
  other days. To hide every Monday, make a rule under Calendar filters
  (docs/hide-a-repeating-meeting.md).
- To show an event that a rule hides, switch it on. The page makes a rule that
  shows that one event, and the Always show rule wins as always.
- A hidden calendar and an event that is over have a switch that is off.

How the rule is made:

- It is a Calendar filter with Applies to set to One event. It holds the calendar
  code, the exact title and the exact start of the event, and nothing else.
- Its id starts with `calendarFilter-one-` and its name starts with `One event`.
  The same event always makes the same id, so a second click makes no second rule.
- It stops by itself a day after the event ends (Hide after). It then does nothing
  but stays in the list under Calendar filters until someone deletes it.
- Undo withdraws it. A rule that was never published is deleted. A rule that was
  published is turned off by a draft, which also needs Publish all.

Some events have a switch that is off. An older list, written before the computer
added the start of each event, cannot be switched until the computer runs again.
If the switch does nothing at all, a red line at the bottom of the window gives the
reason. "Studio refused the change" means the account may not edit Calendar
filters. Ask a coach.

To rename a calendar, switch it off or set its kind, use Dashboard Settings,
Calendars. To add a calendar, ask a coach to add its link on the control page, Keys
tab (docs/calendar-links.md).

## What the Teletraan computer does

The calendar service runs every 15 minutes. It does these three things in order,
and the last two also run when a download failed. A failed download is the case
the page is for.

1. `fetch-calendars.sh` leaves `calendar-sync.txt` in the data folder. It has one
   line for each calendar: its code, when it was last downloaded properly and
   why the last try failed. It holds no address.
2. `calendar-status.sh` makes `calendar-status.json` from that file. With Node
   installed it also lists the events: `calendar-status.mjs` reads the Calendar
   filters from Sanity the way the TV does and works out repeating events with
   the dashboard's own calendar code, so the list is what the TV does. Each event
   has its day like 2026-10-12, the first day of the event in the time zone of the
   TV, its place, and its exact start and end. The switch matches an event by its
   start.
3. `status-write.sh calendar-status` sends the file to Sanity as the document
   `calendar-status`. It needs `SANITY_WRITE_TOKEN` in `local.env` and does
   nothing without it.

To turn it on, once the new files are on the Teletraan computer, run
`sudo /opt/teletraan/computer/scripts/install-calendars.sh`, or `install-timers.sh`
on a computer that pulls by itself. systemd reads a changed unit file only when the
script copies it again. The write token is explained in
docs/rebuilding-the-computer.md, "Showing what the computer did in Studio".

## Node on the Teletraan computer

The Teletraan computer has no Node when it is built, and the page works without it. It then
shows the times and the reasons for each calendar but no events, and says so.
To list the events, install Node on the computer after the team mentor says yes
(docs/rebuilding-the-computer.md, step 19):

    sudo apt install nodejs
    node --version

The Node must be version 18 or newer. The `dashboard` folder has a `package.json`
that tells Node its files are modules, and Node 18 and newer read them that way.
Browsers do not use that file. An older Node stops on the first import, and the page
says so. `apt policy nodejs` shows the version that apt would install. Ask the team
mentor before installing Node any other way.

Nothing else changes. The next run lists the events. To try it at once, run
these on the Teletraan computer and open the page again:

    /opt/teletraan/computer/scripts/calendar-status.sh
    /opt/teletraan/computer/scripts/status-write.sh calendar-status

`calendar-status.sh` prints what it did and never prints an address.

## Who can read it

The dataset is public. The TV reads it without a login, and so can anyone who
knows the project ID. The document `calendar-status` holds the titles, places, dates
and times of the next 40 events of every calendar, and that includes the events that
a Calendar filter hides from the TV. Anyone who asks the dataset for it can read
them. It holds no calendar address and no token. Do not put anything in the title
or the place of a BAND event that must stay private.

A one event rule holds the title and the start of its event, and it is in the same
public dataset.

The document is kept below 90000 bytes. If the titles are so long that 40 events
of each calendar do not fit, the Teletraan computer lists fewer events of each calendar, and the
page says how many it shows.

To stop the Teletraan computer writing it, take the two `ExecStopPost` lines out of
`computer/systemd/teletraan-calendars.service`, run `install-calendars.sh` again,
and ask a coach to delete the document `calendar-status` from the dataset.

## Where the code is

- `computer/scripts/fetch-calendars.sh`, `calendar-status.sh`,
  `calendar-status.mjs` and `status-write.sh`.
- `computer/systemd/teletraan-calendars.service`: the two `ExecStopPost` lines. They
  are stop steps because systemd skips `ExecStartPost` after a failed download.
- `dashboard/package.json`: tells Node that the dashboard files are modules.
- `studio/schemas/calendarStatus.js`: the document, kept out of the sidebar and
  the New menu.
- `studio/inputs/calendars-view.js` draws the page. `studio/inputs/calendars-list-parts.js`
  has its words, the rows, the states and the functions that make and withdraw the
  draft rules.
- `studio/schemas/calendarFilter.js`: the fields of a one event rule (scope,
  eventCalendar, eventTitle, eventStart). `dashboard/core/events.js` reads them.
- `tests/calendars-list.test.mjs`, `tests/calendar-one-event.test.mjs`,
  `tests/calendar-status.test.mjs`, `tests/calendar-node.test.mjs` and
  `tests/schemas.test.mjs`: the tests. `studio/inputs/calendars-view-parts.js` and
  `calendars-hide-rules.js` hold the older Hide buttons, which the page no longer
  uses. Rules they made, named Hide: or Hide all:, still work and show under Rules.
