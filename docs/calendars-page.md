# The Calendars page

For the coaches and students who want to know what the calendars bring in. The
Calendars page in Studio, under Events, shows each BAND calendar the Mini
downloads: when it last worked, why it failed, and the next 12 events with
whether the TV shows each one. The page only shows. Nothing on it can be changed.

## Reading the page

- Left: a button for each row of Dashboard Settings, Calendars. It says the
  calendar's name and code, whether the TV shows it, how many events it has in
  the next 30 days and how many of those a rule hides, and when the Mini last
  downloaded it. A calendar that the Mini has and Dashboard Settings has not
  comes last. The TV shows none of it.
- Right: the calendar you picked. First the facts, then up to 12 events in date
  order. Each event has its date, time and title as the TV writes them, and
  SHOWN or HIDDEN. A hidden event also names the Calendar filter that hides it.
  An event that lasts all day says All day.
- A red line is a problem. "Download failed, the server said no" usually means
  BAND gave the calendar a new link: see docs/calendar-links.md, "Change a
  link". The TV keeps the events of the last good download.
- Nothing yet means the Mini has not written the page's document. It writes it
  after every calendar run, which is every 15 minutes, once it has a write
  token (docs/rebuilding-the-mini.md, "Showing what the Mini did in Studio").
- Events not listed means the Mini downloaded the calendar but did not list its
  events. The right side says why. The usual reason is that Node is not
  installed on the Mini, see below.

To change a calendar's name or switch it off, use Dashboard Settings,
Calendars. To hide a repeating meeting, add a rule under Calendar filters
(docs/hide-a-repeating-meeting.md). The page judges the events by the published
rules, so click Publish all and then wait for the next run. To add a calendar,
ask a coach to add its address on the Mini (docs/calendar-links.md).

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
   the dashboard's own calendar code, so the list is what the TV does.
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
(the table at the top of docs/rebuilding-the-mini.md):

    sudo apt install nodejs

The Node must be version 20.19 or newer, or 22.7 or newer. The dashboard files
are read as modules, and an older Node stops on them. `apt policy nodejs` shows
the version that apt would install, and `node --version` the one that is
installed. If the Mini has an older one, the page says so. Ask the team mentor
before installing Node any other way.

Nothing else changes. The next run lists the events. To try it at once, run
these on the Mini and open the page again:

    /opt/teletraan/deploy/scripts/calendar-status.sh
    /opt/teletraan/deploy/scripts/status-write.sh calendar-status

`calendar-status.sh` prints what it did and never prints an address.

## Who can read it

The dataset is public. The TV reads it without a login, and so can anyone who
knows the project ID. The document `calendar-status` holds the titles, dates and
times of the next 12 events of every calendar, and that includes the events that
a Calendar filter hides from the TV. Anyone who asks the dataset for it can read
them. It holds no calendar address, no token and no event location. Do not put
anything in the title of a BAND event that must stay private.

To stop the Mini writing it, take the two `ExecStopPost` lines out of
`deploy/systemd/teletraan-calendars.service`, run `install-calendars.sh` again,
and ask a coach to delete the document `calendar-status` from the dataset.

## Where the code is

- `deploy/scripts/fetch-calendars.sh`, `calendar-status.sh`,
  `calendar-status.mjs` and `status-write.sh`.
- `deploy/systemd/teletraan-calendars.service`: the two `ExecStopPost` lines. They
  are stop steps because systemd skips `ExecStartPost` after a failed download.
- `studio/schemas/calendarStatus.js`: the document, kept out of the sidebar and
  the New menu.
- `studio/calendars-view.js` draws the page. `studio/calendars-view-parts.js` has
  its words and rows.
- `tools/test-calendar-status.mjs`, `tools/test-calendars-view.mjs` and
  `studio/check-schemas.mjs`: the tests.
