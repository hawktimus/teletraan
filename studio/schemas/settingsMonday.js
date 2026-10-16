// The Monday tab of Dashboard Settings: how the Mini reads the two boards of the Monday
// workspace and how an item becomes a task or a milestone (docs/monday.md). It has:
//
//   mondayConnection       a read only block that says who the token belongs to, when the Mini last
//                          read Monday, how often it reads and how many tasks it made
//                          (../monday-status-input.js). It stores nothing
//   mondayTokenTest        the Test the token button (../monday-token-input.js). It stores nothing
//   mondayEveryMinutes     how often the Mini reads, 5 to 120 minutes
//   mondayTaskBoard        the task board: its number, the column of each field, the tables that say
//                          what each label index means, and the text of the Hide label
//   mondayMilestoneBoard   the milestones board, the same way
//   mondayShowOwners       whether the first names of the people in Assigned are kept, off to start with
//   mondayBoards           not used any more: the rows of the older tab, hidden and kept so that nothing
//                          typed is lost. The Mini ignores them
//
// The boards and the columns are picked from lists that the Mini fills in (../monday-pickers.js), so
// nobody types a number. Each column list shows only the columns of the board picked in the same block.
// The lists fall back to a plain box when they cannot be read.
//
// A label is read by its index and not by its text, because students rename labels. The tables are
// rows of an index and what it means: a team (blank means both teams), a Team lead for a department
// (blank means the Team lead with the name on the row), and Unassigned is marked as never shown.
//
// The names and the starting values are the same as mondayEveryMinutes, mondayTaskBoard, mondayMilestoneBoard
// and mondayShowOwners in defaultSettings in dashboard/config.js, and the same as the values at the top of
// mini/scripts/monday-sync.sh. tests/schemas.test.mjs and tests/monday-sync.test.mjs fail if they differ.
//
// None of the fields is required on the page: Dashboard Settings published before these fields existed has
// none, and the Mini then reads the boards with the starting values.
//

import { defineField, defineArrayMember } from 'sanity';
import { tooLong } from './fields.js';
import { board, mostBoards, columnId } from './settingsMondayBoards.js';
import { MondayStatusInput } from '../inputs/monday-status-input.js';
import { MondayTokenInput } from '../inputs/monday-token-input.js';
import { BoardInput, StatusColumnInput, PriorityColumnInput, OwnerColumnInput, TimelineColumnInput, HoursColumnInput, DateColumnInput, RelationColumnInput } from '../inputs/monday-pickers.js';

// The starting values of the two blocks. Whoever edits them edits defaultSettings in dashboard/config.js too.
const taskBoardStart = {
  boardId: '18435126893',
  departmentColumn: 'color_mm82nvea',
  statusColumn: 'color_mkv6tatz',
  teamColumn: 'color_mm82jgxg',
  priorityColumn: 'color_mm82wfy',
  showColumn: 'color_mm83p12x',
  assignedColumn: 'multiple_person_mm82cqbx',
  pocColumn: 'multiple_person_mm8331h1',
  timelineColumn: 'timerange_mkyp8kx7',
  hoursColumn: 'numeric_mm82pw1a',
  completedColumn: 'date_mm82kn5v',
  milestoneColumn: 'board_relation_mm83phwy',
  teamLabels: [{ index: 1, team: { _type: 'reference', _ref: 'team-prime' } }, { index: 0, team: { _type: 'reference', _ref: 'team-nova' } }, { index: 5 }],
  statusIndexes: { todo: 5, inProgress: 0, inReview: 3, stuck: 2, done: 1 },
  priorityIndexes: { high: 2, medium: 0, low: 1 },
  hideLabel: 'Hide',
  departmentLabels: [
    { index: 0, name: 'Electrical' },
    { index: 1, name: 'Build' },
    { index: 2, name: 'Programming' },
    { index: 3, name: 'Design' },
    { index: 4, name: 'CNC' },
    { index: 5, name: 'Unassigned', neverShown: true },
    { index: 6, name: 'Strategy' },
    { index: 7, name: 'Business' },
    { index: 8, name: 'Marketing' },
    { index: 9, name: 'Operations' },
  ],
};

