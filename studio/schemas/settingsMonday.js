// The Monday tab of Dashboard Settings: which boards of the team's Monday account the
// Mini reads, and how an item becomes a task (docs/monday.md). It has:
//
//   mondayConnection   a read only block that says who the token belongs to and when the
//                      Mini last read Monday (../monday-status-input.js). It stores nothing
//   mondayBoards       one entry for each board the screen reads. An entry has the board and
//                      its team, the status column with the three labels that mean not
//                      started, being worked on and finished, and optional columns for the
//                      priority, the due date, the owner and the subteam
//   mondayShowOwners   whether the first name of the owner of an item is kept, off to start with
//
// The board and the columns are picked from lists that the Mini fills in (../monday-pickers.js),
// so nobody types a number. The lists fall back to a plain box when they cannot be read.
// The rows on a card are fixed at 2 not started, 2 being worked on and 2 finished, so they
// are not a field.
//
// The names and the starting values are the same as mondayBoards and mondayShowOwners in
// defaultSettings in dashboard/config.js. check-schemas.mjs fails if they differ.
//
// None of the fields is required on the page: Dashboard Settings published before these
// fields existed has none, and the Mini then reads no board. A board entry needs its board,
// its team and its status column, or the Mini has nothing to read.
//
// To take the whole section out later: delete this file, remove its import and the line that
// uses mondayFields in dashboardSettings.js, and remove the same names from check-schemas.mjs
// and config.js. The dashboard uses the starting values for anything missing from the
// published settings.

import { defineField, defineArrayMember } from 'sanity';
import { tooLong } from './fields.js';
import { MondayStatusInput } from '../monday-status-input.js';
import { BoardInput, StatusColumnInput, PriorityColumnInput, DueColumnInput, OwnerColumnInput, TeamColumnInput } from '../monday-pickers.js';

// Monday gives a column an id of letters, digits, hyphens and underscores
const columnId = /^[A-Za-z0-9_-]+$/;

// The longest board entry the Mini reads in one run, with 500 items each (deploy/scripts/monday-sync.sh)
const mostBoards = 10;

function columnField(name, title, description, input, required) {
  const rules = Rule => {
    const list = [tooLong(Rule, 50), Rule.regex(columnId, { name: 'column id' }).error('Use letters, digits, hyphens and underscores only.')];
    return required ? [Rule.required().error('Pick the status column.')].concat(list) : list;
  };
  return defineField({ name: name, title: title, type: 'string', description: description, components: { input: input }, validation: rules });
}

function labelField(name, title, description, initialValue) {
  return defineField({
    name: name,
    title: title,
    type: 'string',
    description: description,
    initialValue: initialValue,
    validation: Rule => tooLong(Rule, 30),
  });
}

const board = defineArrayMember({
  type: 'object',
  title: 'Board',
  fields: [
    defineField({
      name: 'boardId',
      title: 'Board',
      type: 'string',
      description: 'Pick the board by name. If the list cannot be read, type the board number instead, up to 20 digits.',
      components: { input: BoardInput },
      validation: Rule => [
        Rule.required().error('Pick the board.'),
        tooLong(Rule, 20),
        Rule.regex(/^[0-9]+$/, { name: 'digits' }).error('Use digits only.'),
      ],
    }),
    defineField({
      name: 'team',
      title: 'Team',
      type: 'reference',
      to: [{ type: 'team' }],
      description: 'Which team the tasks of this board are for.',
      options: { filter: 'active != false' },
      validation: Rule => Rule.required().error('Pick the team.'),
    }),
    columnField('statusColumn', 'Status column', 'The column with the status of each item. If the list cannot be read, type the column id, up to 50 characters.', StatusColumnInput, true),
    labelField('backlogLabel', 'Backlog label', 'The status label that means the task is not started. Up to 30 characters.', 'Backlog'),
    labelField('progressLabel', 'In progress label', 'The status label that means the task is being worked on. Up to 30 characters.', 'Working on it'),
    labelField('doneLabel', 'Done label', 'The status label that means the task is finished. Up to 30 characters.', 'Done'),
    columnField('priorityColumn', 'Priority column', 'Optional. The column with the priority. If the list cannot be read, type the column id, up to 50 characters.', PriorityColumnInput, false),
    labelField('priorityHigh', 'High label', 'Optional. The priority label that means high. Up to 30 characters.', 'High'),
    labelField('priorityMedium', 'Medium label', 'Optional. The priority label that means medium. Up to 30 characters.', 'Medium'),
    labelField('priorityLow', 'Low label', 'Optional. The priority label that means low. Up to 30 characters.', 'Low'),
    columnField('dueColumn', 'Due date column', 'Optional. The column with the due date. If the list cannot be read, type the column id, up to 50 characters.', DueColumnInput, false),
    columnField('ownerColumn', 'Owner column', 'Optional. The column with the owner, used when owner names are on. If the list cannot be read, type the column id, up to 50 characters.', OwnerColumnInput, false),
    columnField('teamColumn', 'Subteam column', 'Optional. The column that names the Team lead. Empty uses the group names. If the list cannot be read, type the column id, up to 50 characters.', TeamColumnInput, false),
  ],
  preview: {
    select: { board: 'boardId', team: 'team.name', backlog: 'backlogLabel', progress: 'progressLabel', done: 'doneLabel' },
    prepare(entry) {
      const labels = [entry.backlog, entry.progress, entry.done].filter(Boolean).join(' / ');
      return { title: entry.board ? 'Board ' + entry.board : 'Board with no number', subtitle: [entry.team || 'No team', labels].filter(Boolean).join(' · ') };
    },
  },
});

export function mondayFields() {
  return [
    defineField({
      name: 'mondayConnection',
      title: 'Monday connection from the Mini',
      type: 'string',
      group: 'monday',
      readOnly: true,
      description: 'Who the token belongs to and when the Mini last read Monday. The Mini writes this by itself, so there is nothing to type here.',
      components: { input: MondayStatusInput },
    }),

    defineField({
      name: 'mondayBoards',
      title: 'Boards',
      type: 'array',
      group: 'monday',
      description: 'The boards the screen reads, one entry for each, up to ' + mostBoards + '. The Mini reads them every 10 minutes and each item becomes a task.',
      of: [board],
      validation: Rule => Rule.max(mostBoards).error('Up to ' + mostBoards + ' boards can be read.'),
    }),

    defineField({
      name: 'mondayShowOwners',
      title: 'Show owner first names on the TV',
      type: 'boolean',
      group: 'monday',
      description: 'On: the first name of the owner of an item goes with its task. Off: no name from the board is kept.',
      initialValue: false,
    }),
  ];
}
