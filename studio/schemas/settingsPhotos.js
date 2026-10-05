// The Photos tab of Dashboard Settings: the order the Photo panel shows its
// photos in, and how long it stays up. Two fields:
//
//   photoOrder    random (the default) or newest first
//   photoSeconds  seconds the panel stays up, from 6 to 120, starting at 16
//
// The choices are the names in photoOrders in dashboard/config.js, and the
// starting values and limits are the same as defaultSettings and limits there.
// check-schemas.mjs fails if they differ. The photos themselves are in
// photo.js.
//
// To take the whole section out later: delete this file, remove its import and
// the two lines that use photosGroup and photosFields in dashboardSettings.js,
// and remove the same names from check-schemas.mjs and config.js. The dashboard
// uses the starting values for anything missing from the published settings.

import { defineField } from 'sanity';

export const photosGroup = { name: 'photos', title: 'Photos' };

// The values are the names in photoOrders in dashboard/config.js
const orders = [
  { title: 'Random', value: 'random' },
  { title: 'Newest first', value: 'newest-first' },
];

export function photosFields() {
  return [
    defineField({
      name: 'photoOrder',
      title: 'Photo order',
      type: 'string',
      group: 'photos',
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
      group: 'photos',
      description: 'How long the Photo panel stays up, from 6 to 120 seconds. A row in Panels with its own seconds wins.',
      initialValue: 16,
      validation: Rule => [
        Rule.required().error('Enter the number of seconds.'),
        Rule.integer().min(6).max(120).error('Use a whole number from 6 to 120.'),
      ],
    }),
  ];
}
