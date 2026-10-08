# Editing content

For everyone who changes what is on the TV. No programming is needed.

## Signing in

1. Open the Studio at [Studio address, added after the first deploy].
2. Sign in with the account your invitation was sent to.
3. If you have no invitation, ask the team mentor to send one.

## Publishing

Studio saves what you type as a draft. The TV does not show a draft. When you
are done, click Publish. The TV changes within a few seconds.

To publish several drafts at once, use Publish all in the top bar. It lists
every draft, checks each one you tick the way the Publish button does, and
publishes the ones that pass. See docs/publish-all.md.

If the TV loses its internet connection, it keeps showing the last content it
received.

## The sidebar

- Tasks: what the team is working on. Each task has a name, a subteam, an
  optional point of contact, an optional location and a status (Blocked, In
  progress, Up next or Done). The point of contact is a first name, up to 12
  characters, with no last name. The location is a place picked from the list
  of Places (see "Places" below). When you set a task to Done, fill in
  "Finished on". If you leave it empty, the time you last edited the task
  counts as the finish time. The task leaves the screen after the number of
  days set in Dashboard Settings. See "What the Tasks panel shows" below.
- Tonight's Plan: the schedule for tonight's meeting, up to 5 rows. The TV
  shows the first plan that is switched on and is dated today or has no date.
  A plan from another day is skipped, so an old plan that is still switched on
  does not hide today's.
- Events Calendar: events that are not on BAND, such as one another school
  hosts. Each entry has a name, a start date, an optional end date, optional
  times and an optional place. See "Events Calendar" below.
- Subteams: each subteam, its lead and the students on it. Turn on "In the
  spotlight" to feature one. Add a subteam here before you use it on a task.
  The Team Leads panel shows every subteam that has a lead, three to a page
  (see Photos of people). The Subteam roster panel shows the lead and the
  members of each subteam (see Subteam members).
- Leadership: coaches, captains and mentors, each with an optional photo. The
  panel shows all the coaches, then all the captains, then all the mentors. A
  page never mixes roles, and a role with more than three people continues on
  more pages (see Photos of people). Pick the role, type the name, and type a
  title if you want something other than the role under the name, for example
  Head Coach. The role also colours the frame round the portrait: Coach is red,
  Captain is gold and Mentor is silver. There is no separate role for a
  president: give a president the role Captain and the title President, and
  they are shown with the captains.
- Sponsors: name, tier, a short line about them, a thank-you line for the
  ticker, and the web address of their logo.
- Photos: the pictures for the Photo panel. Each has a picture you upload, an
  optional short caption and the first name of the person who took it. See
  "Photos" below.
- Tips and News: the lines that run along the bottom of the screen.
- Custom Panels: a panel you build yourself from blocks (heading, text,
  number, list, image address, progress bar, countdown). About 3 blocks fit.
  A block that does not fit is left out. The title shows in capital letters,
  7 at most.
- Dashboard Settings: the settings for the whole screen, described below.
- Theme: the colours of the whole screen, and holiday colours for set dates.
  See "Theme" below.
- Places: the rooms and areas a task can be in, such as the Classroom. See
  "Places" below.
- Demo: plays a few of the special screens (the announcement and night mode) now,
  for visitors. See "Demo" below, and docs/demo.md.

Events on the team's BAND calendars are not edited here. Add or change the
event in BAND and it reaches the TV after the Mini next downloads the
calendars. An event that is not on BAND goes in Events Calendar.

Sponsor logos are not stored in Studio. Where you see an address, paste the
web address of the picture. The photos in Photos and the photo of a person in
Leadership are uploaded to Studio.

## Events Calendar

Use Events Calendar for something that is not on BAND. The Events panel and the
Next event tile show its entries mixed in with the BAND events, in order of
start.

To add one by hand, open Events Calendar, click the plus button, fill in the form
and click Publish. The fields:

- Event name: up to 30 characters.
- Start date: needed.
- End date: optional. Use it for an event of more than one day. It cannot be
  before the start date. The screen always writes the month with the day. An
  event of one day is APR 2, and the Next event tile adds the weekday, as in
  FRI APR 2. An event of several days is a range: APR 2-4, MAR 30-APR 1 when
  it crosses into a new month, or DEC 30-JAN 2 when it crosses into a new
  year. Events from BAND are written the same way.
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
- The dates and times you type are read in that same Time zone, and the screen
  writes the dates of every event, from BAND too, in it: the weekday and the
  month are never taken from the Mini's own clock. Keep the Time zone the same
  as the Mini's own time zone (docs/rebuilding-the-mini.md, step 3), because
  the screen writes times on the Mini's clock.
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

