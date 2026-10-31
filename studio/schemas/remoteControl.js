// Remote actions: one document with the fixed id 'remoteControl' (see structure.js). The three buttons in the menu
// beside Publish (studio/tools/remote-actions.js) fill in action, requestedAt and requestedBy and publish it. The
// poller on the Teletraan computer (computer/scripts/remote-poller.mjs) runs the action once, within 10 minutes of
// requestedAt, and writes lastHandledAt and lastResult. Nobody types in the form: every field is read only.
//
// The dataset is public, so requestedBy is a first name and nothing else is stored.

import { defineType, defineField } from 'sanity';

export const remoteControlType = 'remoteControl';
export const remoteControlId = 'remoteControl';

// The stored values and what the editor reads. computer/scripts/remote-plan.mjs maps each value to fixed words, and
// tests/remote-actions.test.mjs fails if the two lists differ.
export const remoteActions = [
  { title: 'Restart dashboard', value: 'restart_dashboard' },
  { title: 'Restart services', value: 'restart_services' },
  { title: 'Reboot computer', value: 'reboot_computer' },
  { title: 'Sync all', value: 'sync_all' },
  { title: 'Sync calendars', value: 'sync_calendars' },
  { title: 'Sync Monday', value: 'sync_monday' },
  { title: 'Sync competition', value: 'sync_competition' },
  { title: 'Sync news', value: 'sync_news' },
  { title: 'Sync Match13', value: 'sync_match13' },
  { title: 'Sync photos', value: 'sync_photos' },
  { title: 'Show a view', value: 'show_view' },
  { title: 'Show a theme', value: 'show_theme' },
  { title: 'Pause rotation', value: 'pause_rotation' },
  { title: 'Resume rotation', value: 'resume_rotation' },
];

// The words a show request may carry. They are the words of showView and previewTheme in Dashboard Settings; auto
// ends the request and the wall goes back to its schedule.
export const remoteViews = ['general', 'prime', 'nova', 'family', 'auto'];
export const remoteThemes = ['original', 'cybertron', 'retro', 'foundry', 'auto'];

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
      name: 'view',
      title: 'View asked for',
      type: 'string',
      description: 'The view for Show a view: general, prime, nova or family. auto goes back to the schedule. Set by the button.',
      options: { list: remoteViews },
      readOnly: true,
    }),
    defineField({
      name: 'theme',
      title: 'Theme asked for',
      type: 'string',
      description: 'The theme for Show a theme: original, cybertron, retro or foundry. auto goes back to the schedule. Set by the button.',
      options: { list: remoteThemes },
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
