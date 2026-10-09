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

The sidebar is in groups, by how often you touch them. Start here is at the top.
The group names, such as EVERY MEETING, are headings. Daily Agenda and Settings are
folders: click one and its lines open beside it. Each line has an icon.

Start here: a short page that says what the screen is and that Publish all is the
last step of every change. See "The Start here page" below.

### Every meeting

- Daily Agenda: a folder with three lines. Its plus button adds an Agenda item or a
  Presentation.
  - Agenda items: the schedule for today's meeting, up to 5 rows. The TV shows the
    first one that is switched on and is dated today or has no date. One from
    another day is skipped, so an old one that is still switched on does not
    hide today's. The talks booked for today fill the rows the schedule leaves
    free (docs/up-next.md). The panel is headed AGENDA.
  - Presentations: the talks students book in a Google Form, and the ones a coach
    adds by hand. They have the same fields, the slides link too, and they are in
    the same lists. Upcoming and Past are the two lists, where a coach can cancel
    or move a talk (docs/presentations.md).
  - Meeting days: which days have talk slots and when they start. A day with no
    Meeting day has no slots.
- Tasks: what the team is working on. Each task has a name, a subteam, an
  optional point of contact, an optional location and a status (Blocked, In
  progress, Up next or Done). The point of contact is a first name, up to 12
  characters, with no last name. The location is a place, picked in the Location
  field of the task (see "Places" below). When you set a task to Done, fill in
  "Finished on". If you leave it empty, the time you last edited the task
  counts as the finish time. The task leaves the screen after the number of
  days set in Dashboard Settings. See "What the Tasks panel shows" below.
- Tips and News: the lines that run along the bottom of the screen.

### Events

- Calendars: the BAND calendars the Mini reads. The page tells you to add a rule
  under Calendar filters to hide a repeating meeting, and to ask a coach to add
  the address of a new calendar on the Mini.
- Calendar filters: rules that hide events from the BAND calendars, or keep them
  on the screen, such as a meeting that repeats every week
  (docs/calendar-filters.md). Students can follow
  docs/hide-a-repeating-meeting.md.

### Roster

- Leadership: coaches, captains and mentors, each with an optional photo. The
  panel is one page of four rows: the coaches, then the captains, then the
  mentors, and only the first four show (see Photos of people). Two coaches and
  two captains are the four rows. Pick the role, type the name, and type a
  title if you want something other than the role under the name, for example
  Head Coach. The role also colours the frame round the portrait: Coach is red,
  Captain is gold and Mentor is silver. There is no separate role for a
  president: give a president the role Captain and the title President, and
  they are shown with the captains.
- Team leads: each subteam, its lead and the students on it. Turn on "In the
  spotlight" to feature one. Add a subteam here before you use it on a task.
  The Team Leads panel shows every subteam as a row with its lead, four to a
  page (see Photos of people). The Subteam roster panel shows the lead and the
  members of each subteam (see Subteam members).
- Sponsors: name, tier, a short line about them, a thank-you line for the
  ticker, and the web address of their logo.
- Photos: the pictures for the Photo panel. Each has a picture you upload, an
  optional short caption and the first name of the person who took it. See
  "Photos" below.

### Coaches only

If you are not a coach, leave these alone and ask a coach.

- Settings: a folder with three lines.
  - Dashboard Settings: the settings for the whole screen, described below.
  - Look: the colours of the whole screen, and holiday colours for set dates.
    See "Look" below.
  - Teams: the teams the TV can show, each with a name, a number, a logo, seven
    colors and a switch that flips the screen left to right. See "Teams" below.
- Extra panels: a panel you build yourself from blocks (heading, text,
  number, list, image address, progress bar, countdown). About 3 blocks fit.
  A block that does not fit is left out. The title shows in capital letters,
  7 at most.

Three kinds of content are in the Studio but have no line in the list: Events
Calendar entries, Places and Demo. They are explained below.

