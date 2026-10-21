// The Monday tab of Dashboard Settings (docs/monday.md). The Teletraan computer reads the two boards of the team, Robotics
// Tasks and Completed Tasks, by their numbers, which are in computer/scripts/monday-contract.sh with their columns and labels.
// Nothing about a board is typed here any more. The tab has:
//
//   mondayConnection       a note that says where the tasks are shown (the Monday page) and where the panels are chosen
//                          (the Rotation board). It stores nothing
//   mondayEveryMinutes     how often the Teletraan computer reads, 5 to 120 minutes
//
// Kept, hidden, so that nothing typed before is lost and Dashboard Settings still publishes: mondayTokenTest (a link that
// stored nothing), mondayTaskBoard and mondayMilestoneBoard (the board numbers, column ids and label tables the older sync
// read), mondayShowOwners and mondayBoards. The Teletraan computer reads none of them.

import { defineField, defineArrayMember } from 'sanity';
import { noteField, tooLong } from './fields.js';
import { board, mostBoards, columnId } from './settingsMondayBoards.js';

// The starting values of the two hidden blocks, as the older sync had them (defaultSettings in dashboard/config.js)
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

const columnHelp = ' Not read any more. Up to 50 characters.';

// A column of one of the two boards, picked from the columns of the board in the same block
function blockColumn(name, title, description) {
  return defineField({
    name: name,
    title: title,
    type: 'string',
    description: description + columnHelp,
    validation: Rule => [tooLong(Rule, 50), Rule.regex(columnId, { name: 'column id' }).error('Use letters, digits, hyphens and underscores only.')],
  });
}

// The index of a label. Monday numbers its labels, and the number is what the Teletraan computer reads.
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
  group: 'advanced',
  hidden: true,
  description: 'Not read any more: the board with the tasks, the column of each field and what each label means, as the older sync read them.',
  options: { collapsible: true, collapsed: true },
  initialValue: taskBoardStart,
  fields: [
    defineField({
      name: 'boardId',
      title: 'Board',
      type: 'string',
      description: 'Pick the board by name. If the list cannot be read, type the board number instead, up to 20 digits.',
      validation: Rule => [tooLong(Rule, 20), Rule.regex(/^[0-9]+$/, { name: 'digits' }).error('Use digits only.')],
    }),
    blockColumn('departmentColumn', 'Department column', 'The column with the department of each task. A task with no department is never shown.'),
    blockColumn('statusColumn', 'Status column', 'The status of each task. The column decides, not the group.'),
    blockColumn('teamColumn', 'Team column', 'The column that says which team a task is for.'),
    blockColumn('priorityColumn', 'Priority column', 'The column with the priority.'),
    blockColumn('showColumn', 'Show on TV column', 'The column that hides a task from the TV when it holds the Hide label.'),
    blockColumn('assignedColumn', 'Assigned column', 'The people working on a task. Their first names are kept only when owner names are on.'),
    blockColumn('pocColumn', 'POC column', 'The person to ask about a task. Only the first person and only the first name are kept.'),
    blockColumn('timelineColumn', 'Timeline column', 'The start and end day of a task. The end day is the due date.'),
    blockColumn('hoursColumn', 'Estimated Hours column', 'The hours a task needs, which weight the progress.'),
    blockColumn('completedColumn', 'Date Completed column', 'The day a task was finished.'),
    blockColumn('milestoneColumn', 'Milestone column', 'The column that links a task to a milestone.'),
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
  group: 'advanced',
  hidden: true,
  description: 'Not read any more: the milestones board of the older sync and its columns.',
  options: { collapsible: true, collapsed: true },
  initialValue: milestoneBoardStart,
  fields: [
    defineField({
      name: 'boardId',
      title: 'Board',
      type: 'string',
      description: 'Pick the board by name. If the list cannot be read, type the board number instead, up to 20 digits.',
      validation: Rule => [tooLong(Rule, 20), Rule.regex(/^[0-9]+$/, { name: 'digits' }).error('Use digits only.')],
    }),
    blockColumn('dateColumn', 'Target Date column', 'The column with the target date of each milestone.'),
    blockColumn('teamColumn', 'Team column', 'The column that says which team a milestone is for.'),
    blockColumn('departmentColumn', 'Department column', 'The column that says which department a milestone is for.'),
    blockColumn('statusColumn', 'Status column', 'The column with the status of each milestone.'),
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
    Object.assign(noteField('mondayConnection', 'Robotics Tasks and Completed Tasks are read by number. See the Monday page, the Rotation board, and the control page, Settings, Monitor Monday.', 'monday'), { title: 'Monday' }),

    // Kept, and hidden: it was a link and stored nothing
    defineField({ name: 'mondayTokenTest', title: 'Check the token', type: 'string', group: 'monday', readOnly: true, hidden: true, description: 'Not used any more. The token is checked on the control page, Settings, Monitor Monday.' }),

    defineField({
      name: 'mondayEveryMinutes',
      title: 'How often',
      type: 'number',
      group: 'monday',
      description: 'How often the Teletraan computer reads the boards. The free plan allows about 1,000 reads a day; 30 minutes uses about 150.',
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
      hidden: true,
      description: 'Not read any more: the contact of a task is always the first name of the first person in Assigned.',
      initialValue: false,
    }),

    // Kept, and hidden, so that rows typed earlier still open and publish. The Teletraan computer ignores them.
    defineField({
      name: 'mondayBoards',
      title: 'Boards',
      type: 'array',
      group: 'monday',
      hidden: true,
      description: 'Not used any more. The task board and the milestones board above replace these rows. The Teletraan computer ignores them.',
      of: [board],
      validation: Rule => Rule.max(mostBoards).error('Up to ' + mostBoards + ' boards can be read.'),
    }),
  ];
}
