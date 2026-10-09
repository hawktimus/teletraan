# Daily Agenda

For the coaches and students who write the plan for the day's meeting. Daily Agenda
is the panel headed AGENDA in the large frame. It shows the schedule for today's
meeting, and the talks booked for today (docs/presentations.md).

The code still says `plan` for the Studio type and `tonight` for the panel's folder
and its name in the saved Panels list. They are stored names, so they stay. The
file is still called up-next.md for the same reason.

## The schedule

In Studio open Daily Agenda, then Agenda items. Click the plus button of Agenda items,
or the plus button of Daily Agenda and pick Agenda item, and fill in the form:

- Heading: up to 26 characters, such as the kind of meeting.
- Date: the day the plan is for.
- Location: optional, up to 30 characters.
- Schedule: up to 5 rows. Each row has a Time (up to 9 characters, such as
  6:00 PM), What happens (needed, up to 18 characters) and Who leads it (optional,
  up to 10 characters).
- Show on screen and Hide after, like the other items.

The TV shows one plan: the first that is switched on, has not expired and is dated
today. A plan with no Date counts as today. A plan for another day is skipped, so
an old one that is still switched on does not hide today's. Make one plan for each
meeting, with its date.

## The talks

Talks booked for today share the panel with the schedule. The panel has 5 lines in
all, and the schedule keeps every row it has. The talks fill the lines that are
left.

- A talk line has the start time on the left, then the first name, a colon and the
  title. At the right it has the tag TALK. The text is cut to 18 characters with
  three dots, the same width as a schedule row.
- The talk that is on now has the tag NOW and comes first. The others follow,
  soonest first. A talk leaves the list when its slot is over.
- Only published talks with the status Scheduled show. A draft, a Cancelled talk
  and a Done talk do not. If Run presentations in the Presentations tab of
  Dashboard Settings is off, no talks show.
- If the talks do not all fit, the last line says how many are left out, such as
  +2 more. With only one line left and more than one talk, that line is all there
  is, and no talk is named.
- A schedule of 5 rows leaves no line, so no talk shows. On a day with talks, keep
  the schedule to 3 rows or fewer.
- With no plan for today and some talks, the heading on the card says Talks today.

Times are written in the Time zone on the Look page. With no plan for today and no
talks, the panel is left out of the rotation, as it was.

## Where the code is

- `studio/schemas/plan.js`: the fields and their limits.
- `dashboard/panels/tonight/tonight.js`: `rowsFor` works out the lines and
  `mount` draws them.
- `dashboard/core/presentation.js`: `canRun` says which talks count, the same
  ones that start on the TV.
- `tools/test-content.mjs`: the tests for the lines, the cutting and the empty
  panel.