Tasks, Agenda items, Team leads, Leadership, Sponsors, Tips and News, Extra panels,
Meeting days and booked talks each have a Team choice:
Both, or one of the teams. Both is picked to start with, and the item shows for
every team. Pick a team to show it only while that team is on the screen
(docs/team-on-an-item.md).

Events are not typed into the Studio. They come from the team's BAND calendars.
Add or change the event in BAND and it reaches the TV after the Mini next
downloads the calendars. To get an event on the screen, add it in the calendar app,
or ask a coach for an Always show rule. To add a BAND calendar or change its link,
see docs/calendar-links.md.

Sponsor logos are not stored in Studio. Where you see an address, paste the
web address of the picture. The photos in Photos and the photo of a person in
Leadership are uploaded to Studio.

## The Start here page

The first line of the sidebar. It is a page, not a document, so there is nothing
to publish on it. It has five parts, top to bottom:

1. One line: what Teletraan I is, and that Publish all is the last step of every
   change.
2. A picture of the screen. The boxes A to E are the banner, the main panel, the
   countdown, the side panel and the ticker, drawn in the shape of the screen.
   Each box names the sidebar items that fill it.
3. The three steps of every meeting: open Daily Agenda or Tasks, make the change,
   click Publish all in the top bar. You edit on Draft, and the screen shows
   Published.
4. A row of five buttons, described below.
5. One line: anything under Coaches only is for a coach.

The buttons try the screen without waiting for a time or for a booked talk:

- Play announcement: plays every announcement that is switched on, once, one
  after another, whatever its time and days. It does what Play announcements in
  the menu beside Publish on Dashboard Settings does (docs/hidden-transitions.md).
- Run presentation test: starts the sample talk with its six sample slides. It
  does what Run presentation test in the same menu does. Run presentations in
  the Presentations tab of Dashboard Settings must be on.
- Next look now: moves the screen on to the next pass of the look rotation: the next team, or the
  Monday cards of the team on the screen if it has any. A second press while the Monday cards
  are up moves past them to the next team.
- Preview competition: shows the competition cards for 2 minutes, with sample
  competition data.
- Preview the screen: opens the screen in a new tab with the sample content, which
  is what `?sample=1` on the address does. The address is `dashboardAddress` in
  `studio/dashboard-address.js`. It is the Mini's own address, and the Mini's web
  server only answers on the Mini (deploy/README.md), so on any other computer
  the tab shows no page.

The first four buttons send a request and the screen answers it within a few
seconds. They set the request on the published Dashboard Settings and nothing
else, so a change on that page that you have not published yet stays a draft.
The buttons in the menu beside Publish publish the whole page. Dashboard
Settings must have been published once, or the page says so. Like the menu
buttons, they do nothing on a screen that shows sample content.

The requests are hidden fields of Dashboard Settings that hold the time of the
last click: `announceRequest`, `presentationTestRequest`, `nextLookRequest` and
`competitionPreviewRequest`. The buttons in the menu beside Publish and the
buttons here write the same fields, and the work is written once in
`studio/screen-requests.js`. The page is `studio/start-here.js`, and its picture
and button list are in `studio/start-here-parts.js`.

## Events

The Events panel and the Next event tile show the events of the BAND calendars, in
order of start, after the Calendar filters have taken some out. The screen always
writes the month with the day. An event of one day is APR 2, and the Next event tile
adds the weekday, as in FRI APR 2. An event of several days is a range: APR 2-4,
MAR 30-APR 1 when it crosses into a new month, or DEC 30-JAN 2 when it crosses into a
new year. An all-day event shows its date and no time.

What the screen does with them:

- An event leaves the screen when its last day has passed. The day changes at
  midnight in the Time zone on the Look page. You do not have to delete or hide a
  finished event. The screen checks once a minute, so it goes soon after midnight.
