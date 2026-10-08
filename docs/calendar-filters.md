# Calendar filters

For the coaches who look after what the TV shows. The team's BAND calendars send
every event, including meetings that repeat every week. A Calendar filter is a
rule in Studio that takes some of those events off the TV, or keeps some on it.
Students can follow docs/hide-a-repeating-meeting.md for the usual case.

Filters work on BAND events only. Events Calendar entries typed into Studio are
never filtered: to take one down, turn off its Show on screen switch. A
calendar's own Show on screen switch in Dashboard Settings, Calendars comes
first. An event from a calendar that is switched off is gone before any rule
looks at it.

## The fields

Open Calendar filters in the sidebar, click the plus button and fill in the form.

- Rule name: up to 40 characters. It is only for editors. The check script prints
  it beside each event the rule hides.
- Action: Hide takes the matching events off the screen. Always show keeps them
  on, even when a Hide rule matches them. Hide is picked to start with.
- Title words: optional, up to 5 words of up to 30 characters each. An event
  matches when its title has any one of them in it, capitals ignored. A word can
  be part of a longer word, so Kick matches Kickoff.
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
- The day of an event is the day it starts, in the Time zone on the Theme page. An
  event that starts on Thursday evening and ends after midnight is a Thursday
  event.
- An event is hidden when a Hide rule matches it and no Always show rule matches
  it. Always show wins. An event that no rule matches is shown, and with no rules
  every event is shown.
- Rules that are off, past their Hide after time or still drafts do nothing.

The Events panel and the Next event tile both use the list after the rules.

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

While the TV shows sample content it uses the two example rules in
`dashboard/data/sample/content.json`, not the ones in Studio.

## Checking the rules

The TV only follows published rules. To see what it does with each event of the
next 30 days, run this on a computer that has Node, a copy of the repository and
a `deploy/local.env` with the calendar links. The Mini has no Node.

    deploy/scripts/check-calendars.sh

It prints a line for each event, SHOWN or HIDDEN, and for a hidden one the name of
the rule that hid it. It reads the published rules from Sanity the way the TV
does. It names each calendar by its code and never prints a link. The lines are
explained in docs/rebuilding-the-mini.md, "Adding or changing a calendar".

## Where the code is

- `studio/schemas/calendarFilter.js`: the fields and the check that a rule has a
  condition.
- `dashboard/core/events.js`: `ruleMatches` and `hidingRule`. `mergeEvents` uses
  them on the BAND events.
- `dashboard/core/sanity.js`: reads the rules with the rest of the content.
- `tools/test-calendar.mjs`: the tests, run with `node tools/test-calendar.mjs`.
