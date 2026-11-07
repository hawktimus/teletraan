// Whether the Teletraan computer is allowed to fix itself, in the Advanced tab of Dashboard Settings.
//
//   supervisorStatus   what it is doing, what it has tried and whether it has stopped trying. It stores nothing
//   supervisorMode     Watch (the starting value) or Fix
//
// The computer checks itself every minute either way (computer/scripts/health.sh) and the Now area of the control page
// always says what it found. The difference is whether it may act: load the page again, run or restart a service,
// restart the screen session, repair the network, and as a last resort reboot. The ladder, the limits and the way a
// reboot loop is made impossible are in computer/scripts/supervisor-plan.mjs and docs/OPERATIONS.md.
//
// It starts on Watch on purpose. For its first day after being installed it watches whatever this says, so there is a
// day of its log to read before it is allowed to restart anything on a wall that people are using.
//
// The dashboard never reads these fields: only the Teletraan computer does.

import { defineField } from 'sanity';
import { SupervisorStatusInput } from '../inputs/supervisor-status-input.js';

export const supervisorModes = ['watch', 'fix'];

export function supervisorFields() {
  return [
    defineField({
      name: 'supervisorStatus',
      title: 'What the computer is fixing',
      type: 'string',
      group: 'advanced',
      readOnly: true,
      description: 'What the Teletraan computer checked, what it is trying and whether it has stopped trying. The computer writes this by itself, so there is nothing to type here.',
      components: { input: SupervisorStatusInput },
    }),
    defineField({
      name: 'supervisorMode',
      title: 'May the computer fix itself?',
      type: 'string',
      group: 'advanced',
      initialValue: 'watch',
      description: 'Watch: it checks itself every minute and writes down what it would do, and does nothing. Fix: it may load the page again, restart a service or the screen, repair the network, and reboot as a last resort. It always watches only for its first day.',
      options: {
        list: [
          { title: 'Watch only (write down what it would do)', value: 'watch' },
          { title: 'Fix (let it repair itself)', value: 'fix' },
        ],
        layout: 'radio',
      },
    }),
  ];
}
