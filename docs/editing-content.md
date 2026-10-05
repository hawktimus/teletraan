# Editing content

For everyone who changes what is on the TV. No programming is needed.

## Signing in

1. Open the Studio at [Studio address, added after the first deploy].
2. Sign in with the account your invitation was sent to.
3. If you have no invitation, ask the team mentor to send one.

## Publishing

Studio saves what you type as a draft. The TV does not show a draft. When you
are done, click Publish. The TV changes within a few seconds.

If the TV loses its internet connection, it keeps showing the last content it
received.

## The sidebar

- Tasks: what the team is working on. Each task has a name, a subteam and a
  status (Blocked, In progress, Up next or Done). When you set a task to Done,
  fill in "Finished on". If you leave it empty, the time you last edited the
  task counts as the finish time. The task leaves the screen after the number
  of days set in Dashboard Settings. The Tasks panel shows at most 2 tasks for
  each status and at most 3 statuses, in the order Blocked, In progress, Up
  next, Done. Done tasks only show when one of the other three statuses has no
  tasks. The Open Tasks panel counts every open task, even one that the Tasks
  panel has no room for.
- Tonight's Plan: the schedule for tonight's meeting, up to 5 rows. The TV
  shows the first plan that is switched on and is dated today or has no date.
  A plan from another day is skipped, so an old plan that is still switched on
  does not hide today's.
- Extra events: events that are not on BAND, such as one another school hosts.
  Each has a name, a start date, an optional end date, optional times and an
  optional place. See "Extra events" below.
- Sponsors: name, tier, a short line about them, a thank-you line for the
  ticker, and the web address of their logo.
- Tips and News: the lines that run along the bottom of the screen.
- Subteams: each subteam and its lead. Turn on "In the spotlight" to feature
  one. Add a subteam here before you use it on a task. The Team Leads panel
  shows every subteam that has a lead, three to a page (see Photos of people).
- Leadership: coaches, captains and mentors, each with an optional photo. The
  panel lists coaches first, then captains, then mentors, three to a page (see
  Photos of people).
- Custom Panels: a panel you build yourself from blocks (heading, text,
  number, list, image address, progress bar, countdown). About 3 blocks fit.
  A block that does not fit is left out. The title shows in capital letters,
  7 at most.
- Dashboard Settings: the settings for the whole screen, described below.
- Theme: the colours of the whole screen, and holiday colours for set dates.
  See "Theme" below.

Events on the team's BAND calendars are not edited here. Add or change the
event in BAND and it reaches the TV after the Mini next downloads the
calendars. An event that is not on BAND goes in Extra events.

Sponsor logos and the pictures in the Photos panel are not stored in Studio.
Where you see an address, paste the web address of the picture. The photo of a
person in Leadership is the one picture that is uploaded to Studio.

## Extra events

Use Extra events for something that is not on BAND. The Events panel and the
Next event tile show them mixed in with the BAND events, in order of start.

To add one by hand, open Extra events, click the plus button, fill in the form
and click Publish. The fields:

- Event name: up to 30 characters.
- Start date: needed.
- End date: optional. Use it for an event of more than one day. It cannot be
  before the start date. The screen writes the dates as a range, such as
  APR 2-4, or DEC 30-JAN 2 when the event crosses into a new month.
- Start time and End time: optional, in 24 hour time with two digits, such as
  18:30. Leave Start time empty for an all-day event: the screen shows the date
  and no time. An End time needs a Start time.
- Location: optional, up to 24 characters.
- Show on screen: turn it off to hide the event without deleting it.

What the screen does with them:

- An event leaves the screen when its last day has passed: the End date, or
  the Start date if there is no End date. The day changes at midnight in the
  Time zone on the Theme page. You do not have to delete or hide a finished
  event. The screen checks once a minute, so it goes soon after midnight.
- The times you type are read in that same Time zone. Keep it the same as the
  Mini's own time zone (docs/rebuilding-the-mini.md, step 3), because the
  screen writes times on the Mini's clock.
