// The photo fields of Dashboard Settings, in the Screen tab: the order the Photo
// panel shows its photos in, how long it stays up, how big the portraits are
// and whether a photo is cut to fill the panel or shown whole. Five fields:
//
//   photoOrder     random (the default) or newest first
//   photoSeconds   seconds the panel stays up, from 6 to 120, starting at 16
//   portraitScale  size of the portraits, in percent, from 60 to 200, starting at 100
//   photoScale     hidden: the size of the picture, which is not used since a photo fills the panel
//   photoFit       fill (the default) cuts a photo to fill the panel, whole fits all of it inside
//
// The choices are the names in photoOrders and photoFits in dashboard/config.js,
// and the starting values and limits are the same as defaultSettings and limits there.
// check-schemas.mjs fails if they differ. The photos themselves are in
// photo.js. For the portraits 100 is the standard size and 200 is double: above
// 100 the rows of Leadership and Team Leads get taller and fewer fit on a page
// (core/portrait.js, rowLayout).
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
      description: 'How long the Photo panel stays up each turn, from 6 to 120 seconds. Photos share it, 8 seconds each at least. A row in Panels with its own seconds wins.',
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
      description: 'From 60 to 200. 100 is standard and 200 is double. Above 100 a page of Leadership or Team Leads holds 3 rows (to 139) or 2 (from 140). Roster stays at 100.',
      initialValue: 100,
      validation: Rule => [
        Rule.required().error('Enter a percent from 60 to 200.'),
        Rule.integer().min(60).max(200).error('Use a whole number from 60 to 200.'),
      ],
    }),

    // Hidden, and the value saved in it stays. A photo fills the whole body of the panel, so there is
    // no size to set. It is not required: nobody can fill in a hidden field, and a page saved before
    // the field existed must still publish.
    defineField({
      name: 'photoScale',
      title: 'Photo size, percent',
      type: 'number',
      group: 'screen',
      hidden: true,
      description: 'Not used any more. A photo fills the whole panel.',
      initialValue: 100,
      validation: Rule => Rule.integer().min(60).max(100).error('Use a whole number from 60 to 100.'),
    }),

    defineField({
      name: 'photoFit',
      title: 'Photo fit',
      type: 'string',
      group: 'screen',
      description: 'Fill the frame cuts every photo to fill the whole panel. Show the whole photo fits all of it inside the panel, so nothing is cut. A photo can pick its own.',
      options: { list: fits, layout: 'radio', direction: 'horizontal' },
      initialValue: 'fill',
      validation: Rule => Rule.valid(fits.map(fit => fit.value)).error('Pick fill the frame or show the whole photo.'),
    }),
  ];
}
