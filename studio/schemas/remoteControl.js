// Remote actions: one document with the fixed id 'remoteControl' (see structure.js). The three buttons in the menu
// beside Publish (studio/tools/remote-actions.js) fill in action, requestedAt and requestedBy and publish it. The
// poller on the Teletraan computer (computer/scripts/remote-poller.mjs) runs the action once, within 10 minutes of
// requestedAt, and writes lastHandledAt and lastResult. Nobody types in the form: every field is read only.
//
// The dataset is public, so requestedBy is a first name and nothing else is stored.

import { defineType, defineField } from 'sanity';

export const remoteControlType = 'remoteControl';
export const remoteControlId = 'remoteControl';

// The stored values and what the editor reads. computer/scripts/remote-plan.mjs maps each value to a fixed word.
export const remoteActions = [
  { title: 'Restart dashboard', value: 'restart_dashboard' },
  { title: 'Restart services', value: 'restart_services' },
  { title: 'Reboot computer', value: 'reboot_computer' },
];

export default defineType({
  name: remoteControlType,
  title: 'Remote actions',
  type: 'document',
  fields: [
    defineField({
      name: 'action',
      title: 'Action asked for',
      type: 'string',
      description: 'The last action asked for. Use the buttons in the menu beside Publish. You cannot type here.',
      options: { list: remoteActions },
      readOnly: true,
    }),
    defineField({
      name: 'requestedAt',
      title: 'Asked at',
      type: 'datetime',
      description: 'When the button was clicked. The computer only obeys a request that is less than 10 minutes old.',
      readOnly: true,
    }),
    defineField({
      name: 'requestedBy',
      title: 'Asked by',
      type: 'string',
      description: 'The first name of the person who clicked the button.',
      readOnly: true,
    }),
    defineField({
      name: 'lastHandledAt',
      title: 'Handled at',
      type: 'datetime',
      description: 'When the Teletraan computer last answered a request. The computer writes it.',
      readOnly: true,
    }),
    defineField({
      name: 'lastResult',
      title: 'Result',
      type: 'string',
      description: 'What the Teletraan computer did with the last request, such as done, or ignored: too old. The computer writes it.',
      readOnly: true,
    }),
  ],
  preview: {
    prepare: () => ({ title: 'Remote actions' }),
  },
});
