import { defineType, defineField } from 'sanity';
import { showField, expiresField, orderField, tooLong, byOrder, aToZ, titleOf, subtitleFor } from './fields.js';

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
    orderField(),
    showField(),
    expiresField(),
  ],
  orderings: [byOrder, aToZ('title')],
  preview: {
    select: { title: 'title', subteam: 'subteam.name', status: 'status', show: 'show', expires: 'expires' },
    prepare(item) {
      const text = [titleOf(statuses, item.status), item.subteam].filter(Boolean).join(' · ');
      return { title: item.title || 'Task with no name', subtitle: subtitleFor(text, item) };
    },
  },
});
