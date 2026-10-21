// The clean up of expired items, in the Advanced tab of Dashboard Settings: three fields. The control page (Settings, Clean up
// expired items) reads and writes the same stored fields, so the Studio is the source of truth and the page shows the same
// values.
//
//   cleanupEnabled          the switch, off to start with
//   cleanupDeleteAfterDays  how many days after an item expired it may be deleted, 1 to 365, 14 to start with
//   cleanupMode             list (only show what would be deleted, to start with) or delete
//
// The starting values and limits are the same as defaults and daysRange in computer/scripts/cleanup-plan.mjs, which is what the
// nightly job and the control page use. tests/schemas.test.mjs fails if they differ. The dashboard never reads these fields:
// only the Teletraan computer does (computer/scripts/expired-cleanup.sh). What the job did last is in the status document
// (lastCleanupAt, cleanupWouldDelete, cleanupDeleted, cleanupError), which Check the screen and the control page show.
//
// To take the whole section out later: delete this file, remove the import and the lines that use cleanupFields in
// dashboardSettings.js, and remove the same names from tests/schemas.test.mjs.

import { defineField } from 'sanity';

const modes = [
  { title: 'Only show what would be deleted', value: 'list' },
  { title: 'Delete the items', value: 'delete' },
];

export function cleanupFields() {
  return [
    defineField({
      name: 'cleanupEnabled',
      title: 'Clean up expired items',
      type: 'boolean',
      group: 'advanced',
      description: 'On: the Teletraan computer looks for expired items at 03:40 each night. It only lists them until Mode says Delete. Off to start with.',
      initialValue: false,
    }),

    defineField({
      name: 'cleanupDeleteAfterDays',
      title: 'Wait this many days',
      type: 'number',
      group: 'advanced',
      description: 'How many days after an item expired it may be deleted, from 1 to 365. 14 to start with. Items edited in the last 2 days are never deleted.',
      initialValue: 14,
      validation: Rule => [
        Rule.required().error('Enter the number of days.'),
        Rule.integer().min(1).max(365).error('Use a whole number from 1 to 365.'),
      ],
    }),

    defineField({
      name: 'cleanupMode',
      title: 'Mode',
      type: 'string',
      group: 'advanced',
      description: 'Only show lists what would be deleted and deletes nothing. Delete saves a backup first, then deletes. Only show to start with.',
      options: { list: modes, layout: 'radio', direction: 'horizontal' },
      initialValue: 'list',
      validation: Rule => Rule.valid(modes.map(mode => mode.value)).error('Pick one of the two choices.'),
    }),
  ];
}
