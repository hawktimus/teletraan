import { defineType, defineField } from 'sanity';
import { showField, expiresField, orderField, teamField, tooLong, byOrder, aToZ, subtitleFor } from './fields.js';

const roles = [
  { title: 'Coach', value: 'Coach' },
  { title: 'Captain', value: 'Captain' },
  { title: 'Mentor', value: 'Mentor' },
];

// The values are the names in groupNames in dashboard/core/leadership.js
const groups = [
  { title: 'Coach', value: 'COACH' },
  { title: 'Captain', value: 'CAPTAIN' },
  { title: 'Mentor', value: 'MENTOR' },
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
      description: 'Coach, Captain or Mentor. This also sets the colour of the frame round the portrait.',
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
      title: 'Title on screen',
      type: 'string',
      description: 'Optional. Type what is shown under the name, for example Head Coach. Leave it empty to show the role. Up to 22 characters fit.',
      validation: Rule => tooLong(Rule, 22),
    }),
    defineField({
      name: 'line',
      title: 'Line under the title',
      type: 'string',
      description: 'One short line under the role, such as a year, a department, or a note. Leave blank to hide. Up to 48 characters fit. Shown on pages of 3 people or fewer.',
      validation: Rule => tooLong(Rule, 48),
    }),
    defineField({
      name: 'group',
      title: 'Chip at the right end',
      type: 'string',
      description: 'The word in the chip at the right end. Leave blank to follow the role: coach is COACH, mentor is MENTOR, any other role is CAPTAIN.',
      options: { list: groups, layout: 'radio', direction: 'horizontal' },
      validation: Rule => Rule.valid(groups.map(group => group.value)).error('Pick coach, captain or mentor.'),
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