When it finishes, the seven events are in Events Calendar, published. Open them
there to check. An event you delete in Studio comes back if you import again,
because its id is missing again. Ids use hyphens and no dots on purpose: the
screen reads without signing in, and Sanity keeps a document whose id has a
dot private.

## What the Tasks panel shows

A page of the Tasks panel is three rows, and a row is one status: BLOCKED, IN
PROGRESS, UP NEXT or RECENTLY DONE. A row has room for two lines of text:

- A task with only a name (and maybe a subteam) is one line.
- A task with a point of contact or a location is two lines: the name and the
  subteam, then the contact and the location under them, in smaller text.
  A task with only a contact shows only the contact, and a task with only a
  location shows only the place.
- Only Blocked, In progress and Up next tasks show the contact and the
  location. A Done task shows its name and subteam and nothing more.

So a row holds two tasks with only a name, or one task that has a contact or a
location. A status with more tasks than that takes more than one row, and each
row has its own label. Blocked comes first, then In progress, Up next and Done.

When the rows do not fit on one page, the panel shows the next page each time
it comes round, and the first page again after the last. A blocked task is
always on the first page. Giving tasks contacts and locations makes the pages
hold fewer tasks, three at the least, so there are more pages. Hidden tasks,
expired tasks and Done tasks past the number of days in Dashboard Settings are
left out. The Open Tasks panel counts every open task however many pages there are.

## Places

A place is a room or area where a task is done, such as the Classroom. Pick one
in the Location field of a task and the TV shows its name under the task. Places
are a list of their own, so that every task spells a place the same way.

To add one, open Places, click the plus button, fill in the form and click
Publish. The fields:

- Place name: needed, up to 16 characters. Two places cannot have the same
  name. Studio ignores capitals when it compares, so it refuses "classroom"
  when "Classroom" is already there.
- Show on screen: turn it off to hide the place. A task that uses a hidden
  place shows no location, and the task itself stays on the screen. Deleting a
  place does the same to the tasks that used it.

You can also add a place while you edit a task: in the Location field choose
Create new, type the name, and publish the new place as well as the task. The
TV only shows a place once it is published.

### Importing the starting places

The file `docs/seed/places.ndjson` holds the three starting places: Classroom,
Programming room and Media center. Import it once, in the same way as the
starting events above: from a Mac, with the Studio set up and signed in, and
with the team mentor's yes. From the `studio` folder, run this one command:

    npx sanity dataset import ../docs/seed/places.ndjson --missing

Each place has a fixed id, such as `place-classroom`, and `--missing` skips any
place whose id is already there, so running it again changes nothing. The
parts of the command are explained under "Importing the starting list" above.
A place you delete in Studio comes back if you import again, because its id is
missing again.

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

### Order, time on screen and size

Dashboard Settings has a Photos tab with four settings:

- Photo order is Random (the default) or Newest first. Random never shows the
  same photo twice in a row. Newest first goes from the photo uploaded last to
  the one uploaded first, then starts over. "Newest" is the time the photo was
  added to Studio, not the time it was taken. A photo added while the screen
  is running comes at the start of the next round.
- Seconds per photo is how long the Photo panel stays up, from 6 to 120, and
  starts at 16. A Photo row in the Panels tab that has seconds of its own wins
  over it. With the row's seconds empty, the Photo panel follows Seconds per
  photo and not Seconds per page.
- Portrait size, percent is how big the portraits are on the Leadership and
  Team Leads panels, and the team lead portrait on the Roster panel. It is a
  whole number from 60 to 100 and starts at 100. 100 is the full size and the
  largest that fits the frame. At 80 the portraits are four fifths as big in
  both directions, frame and picture together. The names and roles under them
  keep their size, and a page still holds three portraits. A smaller portrait
  stays in the middle of its place, so the names move up with it. A person
  with no photo, who shows the silhouette, follows the same size.
- Photo size, percent is how big the picture in the Photo panel is, from 60 to
  100, starting at 100. 100 is the full size and the largest that fits the
  frame. A smaller picture is in the middle of the panel with its caption
  directly under it. The caption and the "Photo:" credit keep their size. The
  caption starts a little way in from the left edge of the picture and always
  ends in the same place, so a smaller picture leaves it less room. At 80 or
  more the longest caption Studio allows (36 characters) still fits. Below 80 a
  caption of more than about 30 characters may be cut with three dots, so check
  a long caption after you change the size.

Studio only accepts whole numbers from 60 to 100 for the two sizes. If a value
outside that range ever reaches the screen it uses the nearest end, and an
empty or odd value is 100. To see a size, set it, click Publish, and wait for
the panel to come round, or try it on the sample content first (Content
source tab).

