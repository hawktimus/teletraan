# Calendar filters

For the coaches who look after what the TV shows. The team's BAND calendars send
every event, including meetings that repeat every week. A Calendar filter is a
rule in Studio that takes some of those events off the TV, or keeps some on it.
Students can follow docs/hide-a-repeating-meeting.md for the usual case, which
starts with a button on the Calendars page.

Filters work on the BAND events, which are the only events the screen shows. A
calendar's own Show on screen switch in Dashboard Settings, Calendars comes
first. An event from a calendar that is switched off is gone before any rule
looks at it.

## The fields

Open Calendar filters in the sidebar, click the plus button and fill in the form.

- Rule name: up to 40 characters. It is only for editors. The Calendars page and
  the check script show it beside each event the rule hides. A name that starts
  with Hide: or Hide all: means the Calendars page made the rule, see "Rules made
  on the Calendars page" below.
- Action: Hide takes the matching events off the screen. Always show keeps them
  on, even when a Hide rule matches them. Hide is picked to start with.
- Pin to page one: only an Always show rule has it. Off to start with. On puts
  the events the rule matches first on page one of the Events panel, even when
  they are not one of the next 8. See "Pinning an event" below.
- Title words: optional, up to 5 words of up to 30 characters each. An event
  matches when its title has any one of them in it, capitals ignored. A word can
  be part of a longer word, so Kick matches Kickoff. Two spaces in a row, or a
  line break, count as one space in the title and in the word.
- Days: optional. Tick the days of the week the rule applies to. Leave every box
  empty for any day.
- Calendar: optional. The code of one calendar from Dashboard Settings,
  Calendars, such as group. Empty means every calendar.
- From date and To date: optional. The first and last day the rule applies. Both
  days count. To date cannot be before From date.
- Rule on: on to start with. Turn it off to stop the rule without deleting it.
- Hide after: optional date and time. After it the rule stops.

A rule needs at least one of Title words, Days, Calendar, From date or To date.
Studio will not publish one with none, because it would match every event.

## How a rule is read

- A rule matches an event when every condition it has matches. Title words
  Pre-Season with Days Monday and Thursday matches a Pre-Season event on a Monday
  or a Thursday. It does not match a Pre-Season event on a Tuesday, or another
  event on a Monday.
- Inside one list, such as Title words or Days, one match is enough. Between
  fields, all of them must match.
- A repeating event is judged one day at a time, after BAND's repeats are worked
  out. A rule for Mondays hides the Mondays and leaves the other days of the same
  repeating event.
- The day of an event is the day it starts, in the Time zone on the Look page. An
  event that starts on Thursday evening and ends after midnight is a Thursday
  event.
- An event is hidden when a Hide rule matches it and no Always show rule matches
  it. Always show wins. An event that no rule matches is shown, and with no rules
  every event is shown.
- Rules that are off, past their Hide after time or still drafts do nothing.

The Events panel and the Next event tile both use the list after the rules.

## Rules made on the Calendars page

The Calendars page in Studio, under Events, has a Hide this one and a Hide all like
this button on every event that the TV shows (docs/calendars-page.md). A button
makes a rule here, and it is published already. Rules whose name starts with Hide:
or Hide all: come from the Calendars page.

- Hide: with the title, a comma and the day is the rule of Hide this one. Title
  words is the title cut to 30 characters, Calendar is the calendar of the event,
  and From date and To date are both the day of the event.
- Hide all: with the title is the rule of Hide all like this. It has the same
  Title words and Calendar and no dates, so it applies to every day.
- The id of such a rule starts with `calendarFilter-hide-`. The page reads and
  deletes only rules with that id. Show again on the page deletes the rule and any
  draft of it. A rule you made yourself is never touched by the page, even when
  you name it Hide:.
- You can edit, switch off or delete these rules here like any other. The page
  follows: an event that a rule here hides says so, and Show again deletes the rule.
  If you add an Always show rule for the same event, it wins, as always.

## Pinning an event

The Events panel has two pages that come one after the other. Page one shows the
next 4 events and page two the 4 after them. An event that is later than the
eighth is on neither page yet. An Always show rule with Pin to page one on puts
its events on page one anyway.

