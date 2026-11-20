// The pre-meeting refresh of the Teletraan computer, in the Advanced tab of Dashboard Settings next to the scheduled reboot:
// three fields. The computer reads them from its copy of the content (computer/scripts/pre-meeting-refresh.sh, refresh-plan.mjs),
// so the Studio is the source of truth and Control shows what it last decided.
//
//   refreshEnabled   the switch, on to start with
//   refreshTime      HH:MM in the time zone of the Look page, 13:30 to start with
//   refreshDays      the weekdays, 0 is Sunday, Monday to Friday to start with
//
// The starting values are `defaults` in computer/scripts/refresh-plan.mjs, which tests/schemas.test.mjs holds these to. The
// dashboard never reads these fields. To take the section out: delete this file and the lines that use refreshFields in
// dashboardSettings.js.

import { defineArrayMember, defineField } from 'sanity';

const weekdays = [
  { title: 'Sunday', value: 0 },
  { title: 'Monday', value: 1 },
  { title: 'Tuesday', value: 2 },
  { title: 'Wednesday', value: 3 },
  { title: 'Thursday', value: 4 },
  { title: 'Friday', value: 5 },
  { title: 'Saturday', value: 6 },
];

const timeFormat = /^([01]\d|2[0-3]):[0-5]\d$/;

export function refreshFields() {
  return [
    defineField({
      name: 'refreshEnabled',
      title: 'Refresh before the meeting',
      type: 'boolean',
      group: 'advanced',
      description: 'Once a day the computer reads every source and checks itself. All green: it reloads the page and nothing changes. Amber: it restarts what is wrong.',
      initialValue: true,
    }),

    defineField({
      name: 'refreshTime',
      title: 'Refresh at',
      type: 'string',
      group: 'advanced',
      description: 'The time of day, 24 hour time with two digits, such as 13:30. It uses the time zone on the Look page. It waits for a talk or a meeting to be over.',
      initialValue: '13:30',
      validation: Rule => [
        Rule.required().error('Enter the time, such as 13:30.'),
        Rule.regex(timeFormat, { name: '24 hour time' }).error('Use 24 hour time with two digits, such as 13:30.'),
      ],
    }),

    defineField({
      name: 'refreshDays',
      title: 'Refresh on',
      type: 'array',
      group: 'advanced',
      description: 'Tick every day of the week it should refresh. Monday to Friday to start with.',
      of: [defineArrayMember({ type: 'number' })],
      options: { list: weekdays },
      initialValue: [1, 2, 3, 4, 5],
      validation: Rule => Rule.required().min(1).error('Tick at least one day.'),
    }),
  ];
}
