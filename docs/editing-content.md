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
- Photos: the pictures for the Photo panel. Each has a picture you upload, an
  optional short caption and the first name of the person who took it. See
  "Photos" below.
- Custom Panels: a panel you build yourself from blocks (heading, text,
  number, list, image address, progress bar, countdown). About 3 blocks fit.
  A block that does not fit is left out. The title shows in capital letters,
  7 at most.
- Dashboard Settings: the settings for the whole screen, described below.
- Theme: the colours of the whole screen, and holiday colours for set dates.
  See "Theme" below.
- Demo: plays a few of the special screens (the announcement and night mode) now,
  for visitors. See "Demo" below, and docs/demo.md.

Events on the team's BAND calendars are not edited here. Add or change the
event in BAND and it reaches the TV after the Mini next downloads the
calendars. An event that is not on BAND goes in Extra events.

Sponsor logos are not stored in Studio. Where you see an address, paste the
web address of the picture. The photos in Photos and the photo of a person in
Leadership are uploaded to Studio.

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

## Adding many items from a spreadsheet

To add a lot of items at once, for example the tasks and sponsors for a new
season, fill in the CSV templates in `docs/content-templates/` in a
spreadsheet and import them. The steps are in docs/importing-from-csv.md. It
only adds items and never changes one that is already there.

## Photos

The Photo panel shows one photo at a time, with its caption under it and the
photographer's first name at the lower left of the picture ("Photo: Sam").
Photos are uploaded to Studio. Nothing is kept on the Mini.

### Adding a photo

1. Open Photos in the sidebar and click the plus button.
2. Under Picture, drag a photo onto the box or click it and choose one. A large
   photo straight from a phone is fine: the screen asks Sanity for a copy that
   is no wider than the screen, in a small file format, so you do not need to
   shrink it first.
3. Open the crop and hotspot tool (the crop button on the picture). Crop out
   anything you do not want, and drag the circle onto the main subject, such as
   a face. The screen cuts the photo to fit its box and keeps the circle in view.
4. Caption is optional: a short line under the picture, up to 36 characters. No
   last names.
5. Credit is optional: the first name of the person who took the photo, up to
   14 characters. Studio refuses a space or a number, so use a hyphen in a name
   such as Mary-Anne. The screen shows it as "Photo: Sam".
6. Click Publish. There is no approval step: a photo shows on the TV as soon as
   it is published, so look at it first. The TV changes within a few seconds.

Every photo also has "Show on screen" and "Hide after", like the other items.
Turn "Show on screen" off to take a photo off the TV without deleting it, or set
"Hide after" so it goes by itself. The list shows Hidden or Expired beside such a
photo. The Photo panel only uses photos that are on and have not expired. If there
are none, the panel is skipped.

### For the people who upload

- Use first names only. Put the photographer's first name in Credit and nothing
  more.
- Never put a last name in a caption, and do not write a last name for anyone in
  the picture.
- Switch location tagging off on your phone before you take the photo. A phone
  can save where a photo was taken inside the picture file, and anyone who has
  the picture's web address can open that file. On an iPhone: Settings, Privacy
  and Security, Location Services, Camera, then choose Never. On an Android
  phone: open the Camera app, open its settings and turn off Location tags (the
  name changes a little between makes).
- Take the photo in landscape, with the phone turned sideways. The picture
  box on the TV is about twice as wide as it is tall. A square photo loses about
  half its height and a tall photo loses most of it, so landscape is best and
  the circle in the crop and hotspot tool matters most for the others.
- Only upload a photo that may be shown. Photos in Studio can be opened by
  anyone who has their web address.

### Order and time on screen

Dashboard Settings has a Photos tab with two settings:

- Photo order is Random (the default) or Newest first. Random never shows the
  same photo twice in a row. Newest first goes from the photo uploaded last to
  the one uploaded first, then starts over. "Newest" is the time the photo was
  added to Studio, not the time it was taken. A photo added while the screen
  is running comes at the start of the next round.
- Seconds per photo is how long the Photo panel stays up, from 6 to 120, and
  starts at 16. A Photo row in the Panels tab that has seconds of its own wins
  over it. With the row's seconds empty, the Photo panel follows Seconds per
  photo and not Seconds per page.

While one photo is up, the screen starts downloading the next one, so it is
ready at the page change. If a photo cannot be loaded, the card says so and the
next page change tries the next photo. While the screen shows the sample content
(Content source), the Photo panel shows the three sample photos instead.

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

One page, with tabs along the top. It cannot be deleted or copied. The tabs, in
order, are Screen, Logo, Transitions, Countdown, Alert, Panels, Photos,
Announcements, Night mode, Hidden, Calendars, Content source and Connection.

