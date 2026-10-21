# Calendar filters

For the coaches who look after what the TV shows. The team's BAND calendars send
every event, including meetings that repeat every week. A Calendar filter is a
rule in Studio that takes some of those events off the TV, or keeps some on it.
Students can follow docs/hide-a-repeating-meeting.md for the usual case. To hide a
single event, use the switch on the Calendars page instead (docs/calendars-page.md).

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
- Applies to: Every matching event is the usual rule. One event is made by the
  Calendars page. The three fields that follow show only for it: Event calendar,
  Event title and Event start. See "One event rules" below.

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

## What is public

The dataset is public. A rule is a document in it, so its name, words and dates can be read by anyone who asks.
The Mini lists the coming events in a document for the Calendars page, and it leaves out the title of an event a
rule hides (docs/calendars-page.md, "Who can read it"). Name a rule for the reason, such as Hide: Practice, and
keep private words out of its name and its words.

## One event rules

The Calendars page in Studio, under Events, has a Show and Hide switch on every
coming event (docs/calendars-page.md). Hiding an event makes a draft rule here
with Applies to set to One event.

- It matches one event by its calendar code, its exact title and its exact start,
  and by nothing else. Title words, Days, Calendar and the dates are not used. The
  title is judged as the Calendars page lists it: on one line and cut at 60
  characters. Capitals count.
- Action is Hide. Showing an event that another rule hides makes the same kind of
  rule with Action Always show, and Always show wins as always.
- Hide after is set to a day after the event ends, so the rule stops by itself. It
  stays in the list until someone deletes it. Delete old ones now and then.
- The name starts with One event and the id with `calendarFilter-one-`.
- It is a draft until you click Publish all. Undo on the page withdraws it. You can
  also edit, switch off or delete it here like any other rule.
- A one event rule with the calendar, the title or the start empty is not
  published by Studio, and the TV ignores one like that.

## Rules from the older Hide buttons

Earlier versions of the Calendars page had Hide this one and Hide all like this
buttons. Rules whose name starts with Hide: or Hide all: come from them. They are
published, they still work, and they are ordinary rules: Hide: has the title, a
comma and the day, and Hide all: has the title and no dates. Their ids start with
`calendarFilter-hide-`. Edit, switch off or delete them here.

## Pinning an event

The Events panel has two pages, and the list scrolls from the first to the second. Page one shows the
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
the Calendars page in Studio, under Events. It lists the coming events of each
calendar, with whether the TV shows each one and the name of the rule that hides it
(docs/calendars-page.md). It changes after the next calendar run, within 15
minutes, and it lists the events only when Node is installed on the Teletraan computer.

To see every event of the next 30 days at once, run this on a computer that has
Node, a copy of the repository and a `computer/local.env` with the calendar links.
The Teletraan computer has no Node, unless a coach installed it for the Calendars page.

    computer/scripts/check-calendars.sh

It prints the kind of each calendar on a KIND line (no chip when the calendar has
none), a line for each event, SHOWN or HIDDEN, and for a hidden one the name of
the rule that hid it. A SHOWN line also says where the event is on the Events
panel and the kind of its calendar, after the time and before the title, or no
chip when the calendar has no kind:

    KIND    group  Meetings
    SHOWN   group  FRI APR 2  6:30 PM  page 1 pinned · Meetings  Kickoff

The place is page 1, page 1 pinned, page 2, later (the event shows, but it is not
among the first 8 yet) or no page (the calendar has no row in Dashboard Settings,
Calendars, or its row is switched off). The place counts all the calendars
together, so the script downloads every calendar before it checks any. It reads
the published rules from Sanity the way the TV does. It names each calendar by its
code and never prints a link. The lines are explained in
docs/rebuilding-the-computer.md, "Adding or changing a calendar".

## Where the code is

- `studio/schemas/calendarFilter.js`: the fields and the check that a rule has a
  condition.
- `dashboard/core/events.js`: `ruleMatches`, `hidingRule` and `forcingRule`.
  `mergeEvents` uses `hidingRule` on the BAND events.
- `dashboard/core/event-pages.js`: which events are on page one and page two,
  and which are pinned. In the code a pinned event is called forced, as the field
  is in Studio.
- `dashboard/core/sanity.js`: reads the rules with the rest of the content.
- `computer/scripts/calendar-status.mjs`: judges the next events with the same code
  and the published rules, for the Calendars page.
- `studio/inputs/calendars-list-parts.js`: makes and withdraws the one event rules
  and judges each event. `ruleMatchesEvent` in `calendars-hide-rules.js` reads a
  usual rule the way `ruleMatches` does.
- `tests/calendars-hide.test.mjs` runs both on the same cases.
  `tests/calendar-one-event.test.mjs` tests the one event rules.
- `tests/calendar.test.mjs`: the tests, run with `node tests/calendar.test.mjs`.
- `tests/event-pages.test.mjs`: the tests for the two pages, the kinds and the
  pins.
