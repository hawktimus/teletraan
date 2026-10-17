// The photo fields of Dashboard Settings, in the Screen tab: the order the Photo
// panel shows its photos in, how long it stays up, whether a photo is cut to fill
// the panel or shown whole, and the Portraits box for the people panels. Nine fields:
//
//   photoOrder          random (the default) or newest first
//   photoSeconds        not used any more: a Photos row of a Screen sets its own photos and seconds each. Kept, hidden
//   portraitScale       the old size of the portraits. Hidden: the screen reads it only while
//                       neither of the two sizes below has a value, and then both take it
//   photoScale          hidden: the size of the picture, which is not used since a photo fills the panel
//   photoFit            fill (the default) cuts a photo to fill the panel, whole fits all of it inside
//   leadershipPortrait  size of the Leadership portraits, in percent, from 60 to 220, starting at 100
//   rosterPortrait      the same for Team leads and the Roster, from 60 to 220, starting at 100
//   portraitShape       square (the default), rounded or circle, for all three panels
//   portraitFrame       metal (the default), a thin line or none, for all three panels
//
// The choices are the names in photoOrders, photoFits, portraitShapes and portraitFrames in
// dashboard/config.js, and the starting values and limits are the same as defaultSettings and
// limits there. tests/schemas.test.mjs fails if they differ. The photos themselves are in
// photo.js. For the portraits 100 is a portrait of 120 pixels, which fills a row of four, and
// 220 is 264, which fills the page: a bigger portrait needs a taller row, so fewer rows fit on
// a page (core/portrait.js, rowLayout).
//
// photoFit and the four portrait fields are not required. Dashboard Settings published before
// they existed has none, and the screen reads that as fill, or as the old Portrait size and
// the square shape with the metal frame. A required field would stop that
// page being published until somebody filled it in.
//
// To take the whole section out later: delete this file, remove its import and
// the line that uses photosFields in dashboardSettings.js, and remove the same
// names from tests/schemas.test.mjs and config.js. The dashboard uses the starting
// values for anything missing from the published settings.

import { defineField } from 'sanity';
import { checkDriveFolder } from './driveFolder.js';

// The values are the names in photoOrders in dashboard/config.js
const orders = [
  { title: 'Random', value: 'random' },
  { title: 'Newest first', value: 'newest-first' },
];

// The values are the names in photoSources in dashboard/config.js
const sources = [
  { title: 'Upload photos', value: 'upload' },
  { title: 'Google Drive folder', value: 'drive' },
  { title: 'Both', value: 'both' },
];

// The values are the names in photoFits in dashboard/config.js
const fits = [
  { title: 'Fill the frame', value: 'fill' },
  { title: 'Show the whole photo', value: 'whole' },
];

// The values are the names in portraitShapes and portraitFrames in dashboard/config.js
const shapes = [
  { title: 'Square', value: 'square' },
  { title: 'Rounded', value: 'rounded' },
  { title: 'Circle', value: 'circle' },
];

const frames = [
  { title: 'Metal', value: 'metal' },
  { title: 'Thin line', value: 'line' },
  { title: 'None', value: 'none' },
];

// The Portraits box in the Screen tab (the fieldset of the four portrait fields)
export const portraitFieldsets = [
  {
    name: 'portraits',
    title: 'Portraits',
    description: 'How the portraits on Leadership, Team leads and Roster are sized and drawn.',
    options: { collapsible: true, collapsed: false },
  },
];

// The most people that fit on a page at a size, for the descriptions. The table is the one in
// dashboard/core/portrait.js (rowSteps), and tests/schemas.test.mjs fails if the words drift from it.
const peopleFit = '4 up to 100, 3 up to 138, 2 up to 200, 1 up to 220.';

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

    // Chosen on the Photos page, which writes only these two fields to the draft. They are not required: a page
    // saved before they existed has neither, and the screen reads that as Upload photos.
    defineField({
      name: 'photoSource',
      title: 'Photo source',
      type: 'string',
      group: 'screen',
      description: 'Where the Photo panel gets its pictures: photos uploaded in Studio, the pictures of a Google Drive folder, or both. Chosen on the Photos page.',
      options: { list: sources, layout: 'radio', direction: 'horizontal' },
      initialValue: 'upload',
      validation: Rule => Rule.valid(sources.map(source => source.value)).error('Pick upload photos, Google Drive folder or both.'),
    }),

    defineField({
      name: 'photoDriveFolder',
      title: 'Google Drive folder',
      type: 'string',
      group: 'screen',
      description: 'The link of the Google Drive folder, shared with Anyone with the link as Viewer, or its id. Used when the Photo source includes Google Drive.',
      validation: Rule => Rule.custom(checkDriveFolder),
    }),

    defineField({
      name: 'photoSeconds',
      title: 'Seconds per photo',
      type: 'number',
      group: 'screen',
      hidden: true,
      description: 'Not used any more. A Photos row of a Screen has its own number of photos and seconds for each. This stays so that a saved value is kept.',
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
      hidden: true,
      description: 'Not used any more. The old size, from 60 to 200, used only while neither Leadership nor Roster portrait size has a value.',
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

    defineField({
      name: 'leadershipPortrait',
      title: 'Leadership portrait size, percent',
      type: 'number',
      group: 'screen',
      fieldset: 'portraits',
      description: 'From 60 to 220. 100 fills a row of four. People per page on Leadership: ' + peopleFit,
      initialValue: 100,
      validation: Rule => Rule.integer().min(60).max(220).error('Use a whole number from 60 to 220.'),
    }),

    defineField({
      name: 'rosterPortrait',
      title: 'Team leads and Roster portrait size, percent',
      type: 'number',
      group: 'screen',
      fieldset: 'portraits',
      description: 'From 60 to 220. 100 fills a row of four. People per page on Team leads: ' + peopleFit + ' The Roster portrait stays at 100.',
      initialValue: 100,
      validation: Rule => Rule.integer().min(60).max(220).error('Use a whole number from 60 to 220.'),
    }),

    defineField({
      name: 'portraitShape',
      title: 'Portrait shape',
      type: 'string',
      group: 'screen',
      fieldset: 'portraits',
      description: 'Square keeps the card with the cut corner of the frame. Rounded cuts every corner. Circle is round. It is the same on all three panels.',
      options: { list: shapes, layout: 'radio', direction: 'horizontal' },
      initialValue: 'square',
      validation: Rule => Rule.valid(shapes.map(shape => shape.value)).error('Pick square, rounded or circle.'),
    }),

    defineField({
      name: 'portraitFrame',
      title: 'Portrait frame',
      type: 'string',
      group: 'screen',
      fieldset: 'portraits',
      description: 'Metal is the edge the portraits have always had. Thin line is 3 pixels in the team accent. None shows the picture alone. It is the same on all three panels.',
      options: { list: frames, layout: 'radio', direction: 'horizontal' },
      initialValue: 'metal',
      validation: Rule => Rule.valid(frames.map(frame => frame.value)).error('Pick metal, thin line or none.'),
    }),
  ];
}
