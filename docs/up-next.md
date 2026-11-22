# Daily Agenda

For the coaches and students who write the plan for the day's meeting. Daily Agenda
is the panel headed AGENDA in the large frame. It shows the schedule for today's
meeting.

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

Talks are not listed here. They used to share the panel with the schedule, when
they were booked in Studio. A deck is played from the Google Drive folder now
(docs/presentations.md).

Times are written as typed on the plan. With no plan for today, the panel is left
out of the rotation.

## Where the code is

- `studio/schemas/plan.js`: the fields and their limits.
- `dashboard/panels/tonight/panel.js`: `rowsFor` works out the lines and
  `mount` draws them.
- `tests/content.test.mjs`: the tests for the lines, the cutting and the empty
  panel.
