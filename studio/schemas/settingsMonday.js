// The Monday tab of Dashboard Settings: which boards of the team's Monday account the
// Mini reads, and how an item becomes a task (docs/monday.md). It has:
//
//   mondayConnection   a read only block that says who the token belongs to and when the
//                      Mini last read Monday (../monday-status-input.js). It stores nothing
//   mondayBoards       one entry for each board the screen reads. An entry has the board and
//                      its team (blank for both teams), where the status comes from (the group names of the board, or
//                      a status column with the labels that mean being worked on and finished,
//                      and any other status is Backlog), and optional columns for the priority,
//                      the due date, the owner and the subteam
//   mondayShowOwners   whether the first name of the owner of an item is kept, off to start with
//
// The board and the columns are picked from lists that the Mini fills in (../monday-pickers.js),
// so nobody types a number. Each column list shows only the columns of the board picked in the
// same entry. The lists fall back to a plain box when they cannot be read.
// The rows on a card are fixed at 2 in the backlog, 2 being worked on and 2 finished, so they
// are not a field.
//
// The names and the starting values are the same as mondayBoards and mondayShowOwners in
// defaultSettings in dashboard/config.js. check-schemas.mjs fails if they differ.
//
// None of the fields is required on the page: Dashboard Settings published before these
// fields existed has none, and the Mini then reads no board. A board entry needs its board, and
// its status column when the status comes from a column, or the Mini has nothing to read. Its
// team is optional: a board with no team makes tasks for both teams. An entry with no choice of where the status comes from reads the group names.
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

// Where the status of an item comes from. Group names is the starting choice, and what an entry
// with no choice reads. The stored values are the ones monday-sync.sh looks for.
const statusSources = [
  { title: 'Group names', value: 'groups' },
  { title: 'A status column', value: 'column' },
];

// What the entry reads its status from: the group names unless it says a column
function fromColumn({ parent }) {
  return Boolean(parent) && parent.statusFrom === 'column';
}

function fromGroups(context) {
  return !fromColumn(context);
}

// The longest board entry the Mini reads in one run, with 500 items each (deploy/scripts/monday-sync.sh)
const mostBoards = 10;

// The status column is needed only when the status comes from a column, so its rule is a custom one
// and the field is hidden under Group names. required is true for that column.
function columnField(name, title, description, input, required) {
  const rules = Rule => {
    const list = [tooLong(Rule, 50), Rule.regex(columnId, { name: 'column id' }).error('Use letters, digits, hyphens and underscores only.')];
    return required ? [Rule.custom((value, context) => (fromColumn(context) && !value ? 'Pick the status column.' : true))].concat(list) : list;
  };
  const field = { name: name, title: title, type: 'string', description: description, components: { input: input }, validation: rules };
  if (required) field.hidden = fromGroups;
  return defineField(field);
}

// A label is read only when the status comes from a column, so it is hidden under Group names.
// The priority labels belong to the priority column and are always shown.
function labelField(name, title, description, initialValue, forColumn) {
  const field = {
    name: name,
    title: title,
    type: 'string',
    description: description,
    initialValue: initialValue,
    validation: Rule => tooLong(Rule, 30),
  };
  if (forColumn) field.hidden = fromGroups;
  return defineField(field);
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
      description: 'Leave blank when it is for both teams.',
      options: { filter: 'active != false' },
    }),
    defineField({
      name: 'statusFrom',
      title: 'Status comes from',
      type: 'string',
      description: 'Group names: the group of an item gives its status, such as To Do or Done. A status column: a column gives it. With no choice, the group names are read.',
      options: { list: statusSources, layout: 'radio' },
      initialValue: 'groups',
    }),
    columnField('statusColumn', 'Status column', 'The column with the status of each item, needed when the status comes from a column. If the list cannot be read, type the column id, up to 50 characters.', StatusColumnInput, true),
    // Kept, and hidden, so that a value saved earlier still opens and publishes. The Mini no longer reads it.
    defineField({
      name: 'backlogLabel',
      title: 'Backlog label',
      type: 'string',
      hidden: true,
      description: 'Not used any more. Every status that is not the In progress label or the Done label is Backlog. Up to 30 characters.',
      initialValue: 'Backlog',
      validation: Rule => tooLong(Rule, 30),
    }),
    labelField('progressLabel', 'In progress label', 'Items with this status are In progress. Every status that is not this label or the Done label is Backlog. Up to 30 characters.', 'Working on it', true),
    labelField('doneLabel', 'Done label', 'Items with this status are Done. Every status that is not this label or the In progress label is Backlog. Up to 30 characters.', 'Done', true),
    columnField('priorityColumn', 'Priority column', 'Optional. The column with the priority. If the list cannot be read, type the column id, up to 50 characters.', PriorityColumnInput, false),
    labelField('priorityHigh', 'High label', 'Optional. The priority label that means high. Up to 30 characters.', 'High'),
    labelField('priorityMedium', 'Medium label', 'Optional. The priority label that means medium. Up to 30 characters.', 'Medium'),
    labelField('priorityLow', 'Low label', 'Optional. The priority label that means low. Up to 30 characters.', 'Low'),
    columnField('dueColumn', 'Due date column', 'Optional. A date column gives its day and a timeline column gives its end date. If the list cannot be read, type the column id, up to 50 characters.', DueColumnInput, false),
    columnField('ownerColumn', 'Owner column', 'Optional. The column with the owner, used when owner names are on. If the list cannot be read, type the column id, up to 50 characters.', OwnerColumnInput, false),
    columnField('teamColumn', 'Subteam column', 'Optional. The column that names the Team lead. Empty uses the group names. If the list cannot be read, type the column id, up to 50 characters.', TeamColumnInput, false),
  ],
  preview: {
    select: { board: 'boardId', team: 'team.name', from: 'statusFrom', progress: 'progressLabel', done: 'doneLabel' },
    prepare(entry) {
      const labels = entry.from === 'column' ? [entry.progress, entry.done].filter(Boolean).join(' / ') : 'Group names';
      return { title: entry.board ? 'Board ' + entry.board : 'Board with no number', subtitle: [entry.team || 'Both teams', labels].filter(Boolean).join(' · ') };
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
      description: 'Who the token belongs to, when the Mini last read Monday, how many boards are chosen and how many tasks the Mini has made. There is nothing to type here.',
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
