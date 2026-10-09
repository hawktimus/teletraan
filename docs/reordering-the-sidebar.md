# Reordering the sidebar

The list on the left of the Studio is one list in `studio/structure.js`, called
`sidebarEntries`. One line is one entry, from top to bottom. To change the
order, move a line.

The sidebar reads like this. A heading in capitals is a divider with a title, not
a folder. Daily Agenda and Settings are folders, and Presentations is a folder
inside Daily Agenda:

    Start here
    EVERY MEETING
      Daily Agenda
        Agenda items
        Presentations (Upcoming, Past)
        Meeting days
      Tasks
      Tips and News
    EVENTS
      Calendars
      Calendar filters
    ROSTER
      Leadership
      Team leads
      Sponsors
      Photos
    COACHES ONLY
      Settings
        Dashboard Settings
        Look
        Teams
      Extra panels

## The five kinds of line

    { kind: 'list', title: 'Tasks', icon: TaskIcon, type: 'task', sort: byOrder },
    { kind: 'page', title: 'Look', icon: ColorWheelIcon, type: themeType, id: themeId },
    { kind: 'group', title: 'Settings', icon: CogIcon, id: 'settings', entries: [ ... ] },
    { kind: 'component', title: 'Start here', id: 'startHere', icon: HomeIcon, component: StartHere },
    { kind: 'divider', title: 'EVERY MEETING' },

- `list` opens the list of one kind of document. `title` is what editors read
  in the sidebar and at the top of the list. `type` is the document type, the
  `name` in its file in `studio/schemas/`. `sort` is how the list opens: by
  Order on screen (`byOrder`), by name (`byName`), by date with the newest first
  (`newestDateFirst`), by upload with the newest first (`newestUploadFirst`), by
  the first talk of a meeting day (`byFirstTalk`), or by the start of a talk with
  the soonest first (`soonestStart`) or the latest first (`latestStart`). They are
  defined just above the list.
- `page` opens the one document of its type, which has a fixed id: Dashboard
  Settings and Look. A page opens the document itself, with no list of one in
  between. Demo is the third page that exists once, and it has no line.
- `group` is a folder. It opens a list of the lines under `entries`, one line
  each. A folder holds lists and pages, and one more folder, which holds lists
  only. Daily Agenda holds Agenda items, Presentations (Upcoming and Past) and
  Meeting days. Settings holds Dashboard Settings, Look and Teams.
- `component` opens a page that is not a document. `component` is a plain
  function that draws it. Start here is `StartHere` in `studio/start-here.js`
  and Calendars is `CalendarsView` in `studio/calendars-view.js`. A component
  line needs an `id`.
- `divider` is a thin line between groups. Give it a `title` and it is a
  heading, such as EVERY MEETING. Every divider in the sidebar has a title.

A folder can have `add`, a list of document types. The plus button of the
folder then offers a new document of each type. Daily Agenda has
`add: ['plan', 'presentation']`, so its plus button offers an Agenda item and a
Presentation. Each type needs a list inside the folder, so that the new document
is found there. The words in the menu are the titles of the types in
`studio/schemas/`, one document at a time: Agenda item and Presentation.

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

Events are not edited in the Studio. They come from the BAND calendars, and
Calendars is a page that explains them. Three kinds of content have no line:
Events Calendar (the type `extraEvent`, which the screen no longer reads), Places
(`place`, which a task's Location field adds and opens) and Demo (`demo`, whose
buttons are on Start here). They are kept in the schema so that nothing already
typed is lost. The status document (`status`) has no line either: the Mini writes
it, and the status block at the top of the Screen tab of Dashboard Settings shows it.

## Change the order

1. Open `studio/structure.js`.
2. Cut a line and paste it where it should go. Keep the comma at the end.
3. To start a new group, add `{ kind: 'divider', title: 'A HEADING' },` before
   its first line.
4. In the `studio` folder, run `node check-schemas.mjs`. It should report no
   failures. It also checks that the groups, the headings and their order are
   the ones above, so it fails when the order no longer matches. If the new
   order is the one you want, change `sidebarGroups` and `folderLines` in
   `studio/check-schemas.mjs` to match.
5. To see the new order, run `npm run dev` in the `studio` folder. Editors get
   it after the Studio is deployed (studio/README.md).

## Change a title

Change `title` on the line. The title is only words on the screen. Do not change
`type`: it is the name Sanity stores each document under, and the dashboard asks
for it by that name. The Agenda items list, for example, is the type `plan`, Team
leads is `subteam`, Extra panels is `customPanel` and Look is `theme`.

Words in the schema that name a list, such as a description that says "the
Team leads list", change with it. The title of the type, which the New menu and
the plus button show, follows the sidebar in the singular: Agenda item, Team
lead, Extra panel. `node check-schemas.mjs` fails when a title or a description
still uses a name the sidebar had before, and when the title of a type is not the
one it expects (`typeTitles` in `studio/check-schemas.mjs`).

## Add a new kind of content

A new document type needs a line in `sidebarEntries`, or editors cannot reach it.
`node check-schemas.mjs` fails and names the type when the line is missing. It
also fails when a line names a type that does not exist, such as one with a
spelling slip, and when a line has no icon.

A type that is only an object inside another document, such as the blocks of an
Extra panel, is not a document and has no line. If a document type should stay
out of the sidebar on purpose, add it to `notInSidebar` in
`studio/check-schemas.mjs`, with the reason. A type left out of the sidebar is
also left out of the New menu in the top bar: add it to `notOffered` in
`studio/sanity.config.js`. A type that a reference field must still be able to
create, as the Location field of a task does for a place, goes in
`offeredInDocuments` there instead, and the field keeps Create new.
