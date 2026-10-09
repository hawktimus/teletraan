# Teletraan I Studio

The editing screen for the dashboard, built with Sanity Studio. About ten team
members use it to change the tasks, the daily agenda, sponsors and other content on the
TV. The dashboard reads what they publish.

## What is here

    project.js            the project ID and dataset
    sanity.config.js      the Studio's main settings
    sanity.cli.js         settings for the command line tool
    structure.js          the sidebar, one list with a line for each entry, so changing the order means moving a line (a folder holds lines of its own, and Events Calendar, Places and Demo have no line)
    start-here.js         the Start here page, the first line of the sidebar, written as a plain function
    start-here-parts.js   the picture of the screen, the five buttons and their words, with no Studio in it, so node can test them
    screen-requests.js    what the request buttons write (Play announcement, Run presentation test, Next look now, Preview competition, the Play and Preview buttons), used by actions.js and the Start here page
    dashboard-address.js  the address that Preview the screen opens on the Start here page, with ?sample=1 for the sample content
    calendars-view.js     the Calendars page under Events, written as a plain function
    actions.js            the two content source buttons, the Play buttons of the hidden transitions, Play announcements, Run presentation test and the Preview buttons on Dashboard Settings
    themes.js             the list of themes and overlays, a copy of the dashboard's
    demo-screens.js       the list of screens a demo can show, a copy of the dashboard's
    hidden-transitions.js the list of hidden transitions, a copy of the dashboard's
    previews.js           the list of Preview buttons (Prime, Nova, Cybertron, Minimal, next pack), a copy of the dashboard's
    team-input.js         the Team radio (Both, then each active team) that the Team field of each kind of content uses
    schemas/              one file per kind of content
    scripts/              make-templates.mjs writes the CSV templates from the schemas,
                          import-csv.mjs turns filled-in CSVs into a file for sanity dataset import
    publish-all-tool.js   the Publish all page in the top bar (docs/publish-all.md)
    publish-all.js        the logic of Publish all, with no Studio in it, so node can test it
    check-schemas.mjs     a check that needs nothing installed
    package.json          the packages the Studio needs

Each file in schemas/ describes one kind of content: its fields, the text
shown beside each field, and the limits on length. See
docs/adding-a-field.md for how to change one.

## Setting it up on a Mac

The Sanity project already exists. Its ID is `ybfqe345` and its dataset is
called `production`. The ID is in project.js and in dashboard/config.js, and
`node check-schemas.mjs` fails if the two differ. A project ID is public (it
is part of every address the dashboard asks for), so it is fine to keep it in
the repository.

Do these once, in order. Steps 3 and 4 install packages and sign in to the
team's Sanity account, so they need the team mentor's yes first (see
docs/where-things-are.md).

1. Open the Terminal app: press Command+Space, type Terminal and press
   Enter.
2. Go to this folder. Type `cd ` with a space after it, drag the `studio`
   folder from Finder into the Terminal window, and press Enter. Check that
   Node.js is new enough with `node --version`. It must print v22.12 or
   higher. If it does not, install the current LTS version from nodejs.org
   (again, ask first).
3. Install the packages. This takes a few minutes the first time.

       npm install

4. Sign in to Sanity. A browser window opens. Sign in with the account that
   owns the project.

       npx sanity login

5. Start the Studio on this Mac. Open http://localhost:3333 in a browser. Leave
   the Terminal window open while you use it, and press Control+C in it to
   stop.

       npm run dev

6. Let the dashboard read from Sanity. In a browser go to sanity.io/manage,
   open the Teletraan project, choose API, then CORS origins, then Add CORS
   origin. Type `http://localhost:8080`, leave "Allow credentials" off, and
   save. Then add `http://localhost:3229` the same way. CORS is the browser
   rule that lets a web page read data from another website only when that
   website has listed the page's address. The first address is the test server
   on this Mac (`python3 tools/serve.py`) and the second is the Mini, whose web
   server answers on the port in `TELETRAAN_PORT` in deploy/local.env, 3229. If
   you ever change that port, add the new address as well.
