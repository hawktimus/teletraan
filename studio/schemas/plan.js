import { defineType, defineField, defineArrayMember } from 'sanity';
import { showField, expiresField, teamField, tooLong, subtitleFor } from './fields.js';

const rowFields = [
  defineField({
    name: 'time',
    title: 'Time',
    type: 'string',
    description: 'When it starts, for example 6:00 PM. Up to 9 characters fit.',
    validation: Rule => tooLong(Rule, 9),
  }),
  defineField({
    name: 'text',
    title: 'What happens',
    type: 'string',
    description: 'What is planned for this time. Up to 18 characters fit.',
    validation: Rule => [Rule.required().error('Say what happens.'), tooLong(Rule, 18)],
  }),
  defineField({
    name: 'lead',
    title: 'Who leads it',
    type: 'string',
    description: 'Optional. The name of the person in charge. Up to 10 characters fit.',
    validation: Rule => tooLong(Rule, 10),
  }),
];

export default defineType({
  name: 'plan',
  title: 'Up Next',
  type: 'document',
  fields: [
    defineField({
      name: 'heading',
      title: 'Heading',
      type: 'string',
      description: 'The heading, such as the kind of meeting. Up to 26 characters fit.',
      validation: Rule => [Rule.required().error('Add a heading.'), tooLong(Rule, 26)],
    }),
    defineField({
      name: 'date',
      title: 'Date',
      type: 'date',
      description: 'The day this is for.',
    }),
    defineField({
      name: 'location',
      title: 'Location',
      type: 'string',
      description: 'Where the meeting is, such as a room. Up to 30 characters fit.',
      validation: Rule => tooLong(Rule, 30),
    }),
    defineField({
      name: 'rows',
      title: 'Schedule',
      type: 'array',
      description: 'The schedule, one row per item. Up to 5 rows fit on the screen.',
      of: [
        defineArrayMember({
          type: 'object',
          title: 'Row',
          fields: rowFields,
          preview: {
            select: { title: 'text', time: 'time', lead: 'lead' },
            prepare(row) {
              return { title: row.title || 'Empty row', subtitle: [row.time, row.lead].filter(Boolean).join(' · ') };
            },
          },
        }),
      ],
      validation: Rule => Rule.max(5).error('Only 5 rows fit on the screen.'),
    }),
    teamField(),
    showField(),
    expiresField(),
  ],
  orderings: [
    { title: 'Newest date first', name: 'dateNewest', by: [{ field: 'date', direction: 'desc' }] },
    { title: 'Oldest date first', name: 'dateOldest', by: [{ field: 'date', direction: 'asc' }] },
  ],
  preview: {
    select: { title: 'heading', date: 'date', location: 'location', show: 'show', expires: 'expires' },
    prepare(item) {
      const text = [item.date, item.location].filter(Boolean).join(' · ');
      return { title: item.title || 'Up Next with no heading', subtitle: subtitleFor(text, item) };
    },
  },
});