- Screen: the team name, number and school in the banner. Motion is Full or
  Calm (Calm only fades panels in and out, with no turning, glint, logo
  animations, name effect or screen glitch). Speed is Very slow, Slow, Normal
  or Fast. It changes how fast things move and how long each panel and ticker
  line stays, but not announcements or alerts, which keep the seconds you give
  them. Frame metal is Gold (warm
  antique brass) or Silver (weathered steel) and sets the metal on the edges that
  stay on the screen: the banner, the countdown and the logo. The large and small
  panels choose their own metal at every page change, in the Transitions tab.
  Glint is a bright spark that runs once around each frame every few
  seconds. Turn it off for a calmer screen. Screen glitch is a short old
  television glitch over the whole screen: a bright bar rolls down, the picture
  jumps sideways and the scan lines flicker. "Play the glitch" turns it on or
  off, "Seconds between glitches" is from 30 to 3600, or 0 to never play it, and
  starts at 240 (every four minutes), and "Glitch duration (seconds)" is from 0.5
  to 10 and starts at 2.7. The announcements play the glitch between their two
  lines whatever this tab says. The glitch used to be set in minutes. If an
  older Studio page shows an "unknown field" box called everyMinutes, click
  Unset. The screen reads an old value of minutes as seconds until you set the
  new field.
- Logo: everything the logo and the team name do, in one tab. "Logo
  animations" is the master switch, and comes first. Turn it off and nothing in
  the logo moves, the name effect included, and the logo stays the still
  emblem. Under it, "Entrance" is a switch for the four plates flying in once
  when the screen starts. It plays once, so it has no timing. The spin (the
  logo makes one full turn, drawn flat), the flying hawk (the logo folds into a
  robot, changes into a hawk, flies and changes back) and the name effect (the
  letters of the team name split apart, turn and lock back together) each have
  the same three settings: a switch, "every (seconds)" and "duration
  (seconds)". Every is how often it plays, and 0 means never. The spin starts at
  every 72 seconds (0 for never, or 10 to 3600) and takes 1.6 seconds (0.5 to
  10). The flying hawk starts at every 24 seconds (0 for never, or 10 to 3600)
  and takes 11 seconds (6 to 30) from the first fold to the plates locking
  home. The name effect starts at every 300 seconds, which is five minutes (0
  for never, or 30 to 900), and takes 1.43 seconds (0.5 to 10), the time it
  takes on HAWKTIMUS PRIME today. A longer or shorter name takes a little more
  or less. The starting values are what the logo did before it had
  settings. A duration
  stretches or squeezes the whole animation by the same amount, so a flying
  hawk of 22 seconds is the same flight at half speed. The durations are for
  Normal speed, and the Speed setting makes them longer or shorter like every
  other move. The seconds between plays are real seconds, counted from when
  the animation last started. Only one animation plays at a time, and none
  starts while a panel is changing page, so one that is due can start a moment
  late. A late play is never followed by extra ones. Calm motion plays none of
  them. The screen glitch used to be in this tab, in "Logo and effects". It is
  in the Screen tab now.
- Transitions: how the large and small panels change page, and what metal their
  frames have (docs/page-transitions.md). "Page change style" is Alternate (the
  default), Slat change only or Mechanical only. The slat change turns the rows
  over while the frame lifts and drops. The mechanical change breaks the frame
  into plates and bars that fold away in 3D and then click back into place around
  the new page, like a robot changing shape. Alternate takes turns between the
  two. "Break and rebuild time" is how many seconds the frame takes to break
  apart in the mechanical change, and the same again to rebuild, from 0.3 to 2,
  and starts at 0.6. "Frame finish" is the metal of the page frames, picked again
  at every page change: Mostly gold (the default) is gold with silver now and then,
  Alternate goes gold, silver, gold, Gold only and Silver only never change.
  "Silver chance (percent)" is how many changes in 100 bring silver with Mostly
  gold, from 0 to 100, and starts at 10 (about one change in ten). The other
  finishes ignore it. Frame metal in the Screen tab is the metal of the banner,
  countdown and logo, which never change, so it does not decide the page
  frames. The times are for Normal speed, and the Speed setting stretches them
  like every other move. Calm motion is a plain fade of the page whatever these
  say, and a change of metal fades the whole panel. Motion off moves nothing. The
  ticker has no frame, so only its words change.
- Countdown: the labels and dates for Kickoff and Rollout. The countdown counts
  to Kickoff, then to Rollout. Its seconds change right on the second of the
  Mini's clock, so it keeps time with a phone however long the screen has been
  running.
- Alert: turn it on to cover the whole screen with a headline and a message.
  Turn it off to take it down, or set "Take down at" to do it automatically.
- Panels: which panels appear, in what order and for how long. Drag a row to move
  it. Turn off "Show on screen" to skip a panel. "Seconds per page" is at the
  top. It is how long a large panel stays up, from 8 to 120, and the starting
  value is 20. A small panel stays three quarters as long and a ticker line one
  and a half times as long, so at 20 seconds a small panel stays 15 and a
  ticker line 30. A row can have seconds of its own, from 6 to 120. Leave the
  field empty and the row follows "Seconds per page" (the Photo row follows
  "Seconds per photo" in the Photos tab). The ticker has its own
  "Seconds per ticker line" that works the same way. A row that already has
  seconds keeps them until you clear the field. Speed is applied after all of
  this, so Slow makes every page stay longer than the number you typed. This tab
  also has how many days finished tasks stay, and the date the safety day count
  starts. If you delete every row of a list, nothing is shown in that part of
  the screen.