7. Type some content into the Studio. Open Dashboard Settings first and click
   Publish. Then check the Announcements tab: the two starting rows, 14:30 and
   17:00, must be there, because a settings page saved without them plays no
   announcements. The Screen tab should show Frame metal on Gold with Glint on
   and Screen glitch on every 240 seconds, the Logo tab should show Logo
   animations on, Spin every 72 seconds, Flying hawk every 24 seconds and Name
   effect every 300 seconds, the Transitions tab should show Page change style
   on Alternate, Break and rebuild time 0.6, Frame finish on Mostly gold and
   Silver chance 10, the Panels tab should show Seconds per page at 20,
   the Photos tab should show Photo order on Random, Seconds per photo 16, and
   Portrait size and Photo size at 100,
   the Night mode tab should show Use night mode on, Bouncing logo, 23:30 to
   11:30, Logo width 300 and Normal speed with the preview off,
   the Hidden tab should show Allow hidden transitions on and both chances at 1,
   and the Content source tab should show Production.
   Add a few tasks, a sponsor and some tips, and click Publish on each.
   Studio keeps what you type as a draft, and the dashboard only reads what is
   published.
8. Check that the dashboard has switched over from the sample content.
   Content source in Dashboard Settings starts as Production, so within about
   30 seconds of step 7 the [square bracket] sample text is replaced by what
   you published and the SAMPLE CONTENT label goes. If it still shows the
   sample, open the menu next to Publish on the Dashboard Settings page and
   click "Use production content". A change you publish after this shows on
   the screen within a few seconds. Then set the fallback in
   dashboard/config.js for when the screen cannot read Dashboard Settings and
   has no saved copy of them, for example on the first start with no internet:

       export const useSampleContent = false;

   `false` shows the editors' content (and the connection status text if it
   cannot be read), `true` shows the sample. It switches nothing while the settings can be read.
9. Put the Studio online so the other editors can sign in from anywhere. The
   first time, it asks you to choose the Studio's address.

       npm run deploy

   Then invite each editor: on sanity.io/manage open the project and choose
   Members. Put the Studio's address into docs/editing-content.md.

The dataset has to stay public. The dashboard reads it without a key, so
nothing secret may be typed into Studio. Do not change the dataset to private.

Commands for later, run in this folder:

    npm run dev       opens the Studio on this computer, at http://localhost:3333
    npm run build     builds the Studio into a folder called dist
    npm run deploy    puts the latest Studio on the web (do this after changing a schema)

## The old Events Calendar entries

Events come from the BAND calendars now, and the screen does not read Events
Calendar entries. The kind of content stays in the Studio, so the entries
already typed still open and publish, but it has no line in the list on the left
and the New menu does not offer it (docs/editing-content.md). The seven events
from October 2026 to April 2027 are still in `docs/seed/extra-events.ndjson`.
There is no need to import them.

## The starting places

A task's location is a place, picked in the Location field of the task, where Create
new adds one (docs/editing-content.md). Places has no line in the list on the left.
The three starting places, Classroom, Programming room and Media center, are in
`docs/seed/places.ndjson`. After step 4, and with the team mentor's yes, import
them once from this folder:

    npx sanity dataset import ../docs/seed/places.ndjson --missing

`--missing` skips any place that is already there, so running it again changes
nothing. Do not use `--replace`.

## The starting teams

Teams is the list of the teams the screen can show. The two starting teams,
Hawktimus Prime and Hawktimus Nova, are in `docs/seed/teams.ndjson`. Prime has
the colors the screen has today. The Nova colors are placeholders until the team
has chosen its own. The file cannot carry a note, so this paragraph is the mark:
change them on the Nova team in Studio. After step 4, and with the team mentor's
yes, import them once from this folder:

    npx sanity dataset import ../docs/seed/teams.ndjson --missing

`--missing` skips any team that is already there, so running it again changes
nothing. Do not use `--replace`. Import the teams before any CSV that has a
team in it, because that CSV points at them.

## Adding many items from CSV files

To add a lot of content at once, fill in a copy of the CSV templates in
`docs/content-templates/`, check them with the script in this folder, then
import the result. With the team mentor's yes:

    node scripts/import-csv.mjs ~/Desktop/teletraan-csv
    npx sanity dataset import import.ndjson --missing

The first command checks every row against the limits in the schemas and
writes `import.ndjson`, or lists the rows that break a rule and writes nothing.
`--missing` skips anything that is already there, so a second run changes
nothing. docs/importing-from-csv.md has the steps. After you change a schema,
write the templates again with `node scripts/make-templates.mjs`.

## If the screen cannot read the content

