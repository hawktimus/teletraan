# A team on an item

For everyone who adds content, and for the students who add a kind of content.
Most things you type in Studio can be for one team or for both. The Team field
says which. Empty means Both.

## The field

These have a Team field: Tasks, Up Next, Roster, Leadership, Sponsors, Tips and
News, Extra panels, Events Calendar entries, Meeting days and booked talks. It is
a row of choices: Both, then one for each team that is Active under Teams, with the
name of the team. Both is picked to start with, and it stores nothing.

An item made before teams existed has no team, so it shows for both teams. Nothing
needs to be moved or edited. If the Teams cannot be read when you open an item, the
field shows only Both, with a note. A team that is already picked stays on the list,
so you can see it and change it.

## What the screen does

An item shows when its team is empty or is the team on the screen. One function
decides this, `visibleItems` in `dashboard/core/content.js`, and every panel takes
its items through it. It leaves out hidden items and expired items in the same
step. No panel checks the team itself.

- With Team mode on Prime only, the screen shows the items for Prime and for Both.
- With Nova only, it shows the items for Nova and for Both.
- With Alternate, the items change with the team. They change in the same step as
  the name and the colors, at a page change, so a panel is never rebuilt in the
  middle of a page.

Items with Both keep the screen full for either team. Put the things the whole
club needs, such as a sponsor or a safety tip, on Both.

## What does not have a Team

These are the same for both teams: the countdown, the weather, the BAND events, the
Calendar filters, photos and safety days. A photo has no Team field, so every photo
shows for both teams.

## Things to know

- The Open Tasks tile of the task counts panel counts only the tasks that show for
  the team on the screen.
- Up Next shows the first plan that is dated today and is for the team on the screen.
  A plan for the other team is skipped.
- The talks in Up Next are the ones for the team on the screen. A talk for the other
  team is not listed there, but it still runs at its start time, whichever team is
  showing, because a booked talk takes the whole screen.
- A subteam lead's portrait on Team Leads and Subteam roster is the person in
  Leadership with the same name. If that person is for the other team, the lead
  shows the silhouette.
- A Meeting day has the field, but the screen does not read Meeting days, so a team
  on a Meeting day changes nothing on the screen.
- A team that has been deleted counts as no team, so its items show for both.
- In the CSV templates the last column is `team`: `prime`, `nova` or empty
  (docs/importing-from-csv.md).

## Add the field to another kind of content

The example gives Photos a Team field. Do the steps in order.

1. In `studio/schemas/photo.js`, import `teamField` from `./fields.js` and add
   `teamField()` to the end of `fields`. It carries its own description and the
   Both radio.
2. In `studio/check-schemas.mjs`, add `photo` to `teamTypes`. The check fails for a
   kind that has the field and is not in the list, and for one in the list that has
   no field.
3. In `contentQuery` in `dashboard/core/sanity.js`, add `"team": team->code` to the
   query line of the kind, as `sponsors` has it. The screen compares the code of the
   team, not the reference.
4. A kind that has its own tidying function copies only the fields it knows. Photos
   have `normalizePhoto`: add `team: raw.team` to the fields it copies and pass the
   result through `withTeamCode`. Tasks, sponsors, tips, subteams, people, plans,
   Events Calendar entries and extra panels go through `itemsFrom`, which does it
   already.
5. In the panel, take the items through `visibleItems` from `core/content.js`. The
   Photo panel already does, so it needs nothing. Do not compare the team in a panel.
6. Add `"team": "nova"` to one sample item in `dashboard/data/sample/content.json`,
   so the sample shows the filter. If the kind has a CSV template, run
   `node scripts/make-templates.mjs` in the `studio` folder, and then the checks in
   docs/where-things-are.md, "Checking your work".

To see it, add `?team=nova` to the address of the sample content and look for the
item, then use `?team=prime`.

## Where the code is

- `studio/schemas/fields.js`: `teamField`.
- `studio/team-input.js`: the radio.
- `dashboard/core/teams.js`: `showsForTeam`, which compares the code.
- `dashboard/core/content.js`: `visibleItems`.
- `dashboard/core/sanity.js`: `withTeamCode`, which turns the code into the item's
  `team` or leaves it out.
- `tools/test-content.mjs`: the tests for the filter on every kind of content.
