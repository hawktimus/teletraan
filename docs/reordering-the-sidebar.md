# Reordering the sidebar

The list on the left of the Studio is one list in `studio/structure.js`, called
`sidebarEntries`. One line is one entry, from top to bottom. To change the
order, move a line.

The sidebar reads like this. A heading in capitals is a divider with a title, not
a folder, and Presentations is the one line that opens a list of lists:

    Start here
    EVERY MEETING
      Up Next, Tasks, Tips and News
    EVENTS
      Events Calendar, Calendars, Calendar filters, Presentations
        (Meeting days, Upcoming, Past)
    THE TEAM
      Roster, Leadership, Sponsors, Photos
    COACHES ONLY
      Dashboard Settings, Look, Teams, Locations, Extra panels, Test the screen

## The five kinds of line

    { kind: 'list', title: 'Tasks', icon: TaskIcon, type: 'task', sort: byOrder },
    { kind: 'page', title: 'Look', icon: ColorWheelIcon, type: themeType, id: themeId },
    { kind: 'group', title: 'Presentations', icon: PresentationIcon, id: 'presentations', entries: [ ... ] },
    { kind: 'component', title: 'Start here', id: 'startHere', icon: HomeIcon, component: StartHere },
    { kind: 'divider', title: 'EVERY MEETING' },

- `list` opens the list of one kind of document. `title` is what editors read
  in the sidebar and at the top of the list. `type` is the document type, the
  `name` in its file in `studio/schemas/`. `sort` is how the list opens: by
  Order on screen (`byOrder`), by start date (`byStartDate`), by name
  (`byName`), by date with the newest first (`newestDateFirst`), by upload
  with the newest first (`newestUploadFirst`), by the first talk of a meeting
  day (`byFirstTalk`), or by the start of a talk with the soonest first
  (`soonestStart`) or the latest first (`latestStart`). They are defined just
  above the list.
- `page` opens the one document of its type, which has a fixed id: Dashboard
  Settings, Look and Test the screen. These three are the pages that exist
  once. A page opens the document itself, with no list of one in between.
- `group` opens a list of lists. Its lines are under `entries`, one line each,
  and each is a `list` line. Presentations is one: Meeting days, Upcoming and
  Past.
- `component` opens a page that is not a document. `component` is a plain
  function that draws it. Start here is `StartHere` in `studio/start-here.js`
  and Calendars is `CalendarsView` in `studio/calendars-view.js`. A component
  line needs an `id`.
- `divider` is a thin line between groups. Give it a `title` and it is a
  heading, such as EVERY MEETING. Every divider in the sidebar has a title.

Every line except a divider has an `icon`, and no two lines share one. The icons
come from `@sanity/icons`, which comes with the Studio and is not listed in
`studio/package.json`. Import each one from its own file, as the top of
`structure.js` does:

    import { TaskIcon } from '@sanity/icons/Task';

The icons are listed by name at icons.sanity.dev. Do not import from
`'@sanity/icons'` alone: the package no longer lists the icons in its main file.

A `list` line can have a `filter`, which keeps some of the documents of its
type. Upcoming and Past are both the type `presentation`, so each has an `id`
of its own. In a filter, `$since` is the time a day ago, worked out when the
sidebar opens. Do not use `now()`: Studio keeps a list live, and a live filter
cannot use it.

Calendar events from BAND have no line of their own in the document lists,
because they are not edited in the Studio. Events that are not on BAND are the
Events Calendar list. Calendars is a page that explains the BAND calendars.

## Change the order

1. Open `studio/structure.js`.
2. Cut a line and paste it where it should go. Keep the comma at the end.
3. To start a new group, add `{ kind: 'divider', title: 'A HEADING' },` before
   its first line.
4. In the `studio` folder, run `node check-schemas.mjs`. It should report no
   failures. It also checks that the groups, the headings and their order are
   the ones above, so it fails when the order no longer matches. If the new
   order is the one you want, change `sidebarGroups` in
   `studio/check-schemas.mjs` to match.
5. To see the new order, run `npm run dev` in the `studio` folder. Editors get
   it after the Studio is deployed (studio/README.md).

## Change a title

Change `title` on the line. The title is only words on the screen. Do not change
`type`: it is the name Sanity stores each document under, and the dashboard asks
for it by that name. The Events Calendar list, for example, is still the type
`extraEvent`, Roster is still `subteam`, Locations is `place`, Extra panels is
`customPanel`, Look is `theme` and Test the screen is `demo`.

Words in the schema that name a list, such as a description that says "the
Locations list", change with it. `node check-schemas.mjs` fails when a title or a
description still uses a name the sidebar had before.

## Add a new kind of content

A new document type needs a line in `sidebarEntries`, or editors cannot reach it.
`node check-schemas.mjs` fails and names the type when the line is missing. It
also fails when a line names a type that does not exist, such as one with a
spelling slip, and when a line has no icon.

A type that is only an object inside another document, such as the blocks of an
Extra panel, is not a document and has no line. If a document type should stay
out of the sidebar on purpose, add it to `notInSidebar` in
`studio/check-schemas.mjs`, with the reason.