const milestoneBoardStart = {
  boardId: '18435272887',
  dateColumn: 'date_mm83y6zw',
  teamColumn: 'color_mm83be52',
  departmentColumn: 'color_mm83f77w',
  statusColumn: 'color_mm83ndkf',
  teamLabels: [{ index: 109, team: { _type: 'reference', _ref: 'team-prime' } }, { index: 8, team: { _type: 'reference', _ref: 'team-nova' } }, { index: 5 }],
  statusIndexes: { notStarted: 5, onTrack: 1, atRisk: 2, done: 3 },
  departmentLabels: [
    { index: 107, name: 'Build' },
    { index: 9, name: 'Electrical' },
    { index: 19, name: 'Programming' },
    { index: 1, name: 'Design' },
    { index: 11, name: 'CNC' },
    { index: 104, name: 'Strategy' },
    { index: 0, name: 'Business' },
    { index: 18, name: 'Marketing' },
    { index: 7, name: 'Operations' },
    { index: 5, name: 'All Departments' },
  ],
};

const columnHelp = ' If the list cannot be read, type the column id, up to 50 characters.';

// A column of one of the two boards, picked from the columns of the board in the same block
function blockColumn(name, title, description, input) {
  return defineField({
    name: name,
    title: title,
    type: 'string',
    description: description + columnHelp,
    components: { input: input },
    validation: Rule => [tooLong(Rule, 50), Rule.regex(columnId, { name: 'column id' }).error('Use letters, digits, hyphens and underscores only.')],
  });
}

// The index of a label. Monday numbers its labels, and the number is what the Mini reads.
function indexField(name, title, description) {
  return defineField({
    name: name,
    title: title,
    type: 'number',
    description: description,
    validation: Rule => [Rule.integer().error('Use a whole number such as 0 or 5.'), Rule.min(0).error('Use 0 or more.'), Rule.max(999).error('Use 999 or less.')],
  });
}

function statusIndexes(name, title, description, entries) {
  return defineField({
    name: name,
    title: title,
    type: 'object',
    description: description,
    fields: entries.map(entry => indexField(entry[0], entry[1], entry[2])),
  });
}

// Which team a label index means. Blank is both teams.
function teamLabels(forBoard) {
  return defineField({
    name: 'teamLabels',
    title: 'Team labels',
    type: 'array',
    description: 'One row for each label of the Team column: its index, and the team it means. Leave the team blank for both teams. Up to 10 rows.',
    of: [
      defineArrayMember({
        type: 'object',
        title: 'Team label',
        fields: [
          indexField('index', 'Label index', 'The index of the label in Monday. ' + forBoard),
          defineField({ name: 'team', title: 'Team', type: 'reference', to: [{ type: 'team' }], description: 'Leave blank when the label means both teams.', options: { filter: 'active != false' } }),
        ],
        preview: {
          select: { index: 'index', team: 'team.name' },
          prepare(entry) {
            return { title: 'Label ' + (typeof entry.index === 'number' ? entry.index : 'with no index'), subtitle: entry.team || 'Both teams' };
          },
        },
      }),
    ],
    validation: Rule => Rule.max(10).error('Up to 10 rows fit. Remove one.'),
  });
}

