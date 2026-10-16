import { defineType, defineField } from 'sanity';
import { showField, expiresField, orderField, teamField, noteField, tooLong, byOrder, aToZ, titleOf, subtitleFor } from './fields.js';
import { ShowOnTvInput } from '../inputs/show-on-tv-input.js';

// The contact is a first name, so a space or a digit means a last name or
// something else is in there. A hyphen is fine, as in Mary-Anne.
function firstNameOnly(value) {
  if (typeof value === 'string' && /[\s\d]/.test(value)) return 'Use a first name only, with no spaces or numbers.';
  return true;
}

const statuses = [
  { title: 'Blocked', value: 'blocked' },
  { title: 'In progress', value: 'in-progress' },
  { title: 'In review', value: 'in-review' },
  { title: 'Up next', value: 'up-next' },
  { title: 'Done', value: 'done' },
];

const priorities = [
  { title: 'High', value: 'high' },
  { title: 'Medium', value: 'medium' },
  { title: 'Low', value: 'low' },
];

const sources = [
  { title: 'Typed by hand', value: 'manual' },
  { title: 'From the team board', value: 'monday' },
];

const boardNote = 'This task comes from the team board. Change it there. Use Show on TV to hide it here.';
const manualNote = 'This task was typed by hand. The screen shows only the tasks from the team board, so it is not shown. It stays here until it is deleted.';

// The board sync makes the tasks with the source monday. A task with no source was typed by hand,
// before the team board was connected.
function fromBoard({ document }) {
  return Boolean(document) && document.source === 'monday';
}

// The fields of a task that an editor can still change. The others open read only.
const editable = ['boardNote', 'manualNote', 'source', 'mondayId', 'mondayBoardId', 'mondayBoardName', 'showOnTv'];

const reading = ' The board sync sets it.';

const fields = [
  Object.assign(noteField('boardNote', boardNote), { hidden: context => !fromBoard(context) }),
  Object.assign(noteField('manualNote', manualNote), { hidden: fromBoard }),
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
  defineField({
    name: 'startDate',
    title: 'Start date',
    type: 'date',
    description: 'Optional. The first day of the Timeline of the task.' + reading,
  }),
  defineField({
    name: 'estHours',
    title: 'Estimated hours',
    type: 'number',
    description: 'Optional. How many hours the task needs. They weight the progress, and a task with no hours counts as 1.' + reading,
  }),
  defineField({
    name: 'completedOn',
    title: 'Completed on',
    type: 'date',
    description: 'Optional. The day the task was finished, from the Date Completed column.' + reading,
  }),
  defineField({
    name: 'owners',
    title: 'Owners',
    type: 'array',
    of: [{ type: 'string', validation: Rule => tooLong(Rule, 12) }],
    description: 'Optional. First names from Assigned, kept when owner names are on. Up to 6 names of 12 characters.' + reading,
    validation: Rule => Rule.max(6).error('Up to 6 names.'),
  }),
  defineField({
    name: 'milestoneIds',
    title: 'Milestones',
    type: 'array',
    of: [{ type: 'string', validation: Rule => tooLong(Rule, 20) }],
    description: 'Optional. The numbers of the milestone items the task is linked to. Up to 50.' + reading,
    validation: Rule => Rule.max(50).error('Up to 50 milestones.'),
  }),
  defineField({
    name: 'showOnBoard',
    title: 'Show on TV in Monday',
    type: 'boolean',
    description: 'On unless the Show on TV column holds the Hide label. Both this and Show on TV must be on.' + reading,
    initialValue: true,
  }),
  defineField({
    name: 'hiddenReason',
    title: 'Why it is hidden',
    type: 'string',
    description: 'Optional. Unassigned means the task has no department, so it is kept off the TV until it has one.' + reading,
    options: { list: [{ title: 'No department', value: 'unassigned' }] },
  }),
  teamField(),
  orderField(),
  defineField({
    name: 'showOnTv',
    title: 'Show on TV',
    type: 'boolean',
    description: 'Turn this off to keep the task off the TV. It is the one thing you can change on a task from the team board.',
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
  defineField({
    name: 'mondayBoardId',
    title: 'Board number',
    type: 'string',
    description: 'The number of the board the item is on. The board sync sets it, so it is hidden here.',
    hidden: true,
  }),
  defineField({
    name: 'mondayBoardName',
    title: 'Board name',
    type: 'string',
    description: 'The name of the board the item is on. The board sync sets it, so it is hidden here.',
    hidden: true,
  }),
];

fields.forEach(field => {
  if (editable.indexOf(field.name) === -1) field.readOnly = true;
});

// Oct 14, from 2026-10-14
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dayText(date) {
  const parts = typeof date === 'string' ? date.split('-') : [];
  const month = months[Number(parts[1]) - 1];
  return month && Number(parts[2]) > 0 ? month + ' ' + Number(parts[2]) : '';
}

export default defineType({
  name: 'task',
  title: 'Task',
  type: 'document',
  fields: fields,
  orderings: [byOrder, aToZ('title')],
  preview: {
    select: { title: 'title', status: 'status', contact: 'contact', due: 'dueDate', board: 'mondayBoardName', source: 'source', priority: 'priority', showOnTv: 'showOnTv', show: 'show', expires: 'expires', showOnBoard: 'showOnBoard', reason: 'hiddenReason' },
    prepare(item) {
      const priority = titleOf(priorities, item.priority);
      const due = dayText(item.due);
      const text = [titleOf(statuses, item.status), priority ? priority + ' priority' : '', item.contact, due ? 'Due ' + due : '', item.board, item.reason === 'unassigned' ? 'No department' : ''].filter(Boolean).join(' · ');
      // a task typed by hand is never on the screen, whatever its switches say
      const line = item.source === 'monday' ? text : ['Manual (not shown)', text].filter(Boolean).join(' · ');

      // a task kept off the TV is hidden, however it is listed
      const hidden = item.show === false || item.showOnTv === false || item.showOnBoard === false;
      return { title: item.title || 'Task with no name', subtitle: subtitleFor(line, { show: hidden ? false : item.show, expires: item.expires }) };
    },
  },
});
