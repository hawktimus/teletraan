// The Night mode tab of Dashboard Settings: the screensaver. Between a start
// and an end time the screen is black with the team logo and the team number
// under it. The picture is never turned off. Seven fields:
//
//   nightEnabled    the switch, on to start with
//   nightStyle      a bouncing logo (the default) or blank black
//   nightStart      when it starts, 24 hour time, 23:30 to start with
//   nightEnd        when it ends, 11:30 to start with. Earlier than the start runs past midnight
//   nightLogoWidth  how wide the logo is, from 120 to 800 pixels, 300 to start with
//   nightSpeed      slow, normal (the default) or fast
//   nightPreview    shows night mode now, whatever the time
//
// The time zone is not here. Night mode uses the time zone on the Look page,
// so the whole screen has one zone and two settings can never disagree.
//
// The choices are the names in nightStyles and nightSpeeds in
// dashboard/config.js, and the starting values and limits are the same as
// defaultSettings and limits there. check-schemas.mjs fails if they differ.
//
// To take the whole section out later: delete this file, remove its import and
// the two lines that use nightGroup and nightFields in dashboardSettings.js, and
// remove the same names from check-schemas.mjs and config.js. The dashboard uses
// the starting values for anything missing from the published settings.

import { defineField } from 'sanity';

export const nightGroup = { name: 'night', title: 'Night mode' };

// 24 hour time with two digits for the hour and for the minutes, as in settingsAnnouncements.js
const timeFormat = /^([01]\d|2[0-3]):[0-5]\d$/;

// The values are the names in nightStyles in dashboard/config.js
const styles = [
  { title: 'Bouncing logo', value: 'bounce' },
  { title: 'Blank black', value: 'black' },
];

// The values are the names in nightSpeeds in dashboard/config.js
const speeds = [
  { title: 'Slow', value: 'slow' },
  { title: 'Normal', value: 'normal' },
  { title: 'Fast', value: 'fast' },
];

// The same start and end is no time at all, so night mode would never come on
function differsFromStart(value, context) {
  const same = context.document && value && context.document.nightStart === value;
  return same ? 'The same as the start time, so night mode never starts.' : true;
}

export function nightFields() {
  return [
    defineField({
      name: 'nightEnabled',
      title: 'Use night mode',
      type: 'boolean',
      group: 'night',
      description: 'Between the start and end times the screen goes black with the team logo. The picture is never turned off. Turn this off to keep the dashboard on.',
      initialValue: true,
    }),

    defineField({
      name: 'nightStyle',
      title: 'Night style',
      type: 'string',
      group: 'night',
      description: 'Bouncing logo drifts round the black screen and changes colour at every bounce. Blank black shows only black.',
      options: { list: styles, layout: 'radio', direction: 'horizontal' },
      initialValue: 'bounce',
      validation: Rule => [
        Rule.required().error('Pick a bouncing logo or blank black.'),
        Rule.valid(styles.map(style => style.value)).error('Pick a bouncing logo or blank black.'),
      ],
    }),

    defineField({
      name: 'nightStart',
      title: 'Night starts at',
      type: 'string',
      group: 'night',
      description: 'When night mode starts, in 24 hour time such as 23:30. It uses the time zone on the Look page.',
      initialValue: '23:30',
      validation: Rule => [
        Rule.required().error('Enter the time, such as 23:30.'),
        Rule.regex(timeFormat, { name: '24 hour time' }).error('Use 24 hour time with two digits, such as 23:30.'),
      ],
    }),

    defineField({
      name: 'nightEnd',
      title: 'Night ends at',
      type: 'string',
      group: 'night',
      description: 'When night mode ends, such as 11:30. An end before the start runs past midnight. It uses the time zone on the Look page.',
      initialValue: '11:30',
      validation: Rule => [
        Rule.required().error('Enter the time, such as 11:30.'),
        Rule.regex(timeFormat, { name: '24 hour time' }).error('Use 24 hour time with two digits, such as 11:30.'),
        Rule.custom(differsFromStart).warning(),
      ],
    }),

    defineField({
      name: 'nightLogoWidth',
      title: 'Logo width (pixels)',
      type: 'number',
      group: 'night',
      description: 'How wide the logo is, from 120 to 800 pixels. The team number under it stays the same size.',
      initialValue: 300,
      validation: Rule => [
        Rule.required().error('Enter the width in pixels.'),
        Rule.integer().min(120).max(800).error('Use a whole number from 120 to 800.'),
      ],
    }),

    defineField({
      name: 'nightSpeed',
      title: 'Bounce speed',
      type: 'string',
      group: 'night',
      description: 'How fast the logo drifts. It reaches a corner about every 12 minutes (Slow), 6.5 (Normal) or 3.7 (Fast). Calm motion keeps it still.',
      options: { list: speeds, layout: 'radio', direction: 'horizontal' },
      initialValue: 'normal',
      validation: Rule => [
        Rule.required().error('Pick slow, normal or fast.'),
        Rule.valid(speeds.map(speed => speed.value)).error('Pick slow, normal or fast.'),
      ],
    }),

    defineField({
      name: 'nightPreview',
      title: 'Preview night mode',
      type: 'boolean',
      group: 'night',
      description: 'Turn this on and publish to see night mode now, whatever the time, even with Use night mode off. Turn it off and publish when done.',
      initialValue: false,
    }),
  ];
}
