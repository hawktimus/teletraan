import { defineType, defineField } from 'sanity';
import { showField, expiresField, orderField, teamField, noteField, tooLong, byOrder, aToZ, titleOf, subtitleFor } from './fields.js';
import { ShowOnTvInput } from '../show-on-tv-input.js';

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

const priorities = [
  { title: 'High', value: 'high' },
  { title: 'Medium', value: 'medium' },
  { title: 'Low', value: 'low' },
];

const sources = [
  { title: 'Pinned by hand', value: 'manual' },
  { title: 'From the team board', value: 'monday' },
];

const boardNote = 'This task comes from the team board. Change it there. Use Show on TV to hide it here.';

// The board sync makes the tasks with the source monday. A task with no source is pinned.
function fromBoard({ document }) {
  return Boolean(document) && document.source === 'monday';
}

// The fields of a task from the board that an editor can still change
const editableOnBoard = ['boardNote', 'source', 'mondayId', 'showOnTv'];

const fields = [
  Object.assign(noteField('boardNote', boardNote), { hidden: context => !fromBoard(context) }),
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
  defineField({
    name: 'priority',
    title: 'Priority',
    type: 'string',
    description: 'Optional. How urgent the task is. A task from the team board takes it from the board.',
    options: { list: priorities },
  }),
  defineField({
    name: 'dueDate',
    title: 'Due date',
    type: 'date',
    description: 'Optional. The day the task is due. A task from the team board takes it from the board.',
  }),
  teamField(),
  orderField(),
  defineField({
    name: 'showOnTv',
    title: 'Show on TV',
    type: 'boolean',
    description: 'Turn this off to keep the task off the TV. It works on every task, including the ones from the team board.',
    initialValue: true,
    components: { input: ShowOnTvInput },
  }),
  showField(),
  expiresField(),
  defineField({
    name: 'source',
    title: 'Source',
    type: 'string',
    description: 'Where the task comes from. The board sync sets it, so it is hidden here.',
    options: { list: sources },
    initialValue: 'manual',
    hidden: true,
  }),
  defineField({
    name: 'mondayId',
    title: 'Board item number',
    type: 'string',
    description: 'The number of the item on the team board. The board sync sets it, so it is hidden here.',
    hidden: true,
  }),
];

fields.forEach(field => {
  if (editableOnBoard.indexOf(field.name) === -1) field.readOnly = fromBoard;
});

export default defineType({
  name: 'task',
  title: 'Task',
  type: 'document',
  fields: fields,
  orderings: [byOrder, aToZ('title')],
  preview: {
    select: { title: 'title', subteam: 'subteam.name', status: 'status', contact: 'contact', place: 'location.name', source: 'source', priority: 'priority', showOnTv: 'showOnTv', show: 'show', expires: 'expires' },
    prepare(item) {
      const priority = titleOf(priorities, item.priority);
      const text = [item.subteam, titleOf(statuses, item.status), priority ? priority + ' priority' : '', item.source === 'monday' ? 'Board' : 'Pinned', item.contact, item.place].filter(Boolean).join(' · ');
      // a task kept off the TV is hidden, however it is listed
      const hidden = item.show === false || item.showOnTv === false;
      return { title: item.title || 'Task with no name', subtitle: subtitleFor(text, { show: hidden ? false : item.show, expires: item.expires }) };
    },
  },
});
