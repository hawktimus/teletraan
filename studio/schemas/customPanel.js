import { defineType, defineField, defineArrayMember } from 'sanity';
import { showField, expiresField, orderField, tooLong, byOrder, aToZ, subtitleFor } from './fields.js';

export default defineType({
  name: 'customPanel',
  title: 'Custom Panel',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Panel title',
      type: 'string',
      description: 'The big title at the top of the panel, shown in capitals. Up to 7 characters fit.',
      validation: Rule => [Rule.required().error('Give the panel a title.'), tooLong(Rule, 7)],
    }),
    defineField({
      name: 'blocks',
      title: 'Blocks',
      type: 'array',
      description: 'Shown top to bottom. About 3 blocks fit; blocks that do not fit are left out.',
      of: [
        defineArrayMember({ type: 'headingBlock' }),
        defineArrayMember({ type: 'textBlock' }),
        defineArrayMember({ type: 'statBlock' }),
        defineArrayMember({ type: 'listBlock' }),
        defineArrayMember({ type: 'imageBlock' }),
        defineArrayMember({ type: 'progressBlock' }),
        defineArrayMember({ type: 'countdownBlock' }),
      ],
      validation: Rule => Rule.max(6).error('Use 6 blocks or fewer. Blocks that do not fit on the screen are left out.'),
    }),
    orderField(),
    showField(),
    expiresField(),
  ],
  orderings: [byOrder, aToZ('title')],
  preview: {
    select: { title: 'title', blocks: 'blocks', show: 'show', expires: 'expires' },
    prepare(item) {
      const count = (item.blocks || []).length;
      const text = count === 1 ? '1 block' : count + ' blocks';
      return { title: item.title || 'Panel with no title', subtitle: subtitleFor(text, item) };
    },
  },
});
