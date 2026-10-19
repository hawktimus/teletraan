// The one ordered rotation list of Dashboard Settings (docs/views.md, "The rotation"). Editors change it on the Rotation page (inputs/rotation-board-view.js);
// the field is in the Advanced tab as the full form.
//
//   transitionSeconds  how long a whole panel or view transition takes, 2 to 4 seconds, 3 to start with (dashboard/config.js)
//   rotationRows  the rows the large panel plays, top to bottom, each { view, panel, seconds, shown }, and for the two Monday
//                 panels department, list, chart and team. Drag a row to move it.
//                 Shown off keeps the row in its place and plays nothing. Rows that follow each other in one view are a block,
//                 and the screen changes view only between blocks.
//
// The stored name rotation is the Ticker block of the same page, so the list has its own name. The panel is the id of
// dashboard/registry.js, as in every other list. While the list has no Shown row the screen plays the default rotation, and the
// first time the page is opened the list is filled with it (inputs/rotation-input.js, tools/default-rotation.js).
//
// To take the section out later: delete this file, its import and the line in dashboardSettings.js, and the same names in
// tests/schemas.test.mjs and config.js.

import { defineField, defineArrayMember } from 'sanity';
import { RotationInput } from '../inputs/rotation-input.js';
import { rotationPanels, largePanels, mondayPanels, olderMondayPanels, pairedPanels, panelTitle, placeholderPanels, smallPanels } from '../inputs/screen-panels.js';
import { rotationViewNames } from '../tools/rotation-migrate.js';

const viewChoices = [
  { title: 'Robotics', value: 'robotics' },
  { title: 'Prime', value: 'prime' },
  { title: 'Nova', value: 'nova' },
];

const panelChoices = largePanels.concat(rotationPanels, placeholderPanels, mondayPanels);
const sideChoices = smallPanels.concat(pairedPanels);

const isPhoto = context => Boolean(context.parent) && context.parent.panel === 'photo';

const rotationRow = defineArrayMember({
  type: 'object',
  title: 'Row',
  fields: [
    defineField({
      name: 'view',
      title: 'View',
      type: 'string',
      description: 'Which view this row plays in. Rows of one view that follow each other are one block.',
      options: { list: viewChoices, layout: 'radio', direction: 'horizontal' },
      validation: Rule => [Rule.required().error('Pick a view.'), Rule.valid(rotationViewNames).error('Pick robotics, prime or nova.')],
    }),
    defineField({
      name: 'panel',
      title: 'Panel',
      type: 'string',
      description: 'Which panel this row plays. A row whose panel has nothing to show right now is skipped.',
      // The retired Monday panels stay in the list: Sanity also checks a value against options.list, and a stored row that
      // names one must not stop Dashboard Settings from being published. The board and the Display tab offer only the others.
      options: { list: panelChoices.concat(olderMondayPanels) },
      validation: Rule => [Rule.required().error('Pick a panel.'), Rule.valid(panelChoices.concat(olderMondayPanels).map(panel => panel.value)).error('Pick a panel from the list.')],
    }),
    defineField({
      name: 'seconds',
      title: 'Seconds on screen',
      type: 'number',
      description: 'How long the row stays, from 6 to 120. Empty follows Seconds per page.',
      hidden: isPhoto,
      validation: Rule => Rule.integer().min(6).max(120).error('Use a whole number from 6 to 120.'),
    }),
    defineField({
      name: 'shown',
      title: 'Shown',
      type: 'boolean',
      description: 'Turn this off to skip the row without taking it out of the list.',
      initialValue: true,
    }),
    defineField({
      name: 'side',
      title: 'Small panel beside it',
      type: 'string',
      description: 'The small panel shown beside this row in the split layout. Empty follows the small panels of the view.',
      options: { list: sideChoices },
      validation: Rule => Rule.valid(sideChoices.map(panel => panel.value).concat([undefined, ''])).error('Pick a small panel from the list.'),
    }),
    defineField({ name: 'part', title: 'Part', type: 'number', hidden: true, description: 'For Events, Subteam roster and Team leads: 1 plays the first page and 2 the next pages. Empty plays all.', validation: Rule => Rule.integer().min(1).max(2).error('Use 1 or 2.') }),
    defineField({ name: 'department', title: 'Department', type: 'string', hidden: true, description: 'The department a row plays: one of the nine Monday departments for Department tasks, or a Team lead name such as build (two with a comma) for the roster.' }),
    defineField({ name: 'list', title: 'List', type: 'string', hidden: true, description: 'For Department tasks: open (To Do, In Progress, In Review, Stuck) or done.', options: { list: ['open', 'done'] } }),
    defineField({ name: 'chart', title: 'Chart', type: 'string', hidden: true, description: 'For the TV charts: status, progress or timeline.', options: { list: ['status', 'progress', 'timeline'] } }),
    defineField({ name: 'team', title: 'Team', type: 'string', hidden: true, description: 'For the two Monday panels: the tasks of prime or nova. Empty shows both teams.', options: { list: ['prime', 'nova'] } }),
    defineField({ name: 'photoCount', title: 'Photos', type: 'number', hidden: true, description: 'How many photos a Photo row shows.', validation: Rule => Rule.integer().min(1).max(20).error('Use a whole number from 1 to 20.') }),
    defineField({ name: 'secondsPerPhoto', title: 'Seconds per photo', type: 'number', hidden: true, description: 'How long each photo stays.', validation: Rule => Rule.integer().min(5).max(60).error('Use a whole number from 5 to 60.') }),
  ],
  preview: {
    select: { view: 'view', panel: 'panel', shown: 'shown', seconds: 'seconds' },
    prepare(row) {
      const view = (viewChoices.filter(choice => choice.value === row.view)[0] || { title: 'No view' }).title;
      const words = [view, row.seconds ? row.seconds + ' seconds' : 'Follows Seconds per page'];
      if (row.shown === false) words.push('Not shown');
      return { title: panelTitle(row.panel) || 'Panel not chosen', subtitle: words.join(' · ') };
    },
  },
});

export function rotationRowsFields() {
  return [
    defineField({
      name: 'rotationRows',
      title: 'Rotation (full form)',
      type: 'array',
      group: 'advanced',
      description: 'The same list as the Rotation page in the sidebar. Use that page. This form is only for a row the page cannot fix.',
      of: [rotationRow],
      components: { input: RotationInput },
    }),
    defineField({
      name: 'transitionSeconds',
      title: 'Transition length',
      type: 'number',
      group: 'look',
      description: 'Seconds the whole change between two panels, or two views, takes, from 2 to 4. Starts at 3.',
      initialValue: 3,
      validation: Rule => Rule.min(2).max(4).error('Use a number from 2 to 4.'),
    }),
  ];
}