- The screen writes the dates of every event in that same Time zone: the weekday and
  the month are never taken from the Mini's own clock. Keep the Time zone the same
  as the Mini's own time zone (docs/rebuilding-the-mini.md, step 3), because
  the screen writes times on the Mini's clock.

### The old Events Calendar entries

Before the calendars, events that were not on BAND were typed into a list called
Events Calendar. The screen does not read that list any more, and it has no line in the
sidebar or in the New menu. The entries already typed are still in the Studio and
still open and publish, if you follow a link to one. Nothing was deleted. Their
seed file, `docs/seed/extra-events.ndjson`, does not need to be imported.

## What the Tasks panel shows

A page of the Tasks panel is three rows, and a row is one status: BLOCKED, IN
PROGRESS, UP NEXT or RECENTLY DONE. A row has room for two lines of text:

- A task with only a name (and maybe a subteam) is one line.
- A task with a point of contact or a location is two lines: the name and the
  subteam, then the contact and the location under them, in smaller text.
  A task with only a contact shows only the contact, and a task with only a
  location shows only the location.
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
in the Location field of a task and the TV shows its name under the task.
Places are a list of their own, so that every task spells a place the same way.
Places has no line in the sidebar. You add one, and open it, from a task.

To add one, open a task, and in the Location field choose Create new. Type the name
and publish the new place as well as the task. The TV only shows a place once it is
published. The fields:

- Place name: needed, up to 16 characters. Two places cannot have the same
  name. Studio ignores capitals when it compares, so it refuses "classroom"
  when "Classroom" is already there.
- Show on screen: turn it off to hide the place. A task that uses a hidden
  place shows no location, and the task itself stays on the screen. Deleting a
  place does the same to the tasks that used it.

To change a place, open a task that uses it and open the place from the Location
field of the task.

### Importing the starting places

The file `docs/seed/places.ndjson` holds the three starting places: Classroom,
Programming room and Media center. Import it once, from a Mac, with the Studio set
up and signed in (studio/README.md, steps 1 to 4), and with the team mentor's yes.
From the `studio` folder, run this one command:

    npx sanity dataset import ../docs/seed/places.ndjson --missing

What each part means:

- `npx sanity dataset import` is the Sanity tool's command for adding
  documents from a file. It already knows the project and dataset from
  `sanity.cli.js`, so it needs nothing more.
- `../docs/seed/places.ndjson` is the file. `..` means the folder above
  `studio`. The file has one place on each line, and each place has a fixed id,
  such as `place-classroom`.
- `--missing` means: skip any document whose id already exists. It is what
  makes the import safe to repeat. Run it twice and the second run finds every
  id already there, skips them all and changes nothing, even if someone has
  edited a place in Studio since. Do not use `--replace` instead: it would put
  the original text back over those edits. `npx sanity dataset import --help`
  lists every option.

A place you delete in Studio comes back if you import again, because its id is
missing again. Ids use hyphens and no dots on purpose: the screen reads without
signing in, and Sanity keeps a document whose id has a dot private.

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

The Screen tab of Dashboard Settings has four photo settings:

- Photo order is Random (the default) or Newest first. Random never shows the
  same photo twice in a row. Newest first goes from the photo uploaded last to
  the one uploaded first, then starts over. "Newest" is the time the photo was
  added to Studio, not the time it was taken. A photo added while the screen
  is running comes at the start of the next round.
- Seconds per photo is how long the Photo panel stays up, from 6 to 120, and
  starts at 16. A Photo row in Panel order, in the Screen tab, that has seconds of its own wins
  over it. With the row's seconds empty, the Photo panel follows Seconds per
  photo and not Seconds per page.
