// Full screen announcements at set times of the day: a first line, then a
// second line a few seconds later.

import { defineField, defineArrayMember } from 'sanity';
import { showField, tooLong, subtitleFor } from './fields.js';

const weekdays = [
  { title: 'Sunday', value: 0 },
  { title: 'Monday', value: 1 },
  { title: 'Tuesday', value: 2 },
  { title: 'Wednesday', value: 3 },
  { title: 'Thursday', value: 4 },
  { title: 'Friday', value: 5 },
  { title: 'Saturday', value: 6 },
];

const everyDay = [0, 1, 2, 3, 4, 5, 6];

// 24 hour time with two digits for the hour and for the minutes
const timeFormat = /^([01]\d|2[0-3]):[0-5]\d$/;

// The two announcements in dashboard/config.js, with the switch written out
// so that Studio shows it on
const startingList = [
  { time: '14:30', title: 'WHAT TIME IS IT?', followUp: 'PRIMETIME', titleSeconds: 12, followUpSeconds: 10, days: everyDay, show: true },
  { time: '17:00', title: 'WHAT TIME IS IT?', followUp: 'PRIMETIME', titleSeconds: 12, followUpSeconds: 10, days: everyDay, show: true },
];

const secondsRule = Rule => [
  Rule.required().error('Enter the number of seconds.'),
  Rule.integer().min(3).max(60).error('Use a whole number from 3 to 60.'),
];

function dayText(selected) {
  if (!selected || selected.length === 0) return 'No days';
  if (selected.length === 7) return 'Every day';

  return selected
    .slice()
    .sort((a, b) => a - b)
    .map(value => weekdays[value].title.slice(0, 3))
    .join(', ');
}

const announcementMember = defineArrayMember({
  type: 'object',
  title: 'Announcement',
  fields: [
    defineField({
      name: 'time',
      title: 'Time',
      type: 'string',
      description: 'When it starts, in 24 hour time with two digits, such as 14:30 or 09:05.',
      validation: Rule => [
        Rule.required().error('Enter the time, such as 14:30.'),
        Rule.regex(timeFormat, { name: '24 hour time' }).error('Use 24 hour time with two digits, such as 14:30.'),
      ],
    }),
    defineField({
      name: 'title',
      title: 'First line',
      type: 'string',
      description: 'The words shown first. Up to 24 characters fit.',
      validation: Rule => [Rule.required().error('Write the first line.'), tooLong(Rule, 24)],
    }),
    defineField({
      name: 'followUp',
      title: 'Second line',
      type: 'string',
      description: 'Optional. The words that follow the first line. Leave empty to show only the first line. Up to 24 characters fit.',
      validation: Rule => tooLong(Rule, 24),
    }),
    defineField({
      name: 'titleSeconds',
      title: 'First line seconds',
      type: 'number',
      description: 'How long the first line stays up, from 3 to 60 seconds.',
      initialValue: 12,
      validation: secondsRule,
    }),
    defineField({
      name: 'followUpSeconds',
      title: 'Second line seconds',
      type: 'number',
      description: 'How long the second line stays up, from 3 to 60 seconds.',
      initialValue: 10,
      validation: secondsRule,
    }),
    defineField({
      name: 'days',
      title: 'Days',
      type: 'array',
      description: 'Tick every day of the week it should play.',
      of: [defineArrayMember({ type: 'number' })],
      options: { list: weekdays },
      initialValue: everyDay,
      validation: Rule => Rule.required().min(1).error('Tick at least one day.'),
    }),
    showField(),
  ],
  preview: {
    select: { time: 'time', title: 'title', days: 'days', show: 'show' },
    prepare(item) {
      const title = [item.time, item.title].filter(Boolean).join('  ') || 'Empty announcement';
      return { title: title, subtitle: subtitleFor(dayText(item.days), item) };
    },
  },
});

export function announcementsField() {
  return defineField({
    name: 'announcements',
    title: 'Announcements',
    type: 'array',
    group: 'announcements',
    description: 'Full screen messages that play at set times of the day.',
    of: [announcementMember],
    initialValue: startingList,
  });
}
