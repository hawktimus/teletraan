# Adding a field

For the students who maintain the Studio and the dashboard. The example adds
an optional "Room" field to tasks, up to 12 characters. Do the five steps in
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
- A Team choice (Both, Prime or Nova) is not added by hand. Use `teamField()` from
  `fields.js` and follow docs/team-on-an-item.md.

## 2. The content shape

The dashboard reads content shaped like dashboard/data/sample/content.json.
Add the name to a sample item with a marked placeholder:

    { "title": "[Task in progress]", "room": "[Room]", ... }

dashboard/core/sanity.js turns Sanity documents into this shape. Every field
of a task, sponsor, tip, subteam, person, plan (Up Next) or custom panel
comes through without any change there. A field nobody has filled in is missing, so every
panel must cope with that. There are three exceptions. A person's photo is not a
plain value. Its query line in `contentQuery` asks for the picture's address,
size, crop and hotspot, and `normalizePerson` cleans it. dashboard/core/images.js
builds the address the screen asks for. A new picture field would be done the
same way. A Photo document (the Photos list) is tidied in `normalizePhoto` in
dashboard/core/sanity.js, which copies only the fields it knows, so a new field
on a photo must be added to its part of `contentQuery` and to `normalizePhoto`.
An Events Calendar entry (type `extraEvent`) is tidied in `tidyExtraEvent` in
dashboard/core/events.js, which copies only the fields it knows, so a new field
on one must be added there as well.

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
no field. It also runs `tools/check-themes.mjs`, the colour check, and fails if
that fails.

## 5. The CSV templates

The CSV templates in docs/content-templates/ are made from the schemas, so the
new field needs a new column. Still in the studio folder, run:

    node scripts/make-templates.mjs

A field that editors must fill in (`Rule.required()`) also needs a sample value
in `examples` in studio/scripts/make-templates.mjs, under the field's name, or
the script stops and names the missing one. A new kind of content also needs a
line in `idColumns` there. Run `node tools/test-templates.mjs` from the top
folder. It fails if the templates are out of date. docs/importing-from-csv.md
explains the templates.

A new kind of content (a new file in `studio/schemas/`) also needs a line in
the sidebar, in `studio/structure.js`. `node check-schemas.mjs` fails until it
has one. See docs/reordering-the-sidebar.md.

## Where defaults live

- dashboard/config.js holds `defaultSettings`, `defaultTeam`,
  `defaultPerson` (the starting value of "Show photo on screen") and
  `defaultThemeSettings`. The dashboard uses them for anything the editors have
  not filled in.
- A schema's `initialValue` is what a new item starts with. It is used only
  when an item is created. Items that already exist do not get it, so the
  dashboard default still matters.
- For Dashboard Settings the starting values are copies of config.js. Change
  both. The check fails if they differ.

## Settings fields

A new setting goes in studio/schemas/dashboardSettings.js, and its default in
dashboard/config.js. Give it a one-line description, a starting value
(`initialValue`) and a validation rule with a smallest and a largest value. If
it is a switch, one of a few words or a number in a range, also add it to
`fixSettingValues` in dashboard/core/content.js, with its limits in `limits` in
config.js, so a missing or silly value becomes the default instead of reaching
a panel. The timing of the logo animations and the name effect (the Logo tab,
all in studio/schemas/settingsLogo.js), of the screen glitch (the Screen
tab), of night mode (the Night mode tab, all in
studio/schemas/settingsNight.js) and of the hidden transitions (the Hidden tab, all in
studio/schemas/settingsHidden.js, docs/hidden-transitions.md) is done this way. So are the switch and the two waits of the Presentations tab, all in
studio/schemas/settingsPresentations.js. So are the mode and the minutes of the Teams tab, both in
studio/schemas/settingsTeams.js. The lists of panels and announcements have their own
files, settingsRotation.js and settingsAnnouncements.js. A new field inside one
of those two lists must also be added to normalizeRotation or
normalizeAnnouncements in dashboard/core/sanity.js, which copy only the fields
they know.

Content source and Switch back to production at are the exception to "one
place": the screen asks Sanity for these two first, with its own small query,
`sourceQuery` in dashboard/core/sanity.js, before it reads anything else. They
are also in `defaultSettings`, because they are part of the settings document.
A new setting that decides which content the screen shows would have to be
added to `sourceQuery` and to `tidySourceSettings` in dashboard/core/source.js.
An ordinary setting needs neither.

The Theme page is a separate document, studio/schemas/theme.js, and its
starting values are `defaultThemeSettings` in dashboard/config.js. The screen
reads the whole document, and `tidyTheme` in dashboard/core/theme.js copies
only the fields it knows, so a new Theme field must be added there as well as
to the schema, to `defaultThemeSettings` and to `theme` in the contract in
studio/check-schemas.mjs. The list of themes and overlays in the schema comes
from studio/themes.js (docs/adding-a-theme.md).

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

1. dashboard/themes/hawktimus.css: add a colour, `--status-review`, next to
   the other `--status-` colours. (The two older ones are `--status-progress`
   for in-progress and `--status-next` for up-next.) Add it to every other
   theme file in dashboard/themes/ too, add its name to `requiredVariables` in
   dashboard/themes/required.js, and add the pair "`--status-review` on
   `--plate`" to `pairs` in tools/check-themes.mjs.
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

The order of `groups` matters. A page of the panel is three rows, a row holds
the tasks of one status, and a status with many tasks takes several rows. The
rows are shared out over pages that the panel shows one after another, so the
order of `groups` is the order on the pages. That is why Blocked is first, so a
blocked task is always on the first page, and Done is last. A new status that
must be on the first page belongs near the top of the list.

## Going live

The Studio editors use is a built copy. Run `npm run deploy` in the studio
folder to update it. The dashboard updates when the Mini next pulls the repo.