- Portrait size, percent is how big the portraits are on the Leadership and
  Team Leads panels, and the team lead portrait on the Subteam roster panel. It is a
  whole number from 60 to 100 and starts at 100. 100 is the full size and the
  largest that fits the frame. At 80 the portraits are four fifths as big in
  both directions, frame and picture together. The names and roles next to
  them keep their size, and a page still holds four rows. A smaller portrait
  stays in the middle of its place. On the Subteam roster panel the name moves
  up with it. A person with no photo, who shows the silhouette, follows the same size.
  In a row the portrait is 124 square at 100, so that four rows fit. On the
  Subteam roster panel it is 292.
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
the panel to come round, or try it on the sample content first (see "Sample
content" below).

While one photo is up, the screen starts downloading the next one, so it is
ready at the page change. If a photo cannot be loaded, the card says so and the
next page change tries the next photo. While a page shows the sample content
(`?sample=1`), the Photo panel shows the three sample photos instead.

## Photos of people

Each person in Leadership has a Photo and a "Show photo on screen" switch. The
Leadership and Team Leads panels show each person as a row: the framed photo at
the left, the name beside it, and the title (the role if no title is typed) at
the right end in the team color. The role colours the frame of the photo: Coach
red, Captain gold and Mentor silver. The colours are the `roleMetals` list in
`dashboard/panels/leadership/leadership.js`.

Four rows fit on a panel, spread over its height. The Leadership panel is one
panel: the coaches come first, then the captains, then the mentors, each group
in the order of the Order field, and the first four show. With two coaches and
two captains there is nothing to cut. The Team Leads panel has a row for each
subteam: the lead's name, and the subteam with LEAD after it at the right end.
A subteam with no lead shows its own name and [lead] at the right end, so a
gap can be seen from across the room. The subteams are in the order of the
Order field. Twelve subteams are three panels of four, and each time the panel
comes round it shows the next one, then starts again. The size of the
photos can be changed together with Portrait size, percent in the Screen tab
of Dashboard Settings (see "Order, time on screen and size" above). The text
stays the same size. It never gets smaller to fit more people. A name is cut
after about 17 characters.

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
  another in the order of the Team leads list, and then starts again.
- The lead is the Lead field of the subteam. The photo is the one of the person
  in Leadership with the same name (see Photos of people), or the silhouette.
- A subteam with a lead and no members shows the lead alone. A subteam with
  members and no lead shows the names alone. A subteam with neither is left
  out, and so is one that is hidden or has passed its "Hide after" date.
- The heading always says ROSTER. The name of the subteam is shown in capital
  letters in the corner tag, where all 11 letters the field allows fit.

To put the panel on the screen, open Dashboard Settings, then the Screen tab,
then "Panel order". A Studio set up before this panel existed has a saved list
without it, and a saved list is shown as it is, so the panel stays off until you
add it. Use "Add item", pick Subteam roster, and drag the row to where you want
it in the list. A row that is already there only needs "Show on screen" turned
on. Click Publish.

## Teams

A team is what changes when the TV swaps from one team to the other: the name and
number in the banner, the logo, the colors and whether the screen is flipped left to
right. Open Settings, then Teams, click the plus button, fill in the form and click
Publish. The fields:

- Team name: needed, up to 20 characters.
- Short name: needed, up to 8 characters, such as PRIME.
- Team number: optional, up to 6 characters.
- Team code: needed, lowercase letters and digits, up to 10 characters, such as
  prime. The data uses it, so do not change it later.
- Logo: optional. Leave it empty to use the shared Hawktimus bird.
- Colors: the main, plate, accent, neon, second bright, background and text colors.
  Each is # and six characters from 0 to 9 and A to F, such as #6C18B6, and each
  starts with the Prime color.
- Mirror the layout: off to start with. On, the whole screen is flipped left to
  right while this team is showing.
- Active: on to start with. Off leaves the team out of Team order and out of the
  Team choice on items.
- Order: a lower number comes first. It starts at 10.

Which team is on the screen is Team order in the Look tab of Dashboard Settings
(see below). The two starting teams, Hawktimus Prime and Hawktimus Nova, are in
`docs/seed/teams.ndjson`, and docs/add-the-nova-team.md has the import and the
steps. With no Teams at all the TV shows the built-in Prime team, as it always has.

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
order, are Screen, Look, Countdown, Calendars, Presentations, Monday,
Competition and Advanced. It opens on Screen. Studio also adds a tab called All
fields, which shows every tab one under the other. Studio cannot start a tab
folded, so Advanced is the last tab: it holds what only a coach looking into a
problem would touch.

### Screen

- Status of the Mini: the block at the top. It says when the Mini last saw a
  change to the content, downloaded the calendars, downloaded the slides, read
  the Monday boards, read the FRC data, and started the screen. Each line says
  how long ago and the time. You cannot type in it: the Mini writes it. It says
  No status yet until the Mini has a write token (docs/rebuilding-the-mini.md,
  "Showing what the Mini did in Studio"). A line says Not yet for a job the Mini
  has not done since the token was added.
- Team, motion and frames: the team name, number and school in the banner.
  Motion is Full or Calm (Calm only fades panels in and out, with no turning,
  glint, logo animations, name effect or screen glitch). Speed is Very slow,
  Slow, Normal or Fast. It changes how fast things move and how long each panel
  and ticker line stays, but not announcements or alerts, which keep the
  seconds you give them. Frame metal is Gold (warm antique brass) or Silver
  (weathered steel) and sets the metal on the edges that stay on the screen:
  the banner, the countdown and the logo. The large and small panels choose
  their own metal at every page change, in the Look tab. The theme Neon Prime
  has frames of dark steel of its own and ignores both settings. Glint is a
  bright spark that runs once around each frame every few seconds. Turn it off for a calmer screen. Polish is how much polish the frames
  have. Polished (as now) is the default and is the screen as it has always
  looked: worn metal edges, screws with shading, the glint, and the // at the
  right of each panel header. Flat has plain colour edges and plain screws, with
  no worn metal, shading, ridge or banding, and no glint, whatever the Glint
  switch says. The // stays. Plain is Flat with no screws on the frames and
  no // in the panel headers. The header picture of a seasonal pack, the shapes
  beside the tasks and every other mark stay in all three. Flat and Plain draw
  less, so the Mini has an easier time (docs/try-it-on-the-mini.md). Polish
  applies to every theme (Neon Prime keeps its cyan and magenta trim lines in
  Flat and Plain), and Frame metal and Frame finish keep their meaning.
  It does not change Motion, the page change style, the hidden transitions or
  the name effect. To see one before you change the setting, add `?look=flat`
  or `?look=plain` to the address of the screen: the address wins, for that page
  only. If no choice is ticked for Polish (a Dashboard Settings page published
  before Polish existed), the screen uses Polished. Screen glitch is a short old
  television glitch over the whole screen: a bright bar rolls down, the picture
  jumps sideways and the scan lines flicker. "Play the glitch" turns it on or
  off, "Seconds between glitches" is from 30 to 3600, or 0 to never play it, and
  starts at 240 (every four minutes), and "Glitch duration (seconds)" is from 0.5
  to 10 and starts at 2.7. The announcements play the glitch between their two
  lines whatever this tab says. The glitch used to be set in minutes. If an
  older Studio page shows an "unknown field" box called everyMinutes, click
  Unset. The screen reads an old value of minutes as seconds until you set the
  new field.
- Alert: turn it on to cover the whole screen with a headline and a message.
  Turn it off to take it down, or set "Take down at" to do it automatically.
- Panels: which panels appear, in what order and for how long. In Dashboard
  Settings open the Screen tab. "Panel order" is one list with every panel in
  it, large and small: point at the dots on the left of a row, then drag the row
  up or down. Each row says Large panel or Small panel under its name. The large
  panels show in the order they have in the list, top first, and the small panels
  too, each on its own timer, and the order applies on the next page change. Turn
  off "Show on screen" to skip a panel. A page saved before the list existed
  shows it already filled in, from the two older lists, "Large panels" and "Small
  panels", which are hidden now. "Seconds per page" is just above the list. It is how long a large panel stays up, from 8 to 120, and the starting
  value is 20. A small panel stays three quarters as long and a ticker line one
  and a half times as long, so at 20 seconds a small panel stays 15 and a
  ticker line 30. A row can have seconds of its own, from 6 to 120. Leave the
  field empty and the row follows "Seconds per page" (the Photo row follows
  "Seconds per photo" lower down in this tab). The ticker has its own
  "Seconds per ticker line" that works the same way. A row that already has
  seconds keeps them until you clear the field. Speed is applied after all of
  this, so Slow makes every page stay longer than the number you typed. This tab
  also has how many days finished tasks stay, and the date the safety day count
  starts. If you delete every row of the list, the screen goes back to the two
  older lists, so to show nothing, turn off "Show on screen" on each row. While
  the theme Neon Prime is on there is no small frame, so the small panels in the
  list are not used and the large panels are the rotation of the one big frame.
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

### Look

- Note: the line at the top points to the Look page in the sidebar, which sets
  the colors, the seasonal packs and the time zone. The Look page has a line
  that points back here.
- Styles by day: the styles the screen goes through, one for each day, in this order and then over
  again. Original and Cybertron to start with, so the screen is in Original one day and in Cybertron
  the next. Original is the screen as it is now, in the layout of its theme. Cybertron has the same
  layout, drawn in plates of gunmetal and steel. Minimal has a banner across the top, a thin side
  column and one main panel, whatever the theme says (docs/layouts.md, "Styles"). The day starts at
  midnight in the Time zone on the Look page, and the style of the day is picked at the first
  change of look after midnight, or when the screen starts, so a screen that restarts is in the
  same style. One style in the list holds all the time. If the list is empty, the screen uses the old
  Style setting, which is hidden and keeps what was saved in it. A page published before the list
  existed has it empty, so the screen keeps its style until someone fills the list in.
- Monday style: the style while the Monday cards of a team are on the screen. Minimal to start with.
  A team with no Monday cards skips them.
- Team order: the teams, in the order they take the screen. Prime and then Nova to start with. Drag to
  change the order. Only teams that are switched on count. One team holds all the time. When the team
  changes, the name, the number, the logo, the colors and the mirror change together. If the list
  is empty, the screen uses the old Team mode setting, which is hidden too, with Minutes for each team,
  and so it does on a page published before the list existed.
- How the look changes: Assemble, Slats or Cut, with Assemble to start with. Assemble takes the screen
  apart and builds it again, from the first panel. Slats changes the panels with the slats turning and
  keeps the frames. Cut changes at once. Each waits until the large panel has been through its panels
  once, and never changes while an alert, an announcement or a talk has the screen. A change to or from
  Minimal reloads the screen once, whichever one is picked (docs/layouts.md, "The look rotation").
  To see the next look now, click Next look now on the Start here page. To see a style or a team
  for 2 minutes without saving anything, open the menu next to Publish (the three dots) and click Preview
  Prime, Preview Nova, Preview Cybertron or Preview Minimal, or add `?style=cybertron`, `?style=minimal`
  or `?team=nova` to the address, which stops the rotation on that page (docs/switch-the-look.md,
  docs/hidden-transitions.md, "Preview a look").
- Logo: everything the logo and the team name do. "Logo
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
  them. The screen glitch used to be in a tab called "Logo and effects". It is
  in the Screen tab now.
- Page changes: how the large and small panels change page, and what metal their
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

### Countdown

- Countdown: the labels and dates for Kickoff and Rollout. The countdown counts
  to Kickoff, then to Rollout. Its seconds change right on the second of the
  Mini's clock, so it keeps time with a phone however long the screen has been
  running. With the Cybertron and Minimal styles the same label and dates are in
  the war clock, with no IN: in the countdown's place with Cybertron, and at one end
  of the banner with Minimal.

### Calendars

- Calendars: give each calendar a name and choose whether it shows. A new Studio
  starts with one row, code team, named Team calendar. A calendar only shows
  events when it has a row here, with a code that matches the calendar on the
  Mini (the code team is CALENDAR_TEAM_URL there), and its "Show on screen"
  switch is on. The code is lowercase letters, digits and underscores. Do not
  change a calendar's code unless you were told to. If you delete every row, no
  events show. To add a calendar, see docs/calendar-links.md.

### Presentations

- Presentations: whether the TV takes over for booked talks (docs/presentations.md).
  "Run presentations" is the switch and starts on. The wait for the speaker (the
  title card waits 5 minutes for the first press of the clicker before the talk
  is skipped) and the overrun (a talk may run 5 minutes past its slot) are fixed,
  and are not shown. "Run presentation test" in the menu next to Publish (the
  three dots) starts a sample talk.

### Monday and Competition

- Monday and Competition: each tab has one line that says nothing is set up
  there yet. The Monday boards and the competition cards will be set up on these
  tabs.

### Advanced

- Night mode: the screensaver (docs/night-mode.md). From 11:30 pm to 11:30 am
  the screen is black with the team logo and the team number under it, and the
  picture is never turned off. "Use night mode" starts on. The two times are
  fixed, so there is nothing to set for them. They use the Time zone on the Look
  page, and there is no time zone here. "Night style" is Bouncing logo (the logo drifts round the
  screen, changes colour at every bounce and spins when it hits a corner) or
  Blank black. "Logo width (pixels)" is from 120 to 800 and starts at 300.
  "Bounce speed" is Slow, Normal or Fast, and a corner is hit about every 12, 6.5
  or 3.7 minutes. "Preview night mode" shows it now, whatever the time, even with
  "Use night mode" off: turn it on and publish to look, and turn it off and
  publish when you are done. Calm motion keeps the logo still in the middle. An
  alert or an announcement still shows over night mode.
- Hidden transitions: two rare surprise transitions that now and then replace a page change
  of the large panel (docs/hidden-transitions.md). "Allow hidden transitions" is
  the master switch and starts on. "Desktop reveal every (hours)" and "Red eyes
  every (hours)" say that it comes about once every this many hours of screen
  time, from 1 to 1000, and both start at 60. It is a chance, so 60 hours is an
  average and not a timetable. After one has played, none comes about by chance
  for 4 hours. To make one rarer, raise its hours. To stop them all, turn off
  "Allow hidden transitions". A settings page saved before the hours existed
  has them empty, and keeps its old percent until you fill them in and publish.
  In the desktop reveal the screen glitches blue, comes apart, cuts to a blue
  error screen for 3 seconds and comes back with the next pages. In red eyes it
  glitches red, breaks apart to black, shows a picture of two red eyes for a few
  seconds and comes back. Both end the same way: the frames fall into a pile at
  the bottom, a cube rises out of it, and the frames fly back to their places.
  Each has two pictures that take turns, and they can be
  swapped for others (docs/hidden-transitions.md).
  To play one now, open the menu next to Publish (the three dots) and click
  "Play desktop reveal" or "Play red eyes". Each publishes the page for you, and
  the TV plays it once within about 20 seconds, whatever the hours and the gap
  say. "Last push" shows which one was pushed and when, and you cannot type in
  it. Nothing
  here plays in Calm motion, or during an alert, an announcement, a demo or night
  mode, and with "Allow hidden transitions" off none plays at all, pushed or not.
- Connection: one switch, "Show connection status". It starts off. Turn it on
  to keep a small text at the bottom right of the screen with the time of the
  last read from Sanity, how many tasks, sponsors and other items there are, and
  the time the calendars were last read. The counts include items you have
  switched off or that have expired. It is for setting up or checking the
  screen, so turn it off again for everyday use. Whatever this says, the same
  text comes up in red by itself when the screen has not been able to reach
  Sanity for over two minutes, and says why (docs/rebuilding-the-mini.md,
  "Checking the connection"). A full screen alert or announcement covers it.
- Content source: it used to be a tab. The screen always shows what you
  publish now, so the field and "Switch back to production at" are hidden and
  the screen ignores them. A value saved in them stays in the document. To see
  the sample content, see "Sample content" below.

## Look

One page, like Dashboard Settings. It cannot be deleted or copied. A theme is
a set of colours for the whole screen. The style and the team are set in Dashboard
Settings, not here. The team gives the theme Hawktimus its main, accent, background
and text colors, and the other themes keep their own (docs/switch-the-look.md).
Hawktimus and the placeholder Alternate
change colours only: nothing moves or changes size. One theme, Neon Prime, also
changes where things sit: a column on the left with the team name, the clock,
the countdown and the logo, one big frame on the right and the ticker under it.
It has no small frame, so the small panels in the Panel order list in Dashboard
Settings are not used while it is on (the large panels are the whole rotation), and it has
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
  competition days and the first and last day of school yourself. A rule for a
  seasonal pack has three more fields, all optional. Ticker prefix (up to 12
  characters) goes before each line on the ticker. Banner line (up to 40 characters)
  is a short line in the banner, and a long one is cut off. Corner art is line art in
  the two cut corners: leaves, snowflakes, gears or fireworks, or None. Leave one
  empty and the pack's own is used, if it has one. Christmas has snowflakes,
  Thanksgiving leaves, Competition Day gears and New Year's fireworks.
- Time zone: the zone the dates are read in, such as America/New_York, which is
  where the page starts. The date changes at midnight in that zone, whatever
  the zone of the computer that shows the screen. The events use it too, for
  their dates and for when they are over.
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

One page, like Dashboard Settings. It cannot be deleted or copied, and it has no line in
the sidebar. It used to play a demo of the announcement and night mode, with Run demo
and Stop demo in the menu next to Publish. Those buttons are gone. The Start here page
has the buttons that try the screen now (see "The Start here page" above), and Play
announcement there plays the announcements. docs/demo.md says what is left.

- Steps: the screens to show, in order, up to 10, each with the seconds it stays
  (5 to 300). It starts with the Announcement for 30 seconds and then Night mode
  for 30 seconds.
- Demo announcement text: the words of the Announcement step, up to 24 characters.
  Leave it empty to use the first announcement in Dashboard Settings, or
  [DEMO ANNOUNCEMENT] if there is none.
- Requested at: the time a demo was last asked for. You cannot type in it, and
  nothing in Studio fills it in now.

## Sample content

The TV shows what you publish in Studio, and only that. Nothing in Studio
switches it to anything else. Sample content is made-up content that is kept
with the dashboard, with every piece of text in [square brackets]. It is for
trying the screen out on a computer, or for showing it to visitors before the
real content is ready.

To see it, put `?sample=1` on the end of the address of the dashboard in a
browser, for example `http://localhost:8080/dashboard/?sample=1`. Only that
page shows the sample. Close it or take the `?sample=1` off and the page is
back on what you published. The TV opens the address without it, so the TV
never shows the sample. Any value other than 1 is ignored.

- While a page shows sample content, a yellow SAMPLE CONTENT label sits beside
  the TEAM plate in the banner. It is never shown on what you published. A
  full screen alert or announcement covers it, like everything else.
- Sample content has both teams, Prime and Nova, so `?team=nova` shows Nova with
  its colors and its mirror. Its theme schedule has two example pack rules, named
  [Winter pack] and [Fall pack], with a ticker prefix, a banner line and corner art.
- Sample content comes with its own calendar and its own pictures. Nothing
  else is read from Studio while it is on, so your tasks, events, alert and
  the other settings do not show on that page.
- Dashboard Settings used to have Content source and "Switch back to production
  at", and two buttons in the menu next to Publish, "Use sample content" and
  "Use production content". They are gone. The two fields are hidden and the TV
  ignores them, so nothing already saved is lost.