// Which Team lead a department label index means. A row with no Team lead is matched to the Team lead
// that has the same name as the row. A row marked never shown (Unassigned) gives no Team lead at all.
function departmentLabels(withNeverShown) {
  const fields = [
    indexField('index', 'Label index', 'The index of the label in Monday.'),
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      description: 'The department as the team says it. With no Team lead picked, the Team lead with this name is used. Up to 30 characters.',
      validation: Rule => tooLong(Rule, 30),
    }),
    defineField({ name: 'subteam', title: 'Team lead', type: 'reference', to: [{ type: 'subteam' }], description: 'Optional. The Team lead of this department. Leave blank to use the Team lead with the same name.' }),
  ];
  if (withNeverShown) {
    fields.push(defineField({ name: 'neverShown', title: 'Never shown', type: 'boolean', description: 'On: a task with this label is kept off the TV. Unassigned is on. A task with no department is counted and not shown.', initialValue: false }));
  }

  return defineField({
    name: 'departmentLabels',
    title: 'Department labels',
    type: 'array',
    description: 'One row for each label of the Department column. Up to 30 rows.',
    of: [
      defineArrayMember({
        type: 'object',
        title: 'Department label',
        fields: fields,
        preview: {
          select: { index: 'index', name: 'name', lead: 'subteam.name', never: 'neverShown' },
          prepare(entry) {
            const label = (typeof entry.index === 'number' ? entry.index + ' · ' : '') + (entry.name || 'with no name');
            return { title: label, subtitle: entry.never ? 'Never shown' : entry.lead || 'Team lead with the same name' };
          },
        },
      }),
    ],
    validation: Rule => Rule.max(30).error('Up to 30 rows fit. Remove one.'),
  });
}

const taskBoardBlock = defineField({
  name: 'mondayTaskBoard',
  title: 'Task board',
  type: 'object',
  group: 'monday',
  description: 'The board with the tasks: its number, the column of each field, and what each label means. The starting values are the rebuilt workspace.',
  options: { collapsible: true, collapsed: false },
  initialValue: taskBoardStart,
  fields: [
    defineField({
      name: 'boardId',
      title: 'Board',
      type: 'string',
      description: 'Pick the board by name. If the list cannot be read, type the board number instead, up to 20 digits.',
      components: { input: BoardInput },
      validation: Rule => [tooLong(Rule, 20), Rule.regex(/^[0-9]+$/, { name: 'digits' }).error('Use digits only.')],
    }),
    blockColumn('departmentColumn', 'Department column', 'The column with the department of each task. A task with no department is never shown.', StatusColumnInput),
    blockColumn('statusColumn', 'Status column', 'The status of each task. The column decides, not the group.', StatusColumnInput),
    blockColumn('teamColumn', 'Team column', 'The column that says which team a task is for.', StatusColumnInput),
    blockColumn('priorityColumn', 'Priority column', 'The column with the priority.', PriorityColumnInput),
    blockColumn('showColumn', 'Show on TV column', 'The column that hides a task from the TV when it holds the Hide label.', StatusColumnInput),
    blockColumn('assignedColumn', 'Assigned column', 'The people working on a task. Their first names are kept only when owner names are on.', OwnerColumnInput),
    blockColumn('pocColumn', 'POC column', 'The person to ask about a task. Only the first person and only the first name are kept.', OwnerColumnInput),
    blockColumn('timelineColumn', 'Timeline column', 'The start and end day of a task. The end day is the due date.', TimelineColumnInput),
    blockColumn('hoursColumn', 'Estimated Hours column', 'The hours a task needs, which weight the progress.', HoursColumnInput),
    blockColumn('completedColumn', 'Date Completed column', 'The day a task was finished.', DateColumnInput),
    blockColumn('milestoneColumn', 'Milestone column', 'The column that links a task to a milestone.', RelationColumnInput),
    teamLabels('In the rebuilt workspace Prime is 1, Nova is 0 and General is 5.'),
    statusIndexes('statusIndexes', 'Status indexes', 'The index of each label of the Status column.', [
      ['todo', 'To Do', 'The index of To Do. A status that nobody set reports 5.'],
      ['inProgress', 'In Progress', 'The index of In Progress.'],
      ['inReview', 'In Review', 'The index of In Review.'],
      ['stuck', 'Stuck', 'The index of Stuck.'],
      ['done', 'Done', 'The index of Done.'],
    ]),
    statusIndexes('priorityIndexes', 'Priority indexes', 'The index of each label of the Priority column. Any other index means no priority.', [
      ['high', 'High', 'The index of High.'],
      ['medium', 'Medium', 'The index of Medium.'],
      ['low', 'Low', 'The index of Low.'],
    ]),
    defineField({
      name: 'hideLabel',
      title: 'Hide label text',
      type: 'string',
      description: 'The label of the Show on TV column that hides a task. It is read by its text, so type it the way Monday spells it. Up to 30 characters.',
      initialValue: 'Hide',
      validation: Rule => tooLong(Rule, 30),
    }),
    departmentLabels(true),
  ],
});

