// One person of the team roster: a student, mentor, coach, parent or leader. The roster is a list of first names with a
// role and a team, so the Control page can show who is on Prime and who is on Nova. The dataset is public, so the name is a
// first name only and there is no email address or phone number anywhere in the document. No panel of the screen reads this
// type yet; the Leadership and Team leads lists keep feeding the screen (docs/roster.md).

import { defineType, defineField } from 'sanity';
import { limits } from './limits.js';
import { noContact } from '../tools/content-rules.js';
import { showField, expiresField, orderField, teamField, tooLong, byOrder, aToZ, titleOf, subtitleFor } from './fields.js';

const roles = [
  { title: 'Student', value: 'student' },
  { title: 'Mentor', value: 'mentor' },
  { title: 'Coach', value: 'coach' },
  { title: 'Parent', value: 'parent' },
  { title: 'Leadership', value: 'leadership' },
];

// The same nine departments, with the same values, as the department of a task (task.js), so a later panel can join them
const departments = ['Build', 'Electrical', 'Programming', 'Design', 'CNC', 'Strategy', 'Operations', 'Business', 'Marketing']
  .map(name => ({ title: name, value: name.toLowerCase() }));

export default defineType({
  name: 'rosterPerson',
  title: 'Roster person',
  type: 'document',
  fields: [
    defineField({
      name: 'firstName',
      title: 'First name',
      type: 'string',
      description: 'A first name only, with no last name, email address or phone number. Up to ' + limits.rosterFirstName + ' characters.',
      validation: Rule => [
        Rule.required().error('Add a first name.'),
        tooLong(Rule, limits.rosterFirstName),
        Rule.regex(/^[^\s@\d]*$/, { name: 'a first name' }).warning('This has a space, an @ or a number. The roster is public, so use a first name only.'),
        Rule.custom(noContact).warning(),
      ],
    }),
    defineField({
      name: 'role',
      title: 'Role',
      type: 'string',
      description: 'Student, Mentor, Coach, Parent or Leadership. The roster groups people by this.',
      options: { list: roles, layout: 'radio', direction: 'horizontal' },
      validation: Rule => Rule.required().error('Pick a role.'),
    }),
    defineField({
      name: 'jobTitle',
      title: 'Job title',
      type: 'string',
      description: 'Optional. A short title, such as Captain or Lead mentor. Up to ' + limits.rosterJobTitle + ' characters.',
      validation: Rule => [tooLong(Rule, limits.rosterJobTitle), Rule.custom(noContact).warning()],
    }),
    teamField(),
    defineField({
      name: 'department',
      title: 'Department',
      type: 'string',
      description: 'Optional. The subteam this person works in.',
      options: { list: departments },
    }),
    defineField({
      name: 'portrait',
      title: 'Portrait',
      type: 'image',
      description: 'Optional. A square photo with a plain background. It is added in the Studio; the Control page shows it but cannot change it.',
      options: { hotspot: true, accept: 'image/*' },
    }),
    orderField(),
    showField(),
    expiresField(),
  ],
  orderings: [byOrder, aToZ('firstName')],
  preview: {
    select: { title: 'firstName', role: 'role', jobTitle: 'jobTitle', show: 'show', expires: 'expires', media: 'portrait' },
    prepare(item) {
      const text = [titleOf(roles, item.role), item.jobTitle].filter(Boolean).join(' · ');
      return { title: item.title || 'Person with no name', subtitle: subtitleFor(text, item), media: item.media };
    },
  },
});
