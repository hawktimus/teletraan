# Adding a field

For the students who maintain the Studio and the dashboard. The example adds
an optional "Room" field to tasks, up to 12 characters. Do the four steps in
order.

## 1. The schema

Open studio/schemas/task.js and add a field to the `fields` list:

    defineField({
      name: 'room',
      title: 'Room',
      type: 'string',
      description: 'Where the work happens. Optional. Up to 12 characters fit.',
      validation: Rule => tooLong(Rule, 12),
    }),

- `name` is what the dashboard reads. Use camelCase and never change it later.
  Content already saved stays under the old name.
- `title` and `description` are what editors read. Plain words, one line.
- A text field must have a limit. Look at the panel to see how much text fits,
  use `tooLong(Rule, n)`, and write the number in the description as "Up to n
  characters fit." Measure with ordinary mixed case text, not a row of capitals.
- For other kinds of value use `type: 'number'`, `'boolean'`, `'date'` or
  `'datetime'`. A choice from a list uses `options: { list: [...] }`.
- To show the field in the lists on the left of Studio, add it to the
  `select` and `prepare` of the same file.

## 2. The content shape

The dashboard reads content shaped like dashboard/data/sample/content.json.
Add the name to a sample item with a marked placeholder:

    { "title": "[Task in progress]", "room": "[Room]", ... }

dashboard/core/sanity.js turns Sanity documents into this shape. Every field
of a task, sponsor, tip, subteam, person, plan or custom panel comes through
without any change there. A field nobody has filled in is missing, so every
panel must cope with that.

## 3. The panel

Open the panel that uses the content, here dashboard/panels/tasks/tasks.js,
and show the field.

- Pass editor text through `escapeHtml` before it goes into a template.
- Never let a missing field print the word undefined.
- Make sure long text is cut with an ellipsis in the panel's stylesheet.

## 4. The check

Open studio/check-schemas.mjs and add the field to the contract:

    task: withFlags({ title: text(22), room: text(12), ... }),

Then run this in the studio folder:

    node check-schemas.mjs

Every line must say PASS. It fails if a field has no description, a limit is
missing or different from the contract, or the dashboard reads a name that has
no field.

## Where defaults live

- dashboard/config.js holds `defaultSettings` and `defaultTeam`. The dashboard
  uses them for anything the editors have not filled in.
- A schema's `initialValue` is what a new item starts with. It is used only
  when an item is created. Items that already exist do not get it, so the
  dashboard default still matters.
- For Dashboard Settings the starting values are copies of config.js. Change
  both. The check fails if they differ.

## Settings fields

A new setting goes in studio/schemas/dashboardSettings.js, and its default in
dashboard/config.js. The lists of panels and announcements have their own
files, settingsRotation.js and settingsAnnouncements.js. A new field inside one
of those two lists must also be added to normalizeRotation or
normalizeAnnouncements in dashboard/core/sanity.js, which copy only the fields
they know.

When editors delete every row of a list, Sanity removes the list, and the
dashboard would then use the default list. To make an empty list mean none,
the query in dashboard/core/sanity.js has a line like
`"calendars": coalesce(calendars, [])` for the lists that editors can empty
(the two panel lists, announcements and calendars). A new list of that kind
needs the same line.

## Adding a task status

A task status is filed in several places. A status missing from one of them
shows as a task with no mark or no colour, or does not show at all. To add a
status called `review`, change all of these:

1. dashboard/tokens.css: add a colour, `--status-review`, next to the other
   `--status-` colours. (The two older ones are `--status-progress` for
   in-progress and `--status-next` for up-next.)
2. dashboard/core/marks.js: add a shape for `review` to `statusShapes`.
   Without one the task has an empty mark.
3. dashboard/base.css: add a `.mark-review` rule next to the other `.mark-`
   rules, so the shape gets the colour.
4. dashboard/panels/tasks/tasks.css: add a `.status-review` rule for the
   colour of the group label.
5. dashboard/panels/tasks/tasks.js: add the line
   `{ status: 'review', label: 'IN REVIEW' }` to `groups`. Its place in the
   list is its place on the screen.
6. dashboard/panels/task-counts/task-counts.js: if a task with this status is
   not finished, add it to `openGroups`, and give it a line colour in
   task-counts.css if it needs one.
7. studio/schemas/task.js: add `{ title: 'In review', value: 'review' }` to
   `statuses`. The order of that list is the order editors see.
8. studio/check-schemas.mjs: add `review` to the list for `task.status` in
   `choices`, and its title to the titles checked in `checkChoices`.
9. The content shape: sanity.js passes the status through as plain text, so
   nothing changes there. Add a task with the new status to
   dashboard/data/sample/content.json so you can see it.

The order of `groups` matters. The panel has room for three groups, each with
up to 2 tasks. When more than three statuses have tasks, the last ones in
`groups` are left out. That is why Blocked is first and Done is last. A new
status that must always show belongs near the top of the list.

## Going live

The Studio editors use is a built copy. Run `npm run deploy` in the studio
folder to update it. The dashboard updates when the Mini next pulls the repo.
