// The hidden transition fields of Dashboard Settings, in the Advanced tab: two
// rare surprise transitions that replace a normal page change of the large
// panel, and the buttons that play one now. docs/hidden-transitions.md explains
// both. Six fields:
//
//   hiddenEnabled      the master switch, on to start with
//   desktopEveryHours  about once every this many hours of screen time the desktop reveal plays, 60 to start with
//   desktopChance      hidden. The percent of page changes that play the desktop reveal, 1 to start with
//   redEyesEveryHours  the same for red eyes, 60 to start with
//   redEyesChance      hidden. The percent of page changes that play red eyes, 1 to start with
//   hiddenRequest      the last push from "Play desktop reveal" or "Play red eyes". It has two
//                      fields, kind and requestedAt, and both are read only: the buttons in the
//                      menu beside Publish fill them in (actions.js)
//
// The two percent fields stay in the schema so that a page saved with them still
// opens and publishes, and they keep their starting values. The screen reads a
// percent only for a page that has no hours (dashboard/core/hidden.js). They have no
// rules, because nobody can fix a value in a hidden field. The hours are not required
// either: a page saved before they existed has none, and a required field would stop
// it being published until somebody filled them in.
//
// The limits are the same as limits in dashboard/config.js, and the kinds are the
// ones in hidden-transitions.js, a copy of the dashboard's registry. The starting
// percents are the same as defaultSettings there. The starting hours are not: there
// they start at 0, which means not set, so that an old page keeps its percent.
// check-schemas.mjs fails if any of this differs.
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
      name: 'desktopEveryHours',
      title: 'Desktop reveal every (hours)',
      type: 'number',
      group: 'advanced',
      description: 'About once every this many hours of screen time.',
      initialValue: 60,
      validation: Rule => Rule.integer().min(1).max(1000).error('Use a whole number from 1 to 1000.'),
    }),

    defineField({
      name: 'desktopChance',
      title: 'Desktop reveal chance (percent)',
      type: 'number',
      group: 'advanced',
      hidden: true,
      description: 'Used only by a page that has no hours for the desktop reveal: how many page changes in 100 play it.',
      initialValue: 1,
    }),

    defineField({
      name: 'redEyesEveryHours',
      title: 'Red eyes every (hours)',
      type: 'number',
      group: 'advanced',
      description: 'About once every this many hours of screen time.',
      initialValue: 60,
      validation: Rule => Rule.integer().min(1).max(1000).error('Use a whole number from 1 to 1000.'),
    }),

    defineField({
      name: 'redEyesChance',
      title: 'Red eyes chance (percent)',
      type: 'number',
      group: 'advanced',
      hidden: true,
      description: 'Used only by a page that has no hours for red eyes: how many page changes in 100 play it.',
      initialValue: 1,
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
