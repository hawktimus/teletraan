// The presentation fields of Dashboard Settings, in the Presentations tab:
// whether the screen takes over for talks, and the Google Drive folder of
// presentations. Two fields for editors, and three hidden ones:
//
//   presentationsEnabled     the switch, on to start with
//   presentationDriveFolder  the Google Drive folder whose presentations can be picked on the TV and
//                            on the control page. Only computer/scripts/decks-sync.sh reads it
//                            (docs/presentations-drive.md)
//   noShowMinutes            hidden. The title card always waits 5 minutes (dashboard/core/constants.js)
//   graceMinutes             hidden. A talk may always run 5 minutes past its slot (dashboard/core/constants.js)
//   presentationTestRequest  hidden. Not used any more: the Run presentation test button is gone. Kept so a stored value is not lost
//
// noShowMinutes and graceMinutes stay in the schema so that a page saved with
// them still opens and publishes, and they keep their starting values. The
// screen never reads what they hold. They have no rules, because nobody can fix
// a value in a hidden field. The starting value of the switch is the same as in
// defaultSettings in dashboard/config.js. tests/schemas.test.mjs fails if they differ.
// The old booked talks and meeting days are in presentation.js and presentationDay.js, kept and not used.
//
// To take the whole section out later: delete this file, remove its import and
// the lines that use presentationsFields and presentationTestRequestField in
// dashboardSettings.js, and remove the same names from tests/schemas.test.mjs and
// config.js. The dashboard uses the starting values for anything missing from
// the published settings.

import { defineField } from 'sanity';
import { checkDriveFolder } from './driveFolder.js';

export function presentationsFields() {
  return [
    defineField({
      name: 'presentationsEnabled',
      title: 'Run presentations',
      type: 'boolean',
      group: 'presentations',
      description: 'Turn this off and the screen never starts a deck picked from the Google Drive folder.',
      initialValue: true,
    }),

    defineField({
      name: 'presentationDriveFolder',
      title: 'Google Drive folder of presentations',
      type: 'string',
      group: 'presentations',
      description: 'The link of the Google Drive folder. A public one is Anyone with the link, Viewer. A private one uses the decks script (docs/presentations-drive.md).',
      validation: Rule => Rule.custom(checkDriveFolder),
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

// Not used any more. The Run presentation test button wrote the time into this, and nothing
// writes or reads it now. It stays in the schema because stored values are never removed.
// Editors never see it: hidden keeps it out of the form, and its value stays in the document.
export function presentationTestRequestField() {
  return defineField({
    name: 'presentationTestRequest',
    title: 'Last presentation test',
    type: 'object',
    group: 'presentations',
    hidden: true,
    description: 'Not used any more. The Run presentation test button is gone and the screen ignores this. The stored value is kept. Do not edit it.',
    fields: [
      defineField({
        name: 'requestedAt',
        title: 'Requested at',
        type: 'datetime',
        readOnly: true,
        description: 'Not used any more. When the old button was last clicked.',
      }),
    ],
  });
}