- If a BAND event is on the same date and one of the two titles contains the
  other, capitals ignored, only the BAND event shows. So you can add an event
  before it is in BAND, and it steps aside once BAND has it. For an event of
  several days "the same date" means the dates overlap.

### Importing the starting list

The file `docs/seed/extra-events.ndjson` holds the first seven events, from
October 2026 to April 2027. Import it once, from a Mac, with the Studio set up
and signed in (studio/README.md, steps 1 to 4). It changes the real content
that the TV shows, so ask the team mentor first.

1. Open the Terminal app and go to the `studio` folder: type `cd `, with a
   space after it, drag the `studio` folder from Finder into the window and
   press Enter.
2. Run this one command:

       npx sanity dataset import ../docs/seed/extra-events.ndjson --missing

What each part means:

- `npx sanity dataset import` is the Sanity tool's command for adding
  documents from a file. It already knows the project and dataset from
  `sanity.cli.js`, so it needs nothing more.
- `../docs/seed/extra-events.ndjson` is the file. `..` means the folder above
  `studio`. The file has one event on each line, and each event has a fixed id,
  such as `extraEvent-2026-10-17-doyenne-east`.
- `--missing` means: skip any document whose id already exists. It is what
  makes the import safe to repeat. Run it twice and the second run finds every
  id already there, skips them all and changes nothing, even if someone has
  edited an event in Studio since. Do not use `--replace` instead: it would put
  the original text back over those edits. `npx sanity dataset import --help`
  lists every option.

When it finishes, the seven events are in Extra events, published. Open them
there to check. An event you delete in Studio comes back if you import again,
because its id is missing again. Ids use hyphens and no dots on purpose: the
screen reads without signing in, and Sanity keeps a document whose id has a
dot private.

## Photos of people

Each person in Leadership has a Photo and a "Show photo on screen" switch. The
Leadership and Team Leads panels show a framed portrait for each person, with
the name and the role under it. Three portraits fit on a page. If there are
more people, the panel shows the next page each time it comes round, and the
text stays the same size. It never gets smaller to fit more people.

When you upload a photo:

- Use a square crop, with the face and shoulders in the middle.
- Use a plain background, so the face is easy to see from across the room.
- Use the first name only in the Name field.
- After you upload the photo, open its crop and hotspot tool (the crop button
  on the photo). Drag the box to crop it, and drag the circle onto the face.
  The screen cuts a square from what is left and keeps the circle in it. A
  wide or tall photo is cut down to a square, so a square photo is best.
- A photo needs no special size. The screen asks Sanity for a small copy cut
  to the size it is shown, so a large photo from a phone is fine.

A person with no photo, or with "Show photo on screen" turned off, shows the
same silhouette, so turning the switch off hides the photo without deleting
it. The same silhouette shows when a photo cannot be loaded, for example when
the TV has lost its internet connection. The TV tries again the next time the
page comes round.

A subteam has only the name of its lead, with no photo of its own. The Team
Leads panel shows the photo of the person in Leadership whose name is the same
as the lead's name, for example the lead Sam and the person Sam. The capital
letters and spaces at the ends do not matter, but the spelling does. If nobody
in Leadership has that name, or that person is hidden, the lead shows the
silhouette.

Photos in Studio can be opened by anyone who has their web address. Only
upload a photo that may be shown.

## Order

Most items have an optional Order number. A lower number comes first. Items
with no number come after the numbered ones, in the order they were created.

## Hiding something

Open the item, turn off "Show on screen", and click Publish. Turn it back on to
bring it back. Hide an item rather than deleting it, so you can use it again.

## Expiry

Every item has an optional "Hide after" date and time. Once it has passed, the
item leaves the screen by itself. The item stays in Studio, marked Expired in
the list. To show it again, change or clear the date and publish. Leave the
field empty and the item stays until you hide it. The time is in your own time
zone.

## How long text may be

