import { defineType, defineField } from 'sanity';
import { showField, expiresField, orderField, tooLong, byOrder, aToZ, titleOf, subtitleFor } from './fields.js';

const kinds = [
  { title: 'Tip', value: 'tip' },
  { title: 'News', value: 'news' },
  { title: 'Reminder', value: 'reminder' },
];

export default defineType({
  name: 'tipOrNews',
  title: 'Tip or News',
  type: 'document',
  fields: [
    defineField({
      name: 'kind',
      title: 'Kind',
      type: 'string',
      description: 'Pick what kind of line this is.',
      options: { list: kinds, layout: 'radio', direction: 'horizontal' },
      initialValue: 'tip',
      validation: Rule => Rule.required().error('Pick a kind.'),
    }),
    defineField({
      name: 'text',
      title: 'Line',
      type: 'string',
      description: 'The line shown on the ticker at the bottom of the screen. Up to 52 characters fit.',
      validation: Rule => [Rule.required().error('Write the line.'), tooLong(Rule, 52)],
    }),
    orderField(),
    showField(),
    expiresField(),
  ],
  orderings: [byOrder, aToZ('text')],
  preview: {
    select: { title: 'text', kind: 'kind', show: 'show', expires: 'expires' },
    prepare(item) {
      return { title: item.title || 'Line with no text', subtitle: subtitleFor(titleOf(kinds, item.kind), item) };
    },
  },
});