After step 8, a small red text at the bottom right of the screen says SANITY
UNREACHABLE when the dashboard has not managed to read Sanity for over two
minutes. It keeps showing the last copy it saved, and the text says why: network
down, CORS blocked, access denied or other error. The Mini can also be checked
with one command, see "Checking the connection" in docs/rebuilding-the-mini.md.
Open the browser's console to see more.

- CORS BLOCKED, or a console message that mentions CORS: the origin from step 6
  is missing, or was typed differently from the address in the browser's
  address bar, for example `localhost` against `127.0.0.1`.
- The screen is up but empty: nothing is published yet (step 7).
- Anything else: use "Use sample content" in Dashboard Settings to get the
  screen working again, then ask the team mentor. If the screen cannot read
  Dashboard Settings either, set `useSampleContent` to `true` in
  dashboard/config.js.

## Sample and production content

Dashboard Settings has a Content source tab with two fields: Content source
(Production or Sample) and "Switch back to production at", an optional time.
Two buttons do the usual jobs. Open the menu next to Publish on the Dashboard
Settings page:

- "Use sample content" sets Content source to Sample and publishes. If a
  switch back time has already passed it is cleared, because a time that has
  passed would put the screen straight back on production.
- "Use production content" sets Content source to Production and publishes.

Each is one click. A button is switched off while the screen is already on that
kind of content, and shows "Switching..." while it works. Anything else on the
page that is not published yet is published too. The buttons are plain
functions in actions.js, added to the Dashboard Settings page only, in
sanity.config.js. Publish Dashboard Settings once (step 7) before you use them,
so the other settings keep their starting values.

How the screen behaves, in the order it does things:

1. It asks Sanity only for Content source and the switch back time. If Sanity
   does not answer in 5 seconds, or answers with an error, it uses the last
   answer it saved on that computer. With none saved it uses
   `useSampleContent` in dashboard/config.js. A good answer that says there is
   no Dashboard Settings yet means the defaults, which is production.
2. On production it reads everything from Sanity and listens for changes, as
   before. On sample it reads only dashboard/data/sample/ (the content, which
   has its own list of photos, and the calendar), and makes no other request
   to Sanity.
3. It asks again every 30 seconds, and looks at the clock every 5 seconds, so
   a change in Content source, or the switch back time arriving, takes effect
   without a reload, in either direction.
4. While it is on sample, a SAMPLE CONTENT label shows beside the TEAM plate.
   It is never shown on production.

## Photos

The Photos list in the sidebar (`schemas/photo.js`) holds the pictures for the
Photo panel. Each photo is a document with a Picture (an image the editors
upload, with the crop and hotspot tools on, images only), an optional Caption
of up to 36 characters, an optional Credit that is a first name of up to 14
characters (a space or a digit is refused), "Show on screen" and an optional
"Hide after". There is no approval field. The list is ordered newest first,
by `_createdAt`.

The dashboard reads the photos with the rest of the content (`photos` in
`contentQuery`, `dashboard/core/sanity.js`). It builds one address for each
photo that asks Sanity for the part the editor kept, no wider than 1920 pixels,
never enlarged, in a small format (`screenPhotoUrl` in
`dashboard/core/images.js`), and needs no CORS origin beyond the one in step 6.
The Photos tab of Dashboard Settings (`schemas/settingsPhotos.js`) has Photo
order (Random or Newest first), Seconds per photo (6 to 120, starting at
16), Portrait size and Photo size (each a whole percent from 60 to 100,
starting at 100, which is the full size). Nothing needs setting up beyond the steps above. Run `npm run deploy`
after you change `schemas/photo.js` or `schemas/settingsPhotos.js`, so the
editors see the change. docs/editing-content.md has the advice for the people
who upload: first names only, no last names in captions, location tagging off
on their phones. The CSV importer has no template for photos, because a
picture has to be uploaded in Studio.

## Night mode

The Night mode tab of Dashboard Settings (`schemas/settingsNight.js`) holds the
screensaver: Use night mode, Night style (a bouncing logo or blank black), the
start and end times (24 hour, 23:30 and 11:30 to start with), Logo width (120 to
800 pixels), Bounce speed and Preview night mode. It has no time zone of its own.
The dashboard uses the Time zone on the Look page, so the whole screen reads
the clock in one zone. Nothing needs setting up beyond the steps above. Run
`npm run deploy` after you change `schemas/settingsNight.js`, so the editors see
the change. docs/night-mode.md explains how it works.

