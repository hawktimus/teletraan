# Reordering the sidebar

The list on the left of the Studio is one list in `studio/structure.js`, called
`sidebarEntries`. One line is one entry, from top to bottom. To change the
order, move a line.

## The three kinds of line

    { kind: 'list', title: 'Tasks', type: 'task', sort: byOrder },
    { kind: 'page', title: 'Theme', type: themeType, id: themeId },
    { kind: 'divider' },

- `list` opens the list of one kind of document. `title` is what editors read
  in the sidebar and at the top of the list. `type` is the document type, the
  `name` in its file in `studio/schemas/`. `sort` is how the list opens: by
  Order on screen (`byOrder`), by start date (`byStartDate`), by name
  (`byName`), by date with the newest first (`newestDateFirst`) or by upload
  with the newest first (`newestUploadFirst`). They are defined just above the
  list.
- `page` opens the one document of its type, which has a fixed id: Dashboard
  Settings, Theme and Demo. These three are the pages that exist once.
- `divider` is a thin line between groups.

Calendar events from BAND have no line, because they are not edited in the
Studio. Events that are not on BAND are the Events Calendar list.

## Change the order

1. Open `studio/structure.js`.
2. Cut a line and paste it where it should go. Keep the comma at the end.
3. To start a new group, add `{ kind: 'divider' },` between two lines.
4. In the `studio` folder, run `node check-schemas.mjs`. It should report no
   failures.
5. To see the new order, run `npm run dev` in the `studio` folder. Editors get
   it after the Studio is deployed (studio/README.md).

## Change a title

Change `title` on the line. The title is only words on the screen. Do not change
`type`: it is the name Sanity stores each document under, and the dashboard asks
for it by that name. The Events Calendar list, for example, is still the type
`extraEvent`.

## Add a new kind of content

A new document type needs a line in `sidebarEntries`, or editors cannot reach it.
`node check-schemas.mjs` fails and names the type when the line is missing. It
also fails when a line names a type that does not exist, such as one with a
spelling slip.

A type that is only an object inside another document, such as the blocks of a
Custom Panel, is not a document and has no line. If a document type should stay
out of the sidebar on purpose, add it to `notInSidebar` in
`studio/check-schemas.mjs`, with the reason.
