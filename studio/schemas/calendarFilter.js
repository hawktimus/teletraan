// A rule that hides events from the BAND calendars, or keeps them on the
// screen. The dashboard applies the rules in core/events.js, after repeating
// events are expanded. A rule matches an event when every condition it has
// matches. An event is hidden when a Hide rule matches and no Always show rule
// does. An Always show rule can also pin its events to page one of the Events
// panel (force, core/event-pages.js). Only an Always show rule shows the switch.

import { defineType, defineField, defineArrayMember } from 'sanity';
import { tooLong, aToZ, titleOf, subtitleFor } from './fields.js';

const actions = [
  { title: 'Hide', value: 'hide' },
  { title: 'Always show', value: 'show' },
];

// The week starts on Monday here. The values are the ones Date.getDay gives,
// so Sunday is 0.
const weekdays = [
  { title: 'Monday', value: 1 },
  { title: 'Tuesday', value: 2 },
  { title: 'Wednesday', value: 3 },
  { title: 'Thursday', value: 4 },
  { title: 'Friday', value: 5 },
  { title: 'Saturday', value: 6 },
  { title: 'Sunday', value: 0 },
];

const calendarCode = /^[a-z0-9_]+$/;

const earliestDay = '2020-01-01';
const latestDay = '2099-12-31';
const dayMessage = 'Pick a date between the years 2020 and 2099.';

// A word of spaces is inside every title, so the rule would match every event
function checkWord(word) {
  if (typeof word === 'string' && word.trim() === '') return 'Type a word, or remove the empty line.';
  return true;
}

// The to date may be empty. When it is there it may not come before the from date.
function toDateIsNotBefore(value, context) {
  const from = context.document && context.document.fromDate;
  if (!value || !from) return true;
  return value >= from || 'The to date is before the from date.';
}

// A rule with none of these would match every event
function hasACondition(rule) {
  if (!rule) return true;

  const hasWord = Array.isArray(rule.words) && rule.words.some(word => typeof word === 'string' && word.trim() !== '');
  const hasDay = Array.isArray(rule.days) && rule.days.length > 0;
  const hasCalendar = typeof rule.calendar === 'string' && rule.calendar.trim() !== '';
  if (hasWord || hasDay || hasCalendar || rule.fromDate || rule.toDate) return true;

  return 'Add at least one of: title words, days, a calendar or a date. A rule with none would match every event.';
}

// Mon, Thu
function dayText(selected) {
  return weekdays
    .filter(day => (selected || []).indexOf(day.value) !== -1)
    .map(day => day.title.slice(0, 3))
    .join(', ');
}

function dateText(from, to) {
  if (from && to) return from + ' to ' + to;
  if (from) return 'from ' + from;
  if (to) return 'until ' + to;
  return '';
}

export default defineType({
  name: 'calendarFilter',
  title: 'Calendar filters',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Rule name',
      type: 'string',
      description: 'A name so editors can tell the rules apart, such as the meeting it hides. It does not show on the screen. Up to 40 characters.',
      validation: Rule => [Rule.required().error('Give the rule a name.'), tooLong(Rule, 40)],
    }),
    defineField({
      name: 'action',
      title: 'Action',
      type: 'string',
      description: 'Hide takes the matching events off the screen. Always show keeps them on, even when a Hide rule matches them.',
      options: { list: actions, layout: 'radio', direction: 'horizontal' },
      initialValue: 'hide',
      validation: Rule => [
        Rule.required().error('Pick Hide or Always show.'),
        Rule.valid(actions.map(action => action.value)).error('Pick Hide or Always show.'),
      ],
    }),
    defineField({
      name: 'force',
      title: 'Pin to page one',
      type: 'boolean',
      hidden: ({ document }) => !document || document.action !== 'show',
      description: 'Show this event even when it is not one of the next 8.',
      initialValue: false,
    }),
    defineField({
      name: 'words',
      title: 'Title words',
      type: 'array',
      description: 'Optional. Matches an event whose title has any of these, in any capitals. Up to 5 words, 30 characters each.',
      of: [
        defineArrayMember({
          type: 'string',
          validation: Rule => [Rule.required().error('Type a word, or remove the empty line.'), tooLong(Rule, 30), Rule.custom(checkWord)],
        }),
      ],
      validation: Rule => Rule.max(5).error('Only 5 words fit. Remove one.'),
    }),
    defineField({
      name: 'days',
      title: 'Days',
      type: 'array',
      description: 'Optional. Tick the days of the week the rule applies to. Leave every box empty for any day.',
      of: [defineArrayMember({ type: 'number' })],
      options: { list: weekdays },
    }),
    defineField({
      name: 'calendar',
      title: 'Calendar',
      type: 'string',
      description: 'Optional. The calendar code from Calendars in Dashboard Settings, such as team. Empty means every calendar. Up to 20 characters.',
      validation: Rule => [
        tooLong(Rule, 20),
        Rule.regex(calendarCode, { name: 'lowercase code' }).error('Use lowercase letters, digits and underscores only, such as team.'),
      ],
    }),
    defineField({
      name: 'fromDate',
      title: 'From date',
      type: 'date',
      description: 'Optional. The first day the rule applies. It counts as part of the rule. Leave empty for no start.',
      validation: Rule => Rule.min(earliestDay).max(latestDay).error(dayMessage),
    }),
    defineField({
      name: 'toDate',
      title: 'To date',
      type: 'date',
      description: 'Optional. The last day the rule applies. It counts as part of the rule. Leave empty for no end.',
      validation: Rule => [Rule.min(earliestDay).max(latestDay).error(dayMessage), Rule.custom(toDateIsNotBefore)],
    }),
    defineField({
      name: 'show',
      title: 'Rule on',
      type: 'boolean',
      description: 'Turn this off to stop the rule without deleting it.',
      initialValue: true,
    }),
    defineField({
      name: 'expires',
      title: 'Hide after',
      type: 'datetime',
      description: 'Optional. After this date and time the rule stops. Leave empty to keep it going.',
    }),
  ],
  validation: Rule => Rule.custom(hasACondition),
  orderings: [aToZ('name')],
  preview: {
    select: { title: 'name', action: 'action', words: 'words', days: 'days', calendar: 'calendar', from: 'fromDate', to: 'toDate', show: 'show', expires: 'expires' },
    prepare(item) {
      const words = (item.words || []).filter(Boolean).join(' or ');
      const text = [titleOf(actions, item.action), words, dayText(item.days), item.calendar, dateText(item.from, item.to)].filter(Boolean).join(' · ');
      return { title: item.title || 'Rule with no name', subtitle: subtitleFor(text, item, 'Off') };
    },
  },
});