Every text field says how many characters fit, for example "Up to 22
characters fit". Studio shows a red message and will not let you publish until
the text is short enough.

The limits are measured with ordinary mixed case text. Text in all capitals is
wider, so it can be cut off with three dots before it reaches the limit. If
text that is too long ever reaches the screen, it is cut off at the edge of its
box.

## Dashboard Settings

One page, with tabs along the top. It cannot be deleted or copied.

- Screen: the team name, number and school in the banner. Motion is Full or
  Calm (Calm only fades panels in and out, with no turning, glint, name effect
  or screen glitch). Speed is Very slow, Slow, Normal or Fast. It changes how fast things
  move and how long each panel and ticker line stays, but not announcements or
  alerts, which keep the seconds you give them. Frame metal is Gold (warm
  antique brass) or Silver (weathered steel) and sets the metal on the edges of
  the frames. Glint is a bright spark that runs once around each frame every few
  seconds. Turn it off for a calmer screen.
- Logo and effects: the two effects that play now and then, each with the same
  three settings. Name effect makes the letters of the team name split apart,
  turn and lock back together. "Name effect every (seconds)" is how often, from
  30 to 900, or 0 to never play it. The starting value is 300, which is every
  five minutes. "Name effect duration (seconds)" is how long one play takes,
  from 0.5 to 10. The starting value is 1.43, the time it takes on HAWKTIMUS
  PRIME today, and a longer or shorter name takes a little more or less. The
  Screen glitch is a short old television glitch over the whole screen: a bright
  bar rolls down, the picture jumps sideways and the scan lines flicker. "Play
  the glitch" turns it on or off, "Seconds between glitches" is from 30 to
  3600, or 0 to never play it, and starts at 240 (every four minutes), and
  "Glitch duration (seconds)" is from 0.5 to 10 and starts at 2.7. The
  durations are for Normal speed, and the Speed setting makes them longer or
  shorter like every other move. The seconds between plays are real seconds.
  Only one effect plays at a time, and none starts while a panel is changing
  page, so one that is due can start a moment late. Its next play is counted
  from when it started, so a late play is never followed by extra ones. Calm
  motion plays neither. The announcements play the glitch between their two
  lines whatever this tab says. The glitch used to be set in minutes. If an
  older Studio page shows an "unknown field" box called everyMinutes, click
  Unset. The screen reads an old value of minutes as seconds until you set the
  new field.
- Countdown: the labels and dates for Kickoff and Rollout. The countdown counts
  to Kickoff, then to Rollout.
- Alert: turn it on to cover the whole screen with a headline and a message.
  Turn it off to take it down, or set "Take down at" to do it automatically.
- Panels: which panels appear, in what order and for how long. Drag a row to move
  it. Turn off "Show on screen" to skip a panel. "Seconds per page" is at the
  top. It is how long a large panel stays up, from 8 to 120, and the starting
  value is 20. A small panel stays three quarters as long and a ticker line one
  and a half times as long, so at 20 seconds a small panel stays 15 and a
  ticker line 30. A row can have seconds of its own, from 6 to 120. Leave the
  field empty and the row follows "Seconds per page". The ticker has its own
  "Seconds per ticker line" that works the same way. A row that already has
  seconds keeps them until you clear the field. Speed is applied after all of
  this, so Slow makes every page stay longer than the number you typed. This tab
  also has how many days finished tasks stay, and the date the safety day count
  starts. If you delete every row of a list, nothing is shown in that part of
  the screen.
- Announcements: full screen messages at set times. Give the time in 24 hour
  form, such as 14:30, and tick the days it should play. Tick at least one day.
  The second line is optional: leave it empty and only the first line plays.
  Turn off "Show on screen" to stop one without deleting it. If you delete
  every announcement, none play.
