// The background field of Dashboard Settings, in the Look tab.
//
//   background  sweep (the screen as it has always been), blueprint, rays, spotlight or embers. It is the
//               background behind the panels of the Original theme. The other themes draw their own, so the
//               field is hidden while no day of the week plays Original.
//
// The choices are the names in backgrounds in dashboard/config.js, and the starting value is the same as
// defaultSettings.background there. tests/themes-part5.test.mjs fails if they differ.
//
// To take the section out later: delete this file, remove its import and the line that uses
// backgroundFields in dashboardSettings.js. The dashboard draws the sweep for anything missing.

import { defineField } from 'sanity';
import { backgroundChoices, backgroundIds, playsOriginal } from '../inputs/background-ids.js';

export function backgroundFields() {
  return [
    defineField({
      name: 'background',
      title: 'Background of the Original theme',
      type: 'string',
      group: 'look',
      hidden: ({ document }) => !playsOriginal(document),
      description: 'Behind the panels of the Original theme. Sweep is the screen as it has always been. Calm motion draws each one still.',
      options: { list: backgroundChoices.map(choice => ({ title: choice.title, value: choice.id })), layout: 'radio' },
      initialValue: 'sweep',
      validation: Rule => Rule.valid(backgroundIds).error('Pick sweep, blueprint, rays, spotlight or embers.'),
    }),
  ];
}
