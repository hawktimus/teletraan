// The page change fields of Dashboard Settings, in the Look tab: how the large
// and small panels change page, and what metal their frames have. Four fields:
//
//   pageChangeStyle  alternate (the default), slat or mechanical
//   breakSeconds     how long the frame takes to break apart, and again to rebuild
//   frameFinish      mostly gold (the default), alternate, gold only or silver only
//   silverChance     the percent of changes that bring silver, for mostly gold
//
// The choices are the names in pageChangeStyles and frameFinishes in
// dashboard/config.js, and the starting values and limits are the same as
// defaultSettings and limits there. check-schemas.mjs fails if they differ.
// Frame metal (Screen tab) is separate: it is the metal of the banner, the
// countdown and the logo, which never change with the page.
//
// To take the whole section out later: delete this file, remove its import and
// the line that uses transitionsFields in dashboardSettings.js, and remove the
// same names from check-schemas.mjs and config.js. The dashboard uses the
// starting values for anything missing from the published settings.

import { defineField } from 'sanity';

// The values are the names in pageChangeStyles in dashboard/config.js
const styles = [
  { title: 'Alternate', value: 'alternate' },
  { title: 'Slat change only', value: 'slat' },
  { title: 'Mechanical only', value: 'mechanical' },
];

// The values are the names in frameFinishes in dashboard/config.js
const finishes = [
  { title: 'Mostly gold', value: 'mostly-gold' },
  { title: 'Alternate', value: 'alternate' },
  { title: 'Gold only', value: 'gold' },
  { title: 'Silver only', value: 'silver' },
];

export function transitionsFields() {
  return [
    defineField({
      name: 'pageChangeStyle',
      title: 'Page change style',
      type: 'string',
      group: 'look',
      description: 'How the large and small panels change page: the slats turn over, or the frame breaks into plates and rebuilds like a robot. Alternate takes turns.',
      options: { list: styles, layout: 'radio', direction: 'horizontal' },
      initialValue: 'alternate',
      validation: Rule => [
        Rule.required().error('Pick alternate, slat or mechanical.'),
        Rule.valid(styles.map(style => style.value)).error('Pick alternate, slat or mechanical.'),
      ],
    }),

    defineField({
      name: 'breakSeconds',
      title: 'Break and rebuild time',
      type: 'number',
      group: 'look',
      description: 'Seconds the frame takes to break apart in the mechanical change, and the same again to rebuild, from 0.3 to 2, at Normal speed.',
      initialValue: 0.6,
      validation: Rule => [
        Rule.required().error('Enter the number of seconds.'),
        Rule.min(0.3).max(2).error('Use a number from 0.3 to 2.'),
      ],
    }),

    defineField({
      name: 'frameFinish',
      title: 'Frame finish',
      type: 'string',
      group: 'look',
      description: 'The metal of the page frames, picked at every page change. Frame metal (Screen tab) is for the banner, countdown and logo, which never change.',
      options: { list: finishes, layout: 'radio', direction: 'horizontal' },
      initialValue: 'mostly-gold',
      validation: Rule => [
        Rule.required().error('Pick mostly gold, alternate, gold only or silver only.'),
        Rule.valid(finishes.map(finish => finish.value)).error('Pick mostly gold, alternate, gold only or silver only.'),
      ],
    }),

    defineField({
      name: 'silverChance',
      title: 'Silver chance (percent)',
      type: 'number',
      group: 'look',
      description: 'With Mostly gold, how many page changes in 100 bring a silver frame, picked at random, from 0 to 100. Other finishes ignore it.',
      initialValue: 10,
      validation: Rule => [
        Rule.required().error('Enter a percent from 0 to 100.'),
        Rule.integer().min(0).max(100).error('Use a whole number from 0 to 100.'),
      ],
    }),
  ];
}