## Hidden transitions

The Hidden tab of Dashboard Settings (`schemas/settingsHidden.js`) holds two rare
surprise transitions: Allow hidden transitions (the master switch), Desktop reveal
chance and Red eyes chance (percent of page changes, 0 to 100, both 1 to start with),
and Last push. Last push has two read only fields, kind and requestedAt, that the
Play buttons fill in. The menu beside Publish on Dashboard Settings has one button for
each transition, "Play desktop reveal" and "Play red eyes", from `actions.js`. Each
sets Last push to its kind and the time now, and publishes. They are plain functions
that use `useDocumentOperation`, made from the list in `hidden-transitions.js`, and
`sanity.config.js` puts them on Dashboard Settings after the two content source
buttons. The screen plays a push once, at its next page change or within about 20
seconds, while it is less than a minute old (`dashboard/core/hidden.js`). Nothing
needs setting up for it beyond the steps above. Run `npm run deploy` after you change
`schemas/settingsHidden.js` or `hidden-transitions.js`, so the editors see the change.
docs/hidden-transitions.md explains how it works and how to add a transition.

The Studio is built on its own and cannot read the dashboard folder, so
`hidden-transitions.js` is a copy of the ids, names and chance fields in
`dashboard/core/hidden-transitions.js`. `check-schemas.mjs` fails if they differ.

## Play announcements

The menu beside Publish on Dashboard Settings has one more button after the two Play
buttons: "Play announcements", `usePlayAnnouncementsAction` in `actions.js`. It sets
`announceRequest` to the time now and publishes. `announceRequest` is a hidden field
(`announceRequestField` in `schemas/settingsAnnouncements.js`): editors never see it, and
its value stays in the page. The screen plays every announcement that is switched on, once,
whatever its time and days, for a request that is under a minute old (`dashboard/core/announce.js`).
The Demo page has a step "All announcements" that does the same, which comes from the list in
`demo-screens.js`. Run `npm run deploy` after you change `schemas/settingsAnnouncements.js`, so
the editors see the button. docs/hidden-transitions.md explains how it works.

## Run presentation test

The last button on Dashboard Settings is "Run presentation test", `useRunPresentationTestAction`
in `actions.js`. It sets `presentationTestRequest` to the time now and publishes.
`presentationTestRequest` is a hidden field in the Presentations tab
(`presentationTestRequestField` in `schemas/settingsPresentations.js`). The screen runs the
sample talk with its six sample slides, for a request that is under a minute old
(`dashboard/core/presentation-test.js`). Run `npm run deploy` after you change
`schemas/settingsPresentations.js`, so the editors see the button. docs/hidden-transitions.md
explains how it works.

## Preview buttons

The last five buttons on Dashboard Settings are "Preview Prime", "Preview Nova", "Preview Cybertron",
"Preview Minimal" and "Preview next pack", `previewActions` in `actions.js`, made from the list in
`previews.js`. Each sets `previewRequest` to its kind and the time now, and publishes. `previewRequest`
is a hidden field in the Screen tab (`previewRequestField` in `schemas/settingsPreview.js`). The screen
holds that team, style or seasonal pack for 2 minutes, for a request that is under a minute old, and then
goes back to the saved settings (`dashboard/core/preview.js`). Nothing is saved to Dashboard Settings or
the Look page. `previews.js` is a copy of the ids and names in `previewKinds` in
`dashboard/core/preview.js`, and `check-schemas.mjs` fails if they differ. Run `npm run deploy` after you
change `schemas/settingsPreview.js` or `previews.js`, so the editors see the buttons.
docs/hidden-transitions.md explains how it works.

## Photos of people

Leadership has a Photo field, an image the editors upload in Studio, and a
"Show photo on screen" switch. Nothing needs setting up for it beyond the
steps above. The dashboard shows the photo from Sanity's image address, which
needs no CORS origin, and asks for it cut to the size it is shown. Run
`npm run deploy` after you change `schemas/person.js`, so the editors see the
change. docs/editing-content.md has the advice for the people who upload.

## Look

The Look page (`schemas/theme.js`) is a document that exists once, like
Dashboard Settings. It has the Default theme, "Use a theme now", a Schedule of
rules, a Time zone and a switch, "Seasonal pieces over the panels" (it starts on). The screen reads it with the rest of the content and
works out the theme in `dashboard/core/theme.js`. Nothing needs setting up for
it beyond the steps above. Run `npm run deploy` after you change `schemas/theme.js`
or `themes.js`, so the editors see the change.

