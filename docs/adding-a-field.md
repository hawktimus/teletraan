# Adding a field

For the students who maintain the Studio and the dashboard. The example adds
an optional "Sponsor since" field to sponsors, up to 4 characters, and shows it
on the Sponsor panel. docs/your-first-change.md does the same example with the
panel code, in the order you would type it. Do the six steps in order. Tasks are
not a good example any more: they are made by the Monday sync and not typed
(docs/monday.md), so a field on a task is a change to the sync as well.

## 1. The schema

Open studio/schemas/sponsor.js and add a field to the `fields` list:

    defineField({
      name: 'since',
      title: 'Sponsor since',
      type: 'string',
      description: 'The year the sponsor joined the team, such as 2019. Optional. Up to 4 characters fit.',
      validation: Rule => tooLong(Rule, 4),
    }),

- `name` is what the dashboard reads and what Sanity stores. Use camelCase and
  never change it later. Content already saved stays under the old name, and the
  screen would no longer find it. tests/stored-names.test.mjs fails when a stored
  name is renamed or removed (step 6).
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

    { "name": "[Sponsor name]", "since": "[Year]", ... }

dashboard/core/sanity.js and the parts that start with sanity- (sanity-query.js has the
query, sanity-content.js, sanity-people.js, sanity-settings.js and sanity-tasks.js
tidy what comes back) turn Sanity documents into this shape. Every field
of a sponsor, tip, subteam, person, plan (Daily Agenda) or extra panel
comes through without any change there. A task goes through normalizeTask in
sanity-tasks.js, which cleans the board fields, so read it before you add a task
field. A field nobody has filled in is missing, so every
panel must cope with that. There are three exceptions. A person's photo is not a
plain value. Its query line in `contentQuery` asks for the picture's address,
size, crop and hotspot, and `normalizePerson` cleans it. dashboard/core/images.js
builds the address the screen asks for. A new picture field would be done the
same way. A Photo document (the Photos list) is tidied in `normalizePhoto` in
dashboard/core/sanity-people.js, which copies only the fields it knows, so a new field
on a photo must be added to its part of `contentQuery` and to `normalizePhoto`. `contentQuery` is in
dashboard/core/sanity-query.js, and `normalizePerson` is in sanity-people.js too.

## 3. The panel

Open the panel that uses the content, here dashboard/panels/sponsor-feature/panel.js,
and show the field.

- Pass editor text through `escapeHtml` before it goes into a template.
- Never let a missing field print the word undefined.
- Make sure long text is cut with an ellipsis in the panel's stylesheet.

## 4. The check

Open tests/schemas.test.mjs and add the field to the contract, after the line that
starts `sponsor: withFlags({`:

    sponsor: withFlags({ name: text(19), tier: text(12), since: text(4), ... }),

Then run this in the top folder of the repository:

    node tests/run.mjs schemas

Every file must say ok. It fails if a field has no description, a limit is
missing or different from the contract, or the dashboard reads a name that has
no field. The colour check is its own file, tests/check-themes.test.mjs.

## 5. The CSV templates

The CSV templates in docs/content-templates/ are made from the schemas, so the
new field needs a new column. In the top folder, run:

    node studio/scripts/make-templates.mjs

A field that editors must fill in (`Rule.required()`) also needs a sample value
in `examples` in studio/scripts/make-templates.mjs, under the field's name, or
the script stops and names the missing one. A new kind of content also needs a
line in `idColumns` there. Run `node tests/templates.test.mjs` from the top
folder. It fails if the templates are out of date. docs/importing-from-csv.md
explains the templates.

A new kind of content (a new file in `studio/schemas/`) also needs a line in
the sidebar, in `studio/structure.js`. `node tests/run.mjs schemas` fails until it
has one. See docs/reordering-the-sidebar.md.

## 6. The list of stored names

Record the new name, so that nobody removes or renames it by accident later:

    node tests/stored-names.test.mjs --add

