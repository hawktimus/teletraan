// What the Teletraan computer read from Monday, in one document with the fixed id 'monday-status'.
// computer/scripts/monday-sync.sh writes it, so editors never open it: it is
// not in the sidebar or the New menu (structure.js, sanity.config.js). The Monday tab
// of Dashboard Settings shows when it was written and offers its boards and columns in
// the lists of the board blocks (settingsMonday.js, ../monday-status-input.js and
// ../monday-pickers.js), the Monday Boards page lists its boards (../monday-boards-view.js),
// and the screen reads its daily counts of open items and the time of the last read.
//
// The dataset is public, so anyone who asks for this document can read the name of every
// board the token of the Teletraan computer can see, and the titles of their columns, whether or not
// the screen reads the board (docs/monday.md). It holds the first name of the account
// and no token. Every field is optional, because a value the Teletraan computer did not find is left
// out and never made up.

import { defineType, defineField, defineArrayMember } from 'sanity';
import { textField, numberField } from './fields.js';

const column = defineArrayMember({
  type: 'object',
  title: 'Column',
  fields: [
    textField('id', 'Column id', 'The id of the column on the board, which a board entry stores.'),
    textField('title', 'Column title', 'The title of the column as Monday shows it.'),
    textField('type', 'Column type', 'The kind of column, such as status, date or people.'),
  ],
  preview: {
    select: { title: 'title', id: 'id' },
    prepare(entry) {
      return { title: entry.title || 'Column with no title', subtitle: entry.id };
    },
  },
});

const board = defineArrayMember({
  type: 'object',
  title: 'Board',
  fields: [
    textField('id', 'Board number', 'The number of the board, which a board entry stores.'),
    textField('name', 'Board name', 'The name of the board as Monday shows it.'),
    textField('hierarchy', 'Kind of board', 'classic, or multi_level when the board has parent items with subitems. The Teletraan computer reads a multi-level board in another way.'),
    numberField('itemCount', 'Items', 'How many items the board has.'),
    defineField({ name: 'columns', title: 'Columns', type: 'array', of: [column], description: 'The columns of the board.' }),
  ],
  preview: {
    select: { title: 'name', id: 'id' },
    prepare(entry) {
      return { title: entry.title || 'Board with no name', subtitle: entry.id };
    },
  },
});

const reading = defineArrayMember({
  type: 'object',
  title: 'Board reading',
  fields: [
    textField('boardId', 'Board number', 'The number of a board chosen in Dashboard Settings.'),
    textField('boardName', 'Board name', 'The name of the board as Monday shows it, when the token can see it.'),
    numberField('itemsRead', 'Items read', 'How many items the Teletraan computer read from the board the last time it could.'),
    defineField({ name: 'readAt', title: 'Read at', type: 'datetime', description: 'When the Teletraan computer last read the board.' }),
    textField('note', 'Note', 'Why the board gave no items or fewer than it has, in plain words. Empty when nothing went wrong.'),
  ],
  preview: {
    select: { title: 'boardName', id: 'boardId', items: 'itemsRead' },
    prepare(entry) {
      return { title: entry.title || 'Board ' + (entry.id || 'with no number'), subtitle: typeof entry.items === 'number' ? entry.items + ' items read' : '' };
    },
  },
});

const departmentCount = defineArrayMember({
  type: 'object',
  title: 'Department',
  fields: [
    textField('name', 'Department', 'The department, such as build.'),
    numberField('open', 'Open', 'How many open tasks of the department are on the TV.'),
    numberField('done', 'Done', 'How many done tasks of the department are on the TV.'),
  ],
  preview: {
    select: { title: 'name', open: 'open', done: 'done' },
    prepare(entry) {
      return { title: entry.title || 'Department', subtitle: (entry.open || 0) + ' open, ' + (entry.done || 0) + ' done' };
    },
  },
});

const snapshot = defineArrayMember({
  type: 'object',
  title: 'Count',
  fields: [
    defineField({ name: 'date', title: 'Date', type: 'date', description: 'The day of the count.' }),
    numberField('open', 'Open items', 'How many items were not done that day, on the boards the screen reads.'),
  ],
  preview: {
    select: { title: 'date', open: 'open' },
    prepare(entry) {
      return { title: entry.title || 'Count with no date', subtitle: typeof entry.open === 'number' ? entry.open + ' open' : '' };
    },
  },
});

