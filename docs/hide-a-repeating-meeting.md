# Hide a repeating meeting

For the students who edit the Studio. BAND sends every meeting that repeats, and
a meeting that repeats twice a week can fill the Events panel until nothing else
fits. You can take a meeting off the TV with a button on the Calendars page, or
with a rule under Calendar filters. The button is quicker. The rule can do more.
The example is the Pre-Season meeting that is on BAND every Monday and Thursday.

## The button

1. In the Studio sidebar click Calendars, under Events. Click the calendar on the
   left that has the meeting.
2. Find the meeting in the list on the right. The list shows the next 40 events.
3. Click Hide all like this. The page asks: "This hides every event in Team
   calendar with Pre-Season Meeting in its title, on every day." Click Hide.
4. The meeting says HIDDEN at once, and the TV leaves it out within a few seconds.

Hide this one is for a single day. It hides the events with this title in this
calendar on that day only, and leaves the Monday and Thursday after it. Use it for
the one Pre-Season meeting that was cancelled.

To bring a meeting back, click Show again on it. That deletes the rule the button
made. A meeting that a rule from Calendar filters hides has no button. It says
which rule hides it and "Change it under Calendar filters."

Every button makes a rule in Calendar filters. The rule is published already, so
there is nothing to publish. Its name starts with Hide: for one day or Hide all:
for every day, and you can edit, switch off or delete it there like any other
rule. The word it looks for is the first 30 characters of the title. The button
needs a title, so an event called No title has none.

## The rule form

Use the rule form when the button cannot say what you want: only Monday and
Thursday, a stretch of weeks, or two meetings with one rule. Do the four steps in
order.

### 1. Open Calendar filters

In the Studio sidebar click Calendar filters, then the plus button. Look through
the list first. The rule you want may already be there.

### 2. Fill in the rule

- Rule name: Hide Pre-Season Monday and Thursday. Only editors see the name.
- Action: Hide.
- Title words: click Add item and type Pre-Season. The rule matches an event
  whose title has this word in it. Capital letters do not matter.
- Days: tick Monday and Thursday.

Leave Calendar and the two dates empty. A rule with no Calendar applies to every
calendar, and a rule with no dates applies to every week.

### 3. Publish

Click Publish. Studio will not publish a rule that has none of Title words, Days,
Calendar or a date. It tells you to add one.

### 4. Check the TV

The TV reads the new rule within a few seconds. The Events panel and the Next
event tile leave out the Pre-Season meetings by the next time each one comes
round. A Pre-Season event on any other day still shows, because the rule names
Monday and Thursday.

If the meetings are still there, open the rule and check that it is published and
not a draft, that Rule on is on, and that the word is spelled the way BAND spells
it. A coach can also run the check script (docs/calendar-filters.md, "Checking
the rules").

## Afterwards

- To bring the meetings back, turn off Rule on and click Publish. Turn a rule off
  rather than deleting it, so you can use it again. Or click Show again on the
  Calendars page, if a button made the rule.
- To keep one meeting that the rule would hide, make a second rule with the
  Action Always show and a word from that meeting's title. Always show wins over
  Hide.
- Every field of a rule is explained in docs/calendar-filters.md.
