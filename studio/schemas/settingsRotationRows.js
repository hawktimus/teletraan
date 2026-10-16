// The one ordered rotation list of Dashboard Settings (docs/views.md, "The rotation"), in the Look tab.
//
//   transitionSeconds  how long a whole panel or view transition takes, 2 to 4 seconds, 3 to start with (dashboard/config.js)
//   rotationRows  the rows the large panel plays, top to bottom, each { view, panel, seconds, shown }. Drag a row to move it.
//                 Shown off keeps the row in its place and plays nothing. Rows that follow each other in one view are a block,
//                 and the screen changes view only between blocks.
//
// The stored name rotation is the Ticker block of the same page, so the list has its own name. The panel is the id of
// dashboard/registry.js, as in every other list. While the list is empty the screen plays the lists of the views, and the
// first time the page is opened the list is filled from them (inputs/rotation-input.js).
//
// To take the section out later: delete this file, its import and the line in dashboardSettings.js, and the same names in
// tests/schemas.test.mjs and config.js.

import { defineField, defineArrayMember } from 'sanity';
import { RotationInput } from '../inputs/rotation-input.js';
import { largePanels, mondayPanels, olderMondayPanels, panelTitle, placeholderPanels } from '../inputs/screen-panels.js';
import { rotationViewNames } from '../tools/rotation-migrate.js';

const viewChoices = [
  { title: 'Robotics', value: 'robotics' },
  { title: 'Prime', value: 'prime' },
  { title: 'Nova', value: 'nova' },
];

const panelChoices = largePanels.concat(placeholderPanels, mondayPanels);

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
      options: { list: panelChoices },
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
    defineField({ name: 'department', title: 'Department', type: 'string', hidden: true, description: 'The Team lead a Monday tasks row plays. Empty plays every one.' }),
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
      title: 'Rotation',
      type: 'array',
      group: 'look',
      description: 'What the large panel plays, top to bottom, then again. Drag a row to move it. Rows of one view in a row are a block. Empty plays the lists of the views.',
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
