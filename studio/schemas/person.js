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
    defineField({
      name: 'photo',
      title: 'Photo',
      type: 'image',
      description: 'A square photo with a plain background. Put the first name only in Name. Drag the circle onto the face so the screen crops around it.',
      options: { hotspot: true, accept: 'image/*' },
    }),
    defineField({
      name: 'showPhoto',
      title: 'Show photo on screen',
      type: 'boolean',
      description: 'Turn this off to show a plain silhouette instead of the photo, without deleting the photo.',
      initialValue: true,
    }),
    orderField(),
    showField(),
    expiresField(),
  ],
  orderings: [byOrder, aToZ('name')],
  preview: {
    select: { title: 'name', role: 'role', show: 'show', expires: 'expires', media: 'photo' },
    prepare(item) {
      return { title: item.title || 'Person with no name', subtitle: subtitleFor(item.role || '', item), media: item.media };
    },
  },
});
