import { defineType, defineField } from 'sanity';
import { showField, expiresField, orderField, tooLong, byOrder, aToZ, titleOf, subtitleFor } from './fields.js';

// The contact is a first name, so a space or a digit means a last name or
// something else is in there. A hyphen is fine, as in Mary-Anne.
function firstNameOnly(value) {
  if (typeof value === 'string' && /[\s\d]/.test(value)) return 'Use a first name only, with no spaces or numbers.';
  return true;
}

const statuses = [
  { title: 'Blocked', value: 'blocked' },
  { title: 'In progress', value: 'in-progress' },
  { title: 'Up next', value: 'up-next' },
  { title: 'Done', value: 'done' },
];

export default defineType({
  name: 'task',
  title: 'Task',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Task name',
      type: 'string',
      description: 'What needs doing, in a few words. Up to 22 characters fit.',
      validation: Rule => [Rule.required().error('Give the task a name.'), tooLong(Rule, 22)],
    }),
    defineField({
      name: 'subteam',
      title: 'Subteam',
      type: 'reference',
      to: [{ type: 'subteam' }],
      description: 'Which subteam is doing the task. Optional.',
    }),
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      description: 'Where the task stands. It decides which group the task appears in.',
      options: { list: statuses, layout: 'radio' },
      initialValue: 'up-next',
      validation: Rule => Rule.required().error('Pick a status.'),
    }),
    defineField({
      name: 'finishedOn',
      title: 'Finished on',
      type: 'datetime',
      description: 'When the task was finished. After the number of days set in Dashboard Settings it leaves the screen.',
      hidden: ({ document }) => !document || document.status !== 'done',
    }),
    defineField({
      name: 'contact',
      title: 'Point of contact',
      type: 'string',
      description: 'Optional. The first name of who to ask about the task, with no last name. Up to 12 characters fit.',
      validation: Rule => [tooLong(Rule, 12), Rule.custom(firstNameOnly)],
    }),
    // Create new is left on, so an editor can add a place while editing a task
    defineField({
      name: 'location',
      title: 'Location',
      type: 'reference',
      to: [{ type: 'place' }],
      description: 'Optional. Where the task is done. Pick a place, or use Create new to add one.',
    }),
    orderField(),
    showField(),
    expiresField(),
  ],
  orderings: [byOrder, aToZ('title')],
  preview: {
    select: { title: 'title', subteam: 'subteam.name', status: 'status', contact: 'contact', place: 'location.name', show: 'show', expires: 'expires' },
    prepare(item) {
      const text = [titleOf(statuses, item.status), item.subteam, item.contact, item.place].filter(Boolean).join(' · ');
      return { title: item.title || 'Task with no name', subtitle: subtitleFor(text, item) };
    },
  },
});
