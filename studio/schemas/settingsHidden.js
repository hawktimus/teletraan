// The hidden transition fields of Dashboard Settings, in the Advanced tab: two
// rare surprise transitions that replace a normal page change of the large
// panel, and the buttons that play one now. docs/hidden-transitions.md explains
// both. Four fields:
//
//   hiddenEnabled  the master switch, on to start with
//   desktopChance  the percent of page changes that play the desktop reveal, 1 to start with
//   redEyesChance  the percent of page changes that play red eyes, 1 to start with
//   hiddenRequest  the last push from "Play desktop reveal" or "Play red eyes". It has two
//                  fields, kind and requestedAt, and both are read only: the buttons in the
//                  menu beside Publish fill them in (actions.js)
//
// The starting values and limits are the same as defaultSettings and limits in
// dashboard/config.js, and the kinds are the ones in hidden-transitions.js, a copy
// of the dashboard's registry. check-schemas.mjs fails if they differ.
//
// To take the whole section out later: delete this file, remove its import and the
// line that uses hiddenFields in dashboardSettings.js, and remove the same names
// from check-schemas.mjs and config.js. The dashboard uses the starting values
// for anything missing from the published settings.

import { defineField } from 'sanity';
import { hiddenTransitions } from '../hidden-transitions.js';

// The kinds a push can ask for: the ones in hidden-transitions.js. The list is
// only there to show which one was pushed, because the field is read only.
const kinds = hiddenTransitions.map(entry => ({ title: entry.name, value: entry.id }));

export function hiddenFields() {
  return [
    defineField({
      name: 'hiddenEnabled',
      title: 'Allow hidden transitions',
      type: 'boolean',
      group: 'advanced',
      description: 'The master switch. Off, neither hidden transition ever plays, not even when you push one with the buttons beside Publish. They never play in calm motion.',
      initialValue: true,
    }),

    defineField({
      name: 'desktopChance',
      title: 'Desktop reveal chance (percent)',
      type: 'number',
      group: 'advanced',
      description: 'How many page changes in 100 become the desktop reveal: blue glitching, then a blue error screen for 3 seconds. From 0 to 100, 0 is never.',
      initialValue: 1,
      validation: Rule => [
        Rule.required().error('Enter a percent from 0 to 100, or 0 for never.'),
        Rule.integer().min(0).max(100).error('Use a whole number from 0 to 100.'),
      ],
    }),

    defineField({
      name: 'redEyesChance',
      title: 'Red eyes chance (percent)',
      type: 'number',
      group: 'advanced',
      description: 'How many page changes in 100 become red eyes: red glitches, then a picture of two red eyes on black for a few seconds. From 0 to 100, 0 is never.',
      initialValue: 1,
      validation: Rule => [
        Rule.required().error('Enter a percent from 0 to 100, or 0 for never.'),
        Rule.integer().min(0).max(100).error('Use a whole number from 0 to 100.'),
      ],
    }),

    defineField({
      name: 'hiddenRequest',
      title: 'Last push',
      type: 'object',
      group: 'advanced',
      description: 'Filled in by the buttons Play desktop reveal and Play red eyes beside Publish, which play it on the screen within about 20 seconds. Do not edit it.',
      fields: [
        defineField({
          name: 'kind',
          title: 'Which transition',
          type: 'string',
          readOnly: true,
          description: 'The transition the last push asked for. A button fills it in.',
          options: { list: kinds, layout: 'radio', direction: 'horizontal' },
          validation: Rule => Rule.valid(kinds.map(kind => kind.value)).error('This is filled in by the Play buttons.'),
        }),
        defineField({
          name: 'requestedAt',
          title: 'Pushed at',
          type: 'datetime',
          readOnly: true,
          description: 'When the last push was made. The screen plays a push once, and only for a minute after this time.',
        }),
      ],
    }),
  ];
}
