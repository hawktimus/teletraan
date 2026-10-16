import { defineType, defineField } from 'sanity';
import { showField, expiresField, orderField, teamField, tooLong, byOrder, aToZ, subtitleFor } from './fields.js';

const roles = [
  { title: 'Coach', value: 'Coach' },
  { title: 'Captain', value: 'Captain' },
  { title: 'Mentor', value: 'Mentor' },
];

const roleHelp = 'Shown in the chip at the right of the row, for example Coach, Co-President, Mentor, Parent. Up to 22 characters fit.';

export default defineType({
  name: 'person',
  title: 'Person',
  type: 'document',
  fields: [
    defineField({
      name: 'role',
      title: 'Listed with',
      type: 'string',
      description: 'Coach, Captain or Mentor. Coaches are listed first, then captains, then mentors, and the Order field sorts people inside each. The screen shows the Role below.',
      options: { list: roles, layout: 'radio', direction: 'horizontal' },
      validation: Rule => Rule.required().error('Pick a role.'),
    }),
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      description: 'Type the name as it should appear on the screen. Up to 17 characters fit.',
      validation: Rule => [Rule.required().error('Add a name.'), tooLong(Rule, 17)],
    }),
    defineField({
      name: 'title',
      title: 'Role',
      type: 'string',
      description: roleHelp,
      validation: Rule => [Rule.required().error(roleHelp), tooLong(Rule, 22)],
    }),
    defineField({
      name: 'line',
      title: 'Line under the title',
      type: 'string',
      description: 'One short line under the name, such as a year, a department, or a note. Leave blank to hide. Up to 48 characters fit. Shown on pages of 3 people or fewer.',
      validation: Rule => tooLong(Rule, 48),
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
    teamField(),
    orderField(),
    showField(),
    expiresField(),
  ],
  orderings: [byOrder, aToZ('name')],
  preview: {
    select: { title: 'name', role: 'role', jobTitle: 'title', show: 'show', expires: 'expires', media: 'photo' },
    prepare(item) {
      return { title: item.title || 'Person with no name', subtitle: subtitleFor(item.jobTitle || item.role || '', item), media: item.media };
    },
  },
});
