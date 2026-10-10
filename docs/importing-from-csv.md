# Importing content from CSV files

Use this to add many items at once, for example the tasks, team leads and
sponsors for a new season. You fill in a spreadsheet, a small script checks
it, and one Sanity command adds the items to the Studio.

It changes the real content that the TV shows, so ask the team mentor first.
It only adds items. It never changes or deletes an item that is already there.

## What you need

- The Studio set up and signed in, from a Mac (studio/README.md, steps 1 to 4).
  Step 2 there checks Node.js, which the script runs on.
- A spreadsheet program that can save a CSV file: Numbers, Excel or Google
  Sheets. A CSV file is a table saved as plain text, one row to a line.

## The templates

The folder `docs/content-templates/` has one CSV file for each kind of content.

| File | Studio sidebar |
| --- | --- |
| task.csv | Tasks |
| plan.csv | Agenda items, under Daily Agenda |
| extraEvent.csv | Events Calendar, which has no line in the sidebar and is not read by the screen |
| sponsor.csv | Sponsors |
| tipOrNews.csv | Tips and News |
| subteam.csv | Team leads |
| place.csv | Places, which has no line in the sidebar: a task's Location field adds them |
| person.csv | Leadership |
| customPanel.csv | Extra panels |

There is no template for the pages that exist once (Dashboard Settings, Look
and Demo), for Meeting days, Presentations or Calendar filters, and none for
photos. The pictures in Photos and the photo of a person in Leadership or of a
team lead are uploaded in Studio, so there is no photo template, and person.csv
and subteam.csv have no photo column.

Every template has three rows at the top:

1. The column names. They are the names of the fields in the schema.
2. What each column accepts: the type of value, the limits, and the choices.
   The script reads this row, so do not change it or delete it.
3. A sample row. Its first cell says EXAMPLE and the script skips it. Copy it
   to see what a finished row looks like. Words in [square brackets] are
   placeholders.

Your own rows start at row 4. The first column, called `example`, stays
empty on your rows.

These files are made from the schemas, so they are not edited by hand. Do not
fill in the files in the `docs` folder. Copy them first.

## Steps

### 1. Copy the templates you need

Make a new folder outside the project, for example `teletraan-csv` on the
Desktop, and copy the templates you want into it. A file that has only the
EXAMPLE row adds nothing, so a template you leave alone does no harm.

A task points to its subteam by name. The script only accepts a name that is in
a subteam file in the same folder, so keep subteam.csv with task.csv.

A task can also have a point of contact (`contact`, a first name of up to 12
characters) and a `location`, which is the name of a place. Both come just
before the team column at the end of task.csv, and both may be left empty. A
task file saved from the older template, without these two columns, still
imports. The script knows
the three starting places, Classroom, Programming room and Media center,
without a file (they are in `docs/seed/places.ndjson`), and any place in a
place.csv in the same folder. It ignores capitals, so `classroom` is fine. Any
other name is refused, with the row named. It cannot look in Studio, so a place
someone made there by hand is not known to it: leave the cell empty and pick
the place in the task in Studio, or add the place to place.csv if it is not in
Studio yet.