The lists of themes and overlays come from `themes.js`. The Studio is built on
its own and cannot read the dashboard folder, so `themes.js` is a copy of
`dashboard/themes/registry.js` and `dashboard/themes/overlays/registry.js`.
`check-schemas.mjs` fails if the ids, names or descriptions differ. A theme that
has the sidebar layout (Neon Prime) has `layout: 'sidebar'` in both copies, the
check fails if they differ, and its description must say it has a sidebar and no
small frame (docs/layouts.md). The Look page lists show the theme names only, so
the descriptions of the Default theme, Use a theme now and the schedule's Theme
field say what a sidebar theme does, and the Small panels list in Dashboard
Settings says it is not used with one. To add a
theme or an overlay, see docs/adding-a-theme.md and
docs/adding-a-holiday-overlay.md. An overlay is shown to the editors as a
"Seasonal pack" (only the titles and descriptions say so, the stored values do
not change), and its `decorations` flag, which says whether it has a pack file in
`dashboard/seasons/`, is checked too (docs/seasonal-packs.md).

The Time zone is checked against the zones the browser knows
(`Intl.supportedValuesOf`), or against a plain pattern when the browser cannot
list them. It starts as America/New_York.

## Demo

The Demo page (`schemas/demo.js`) is a document that exists once, like Dashboard
Settings and Look. It has Requested at (read only), the Steps and the Demo
announcement text. It has no buttons and no line in the list on the left: Run demo and
Stop demo were taken out, and the Start here page has the buttons that try the screen. The type and its fields stay so
that the documents already in Studio open and publish as they were. The screen reads
the page with the rest of the content and plays a demo when Requested at is recent
(`dashboard/core/demo.js`), but nothing in Studio sets it now. Run `npm run deploy`
after you change `schemas/demo.js` or `demo-screens.js`, so the editors see the
change. docs/demo.md explains how it works and how to add a screen.

The list of screens comes from `demo-screens.js`. The Studio is built on its own and
cannot read the dashboard folder, so `demo-screens.js` is a copy of the ids and
names in `dashboard/core/demo-screens.js`. `check-schemas.mjs` fails if they differ.

## The packages

`npm install` adds these four packages.

- sanity: the Studio itself, and the `sanity` command
- react and react-dom: the Studio is built on React. There is no React code to
  write here.
- styled-components: the Studio uses it for its look. It has to be installed
  next to sanity and is not used directly.

`@sanity/icons`, the sidebar icons, comes with sanity and is not listed in
package.json. structure.js imports each icon from its own file.

## Checking the schemas

    node check-schemas.mjs

This needs no install. It loads every schema and checks it against what the
dashboard reads: every field exists with the right name and limit, every field
has a description, the starting values match dashboard/config.js, the two
content source buttons are on the Dashboard Settings page and do what they
say, the Look page agrees with `defaultThemeSettings` and needs a start and
an end for every rule, `themes.js` matches the dashboard's registries, the Demo
page agrees with `defaultDemo` and has no buttons, and `demo-screens.js`
matches the dashboard's list of demo screens, the Hidden tab agrees with
`defaultSettings`, has a working Play button for each hidden transition, and
`hidden-transitions.js` matches the dashboard's list, Play announcements has its hidden
field, its button and its Demo step, Run presentation test has its hidden field and its button,
the Preview buttons have their hidden field and a list that matches the dashboard's,
the sidebar has the headings, folders and icons it should, every kind of
content has a line or a reason in the check for having none, the New menu offers the
right kinds of content, and the project ID in project.js is
the one in dashboard/config.js. It prints PASS or
FAIL for each check and exits with an error if any fails. Run it after every
change to a schema.

The colours of the themes are checked by `tools/check-themes.mjs` in the top
folder, and `check-schemas.mjs` runs it too, so a theme that is missing a
colour or is hard to read fails here as well. It can also be run alone with
`node tools/check-themes.mjs` from the top folder.

The decorations of the seasonal packs are checked by `tools/check-seasons.mjs`,
and `check-schemas.mjs` runs that too, so an overlay that says it has decorations
and has no pack file fails here as well. It can be run alone with
`node tools/check-seasons.mjs` from the top folder (docs/seasonal-packs.md).
