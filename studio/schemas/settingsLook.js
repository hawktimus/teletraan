// The look rotation fields of Dashboard Settings, in the Look tab: which styles and which teams the
// screen goes through, and how it changes from one look to the next. Four fields:
//
//   dailyStyles  the styles of the days, in order: Original and then Cybertron to start with
//   mondayStyle  the style while the Monday cards of a team are up, Minimal to start with
//   teamOrder    the teams, in the order they take the screen: Prime and then Nova to start with
//   lookSwap     assemble (the default), slats or cut
//
// The choices are the names in styles and lookSwaps in dashboard/config.js, and the starting values
// are the same as defaultSettings there. check-schemas.mjs fails if they differ. The starting teams are
// the two in docs/seed/teams.ndjson. The screen reads the teams by their code (dashboard/core/sanity.js).
//
// None of them is required. A list that is empty gives the choice back to Style and Team mode, which
// stay in the schema, hidden. Dashboard Settings published before these fields existed has no lists, and
// the screen follows Style and Team mode as it always has.
//
// To take the whole section out later: delete this file, remove its import and the line that uses
// lookRotationFields in dashboardSettings.js, make Style, Team mode and Minutes for each team show again,
// and remove the same names from check-schemas.mjs and config.js. The dashboard uses the starting values
// for anything missing from the published settings.

import { defineField, defineArrayMember } from 'sanity';

// The values are the names in styles in dashboard/config.js
const styles = [
  { title: 'Original', value: 'original' },
  { title: 'Cybertron', value: 'cybertron' },
  { title: 'Minimal', value: 'minimal' },
];

// The values are the names in lookSwaps in dashboard/config.js
const swaps = [
  { title: 'Assemble', value: 'assemble' },
  { title: 'Slats', value: 'slats' },
  { title: 'Cut', value: 'cut' },
];

export function lookRotationFields() {
  return [
    defineField({
      name: 'dailyStyles',
      title: 'Styles by day',
      type: 'array',
      group: 'look',
      description: 'One style each day, in this order, and over again after the last. One style holds all the time. Empty keeps the old style choice.',
      of: [
        defineArrayMember({
          type: 'string',
          title: 'Style',
          options: { list: styles },
          validation: Rule => Rule.valid(styles.map(style => style.value)).error('Pick original, cybertron or minimal.'),
        }),
      ],
      initialValue: ['original', 'cybertron'],
    }),

    defineField({
      name: 'mondayStyle',
      title: 'Monday style',
      type: 'string',
      group: 'look',
      description: 'The style while the Monday cards of a team are on the screen. A team with no Monday cards skips them.',
      options: { list: styles, layout: 'radio', direction: 'horizontal' },
      initialValue: 'minimal',
      validation: Rule => Rule.valid(styles.map(style => style.value)).error('Pick original, cybertron or minimal.'),
    }),

    defineField({
      name: 'teamOrder',
      title: 'Team order',
      type: 'array',
      group: 'look',
      description: 'The teams, in the order they take the screen. Drag to change it. One team holds. Empty keeps the old team choice.',
      of: [
        defineArrayMember({
          type: 'reference',
          title: 'Team',
          to: [{ type: 'team' }],
          options: { filter: 'active != false' },
        }),
      ],
      initialValue: [
        { _type: 'reference', _ref: 'team-prime' },
        { _type: 'reference', _ref: 'team-nova' },
      ],
      validation: Rule => Rule.unique().error('Each team can be in the list once.'),
    }),

    defineField({
      name: 'lookSwap',
      title: 'How the look changes',
      type: 'string',
      group: 'look',
      description: 'Assemble takes the screen apart and builds it again. Slats turns the panel over. Cut changes at once. Each waits for the end of a pass.',
      options: { list: swaps, layout: 'radio', direction: 'horizontal' },
      initialValue: 'assemble',
      validation: Rule => Rule.valid(swaps.map(swap => swap.value)).error('Pick assemble, slats or cut.'),
    }),
  ];
}
