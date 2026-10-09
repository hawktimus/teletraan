// The Demo page: one document with the fixed id 'demo' (see structure.js). It has no
// buttons and no line in the sidebar now: the Start here page has the ones that try the
// screen. The type and its fields stay so that the document already in Studio opens and
// publishes as it was. The dashboard reads it with the rest of the content and plays the
// steps in dashboard/core/demo.js. The starting values are the same as defaultDemo in
// dashboard/config.js.
//
// The list of screens comes from ../demo-screens.js, a copy of the dashboard's
// registry that check-schemas.mjs keeps in step.

import { defineType, defineField, defineArrayMember } from 'sanity';
import { tooLong } from './fields.js';
import { demoScreens } from '../demo-screens.js';

const screenChoices = demoScreens.map(screen => ({ title: screen.name, value: screen.id }));

const startingSteps = [
  { screen: 'announcement', seconds: 30 },
  { screen: 'night-mode', seconds: 30 },
];

const requestedAtField = defineField({
  name: 'requestedAt',
  title: 'Requested at',
  type: 'datetime',
  description: 'The time a demo was last asked for. You cannot type here.',
  readOnly: true,
});

const stepMember = defineArrayMember({
  type: 'object',
  title: 'Step',
  fields: [
    defineField({
      name: 'screen',
      title: 'Screen',
      type: 'string',
      description: 'The screen to show in this step.',
      options: { list: screenChoices },
      validation: Rule => [
        Rule.required().error('Pick a screen.'),
        Rule.valid(screenChoices.map(choice => choice.value)).error('Pick a screen from the list.'),
      ],
    }),
    defineField({
      name: 'seconds',
      title: 'Seconds',
      type: 'number',
      description: 'How long the screen stays, from 5 to 300 seconds.',
      initialValue: 30,
      validation: Rule => [
        Rule.required().error('Enter the number of seconds.'),
        Rule.integer().min(5).max(300).error('Use a whole number from 5 to 300.'),
      ],
    }),
  ],
  preview: {
    select: { screen: 'screen', seconds: 'seconds' },
    prepare(step) {
      const choice = screenChoices.filter(item => item.value === step.screen)[0];
      return {
        title: choice ? choice.title : 'Step with no screen',
        subtitle: step.seconds ? step.seconds + ' seconds' : '',
      };
    },
  },
});

const stepsField = defineField({
  name: 'steps',
  title: 'Steps',
  type: 'array',
  description: 'The screens a demo shows, one after the other. The demo plays once, then the screen goes back to normal.',
  of: [stepMember],
  initialValue: startingSteps,
  validation: Rule => Rule.max(10).error('Too many steps. Up to 10 are allowed.'),
});

const announcementTextField = defineField({
  name: 'announcementText',
  title: 'Demo announcement text',
  type: 'string',
  description: 'Optional. The words of the Announcement step. Leave empty to use the first announcement. Up to 24 characters fit.',
  validation: Rule => tooLong(Rule, 24),
});

export default defineType({
  name: 'demo',
  title: 'Demo',
  type: 'document',
  fields: [requestedAtField, stepsField, announcementTextField],
});
