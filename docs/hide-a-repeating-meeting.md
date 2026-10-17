# Hide a repeating meeting

For the students who edit the Studio. BAND sends every meeting that repeats, and
a meeting that repeats twice a week can fill the Events panel until nothing else
fits. You can take one meeting off the TV with the switch on the Calendars page, or
every meeting like it with a rule under Calendar filters. The rule can do more.
The example is the Pre-Season meeting that is on BAND every Monday and Thursday.

## The switch, for one meeting

The Calendars page has a switch on every coming event. It hides that one meeting
and leaves the others. Use it for the one Pre-Season meeting that was cancelled.

1. In the Studio sidebar click Calendars, under Events.
2. Find the meeting in the list. Use the search box if the list is long.
3. Click its switch. The meeting says Hidden by you, and the page says: Click
   Publish all to apply.
4. Click Publish all in the top bar. The TV leaves the meeting out within a few
   seconds.

To bring the meeting back, click its switch again or click Undo, then click Publish
all. The switch works on one meeting only, so it cannot hide every Monday. For that
use the rule form below.

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
  rather than deleting it, so you can use it again. Or delete the rule.
- To keep one meeting that the rule would hide, make a second rule with the
  Action Always show and a word from that meeting's title. Always show wins over
  Hide.
- Every field of a rule is explained in docs/calendar-filters.md.
