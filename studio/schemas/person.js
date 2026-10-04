import { defineType, defineField } from 'sanity';
import { showField, expiresField, orderField, tooLong, byOrder, aToZ, subtitleFor } from './fields.js';

const roles = [
  { title: 'Coach', value: 'Coach' },
  { title: 'Captain', value: 'Captain' },
  { title: 'Mentor', value: 'Mentor' },
];

export default defineType({
  name: 'person',
  title: 'Person',
  type: 'document',
  fields: [
    defineField({
      name: 'role',
      title: 'Role',
      type: 'string',
      description: 'Coach, Captain or Mentor.',
      options: { list: roles, layout: 'radio', direction: 'horizontal' },
      validation: Rule => Rule.required().error('Pick a role.'),
    }),
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      description: 'The name as it should appear on the screen. Up to 17 characters fit.',
      validation: Rule => [Rule.required().error('Add a name.'), tooLong(Rule, 17)],
    }),
    orderField(),
    showField(),
    expiresField(),
  ],
  orderings: [byOrder, aToZ('name')],
  preview: {
    select: { title: 'name', role: 'role', show: 'show', expires: 'expires' },
    prepare(item) {
      return { title: item.title || 'Person with no name', subtitle: subtitleFor(item.role || '', item) };
    },
  },
});