Every template except place.csv has a `team` column, last in all but task.csv and
subteam.csv. It is the code of the team the item is for: `prime` or `nova`, capitals ignored. Leave it empty to show
the item for both teams, which is what happens to anything that was added
before teams existed. A CSV saved from an older template, without the column,
still imports. The script knows the two starting teams without a file (they are
in `docs/seed/teams.ndjson`) and refuses any other code. The teams have to be in
Studio before the import, so import that file first (studio/README.md, "The
starting teams").

task.csv has columns after `team`. They are `priority` (`high`, `medium`
or `low`) and `showOnTv` (`yes` or `no`, and `yes` when the cell is empty). Both may be left
empty. A task file saved from a template without them still imports. A sheet has no column for
where a task comes from, so every task it makes is pinned.

subteam.csv has one column after `team`, `showPhoto` (`yes` or `no`, and `yes` when the cell is
empty). It is the "Show photo on screen" switch of a team lead. A subteam file saved from a
template without it still imports.

### 2. Make the cells plain text

Spreadsheet programs turn 2027-03-04 into a date of their own and write it
back differently, such as 3/4/2027, which the script refuses. So set the cells
to plain text before you type anything:

- Numbers: select the whole table, open the Format panel, choose the Cell tab,
  and set Data Format to Text.
- Excel: select everything, then in the Home tab set the Number format to Text.
- Google Sheets: select everything, then Format, Number, Plain text.

The EXAMPLE row may already have been changed when the file opened. That does
not matter, because the script skips it.

### 3. Fill in the rows

One row is one item. Write each kind of value like this:

| Row 2 says | Write | For example |
| --- | --- | --- |
| text; max 22 | Words, up to the limit | Wire the robot |
| yes/no | yes or no | yes |
| whole number | A number with no decimals | 3 |
| date | Year, month, day | 2027-03-04 |
| time | 24 hour time, two digits for the hour | 18:30 |
| datetime | A date, a space, a time | 2027-03-04 18:30 |
| web address | An address that starts with https:// | https://example.com/logo.png |
| one of tip/news/reminder | One of the words, spelled exactly | tip |
| name of subteam | The name of the subteam, as in subteam.csv | Build |
| name of place | The name of the place, as in place.csv or the starting places | Classroom |

Some more things to know:

- A list of lines (the list block of an extra panel, or the members of a
  subteam) is one cell. Put a vertical bar between the lines, like
  `Drill | Saw | Tape`. Row 2 says how many lines and how long each may be.
- A cell with `required` in row 2 must be filled in. The script says which
  row and column is empty.
- Leave a cell empty to leave the field out. An empty yes/no cell gets what
  Studio gives a new item, for example "Show on screen" is yes, so an item you
  do not touch is shown. A field that is required never gets this.
- A date and a time written together are read in the time zone of the Mac you
  run the script on.
- Text may hold commas and quotation marks. The spreadsheet takes care of it
  when it saves the CSV.
- The limits are the same ones the Studio enforces, and they are what fits on
  the screen.

Two kinds of content hold a list, so their columns come in numbered groups.

**Agenda items** have up to 5 schedule rows. Group 1 is `rows.1.time`,
`rows.1.text` and `rows.1.lead`, group 2 is `rows.2.time` and so on. Leave a
group empty and it is left out. If you fill in anything in a group, its text
is needed.

**Extra panels** have up to 6 blocks. Each block is a group that starts with
`blocks.1._type`, where you pick the kind of block. The other columns of the
group are used by some kinds and left empty by the rest:

| Kind of block (`_type`) | Columns it uses |
| --- | --- |
| headingBlock | text |
| textBlock | text |
| statBlock | value, label |
| listBlock | items |
| imageBlock | address |
| progressBlock | label, percent |
| countdownBlock | label, target |

A limit in row 2 that belongs to one kind says so, for example `max 30 if
headingBlock`. The script refuses a cell that its kind of block does not use.

### 4. Save each file as CSV

Save over the copy in your folder, with the same file name:

- Numbers: File, Export To, CSV. If it asks whether to include table names,
  say no.
- Excel: File, Save As, and choose CSV UTF-8 (Comma delimited).
- Google Sheets: File, Download, Comma Separated Values (.csv).

Leave rows 1 and 2 as they are.

### 5. Check the files

Open the Terminal app and go to the `studio` folder: type `cd `, with a space
after it, drag the `studio` folder from Finder into the window and press
Enter. Then type `node scripts/import-csv.mjs `, with a space after it, drag
your folder into the window and press Enter:

    node scripts/import-csv.mjs ~/Desktop/teletraan-csv

If every row is fine, it writes a file called `import.ndjson` in the studio
folder and says how many items it holds.

If a row breaks a rule, it writes nothing. It lists every problem with the file,
the row and the column, like this:

    task.csv, row 4, column title: 27 characters, up to 22 fit
    task.csv, row 6, column status: write one of: blocked, in-progress, up-next, done

The row number is the one your spreadsheet shows. Fix the cells, save the CSV
again and run the same command again. Nothing has been added to Sanity yet, so
you can repeat this as often as you like.

### 6. Add the items to Sanity

From the same `studio` folder, run:

    npx sanity dataset import import.ndjson --missing

`--missing` skips any item whose id already exists, so running it again
changes nothing. Do not use `--replace`: it would put the file's text back over
anything an editor has changed in Studio since. docs/editing-content.md
explains the command in more detail.

The items are published as soon as they are imported. Open Studio and look
through them. You can delete `import.ndjson` afterwards.

## How a row becomes an item

Each item gets a fixed id made of its type and the words in a few columns, so
the same row always makes the same item:

| Type | Words used for the id |
| --- | --- |
| task | title |
| plan | date, heading |
| extraEvent | startDate, title |
| sponsor | name |
| tipOrNews | text |
| subteam | name |
| place | name |
| person | role, name |
| customPanel | title |

So a task called "Wire the robot" has the id `task-wire-the-robot`. Capitals
and punctuation do not matter. Two rows that make the same id are refused,
because one would replace the other. Change a word in a CSV and import again
and you get a new item next to the old one, not a changed one.

The script cannot see items that someone made by hand in Studio, because those
have random ids. If Studio already has a subteam called Build, importing a row
named Build adds a second one. Look in Studio first.

## Changing the templates

The templates are written by `studio/scripts/make-templates.mjs` from the real
schemas in `studio/schemas/`, so the limits in row 2 always match the Studio.
After you change a schema (docs/adding-a-field.md), write them again from the
`studio` folder:

    node scripts/make-templates.mjs

If the new field is required, add a sample value for it to `examples` in
make-templates.mjs, or the script stops and says which one is missing. A new
kind of content also needs a line in `idColumns`, the columns that name an item.

The test `node tools/test-templates.mjs` fails if the files in
`docs/content-templates/` are out of date, and it checks the importer with a
few good rows, a rejected row and cells that hold commas and quotation marks.