- Calendars: give each calendar a name and choose whether it shows. A new Studio
  starts with one row, code team, named Team calendar. A calendar only shows
  events when it has a row here, with a code that matches the calendar on the
  Mini (the code team is CALENDAR_TEAM_URL there), and its "Show on screen"
  switch is on. The code is lowercase letters, digits and underscores. Do not
  change a calendar's code unless you were told to. If you delete every row, no
  events show.
- Content source: Production or Sample, and an optional "Switch back to
  production at" time. See the next section.

## Theme

One page, like Dashboard Settings. It cannot be deleted or copied. A theme is
a set of colours for the whole screen. It changes colours only: nothing moves
or changes size. A holiday overlay lays a few accent colours over the theme
for a set of dates.

- Default theme: the look the screen has when nothing below applies.
- Use a theme now: pick a theme, an overlay, or both, and they show at once,
  whatever the schedule says. Leave a part empty and the schedule decides it.
  Pick "No overlay" to hide the overlay the schedule would show. "Until" is
  optional. When that time passes, "Use a theme now" stops by itself. With no
  time it stays until you clear it.
- Schedule: rules for certain dates. Give each rule a name (only editors see
  it), a kind (Theme or Holiday overlay), the theme or overlay, a start date and
  an end date. Both dates are needed, and both days count. Turn on "Repeats
  every year" to use the same days every year: only the month and the day
  count, so the year you pick is ignored. A rule can run over New Year. For 20
  December to 5 January, turn on "Repeats every year" and give any year for
  each date. For each kind, the first rule in the list that covers today is
  used, so a theme rule and an overlay rule can both apply at once.
- Time zone: the zone the dates are read in, such as America/New_York, which is
  where the page starts. The date changes at midnight in that zone, whatever
  the zone of the computer that shows the screen. Extra events use it too, for
  their times and for when they are over.

The order is: Use a theme now, then the first matching rule of each kind, then
the Default theme and no overlay. The screen checks once a minute, and also
when you publish. It does not change colour in front of people: a change goes
on at the next page change of the large panel, so allow up to a minute or so. In
an alert it can take up to two minutes. The themes and overlays in the lists
are the ones the dashboard has. A new one is added in the code
(docs/adding-a-theme.md, docs/adding-a-holiday-overlay.md).

## Sample content and production content

The TV can show two kinds of content. Production is what you publish in
Studio. Sample is made-up content that is kept with the dashboard, with every
piece of text in [square brackets]. It is for trying the screen out, or for
showing it to visitors before the real content is ready.

To switch, open Dashboard Settings, open the menu next to Publish (the three
dots), and click "Use sample content" or "Use production content". One click
changes Content source and publishes it. The TV follows within about 30
seconds and does not need a restart. The buttons are switched off when the TV
is already on that kind of content. Anything else you changed on the page and
have not published yet is published at the same time.

You can also pick Production or Sample yourself in the Content source tab and
click Publish. The result is the same.

- While the TV shows sample content, a yellow SAMPLE CONTENT label sits beside
  the TEAM plate in the banner. It stays up the whole time and is gone as soon
  as the TV is back on production. It is never shown on production content. A
  full screen alert or announcement covers it, like everything else.
- Sample content comes with its own calendar, its own pictures and three
  sample Extra events. Their dates are in March 2027, so once those days have
  passed they leave the screen. Change the dates in
  `dashboard/data/sample/content.json` to see them again. Nothing
  else is read from Studio while it is on, so your tasks, events, alert and
  the other settings do not show until you switch back. The TV still asks for
  Dashboard Settings every 30 seconds or so, to notice the switch back.
- "Switch back to production at" is optional. Set a time, and the TV goes back
  to production by itself at that time, for example the end of a demo. Leave it
  empty to stay on sample until someone clicks "Use production content". A
  time that has already passed counts as production, so "Use sample content"
  clears a time that has passed. The time is in your own time zone.
- If the TV cannot read Dashboard Settings, it uses the last ones it saved. If
  it has never saved any, `useSampleContent` in `dashboard/config.js` decides.
  That flag is only this last resort. It is not how you switch.
