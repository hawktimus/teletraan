// The scheduled reboot of the Teletraan computer, in the Advanced tab of Dashboard Settings: a status line, then five
// fields. The control page (Settings, Scheduled reboot) reads and writes the same stored fields, so the Studio is the
// source of truth and the page shows the same values.
//
//   rebootStatus       the next and the last reboot, read from status-mini. It stores nothing
//   rebootEnabled      the switch, off to start with
//   rebootTime         HH:MM in the time zone of the Look page, 03:30 to start with
//   rebootDays         the weekdays, 0 is Sunday, every day to start with
//   rebootSkipBusy     wait while a talk, an alert or an announcement is playing, on to start with
//   rebootWaitMinutes  how long to wait before rebooting anyway, 1 to 120, 30 to start with
//
// The starting values and limits are the same as defaults and waitRange in computer/scripts/reboot-plan.mjs, which is
// what the timer and the control page use. tests/schemas.test.mjs fails if they differ. The dashboard never reads these
// fields: only the Teletraan computer does (computer/scripts/scheduled-reboot.sh).
//
// To take the whole section out later: delete this file and studio/inputs/reboot-status-input.js, remove the import and
// the lines that use rebootFields in dashboardSettings.js, and remove the same names from tests/schemas.test.mjs.

import { defineArrayMember, defineField } from 'sanity';
import { RebootStatusInput } from '../inputs/reboot-status-input.js';

const weekdays = [
  { title: 'Sunday', value: 0 },
  { title: 'Monday', value: 1 },
  { title: 'Tuesday', value: 2 },
  { title: 'Wednesday', value: 3 },
  { title: 'Thursday', value: 4 },
  { title: 'Friday', value: 5 },
  { title: 'Saturday', value: 6 },
];

// 24 hour time with two digits for the hour and for the minutes
const timeFormat = /^([01]\d|2[0-3]):[0-5]\d$/;

export function rebootFields() {
  return [
    defineField({
      name: 'rebootStatus',
      title: 'Next and last reboot',
      type: 'string',
      group: 'advanced',
      readOnly: true,
      description: 'When the Teletraan computer will reboot next, and when and why it last did. The computer writes this by itself, so there is nothing to type here.',
      components: { input: RebootStatusInput },
    }),

    defineField({
      name: 'rebootEnabled',
      title: 'Reboot on a schedule',
      type: 'boolean',
      group: 'advanced',
      description: 'Turn this on and publish to have the Teletraan computer reboot at the time below. Off to start with. The screen goes dark while it restarts.',
      initialValue: false,
    }),

    defineField({
      name: 'rebootTime',
      title: 'Reboot at',
      type: 'string',
      group: 'advanced',
      description: 'The time of day, in 24 hour time with two digits, such as 03:30. It uses the time zone on the Look page.',
      initialValue: '03:30',
      validation: Rule => [
        Rule.required().error('Enter the time, such as 03:30.'),
        Rule.regex(timeFormat, { name: '24 hour time' }).error('Use 24 hour time with two digits, such as 03:30.'),
      ],
    }),

    defineField({
      name: 'rebootDays',
      title: 'Reboot on',
      type: 'array',
      group: 'advanced',
      description: 'Tick every day of the week it should reboot.',
      of: [defineArrayMember({ type: 'number' })],
      options: { list: weekdays },
      initialValue: [0, 1, 2, 3, 4, 5, 6],
      validation: Rule => Rule.required().min(1).error('Tick at least one day.'),
    }),

    defineField({
      name: 'rebootSkipBusy',
      title: 'Not while something is playing',
      type: 'boolean',
      group: 'advanced',
      description: 'On: wait while a talk, an alert or an announcement is on the screen, and reboot anyway after the minutes below.',
      initialValue: true,
    }),

    defineField({
      name: 'rebootWaitMinutes',
      title: 'Wait up to (minutes)',
      type: 'number',
      group: 'advanced',
      description: 'How long to wait for the screen to be free before rebooting anyway, from 1 to 120 minutes. 30 to start with.',
      initialValue: 30,
      validation: Rule => [
        Rule.required().error('Enter the number of minutes.'),
        Rule.integer().min(1).max(120).error('Use a whole number from 1 to 120.'),
      ],
    }),
  ];
}