const milestoneBoardBlock = defineField({
  name: 'mondayMilestoneBoard',
  title: 'Milestones board',
  type: 'object',
  group: 'monday',
  description: 'The board with the milestones. A milestone with no target date, or a name that starts with EXAMPLE, is skipped.',
  options: { collapsible: true, collapsed: true },
  initialValue: milestoneBoardStart,
  fields: [
    defineField({
      name: 'boardId',
      title: 'Board',
      type: 'string',
      description: 'Pick the board by name. If the list cannot be read, type the board number instead, up to 20 digits.',
      components: { input: BoardInput },
      validation: Rule => [tooLong(Rule, 20), Rule.regex(/^[0-9]+$/, { name: 'digits' }).error('Use digits only.')],
    }),
    blockColumn('dateColumn', 'Target Date column', 'The column with the target date of each milestone.', DateColumnInput),
    blockColumn('teamColumn', 'Team column', 'The column that says which team a milestone is for.', StatusColumnInput),
    blockColumn('departmentColumn', 'Department column', 'The column that says which department a milestone is for.', StatusColumnInput),
    blockColumn('statusColumn', 'Status column', 'The column with the status of each milestone.', StatusColumnInput),
    teamLabels('In the rebuilt workspace Prime is 109, Nova is 8 and Both Teams is 5.'),
    statusIndexes('statusIndexes', 'Status indexes', 'The index of each label of the Status column.', [
      ['notStarted', 'Not Started', 'The index of Not Started. A status that nobody set reports 5.'],
      ['onTrack', 'On Track', 'The index of On Track.'],
      ['atRisk', 'At Risk', 'The index of At Risk.'],
      ['done', 'Done', 'The index of Done.'],
    ]),
    departmentLabels(false),
  ],
});

export function mondayFields() {
  return [
    defineField({
      name: 'mondayConnection',
      title: 'Monday connection from the Mini',
      type: 'string',
      group: 'monday',
      readOnly: true,
      description: 'Who the token belongs to, when the Mini last read, how often, the reads used today and the tasks made. There is nothing to type here.',
      components: { input: MondayStatusInput },
    }),

    defineField({
      name: 'mondayTokenTest',
      title: 'Test the token',
      type: 'string',
      group: 'monday',
      readOnly: true,
      description: 'Asks the Mini, through the control page, who the Monday token belongs to. It shows the account name or the error. It stores nothing.',
      components: { input: MondayTokenInput },
    }),

    defineField({
      name: 'mondayEveryMinutes',
      title: 'How often',
      type: 'number',
      group: 'monday',
      description: 'How often the Mini reads the boards. The free plan allows about 1,000 reads a day; 30 minutes uses about 150.',
      initialValue: 30,
      validation: Rule => [Rule.integer().error('Use a whole number of minutes.'), Rule.min(5).error('Use 5 minutes or more.'), Rule.max(120).error('Use 120 minutes or less.')],
    }),

    taskBoardBlock,
    milestoneBoardBlock,

    defineField({
      name: 'mondayShowOwners',
      title: 'Show owner first names on the TV',
      type: 'boolean',
      group: 'monday',
      description: 'On: the first names of the people in Assigned go with a task. Off: only the first name of the POC is kept.',
      initialValue: false,
    }),

    // Kept, and hidden, so that rows typed earlier still open and publish. The Mini ignores them.
    defineField({
      name: 'mondayBoards',
      title: 'Boards',
      type: 'array',
      group: 'monday',
      hidden: true,
      description: 'Not used any more. The task board and the milestones board above replace these rows. The Mini ignores them.',
      of: [board],
      validation: Rule => Rule.max(mostBoards).error('Up to ' + mostBoards + ' boards can be read.'),
    }),
  ];
}