It writes the names the list does not have yet into tests/data/stored-names.txt and
never removes one. Commit that file with your change. To stop using a field, keep it
in the schema with `hidden: true` (see Settings fields, below). A removed name fails
`node tests/run.mjs stored-names` with a message that names it.

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
a panel. The timing of the logo animations and the name effect (in the Look
tab, all in studio/schemas/settingsLogo.js), of the screen glitch (the Screen
tab), of night mode (in the Advanced tab, all in
studio/schemas/settingsNight.js) and of the hidden transitions (in the Advanced tab, all in
studio/schemas/settingsHidden.js, docs/hidden-transitions.md) is done this way. So are the switch and the two waits of the Presentations tab, all in
studio/schemas/settingsPresentations.js. So are the mode and the minutes of Alternate in the Look tab, both in
studio/schemas/settingsTeams.js. The lists of panels and announcements have their own
files, settingsRotation.js and settingsAnnouncements.js. A new field inside one
of those two lists must also be added to normalizeRotation or
normalizeAnnouncements in dashboard/core/sanity-settings.js, which copy only the fields
they know. The rotation board has its own list of rows, rotationRows
(settingsRotationRows.js). A new field in one of its rows is kept by
tidyRotationRow in dashboard/core/rotation.js, which copies only the fields it
knows, and the default rows are in dashboard/config-rotation.js and, a second time,
in studio/tools/default-rotation.js (tests/default-rotation.test.mjs compares them).

Which content the screen shows is not a setting. It always shows what the
editors published, and `?sample=1` on the address shows the sample content for
that page (dashboard/core/source.js). Content source and Switch back to
production at are still fields in the schema, hidden, so that nothing saved is
lost, and the dashboard does not read them.

A field can be hidden the same way when a setting is retired: keep the field in
the schema with `hidden: true` and a description that says it is not used, and
take its name out of `defaultSettings` and `fixSettingValues`.

The Look page is a separate document, studio/schemas/theme.js, and its
starting values are `defaultThemeSettings` in dashboard/config.js. The screen
reads the whole document, and `tidyTheme` in dashboard/core/theme.js copies
only the fields it knows, so a new field on the Look page must be added there as well as
to the schema, to `defaultThemeSettings` and to `theme` in the contract in
tests/schemas.test.mjs. The list of themes and overlays in the schema comes
from studio/inputs/themes.js (docs/adding-a-theme.md).

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
   `--plate`" to `pairs` in tests/check-themes.test.mjs.
2. dashboard/core/marks.js: add a shape for `review` to `statusShapes`.
   Without one the task has an empty mark.
3. dashboard/base.css: add a `.mark-review` rule next to the other `.mark-`
   rules, so the shape gets the colour.
4. dashboard/panels/tasks/panel.css: add a `.status-review` rule for the
   colour of the group label.
5. dashboard/panels/tasks/panel.js: add the line
   `{ status: 'review', label: 'IN REVIEW' }` to `groups`. Its place in the
   list is its place on the screen.
6. dashboard/panels/task-counts/panel.js: if a task with this status is
   not finished, add it to `openGroups`, and give it a line colour in
   panels/task-counts/panel.css if it needs one.
7. studio/schemas/task.js: add `{ title: 'In review', value: 'review' }` to
   `statuses`. The order of that list is the order editors see.
8. tests/schemas.test.mjs: add `review` to the list for `task.status` in
   `choices`, and its title to the titles checked in `checkChoices`.
9. The content shape: sanity.js passes the status through as plain text, so
   nothing changes there. Add a task with the new status to
   dashboard/data/sample/content.json so you can see it.
10. The sync: a task is made from the Monday board, so the new status needs a label of the
    board's Status column. computer/scripts/monday-contract.sh has the table `status`, which
    turns the number of a label into the status word, and docs/monday.md says which label is
    which. A task typed by hand has no place on the screen, so a status that no board label
    reaches never shows.

The order of `groups` matters. A page of the panel is three rows, a row holds
the tasks of one status, and a status with many tasks takes several rows. The
rows are shared out over pages that the panel shows one after another, so the
order of `groups` is the order on the pages. That is why Blocked is first, so a
blocked task is always on the first page, and Done is last. A new status that
must be on the first page belongs near the top of the list.

## Going live

The Studio editors use is a built copy. Run `npm run deploy` in the studio
folder to update it. The dashboard updates when the Teletraan computer next pulls the repo.
