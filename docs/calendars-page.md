# The Calendars page

For the coaches and students who want to know what the calendars bring in. The
Calendars page in Studio, under Events, shows each BAND calendar the Mini
downloads: its kind, when it last worked, why it failed, and the next 40 events
with whether the TV shows each one. Each event has buttons that hide it from the
TV or bring it back.

## Reading the page

- Top: one line of help under the heading. It reads: Hide this one, beside an
  event, takes that one event off the screen. Hide all like this hides every
  event with the same title in the same calendar. Both make a rule, and the
  rules are listed under Calendar filters. To add a calendar, ask a coach to
  add its address on the Mini.
- Left: a button for each row of Dashboard Settings, Calendars. It says the
  calendar's name and code, its kind, whether the TV shows it, how many events it
  has in the next 30 days and how many of those a rule hides, and when the Mini
  last downloaded it. A calendar that the Mini has and Dashboard Settings has not
  comes last. The TV shows none of it, so its kind says Not set.
- Right: the calendar you picked. First the facts, then up to 40 events in date
  order. Each event has its date, time and title as the TV writes them, and
  SHOWN or HIDDEN. A hidden event also names the Calendar filter that hides it.
  An event that lasts all day says All day. A calendar with more than 40 events
  in the next 30 days says how many the list shows.
- A red line is a problem. "Download failed, the server said no" usually means
  BAND gave the calendar a new link: see docs/calendar-links.md, "Change a
  link". The TV keeps the events of the last good download.
- Nothing yet means the Mini has not written the page's document. It writes it
  after every calendar run, which is every 15 minutes, once it has a write
  token (docs/rebuilding-the-mini.md, "Showing what the Mini did in Studio").
- Events not listed means the Mini downloaded the calendar but did not list its
  events. The right side says why. The usual reason is that Node is not
  installed on the Mini, see below.

To rename a calendar, switch it off or set its kind, use Dashboard Settings,
Calendars. To add a calendar, ask a coach to add its address on the Mini
(docs/calendar-links.md).

## The kind of a calendar

Each row and the facts say Kind: Meetings, Competitions, Outreach, Deadlines or
Other. The Events panel writes the kind as a small chip before each title.
Dashboard Settings stores no kind until someone picks one, and a calendar with no
kind shows Other on the screen. The page says Kind: Other (not set) for it, and a
note under the heading says to set the kind in Dashboard Settings, on the
Calendars tab. The page never guesses a kind from the name of a calendar.

## Hide an event from the page

Each event that the TV shows has two buttons:

- Hide this one hides events with this title in this calendar on this day. A
  second meeting with the same title on the same day goes with it.
- Hide all like this hides every event in this calendar with this title, on every
  day. It asks first, in words, and has Hide and Cancel.

A button makes a rule under Calendar filters, and the TV reads it within a few
seconds. The event says HIDDEN at once, before the Mini lists it again. A hidden
event that a button hid has Show again, which deletes the rule. An event that a
rule from Calendar filters hides names that rule and says to change it there,
because the page does not touch rules it did not make.

How the rule is made:

- Its id starts with `calendarFilter-hide-` and ends with a short code made from
  the calendar, the title words and the day, or the word all. Pressing a button
  twice therefore makes one rule.
- Its name is `Hide: ` with the title and the day, or `Hide all: ` with the
  title, cut to 40 characters. The word it looks for is the first 30 characters of
  the title.
- It is published, so Publish all has nothing to do for it. It is listed under
  Calendar filters, where it can be edited, switched off or deleted
  (docs/calendar-filters.md).

Some events have no button. An event with the title No title has none, because
there is nothing to look for. An event from a list that was written before the
Mini listed days only has Hide all like this, and says so. A calendar whose code is
longer than 20 characters has none, because Calendar filters refuses such a code.

When the TV still shows an event, check the rule under Calendar filters: an Always
show rule wins over a Hide rule. If a button fails, the page shows one red line
with the reason at the bottom of the window and changes nothing. "Studio
refused the change" means the account may not edit Calendar filters. Ask a
coach.

## What the Mini does

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
   TV. The Hide this one button uses it.
3. `status-write.sh calendar-status` sends the file to Sanity as the document
   `calendar-status`. It needs `SANITY_WRITE_TOKEN` in `local.env` and does
   nothing without it.

To turn it on, once the new files are on the Mini, run
`sudo /opt/teletraan/deploy/scripts/install-calendars.sh`, or `install-timers.sh`
on a Mini that pulls by itself. systemd reads a changed unit file only when the
script copies it again. The write token is explained in
docs/rebuilding-the-mini.md, "Showing what the Mini did in Studio".

## Node on the Mini

The Mini has no Node when it is built, and the page works without it. It then
shows the times and the reasons for each calendar but no events, and says so.
To list the events, install Node on the Mini after the team mentor says yes
(docs/rebuilding-the-mini.md, step 19):

    sudo apt install nodejs
    node --version

The Node must be version 18 or newer. The `dashboard` folder has a `package.json`
that tells Node its files are modules, and Node 18 and newer read them that way.
Browsers do not use that file. An older Node stops on the first import, and the page
says so. `apt policy nodejs` shows the version that apt would install. Ask the team
mentor before installing Node any other way.

Nothing else changes. The next run lists the events. To try it at once, run
these on the Mini and open the page again:

    /opt/teletraan/deploy/scripts/calendar-status.sh
    /opt/teletraan/deploy/scripts/status-write.sh calendar-status

`calendar-status.sh` prints what it did and never prints an address.

## Who can read it

The dataset is public. The TV reads it without a login, and so can anyone who
knows the project ID. The document `calendar-status` holds the titles, dates and
times of the next 40 events of every calendar, and that includes the events that
a Calendar filter hides from the TV. Anyone who asks the dataset for it can read
them. It holds no calendar address, no token and no event location. Do not put
anything in the title of a BAND event that must stay private.

A rule that a button makes holds the first 30 characters of the title, and it is
in the same public dataset.

The document is kept below 90000 bytes. If the titles are so long that 40 events
of each calendar do not fit, the Mini lists fewer events of each calendar, and the
page says how many it shows.

To stop the Mini writing it, take the two `ExecStopPost` lines out of
`deploy/systemd/teletraan-calendars.service`, run `install-calendars.sh` again,
and ask a coach to delete the document `calendar-status` from the dataset.

## Where the code is

- `deploy/scripts/fetch-calendars.sh`, `calendar-status.sh`,
  `calendar-status.mjs` and `status-write.sh`.
- `deploy/systemd/teletraan-calendars.service`: the two `ExecStopPost` lines. They
  are stop steps because systemd skips `ExecStartPost` after a failed download.
- `dashboard/package.json`: tells Node that the dashboard files are modules.
- `studio/schemas/calendarStatus.js`: the document, kept out of the sidebar and
  the New menu.
- `studio/calendars-view.js` draws the page. `studio/calendars-view-parts.js` has
  its words, its rows, and the functions that make, read and delete the rules.
- `tools/test-calendar-status.mjs`, `tools/test-calendars-view.mjs`,
  `tools/test-calendars-hide.mjs`, `tools/test-calendar-node.mjs` and
  `studio/check-schemas.mjs`: the tests.