const projectStatuses = [
  { title: 'To do', value: 'up-next' },
  { title: 'In progress', value: 'in-progress' },
  { title: 'In review', value: 'in-review' },
  { title: 'Stuck', value: 'blocked' },
  { title: 'Done', value: 'done' },
];

// One project of the Projects (Mentors) board, as the Projects panel of the TV draws it. Mentors and helpers are first names, because the
// dataset is public. A project that says Hide in Monday is not written, and Budget and Notes are never read.
const project = defineArrayMember({
  type: 'object',
  title: 'Project',
  fields: [
    textField('id', 'Item number', 'The number of the item on the Projects board.'),
    textField('title', 'Project', 'The name of the project as Monday shows it, 60 characters at most.'),
    defineField({ name: 'status', title: 'Status', type: 'string', options: { list: projectStatuses }, description: 'To do, in progress, in review, stuck or done. A project in the Done group is done.' }),
    textField('mentor', 'Mentor', 'The first name of the mentor, which is the first word of the Mentor label.'),
    textField('mentorInitial', 'Mentor last initial', 'The first letter of the last name of the mentor, so the screen can tell two mentors with the same first name apart.'),
    defineField({ name: 'helpers', title: 'Helpers', type: 'array', of: [{ type: 'string' }], description: 'The first names of the helpers, six at most.' }),
    numberField('percent', 'Percent complete', 'The % Complete column, from 0 to 100. Empty when the project has none.'),
    defineField({ name: 'timelineEnd', title: 'Timeline end', type: 'date', description: 'The last day of the Timeline column, a date only. A project past it that is not done shows a Late chip.' }),
    defineField({ name: 'completedOn', title: 'Date completed', type: 'date', description: 'The day the project was done, when the board says. A done project shows for 14 days after it.' }),
  ],
  preview: {
    select: { title: 'title', status: 'status', mentor: 'mentor' },
    prepare(entry) {
      return { title: entry.title || 'Project with no name', subtitle: [entry.status, entry.mentor].filter(Boolean).join(', ') };
    },
  },
});

export default defineType({
  name: 'mondayStatus',
  title: 'Monday data from the Teletraan computer',
  type: 'document',
  readOnly: true,
  // Keeps it out of Studio's search, so it is not found by accident
  __experimental_omnisearch_visibility: false,
  fields: [
    textField('connectedAs', 'Connected as', 'Not written any more: the first name of the account of the token, which the older sync kept.'),
    defineField({ name: 'lastSyncAt', title: 'Last sync', type: 'datetime', description: 'When the Teletraan computer last read Monday. The computer writes it.' }),
    textField('lastError', 'Last error', 'What went wrong in the last run, in plain words. Empty when nothing did.'),
    defineField({ name: 'boards', title: 'Boards', type: 'array', of: [board], description: 'Not written any more: the older sync listed every board the token could see here. The next read takes it out.' }),
    defineField({ name: 'readings', title: 'Board readings', type: 'array', of: [reading], description: 'One entry for each of the two boards: how many items the Teletraan computer read from it, when, and why a board gave none.' }),
    defineField({ name: 'departments', title: 'Departments', type: 'array', of: [departmentCount], description: 'The open and done tasks of each department on the TV, from the last read.' }),
    defineField({ name: 'projects', title: 'Projects', type: 'array', of: [project], description: 'The projects of the Projects board that the TV draws, from the last read. A board that could not be read leaves the older list.' }),
    defineField({ name: 'snapshots', title: 'Daily counts', type: 'array', of: [snapshot], description: 'One count a day of the open items, 120 at most.' }),
    numberField('taskCount', 'Tasks', 'How many tasks the Teletraan computer read from the two boards the last time, the ones set to Hide included.'),
    numberField('hiddenCount', 'Hidden on Monday', 'How many of those say Hide in the Show on TV? column. They are counted and not written as tasks, because the dataset is public.'),
    numberField('hiddenUnassigned', 'Hidden, no department', 'Not written any more: the older sync counted the tasks with no department here.'),
    numberField('callsToday', 'Reads today', 'How many requests the Teletraan computer has made to Monday today. Past 900 it waits for midnight.'),
    defineField({ name: 'callsDate', title: 'Reads counted for', type: 'date', description: 'The day of the count of reads, in the time zone of the screen.' }),
  ],
  preview: {
    prepare: () => ({ title: 'Monday data from the Teletraan computer' }),
  },
});
