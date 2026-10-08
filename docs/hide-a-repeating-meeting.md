# Hide a repeating meeting

For the students who edit the Studio. BAND sends every meeting that repeats, and
a meeting that repeats twice a week can fill the Events panel until nothing else
fits. A Calendar filter takes it off the TV. The example hides the Pre-Season
meetings that are on BAND every Monday and Thursday. Do the four steps in order.

## 1. Open Calendar filters

In the Studio sidebar click Calendar filters, then the plus button. Look through
the list first. The rule you want may already be there.

## 2. Fill in the rule

- Rule name: Hide Pre-Season Monday and Thursday. Only editors see the name.
- Action: Hide.
- Title words: click Add item and type Pre-Season. The rule matches an event
  whose title has this word in it. Capital letters do not matter.
- Days: tick Monday and Thursday.

Leave Calendar and the two dates empty. A rule with no Calendar applies to every
calendar, and a rule with no dates applies to every week.

## 3. Publish

Click Publish. Studio will not publish a rule that has none of Title words, Days,
Calendar or a date. It tells you to add one.

## 4. Check the TV

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
  rather than deleting it, so you can use it again.
- To keep one meeting that the rule would hide, make a second rule with the
  Action Always show and a word from that meeting's title. Always show wins over
  Hide.
- Every field of a rule is explained in docs/calendar-filters.md.
