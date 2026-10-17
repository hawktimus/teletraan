// The weekday schedule and the fields the Screens replaced, in the Look tab of Dashboard Settings.
//
//   screenSchedule  a picker for each day of the week, Monday to Sunday, that chose the Screen that played
//                   that day. It is hidden now: the Look page picks the theme of each day and stores it in
//                   themeByWeekday (settingsViews.js). The saved schedule is kept.
//
// The four fields the Screens replaced stay in the schema, hidden, with what was saved in them, so
// that nothing already published is lost, and the screen does not read them for what plays. The only
// one it still looks at is mondayStyle, as the starting Monday style of a Screen that has none:
//
//   dailyStyles  the styles of the days, in order: now the weekday schedule
//   mondayStyle  the style while the Monday cards of a team are up: now a field of each Screen, which
//                the form of a Screen copies from this one the first time it is opened
//   teamOrder    the teams, in the order they take the screen: now the order of the rows of a Screen
//   lookSwap     assemble, slats or cut: every change of look is the same swap (dashboard/core/swap-run.js)
//
// The choices are the names in styles and lookSwaps in dashboard/config.js, and the starting values
// are the same as defaultSettings there. tests/schemas.test.mjs fails if they differ. The starting teams are
// the two in docs/seed/teams.ndjson.
//
// None of them is required: Dashboard Settings published before these fields existed has none, and
// the screen uses the starting week.
//
// To take the whole section out later: delete this file, remove its import and the line that uses
// lookScheduleFields in dashboardSettings.js, and remove the same names from tests/schemas.test.mjs and
// config.js. The dashboard uses the starting values for anything missing from the published settings.

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

// The days of the week, Monday first, with the Screen each plays to start with. The names and the
// starting values are the ones in screenSchedule in defaultSettings in dashboard/config.js.
// Minimal is not scheduled to start with.
const weekdays = [
  { name: 'monday', title: 'Monday', start: 'original' },
  { name: 'tuesday', title: 'Tuesday', start: 'cybertron' },
  { name: 'wednesday', title: 'Wednesday', start: 'original' },
  { name: 'thursday', title: 'Thursday', start: 'cybertron' },
  { name: 'friday', title: 'Friday', start: 'original' },
  { name: 'saturday', title: 'Saturday', start: 'cybertron' },
  { name: 'sunday', title: 'Sunday', start: 'original' },
];

function dayField(day) {
  return defineField({
    name: day.name,
    title: day.title,
    type: 'string',
    description: 'Not used any more. The theme of ' + day.title + ' is set on the Look page.',
    options: { list: styles, layout: 'radio', direction: 'horizontal' },
    initialValue: day.start,
    validation: Rule => Rule.valid(styles.map(style => style.value)).error('Pick original, cybertron or minimal.'),
  });
}

// One picker for each day. The day is the calendar day in the time zone of the Look page.
function scheduleField() {
  return defineField({
    name: 'screenSchedule',
    title: 'Weekday schedule',
    type: 'object',
    group: 'look',
    hidden: true,
    description: 'Not used any more. The Look page picks the theme of each day. It stays so that a saved schedule is kept.',
    fields: weekdays.map(dayField),
  });
}

export function lookScheduleFields() {
  return [
    scheduleField(),

    defineField({
      name: 'dailyStyles',
      title: 'Styles by day',
      type: 'array',
      group: 'look',
      hidden: true,
      description: 'Not used any more. The Weekday schedule picks the Screen of each day. It stays so that a saved list is kept.',
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
      hidden: true,
      description: 'Not used any more. Each Screen has its own Monday style, copied from this one when the Screen was first opened.',
      options: { list: styles, layout: 'radio', direction: 'horizontal' },
      initialValue: 'minimal',
      validation: Rule => Rule.valid(styles.map(style => style.value)).error('Pick original, cybertron or minimal.'),
    }),

    defineField({
      name: 'teamOrder',
      title: 'Team order',
      type: 'array',
      group: 'look',
      hidden: true,
      description: 'Not used any more. The rows of a Screen say when the team changes. It stays so that a saved list is kept.',
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
      validation: Rule => Rule.unique().error('A team can be in the list once. Remove the repeat.'),
    }),

    defineField({
      name: 'lookSwap',
      title: 'How the look changes',
      type: 'string',
      group: 'look',
      description: 'Not used any more. Every change of look is the same move now. It stays so that a saved value is kept.',
      hidden: true,
      options: { list: swaps, layout: 'radio', direction: 'horizontal' },
      initialValue: 'assemble',
      validation: Rule => Rule.valid(swaps.map(swap => swap.value)).error('Pick assemble, slats or cut.'),
    }),
  ];
}
