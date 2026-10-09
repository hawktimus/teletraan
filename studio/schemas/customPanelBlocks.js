// The blocks an extra panel is built from, shown top to bottom. A block's name
// without the word Block is what the dashboard reads: headingBlock is heading.

import { defineType, defineField, defineArrayMember } from 'sanity';
import { tooLong } from './fields.js';

const headingBlock = defineType({
  name: 'headingBlock',
  title: 'Heading',
  type: 'object',
  description: 'A line of large text.',
  fields: [
    defineField({
      name: 'text',
      title: 'Heading',
      type: 'string',
      description: 'The heading. Up to 30 characters fit.',
      validation: Rule => [Rule.required().error('Write the heading.'), tooLong(Rule, 30)],
    }),
  ],
  preview: {
    select: { title: 'text' },
    prepare: block => ({ title: block.title || 'Empty heading', subtitle: 'Heading' }),
  },
});

const textBlock = defineType({
  name: 'textBlock',
  title: 'Text',
  type: 'object',
  description: 'A sentence or two of ordinary text.',
  fields: [
    defineField({
      name: 'text',
      title: 'Text',
      type: 'text',
      rows: 3,
      description: 'The words to show. Up to 100 characters fit.',
      validation: Rule => [Rule.required().error('Write some text.'), tooLong(Rule, 100)],
    }),
  ],
  preview: {
    select: { title: 'text' },
    prepare: block => ({ title: block.title || 'Empty text', subtitle: 'Text' }),
  },
});

const statBlock = defineType({
  name: 'statBlock',
  title: 'Number',
  type: 'object',
  description: 'One big number with a short label under it.',
  fields: [
    defineField({
      name: 'value',
      title: 'Number',
      type: 'string',
      description: 'The big number or short value. Up to 6 characters fit.',
      validation: Rule => [Rule.required().error('Add the number.'), tooLong(Rule, 6)],
    }),
    defineField({
      name: 'label',
      title: 'Label',
      type: 'string',
      description: 'What the number counts. Up to 24 characters fit.',
      validation: Rule => tooLong(Rule, 24),
    }),
  ],
  preview: {
    select: { title: 'value', subtitle: 'label' },
    prepare: block => ({ title: block.title || 'Empty number', subtitle: block.subtitle || 'Number' }),
  },
});

const listBlock = defineType({
  name: 'listBlock',
  title: 'List',
  type: 'object',
  description: 'A short list of lines.',
  fields: [
    defineField({
      name: 'items',
      title: 'Lines',
      type: 'array',
      description: 'The lines of the list. Up to 5 lines fit, with up to 34 characters each.',
      of: [defineArrayMember({ type: 'string', validation: Rule => tooLong(Rule, 34) })],
      validation: Rule => Rule.max(5).error('Only 5 lines fit on the screen.'),
    }),
  ],
  preview: {
    select: { items: 'items' },
    prepare: block => ({ title: (block.items && block.items[0]) || 'Empty list', subtitle: 'List' }),
  },
});

const imageBlock = defineType({
  name: 'imageBlock',
  title: 'Image address',
  type: 'object',
  description: 'A picture, shown from its web address.',
  fields: [
    defineField({
      name: 'address',
      title: 'Image address',
      type: 'url',
      description: 'The web address of the picture. Pictures are not uploaded to Studio.',
      validation: Rule => Rule.required().error('Add the picture address.'),
    }),
  ],
  preview: {
    select: { address: 'address' },
    prepare: block => ({ title: 'Image', subtitle: block.address || 'Image address' }),
  },
});

const progressBlock = defineType({
  name: 'progressBlock',
  title: 'Progress bar',
  type: 'object',
  description: 'A bar that shows how far along something is.',
  fields: [
    defineField({
      name: 'label',
      title: 'Label',
      type: 'string',
      description: 'What the bar measures. Up to 30 characters fit.',
      validation: Rule => [Rule.required().error('Say what the bar measures.'), tooLong(Rule, 30)],
    }),
    defineField({
      name: 'percent',
      title: 'Percent done',
      type: 'number',
      description: 'How full the bar is, from 0 to 100.',
      validation: Rule => [
        Rule.required().error('Enter a number from 0 to 100.'),
        Rule.min(0).max(100).error('Use a number from 0 to 100.'),
      ],
    }),
  ],
  preview: {
    select: { title: 'label', percent: 'percent' },
    prepare(block) {
      const percent = typeof block.percent === 'number' ? block.percent + ' percent' : 'Progress bar';
      return { title: block.title || 'Empty progress bar', subtitle: percent };
    },
  },
});

const countdownBlock = defineType({
  name: 'countdownBlock',
  title: 'Countdown',
  type: 'object',
  description: 'A count of the time left until a date.',
  fields: [
    defineField({
      name: 'label',
      title: 'Label',
      type: 'string',
      description: 'What the countdown is for. Up to 24 characters fit.',
      validation: Rule => [Rule.required().error('Say what the countdown is for.'), tooLong(Rule, 24)],
    }),
    defineField({
      name: 'target',
      title: 'Counts down to',
      type: 'datetime',
      description: 'The date and time the countdown ends.',
      validation: Rule => Rule.required().error('Pick the date and time.'),
    }),
  ],
  preview: {
    select: { title: 'label', subtitle: 'target' },
    prepare: block => ({ title: block.title || 'Empty countdown', subtitle: block.subtitle || 'Countdown' }),
  },
});

export const customPanelBlocks = [
  headingBlock,
  textBlock,
  statBlock,
  listBlock,
  imageBlock,
  progressBlock,
  countdownBlock,
];