- Photos: how the Photo panel works. "Photo order" is Random or Newest first, and
  "Seconds per photo" is from 6 to 120 and starts at 16. See "Photos" above.
- Announcements: full screen messages at set times. Give the time in 24 hour
  form, such as 14:30, and tick the days it should play. Tick at least one day.
  The second line is optional: leave it empty and only the first line plays.
  Turn off "Show on screen" to stop one without deleting it. If you delete
  every announcement, none play.
- Night mode: the screensaver (docs/night-mode.md). Between "Night starts at"
  and "Night ends at" the screen is black with the team logo and the team number
  under it, and the picture is never turned off. "Use night mode" starts on. The
  times are 24 hour times such as 23:30, and start as 23:30 and 11:30. An end
  before the start runs past midnight, and the same time for both means night
  mode never comes on. They use the Time zone on the Theme page, and there is no
  time zone here. "Night style" is Bouncing logo (the logo drifts round the
  screen, changes colour at every bounce and spins when it hits a corner) or
  Blank black. "Logo width (pixels)" is from 120 to 800 and starts at 300.
  "Bounce speed" is Slow, Normal or Fast, and a corner is hit about every 12, 6.5
  or 3.7 minutes. "Preview night mode" shows it now, whatever the time, even with
  "Use night mode" off: turn it on and publish to look, and turn it off and
  publish when you are done. Calm motion keeps the logo still in the middle. An
  alert or an announcement still shows over night mode.
- Hidden: two rare surprise transitions that now and then replace a page change
  of the large panel (docs/hidden-transitions.md). "Allow hidden transitions" is
  the master switch and starts on. "Desktop reveal chance (percent)" and "Red
  eyes chance (percent)" are how many page changes in 100 become that
  transition, from 0 to 100, and both start at 1, so about one page change in 50
  is a surprise. 0 is never. In the
  desktop reveal the whole screen comes apart and shows a wallpaper for a moment
  before it comes back with the next pages. In red eyes it glitches red, breaks
  apart to black, shows a robot face with red eyes for 2 seconds and comes back.
  To play one now, open the menu next to Publish (the three dots) and click
  "Play desktop reveal" or "Play red eyes". Each publishes the page for you, and
  the TV plays it once within about 20 seconds, whatever the chances say. "Last
  push" shows which one was pushed and when, and you cannot type in it. Nothing
  here plays in Calm motion, or during an alert, an announcement, a demo or night
  mode, and with "Allow hidden transitions" off none plays at all, pushed or not.
- Calendars: give each calendar a name and choose whether it shows. A new Studio
  starts with one row, code team, named Team calendar. A calendar only shows
  events when it has a row here, with a code that matches the calendar on the
  Mini (the code team is CALENDAR_TEAM_URL there), and its "Show on screen"
  switch is on. The code is lowercase letters, digits and underscores. Do not
  change a calendar's code unless you were told to. If you delete every row, no
  events show.
- Content source: Production or Sample, and an optional "Switch back to
  production at" time. See the next section.
- Connection: one switch, "Show connection status". It starts off. Turn it on
  to keep a small text at the bottom right of the screen with the time of the
  last read from Sanity, how many tasks, sponsors and other items there are, and
  the time the calendars were last read. The counts include items you have
  switched off or that have expired. It is for setting up or checking the
  screen, so turn it off again for everyday use. Whatever this says, the same
  text comes up in red by itself when the screen has not been able to reach
  Sanity for over two minutes, and says why (docs/rebuilding-the-mini.md,
  "Checking the connection"). A full screen alert or announcement covers it.

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

## Demo

One page, like Dashboard Settings. It cannot be deleted or copied. A demo shows
the announcement and night mode on the TV one after the other, once, without
waiting for their times (docs/demo.md).

- Run demo: open the menu next to Publish (the three dots) and click Run demo.
  The TV starts the demo within a few seconds, plays it once and goes back to
  normal. It publishes the page itself. Click it again to start over.
- Stop demo: in the same menu. It ends a demo that is playing. It is switched off
  when nothing has been asked for.
- Steps: the screens to show, in order, up to 10, each with the seconds it stays
  (5 to 300). It starts with the Announcement for 30 seconds and then Night mode
  for 30 seconds.
- Demo announcement text: the words of the Announcement step, up to 24 characters.
  Leave it empty to use the first announcement in Dashboard Settings, or
  [DEMO ANNOUNCEMENT] if there is none.
- Requested at: filled in by Run demo. You cannot type in it.

A demo is only played when it was asked for in the last minute, and only once, so
a TV that restarts never plays an old one. A real alert ends it.

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