While one photo is up, the screen starts downloading the next one, so it is
ready at the page change. If a photo cannot be loaded, the card says so and the
next page change tries the next photo. While the screen shows the sample content
(Content source), the Photo panel shows the three sample photos instead.

## Photos of people

Each person in Leadership has a Photo and a "Show photo on screen" switch. The
Leadership and Team Leads panels show a framed portrait for each person, with
the name and the title under it (the role if no title is typed). The role
colours the frame: Coach red, Captain gold and Mentor silver. The colours are
the `roleMetals` list in `dashboard/panels/leadership/leadership.js`.

Three portraits fit on a page. The Leadership panel never mixes roles on a
page: the coaches come first, then the captains, then the mentors. A role with
more than three people is shared out as evenly as possible over as many pages
as it needs, so 4 people are 2 and 2, 5 are 3 and 2, and 6 are 3 and 3. A page
with fewer than three people has portraits the same size as a full page, and
they sit in the middle. The size of all of them can be changed together with
Portrait size, percent in the Photos tab of Dashboard Settings (see "Order,
time on screen and size" above). The Team Leads panel fills each page with three leads.
When there is more than one page, the panel shows the next page each time it
comes round, and the text stays the same size. It never gets smaller to fit
more people.

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
Leads panel and the Subteam roster panel show the photo of the person in
Leadership whose name is the same
as the lead's name, for example the lead Sam and the person Sam. The capital
letters and spaces at the ends do not matter, but the spelling does. If nobody
in Leadership has that name, or that person is hidden, the lead shows the
silhouette.

Photos in Studio can be opened by anyone who has their web address. Only
upload a photo that may be shown.

## Subteam members

Each subteam has a Members list. Add one line for each student on the subteam.
The Subteam roster panel shows one subteam on a page: the team lead as a
portrait on the left, with TEAM LEAD under the name, and the members in two
columns on the right. The subteam's name is the title of the page.

- Type first names only, with no numbers. If two students have the same first
  name, add a last initial to each, such as Sam K.
- A name is up to 12 characters and a subteam has up to 24 members. Studio
  refuses a name that is too long, a line left empty, and the same name twice
  (capital letters do not matter).
- Drag the dots on the left of a line to change the order. The names show in
  the order of the list.
- A page holds 16 names, 8 in each column. A subteam with more members goes on
  to a second page, with the lead shown again. The text never gets smaller to
  fit more names.
- Each time the panel comes round it shows the next page, one subteam after
  another in the order of the Subteams list, and then starts again.
- The lead is the Lead field of the subteam. The photo is the one of the person
  in Leadership with the same name (see Photos of people), or the silhouette.
- A subteam with a lead and no members shows the lead alone. A subteam with
  members and no lead shows the names alone. A subteam with neither is left
  out, and so is one that is hidden or has passed its "Hide after" date.
- The heading always says ROSTER. The name of the subteam is shown in capital
  letters in the corner tag, where all 11 letters the field allows fit.

To put the panel on the screen, open Dashboard Settings, then the Panels tab,
then "Large panels". A Studio set up before this panel existed has a saved list
without it, and a saved list is shown as it is, so the panel stays off until you
add it. Use "Add item", pick Subteam roster, and drag the row to where you want
it in the list. A row that is already there only needs "Show on screen" turned
on. Click Publish.

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
  panels choose their own metal at every page change, in the Transitions tab. The
  theme Neon Prime has frames of dark steel of its own and ignores both settings.
  Glint is a bright spark that runs once around each frame every few
  seconds. Turn it off for a calmer screen. Look is how much polish the frames
  have. Polished (as now) is the default and is the screen as it has always
  looked: worn metal edges, screws with shading, the glint, and the // at the
  right of each panel header. Flat has plain colour edges and plain screws, with
  no worn metal, shading, ridge or banding, and no glint, whatever the Glint
  switch says. The // stays. Plain is Flat with no screws on the frames and
  no // in the panel headers. The header picture of a seasonal pack, the shapes
  beside the tasks and every other mark stay in all three. Flat and Plain draw
  less, so the Mini has an easier time (docs/try-it-on-the-mini.md). A look
  applies to every theme (Neon Prime keeps its cyan and magenta trim lines in
  Flat and Plain), and Frame metal and Frame finish keep their meaning.
  It does not change Motion, the page change style, the hidden transitions or
  the name effect. To see one before you change the setting, add `?look=flat`
  or `?look=plain` to the address of the screen: the address wins, for that page
  only. If no choice is ticked for Look (a Dashboard Settings page published
  before Look existed), the screen uses Polished. Screen glitch is a short old
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
- Panels: which panels appear, in what order and for how long. In Dashboard
  Settings open the Panels tab. "Large panels" and "Small panels" are lists:
  point at the dots on the left of a row, then drag the row up or down. The
  panels show in the order of the list, top first, and the order applies on
  the next page change. Turn off "Show on screen" to skip a panel. "Seconds per page" is at the
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
  the screen. While the theme Neon Prime is on there is no small frame, so the
  Small panels list is not used and the Large panels list is the rotation of the
  one big frame.
- Photos: how the Photo panel works. "Photo order" is Random or Newest first, and
  "Seconds per photo" is from 6 to 120 and starts at 16. See "Photos" above.
- Announcements: full screen messages at set times. Give the time in 24 hour
  form, such as 14:30, and tick the days it should play. Tick at least one day.
  The second line is optional: leave it empty and only the first line plays.
  Turn off "Show on screen" to stop one without deleting it. If you delete
  every announcement, none play. To see them now, open the menu next to Publish
  (the three dots) and click "Play announcements". It publishes the page for you,
  and the TV plays every announcement that is switched on, once, one after
  another, whatever their times and days (docs/hidden-transitions.md).
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
  desktop reveal the screen glitches blue, comes apart, cuts to a blue error
  screen for 3 seconds and comes back with the next pages. In red eyes it
  glitches red, breaks apart to black, shows a picture of two red eyes for a few
  seconds and comes back. Each has two pictures that take turns, and they can be
  swapped for others (docs/hidden-transitions.md).
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
a set of colours for the whole screen. Hawktimus and the placeholder Alternate
change colours only: nothing moves or changes size. One theme, Neon Prime, also
changes where things sit: a column on the left with the team name, the clock,
the countdown and the logo, one big frame on the right and the ticker under it.
It has no small frame, so the Small panels list in Dashboard Settings is not
used while it is on (the Large panels list is the whole rotation), and it has
frames of dark steel whatever Frame metal says. When the screen changes to or
from Neon Prime it reloads once, at the next page change of the large frame.
A seasonal pack is a holiday look: a few accent colours laid
over the theme for a set of dates, plus decorations: a small picture in place of
the double slash at the right of every panel header (a tree, a pumpkin, a
heart...), decorations in the empty places along the edges of the screen, such
as strings of lights and a snowy scene, and a few small pieces, such as
snowflakes, that drift slowly over the whole screen. The pieces over the panels
are small and faint and only cross a word for a moment. In calm motion nothing
moves and the pieces over the panels are not drawn.

- Default theme: the look the screen has when nothing below applies.
- Use a theme now: pick a theme, a seasonal pack, or both, and they show at once,
  whatever the schedule says. Leave a part empty and the schedule decides it.
  Pick "No seasonal pack" to hide the pack the schedule would show. "Until" is
  optional. When that time passes, "Use a theme now" stops by itself. With no
  time it stays until you clear it.
- Schedule: rules for certain dates. Give each rule a name (only editors see
  it), a kind (Theme or Seasonal pack), the theme or the pack, a start date and
  an end date. Both dates are needed, and both days count. Turn on "Repeats
  every year" to use the same days every year: only the month and the day
  count, so the year you pick is ignored. A rule can run over New Year. For 20
  December to 5 January, turn on "Repeats every year" and give any year for
  each date. For each kind, the first rule in the list that covers today is
  used, so a theme rule and a seasonal pack rule can both apply at once. Nothing is
  scheduled for you: docs/seasonal-packs.md suggests dates for each pack, and you
  decide. Competition Day and Summer Break have no fixed dates, so type the
  competition days and the first and last day of school yourself.
- Time zone: the zone the dates are read in, such as America/New_York, which is
  where the page starts. The date changes at midnight in that zone, whatever
  the zone of the computer that shows the screen. Events Calendar entries use it
  too, for their times and for when they are over.
- Seasonal pieces over the panels: a switch that starts on. On, a seasonal pack
  lets small pieces such as snow drift over the panels. Off, the pack keeps only its
  header pictures and the decorations along the edges. Turn it off if the pieces
  distract people, or if the screen stutters. A change shows within a few seconds,
  and Calm motion in Dashboard Settings hides the pieces too (docs/seasonal-packs.md,
  "The over layer").

The order is: Use a theme now, then the first matching rule of each kind, then
the Default theme and no overlay. The screen checks once a minute, and also
when you publish. It does not change colour in front of people: a change goes
on at the next page change of the large panel, so allow up to a minute or so. In
an alert it can take up to two minutes. The themes and overlays in the lists
are the ones the dashboard has. A new one is added in the code
(docs/adding-a-theme.md, docs/adding-a-holiday-overlay.md, docs/seasonal-packs.md).

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
  for 30 seconds. "All announcements" is a screen too: it plays every announcement
  that is switched on at its own length, and ignores the seconds of its step.
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
  sample Events Calendar entries. Their dates are in March 2027, so once those days have
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
