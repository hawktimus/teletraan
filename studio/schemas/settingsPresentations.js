// The presentation fields of Dashboard Settings, in the Presentations tab:
// whether the screen takes over for booked talks. One field for editors, and
// three hidden ones:
//
//   presentationsEnabled     the switch, on to start with
//   noShowMinutes            hidden. The title card always waits 5 minutes (dashboard/core/constants.js)
//   graceMinutes             hidden. A talk may always run 5 minutes past its slot (dashboard/core/constants.js)
//   presentationTestRequest  filled in by the Run presentation test button (actions.js), never by editors
//
// noShowMinutes and graceMinutes stay in the schema so that a page saved with
// them still opens and publishes, and they keep their starting values. The
// screen never reads what they hold. They have no rules, because nobody can fix
// a value in a hidden field. The starting value of the switch is the same as in
// defaultSettings in dashboard/config.js. check-schemas.mjs fails if they differ.
// The talks and the meeting days are in presentation.js and presentationDay.js.
//
// To take the whole section out later: delete this file, remove its import and
// the lines that use presentationsFields and presentationTestRequestField in
// dashboardSettings.js, and remove the same names from check-schemas.mjs and
// config.js. The dashboard uses the starting values for anything missing from
// the published settings.

import { defineField } from 'sanity';

export function presentationsFields() {
  return [
    defineField({
      name: 'presentationsEnabled',
      title: 'Run presentations',
      type: 'boolean',
      group: 'presentations',
      description: 'Turn this off and the screen never takes over for a talk. The talks stay in Studio.',
      initialValue: true,
    }),

    defineField({
      name: 'noShowMinutes',
      title: 'Wait for the speaker (minutes)',
      type: 'number',
      group: 'presentations',
      hidden: true,
      description: 'Not used any more. The title card always waits 5 minutes for the first press of the clicker.',
      initialValue: 5,
    }),

    defineField({
      name: 'graceMinutes',
      title: 'Overrun allowed (minutes)',
      type: 'number',
      group: 'presentations',
      hidden: true,
      description: 'Not used any more. A talk may always run 5 minutes past its slot before it is ended.',
      initialValue: 5,
    }),
  ];
}

// The Run presentation test button (actions.js) writes the time into this and publishes,
// and the screen then starts the sample talk, once (dashboard/core/presentation-test.js).
// Editors never see it: hidden keeps it out of the form, and its value stays in the
// document. The starting value is the same as defaultSettings.presentationTestRequest in
// dashboard/config.js, and a missing one means no request.
export function presentationTestRequestField() {
  return defineField({
    name: 'presentationTestRequest',
    title: 'Last presentation test',
    type: 'object',
    group: 'presentations',
    hidden: true,
    description: 'Filled in by the Run presentation test button beside Publish. The screen runs the sample talk once. Do not edit it.',
    fields: [
      defineField({
        name: 'requestedAt',
        title: 'Requested at',
        type: 'datetime',
        readOnly: true,
        description: 'When the button was last clicked. The screen runs a test once, and only for a minute after this time.',
      }),
    ],
  });
}
