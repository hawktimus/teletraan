// What the Teletraan computer reports about itself, in one document with the fixed id 'remote-status'.
// computer/scripts/remote-poller.mjs writes it as a whole every 5 minutes (sooner when it changed), so editors only
// read it: the sidebar shows it under Remote actions. It holds source names, times, short failure reasons with host
// names removed, the last action of the network watchdog and the last remote request. The dataset is public, so it
// holds nothing else.

import { defineType, defineField, defineArrayMember } from 'sanity';
import { textField, numberField } from './fields.js';

export const remoteStatusId = 'remote-status';

function timeField(name, title, description) {
  return defineField({ name: name, title: title, type: 'datetime', description: description });
}

export default defineType({
  name: 'remoteStatus',
  title: 'Status from the Teletraan computer',
  type: 'document',
  readOnly: true,
  // Keeps it out of Studio's search, so it is not found by accident
  __experimental_omnisearch_visibility: false,
  fields: [
    timeField('updatedAt', 'Updated at', 'When the Teletraan computer last wrote this page.'),
    timeField('checkedAt', 'Last check', 'When the Teletraan computer last asked Sanity for a request. It is written at most every 5 minutes.'),
    defineField({
      name: 'network',
      title: 'Network',
      type: 'object',
      description: 'Whether the Teletraan computer could reach the internet at its last sync, and since when.',
      fields: [
        defineField({ name: 'ok', title: 'Reachable', type: 'boolean', description: 'On when the last check worked.' }),
        timeField('since', 'Since', 'When it has been in this state.'),
      ],
    }),
    defineField({
      name: 'sources',
      title: 'Sources',
      type: 'array',
      description: 'One line for each place the computer reads from, such as calendars or Monday.',
      of: [
        defineArrayMember({
          type: 'object',
          title: 'Source',
          fields: [
            textField('name', 'Source', 'The name of the source.'),
            timeField('lastSuccessAt', 'Last good read', 'When the source last answered.'),
            timeField('lastFailureAt', 'Last failure', 'When the source last failed.'),
            textField('lastFailureReason', 'Reason', 'Why it failed, in a few words. Host names are removed.'),
          ],
          preview: {
            select: { title: 'name', subtitle: 'lastFailureReason' },
            prepare: ({ title, subtitle }) => ({ title: title || 'Source', subtitle: subtitle }),
          },
        }),
      ],
    }),
    defineField({
      name: 'netwatch',
      title: 'Network watchdog',
      type: 'object',
      description: 'What the network watchdog of the computer last did.',
      fields: [
        numberField('failures', 'Failed checks', 'How many checks in a row failed.'),
        timeField('lastCheckAt', 'Last check', 'When the network was last checked.'),
        timeField('lastOkAt', 'Last good check', 'When the network last worked.'),
        defineField({
          name: 'lastAction',
          title: 'Last repair',
          type: 'string',
          description: 'The last repair tried: none, restart_network, bounce_interface or reboot.',
          options: { list: ['none', 'restart_network', 'bounce_interface', 'reboot'] },
        }),
        timeField('lastActionAt', 'Last repair at', 'When that repair was tried.'),
        timeField('lastRebootAt', 'Last reboot by the watchdog', 'When the watchdog last rebooted the computer.'),
      ],
    }),
    defineField({
      name: 'lastRequest',
      title: 'Last remote request',
      type: 'object',
      description: 'The last request from the Remote actions page that the computer answered.',
      fields: [
        textField('action', 'Action', 'The action that was asked for.'),
        textField('requestedBy', 'Asked by', 'The first name of the person who asked.'),
        timeField('handledAt', 'Answered at', 'When the computer answered.'),
        textField('result', 'Result', 'What the computer did.'),
        textField('via', 'Asked through', 'How the request came in: sanity for this page.'),
      ],
    }),
  ],
  preview: {
    prepare: () => ({ title: 'Status from the Teletraan computer' }),
  },
});
