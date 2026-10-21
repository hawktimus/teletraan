// Screen fit, in the Advanced tab of Dashboard Settings: how the 1920 by 1080 picture sits in the browser window of the
// TV computer. The control page (Settings, Screen) has a button that sets these for you; the fields are here for hand work.
//
//   screenFit      auto (fit inside the window), fill (cover the window and crop), contain (fit inside with bars)
//                  or exact (no scaling). auto to start with
//   screenScale    percent, from 50 to 200, 100 to start with. An extra multiplier on top of the fit
//   screenOffsetX  pixels, from -400 to 400, 0 to start with. Moves the picture right (negative is left)
//   screenOffsetY  pixels, from -400 to 400, 0 to start with. Moves the picture down (negative is up)
//
// The choices are the names in screenFits in dashboard/config.js, and the starting values and limits are the same as
// defaultSettings and limits there. The dashboard applies a change at once (dashboard/core/screen-fit.js).

import { defineField } from 'sanity';

const fits = [
  { title: 'Auto', value: 'auto' },
  { title: 'Fill the window', value: 'fill' },
  { title: 'Fit inside', value: 'contain' },
  { title: 'No scaling', value: 'exact' },
];

export function screenFitFields() {
  return [
    defineField({
      name: 'screenFit',
      title: 'Screen fit',
      type: 'string',
      group: 'advanced',
      description: 'Auto fits the picture inside the window. Fill the window covers it and crops the edges. Fit inside keeps bars. No scaling keeps its own size.',
      options: { list: fits, layout: 'radio', direction: 'horizontal' },
      initialValue: 'auto',
      validation: Rule => Rule.valid(fits.map(fit => fit.value)).error('Pick auto, fill, fit inside or no scaling.'),
    }),

    defineField({
      name: 'screenScale',
      title: 'Screen size (percent)',
      type: 'number',
      group: 'advanced',
      description: 'Makes the picture bigger or smaller than the fit, from 50 to 200 percent. Use 95 when the TV cuts off the edges.',
      initialValue: 100,
      validation: Rule => Rule.integer().min(50).max(200).error('Use a whole number from 50 to 200.'),
    }),

    defineField({
      name: 'screenOffsetX',
      title: 'Move right (pixels)',
      type: 'number',
      group: 'advanced',
      description: 'Moves the picture sideways, from -400 to 400 pixels. A negative number moves it left.',
      initialValue: 0,
      validation: Rule => Rule.integer().min(-400).max(400).error('Use a whole number from -400 to 400.'),
    }),

    defineField({
      name: 'screenOffsetY',
      title: 'Move down (pixels)',
      type: 'number',
      group: 'advanced',
      description: 'Moves the picture up or down, from -400 to 400 pixels. A negative number moves it up.',
      initialValue: 0,
      validation: Rule => Rule.integer().min(-400).max(400).error('Use a whole number from -400 to 400.'),
    }),
  ];
}
