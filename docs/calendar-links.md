# Calendar links

For the coaches who add or change a BAND calendar. A calendar link is the iCal
address BAND gives for a calendar. The Mini downloads each link every 15 minutes
and the TV shows the events.

A link is a secret, because anyone who has it can read the whole calendar. It
lives in one place: the file `deploy/local.env` on each Mini. Never put it in the
repository, in Studio, in a doc or in a message. Studio and the dashboard only
ever see a calendar's code and name.

## What a calendar needs

Three things that share one short ID, such as GROUP:

1. A line in `deploy/local.env` on the Mini. The name is `CALENDAR_`, the ID in
   capital letters and `_URL`. The value is the link, in single quotes.

       CALENDAR_GROUP_URL='https://api.band.us/ical?token=PASTE_LINK_HERE'

   The link may start with `https://` or `webcal://`. A plain `http://` link is
   refused.
2. The file the Mini saves from it: the ID in lowercase with `.ics` after it,
   here `group.ics`. You do not make this file. The Mini does.
3. A row in Dashboard Settings, in the Calendars tab, with the Calendar code
   `group` (the ID in lowercase), a Calendar name and Show on screen. The TV
   shows nothing from a calendar that has no row, or whose row is switched off.

## Add a calendar

1. Copy the calendar's iCal link from BAND.
2. Add the line to `deploy/local.env` on the Mini. The commands are in
   docs/rebuilding-the-mini.md, "Adding or changing a calendar". The spare Mini
   has its own `local.env`, so add the line there too.
3. In Studio add the row in Dashboard Settings, Calendars, and click Publish.
4. The events arrive within 15 minutes, or at once if someone runs
   `fetch-calendars.sh` on the Mini. To see which events the TV will show, run
   `check-calendars.sh` (docs/calendar-filters.md, "Checking the rules").

## Change a link

BAND sometimes gives a calendar a new link, and then the old one stops working.
Edit the `CALENDAR_<ID>_URL` line in `local.env`, on both Minis, and keep the ID
the same. The file name and the Studio row stay as they are. The TV keeps showing
the old events until a download works.

## Leave out some events

- To leave out a whole calendar, turn off Show on screen on its row in Calendars.
- To leave out some of its events, such as a meeting that repeats every week, use
  a Calendar filter (docs/calendar-filters.md). The filter names a calendar by the
  same code.
