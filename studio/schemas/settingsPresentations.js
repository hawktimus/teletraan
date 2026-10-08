// The Presentations tab of Dashboard Settings: whether the screen takes over for
// booked talks, and how long it waits. Three fields:
//
//   presentationsEnabled  the switch, on to start with
//   noShowMinutes         minutes the title card waits before the talk is skipped, from 1 to 15, 5 to start with
//   graceMinutes          minutes a talk may run past its slot before it is ended, from 0 to 10, 5 to start with
//
// The starting values and limits are the same as defaultSettings and limits in
// dashboard/config.js. check-schemas.mjs fails if they differ. The talks and the
// meeting days are in presentation.js and presentationDay.js.
//
// To take the whole section out later: delete this file, remove its import and
// the two lines that use presentationsGroup and presentationsFields in
// dashboardSettings.js, and remove the same names from check-schemas.mjs and
// config.js. The dashboard uses the starting values for anything missing from
// the published settings.

import { defineField } from 'sanity';

export const presentationsGroup = { name: 'presentations', title: 'Presentations' };

export function presentationsFields() {
  return [
    defineField({
      name: 'presentationsEnabled',
      title: 'Run presentations',
      type: 'boolean',
      group: 'presentations',
      description: 'Turn this off and the screen never takes over for a talk. The talks stay in Studio.',
      initialValue: true,
    }),

    defineField({
      name: 'noShowMinutes',
      title: 'Wait for the speaker (minutes)',
      type: 'number',
      group: 'presentations',
      description: 'How many minutes the title card waits for the first press of the clicker before the talk is skipped, from 1 to 15.',
      initialValue: 5,
      validation: Rule => [
        Rule.required().error('Enter the number of minutes.'),
        Rule.integer().min(1).max(15).error('Use a whole number from 1 to 15.'),
      ],
    }),

    defineField({
      name: 'graceMinutes',
      title: 'Overrun allowed (minutes)',
      type: 'number',
      group: 'presentations',
      description: 'How many minutes a talk may run past its slot before it is ended, from 0 to 10. 0 ends it when the slot ends.',
      initialValue: 5,
      validation: Rule => [
        Rule.required().error('Enter the number of minutes.'),
        Rule.integer().min(0).max(10).error('Use a whole number from 0 to 10.'),
      ],
    }),
  ];
}
