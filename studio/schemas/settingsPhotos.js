// The photo fields of Dashboard Settings, in the Screen tab: the order the Photo
// panel shows its photos in, how long it stays up, how big the pictures are
// and whether a photo is cut to its card or shown whole. Five fields:
//
//   photoOrder     random (the default) or newest first
//   photoSeconds   seconds the panel stays up, from 6 to 120, starting at 16
//   portraitScale  size of the portraits, in percent, from 60 to 100, starting at 100
//   photoScale     size of the picture in the Photo panel, the same range
//   photoFit       fill (the default) cuts a photo to the card, whole keeps its shape
//
// The choices are the names in photoOrders and photoFits in dashboard/config.js,
// and the starting values and limits are the same as defaultSettings and limits there.
// check-schemas.mjs fails if they differ. The photos themselves are in
// photo.js. 100 percent is the full size, the largest that fits the frames
// (core/portrait.js and core/photos.js work out the smaller sizes).
//
// photoFit is not required. Dashboard Settings published before it existed has
// none, and the screen reads that as fill. A required field would stop that
// page being published until somebody filled it in.
//
// To take the whole section out later: delete this file, remove its import and
// the line that uses photosFields in dashboardSettings.js, and remove the same
// names from check-schemas.mjs and config.js. The dashboard uses the starting
// values for anything missing from the published settings.

import { defineField } from 'sanity';

// The values are the names in photoOrders in dashboard/config.js
const orders = [
  { title: 'Random', value: 'random' },
  { title: 'Newest first', value: 'newest-first' },
];

// The values are the names in photoFits in dashboard/config.js
const fits = [
  { title: 'Fill the frame', value: 'fill' },
  { title: 'Show the whole photo', value: 'whole' },
];

export function photosFields() {
  return [
    defineField({
      name: 'photoOrder',
      title: 'Photo order',
      type: 'string',
      group: 'screen',
      description: 'Random never shows the same photo twice in a row. Newest first goes from the latest upload to the oldest, then starts over.',
      options: { list: orders, layout: 'radio', direction: 'horizontal' },
      initialValue: 'random',
      validation: Rule => [
        Rule.required().error('Pick random or newest first.'),
        Rule.valid(orders.map(order => order.value)).error('Pick random or newest first.'),
      ],
    }),

    defineField({
      name: 'photoSeconds',
      title: 'Seconds per photo',
      type: 'number',
      group: 'screen',
      description: 'How long the Photo panel stays up, from 6 to 120 seconds. A row in Panels with its own seconds wins.',
      initialValue: 16,
      validation: Rule => [
        Rule.required().error('Enter the number of seconds.'),
        Rule.integer().min(6).max(120).error('Use a whole number from 6 to 120.'),
      ],
    }),

    defineField({
      name: 'portraitScale',
      title: 'Portrait size, percent',
      type: 'number',
      group: 'screen',
      description: 'How big the portraits are on Leadership, Team Leads and Roster, from 60 to 100. 100 is the full size and the largest that fits the frame.',
      initialValue: 100,
      validation: Rule => [
        Rule.required().error('Enter a percent from 60 to 100.'),
        Rule.integer().min(60).max(100).error('Use a whole number from 60 to 100.'),
      ],
    }),

    defineField({
      name: 'photoScale',
      title: 'Photo size, percent',
      type: 'number',
      group: 'screen',
      description: 'How big the picture is, from 60 to 100. 100 is the full size and the largest that fits the frame. A photo shown whole is made smaller by it too.',
      initialValue: 100,
      validation: Rule => [
        Rule.required().error('Enter a percent from 60 to 100.'),
        Rule.integer().min(60).max(100).error('Use a whole number from 60 to 100.'),
      ],
    }),

    defineField({
      name: 'photoFit',
      title: 'Photo fit',
      type: 'string',
      group: 'screen',
      description: 'Fill the frame cuts every photo to the same card. Show the whole photo gives each card the shape of its photo, so nothing is cut. A photo can pick its own.',
      options: { list: fits, layout: 'radio', direction: 'horizontal' },
      initialValue: 'fill',
      validation: Rule => Rule.valid(fits.map(fit => fit.value)).error('Pick fill the frame or show the whole photo.'),
    }),
  ];
}
