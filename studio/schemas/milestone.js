// A milestone of the season, made by the Mini from the milestones board of Monday
// (deploy/scripts/monday-sync.sh, docs/monday.md). Nobody types one: it is read only here, and
// listed under Monday Boards, Milestones. The screen shows the next three on the Overall
// progress panel and weighs each by the hours of the tasks that link to it.
//
// A team of none means both teams, and a Team lead of none means all departments. A milestone
// that is gone from the board is switched off with show and never deleted.

import { defineType, defineField } from 'sanity';
import { tooLong, aToZ, titleOf, teamField } from './fields.js';

const statuses = [
  { title: 'Not started', value: 'not-started' },
  { title: 'On track', value: 'on-track' },
  { title: 'At risk', value: 'at-risk' },
  { title: 'Done', value: 'done' },
];

const byDate = {
  title: 'Target date',
  name: 'targetDate',
  by: [{ field: 'targetDate', direction: 'asc' }],
};

export default defineType({
  name: 'milestone',
  title: 'Milestone',
  type: 'document',
  readOnly: true,
  fields: [
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      description: 'What is due, in a few words. The Mini writes it from the board. Up to 40 characters fit.',
      validation: Rule => tooLong(Rule, 40),
    }),
    defineField({ name: 'targetDate', title: 'Target date', type: 'date', description: 'The day the milestone is due. The Mini writes it from the board.' }),
    teamField(),
    defineField({ name: 'subteam', title: 'Team lead', type: 'reference', to: [{ type: 'subteam' }], description: 'Which department the milestone is for. Empty means all departments.' }),
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      description: 'Where the milestone stands.',
      options: { list: statuses },
      initialValue: 'not-started',
    }),
    defineField({ name: 'show', title: 'Show on screen', type: 'boolean', description: 'Off when the milestone has gone from the board. The Mini sets it.', initialValue: true }),
  ],
  orderings: [byDate, aToZ('name')],
  preview: {
    select: { title: 'name', date: 'targetDate', status: 'status', team: 'team.name', show: 'show' },
    prepare(item) {
      const line = [item.date, titleOf(statuses, item.status), item.team || 'Both teams', item.show === false ? 'Gone from the board' : ''].filter(Boolean).join(' · ');
      return { title: item.title || 'Milestone with no name', subtitle: line };
    },
  },
});