- A pinned event is first on page one and has a small pin after its title. The
  pinned events are in date order among themselves. The other places on page one
  fill with the next events by date, as before. A pin takes a place from the 8,
  so page two starts one event later for each pin.
- At most three events are pinned. If more match, the three that start first are
  pinned. The rest are ordinary events and show only when they are among the
  next 8.
- A pin needs an Always show rule that is on and has not passed its Hide after
  time. Pin to page one on a Hide rule does nothing.
- A pinned event is first on page one whatever the kind of its calendar, also
  when Group events by kind is on (docs/editing-content.md, "The two pages of the
  Events panel").
- The screen reads each calendar 60 days ahead, so an event that is further off
  than that cannot be pinned yet.

## Examples

Each one is a rule with the fields that are listed. The rest stay empty.

- Hide the Pre-Season meetings on Mondays and Thursdays: Action Hide, Title words
  Pre-Season, Days Monday and Thursday.
- Keep Kickoff on the TV: Action Always show, Title words Kickoff. Use it beside a
  wide Hide rule that could catch a Kickoff event.
- Hide Pre-Season for the winter break: Action Hide, Title words Pre-Season, From
  date the first day of the break, To date the last day.
- Hide Pre-Season in one calendar only: Action Hide, Title words Pre-Season,
  Calendar group. The same title in another calendar stays.
- Hide everything on one day: Action Hide, From date and To date both that day.
- Keep Kickoff at the top of page one while it is weeks away: Action Always show,
  Pin to page one on, Title words Kickoff.

While the TV shows sample content it uses the two example rules in
`dashboard/data/sample/content.json`, not the ones in Studio.

## Checking the rules

The TV only follows published rules. The quickest way to see what a rule does is
the Calendars page in Studio, under Events. It lists the next 40 events of each
calendar, SHOWN or HIDDEN, with the name of the rule that hides each one
(docs/calendars-page.md). It changes after the next calendar run, within 15
minutes, and it lists the events only when Node is installed on the Mini.

To see every event of the next 30 days at once, run this on a computer that has
Node, a copy of the repository and a `deploy/local.env` with the calendar links.
The Mini has no Node, unless a coach installed it for the Calendars page.

    deploy/scripts/check-calendars.sh

It prints a line for each event, SHOWN or HIDDEN, and for a hidden one the name of
the rule that hid it. A SHOWN line also says where the event is on the Events
panel and the kind of its calendar, after the time and before the title:

    SHOWN   group  FRI APR 2  6:30 PM  page 1 pinned · Meetings  Kickoff

The place is page 1, page 1 pinned, page 2, later (the event shows, but it is not
among the first 8 yet) or no page (the calendar has no row in Dashboard Settings,
Calendars, or its row is switched off). The place counts all the calendars
together, so the script downloads every calendar before it checks any. It reads
the published rules from Sanity the way the TV does. It names each calendar by its
code and never prints a link. The lines are explained in
docs/rebuilding-the-mini.md, "Adding or changing a calendar".

## Where the code is

- `studio/schemas/calendarFilter.js`: the fields and the check that a rule has a
  condition.
- `dashboard/core/events.js`: `ruleMatches`, `hidingRule` and `forcingRule`.
  `mergeEvents` uses `hidingRule` on the BAND events.
- `dashboard/core/event-pages.js`: which events are on page one and page two,
  and which are pinned. In the code a pinned event is called forced, as the field
  is in Studio.
- `dashboard/core/sanity.js`: reads the rules with the rest of the content.
- `deploy/scripts/calendar-status.mjs`: judges the next events with the same code
  and the published rules, for the Calendars page.
- `studio/calendars-view-parts.js`: makes, matches and deletes the rules of the
  Hide buttons. `ruleMatchesEvent` there reads a rule the way `ruleMatches` does.
- `tools/test-calendars-hide.mjs`: runs both on the same cases.
- `tools/test-calendar.mjs`: the tests, run with `node tools/test-calendar.mjs`.
- `tools/test-event-pages.mjs`: the tests for the two pages, the kinds and the
  pins.
