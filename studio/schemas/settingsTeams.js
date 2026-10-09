// The Teams tab of Dashboard Settings: which team the screen shows. Two fields:
//
//   teamMode          prime (Prime only, the default), nova (Nova only) or alternate
//   alternateMinutes  minutes each team stays on the screen in Alternate mode, from 1 to 30, 5 to start with
//
// The teams themselves, with their names and colors, are in team.js. The choices
// are the names in teamModes in dashboard/config.js, and the starting values and
// limits are the same as defaultSettings and limits there. check-schemas.mjs
// fails if they differ.
//
// Neither field is required. Dashboard Settings published before this tab
// existed has neither, and the screen reads that as Prime only and 5 minutes. A
// required field would stop that page being published until somebody filled it in.
//
// To take the whole section out later: delete this file, remove its import and
// the two lines that use teamsGroup and teamsFields in dashboardSettings.js, and
// remove the same names from check-schemas.mjs and config.js. The dashboard uses
// the starting values for anything missing from the published settings.

import { defineField } from 'sanity';

export const teamsGroup = { name: 'teams', title: 'Teams' };

// The values are the names in teamModes in dashboard/config.js
const modes = [
  { title: 'Prime only', value: 'prime' },
  { title: 'Nova only', value: 'nova' },
  { title: 'Alternate', value: 'alternate' },
];

export function teamsFields() {
  return [
    defineField({
      name: 'teamMode',
      title: 'Team mode',
      type: 'string',
      group: 'teams',
      description: 'Prime only or Nova only shows that team all the time. Alternate swaps between the teams, and the screen changes with each swap.',
      options: { list: modes, layout: 'radio', direction: 'horizontal' },
      initialValue: 'prime',
      validation: Rule => Rule.valid(modes.map(mode => mode.value)).error('Pick Prime only, Nova only or Alternate.'),
    }),

    defineField({
      name: 'alternateMinutes',
      title: 'Minutes for each team',
      type: 'number',
      group: 'teams',
      description: 'In Alternate mode, how many minutes each team stays on the screen, from 1 to 30. The swap waits for a change between panels.',
      initialValue: 5,
      validation: Rule => Rule.integer().min(1).max(30).error('Use a whole number from 1 to 30.'),
    }),
  ];
}
