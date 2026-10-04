// Which panels appear in each area of the screen, in what order, and for how
// long. The panel names must match the ids in dashboard/registry.js.

import { defineField, defineArrayMember } from 'sanity';
import { titleOf } from './fields.js';

const largePanels = [
  { title: 'Tasks', value: 'tasks' },
  { title: 'Upcoming events', value: 'events' },
  { title: "Tonight's plan", value: 'tonight' },
  { title: 'Subteam spotlight', value: 'spotlight' },
  { title: 'Sponsor feature', value: 'sponsor-feature' },
  { title: 'Photo', value: 'photo' },
  { title: 'Leadership', value: 'leadership' },
  { title: 'Team leads', value: 'team-leads' },
  { title: 'Custom panel', value: 'custom' },
];

const smallPanels = [
  { title: 'Task counts', value: 'task-counts' },
  { title: 'Next event', value: 'next-event' },
  { title: 'Weather forecast', value: 'forecast' },
  { title: 'Safety days', value: 'safety-days' },
  { title: 'Sponsor logo', value: 'sponsor-logo' },
];

const secondsRule = Rule => [
  Rule.required().error('Enter the number of seconds.'),
  Rule.integer().min(6).max(120).error('Use a whole number from 6 to 120.'),
];

// A new Studio starts with every panel in the list, in this order
function startingList(panels, seconds) {
  return panels.map(panel => ({ panel: panel.value, show: true, seconds: seconds }));
}

function stepMember(panels, seconds) {
  return defineArrayMember({
    type: 'object',
    title: 'Panel',
    fields: [
      defineField({
        name: 'panel',
        title: 'Panel',
        type: 'string',
        description: 'Which panel this row controls.',
        options: { list: panels },
        validation: Rule => Rule.required().error('Pick a panel.'),
      }),
      defineField({
        name: 'show',
        title: 'Show on screen',
        type: 'boolean',
        description: 'Turn this off to skip the panel without taking it out of the list.',
        initialValue: true,
      }),
      defineField({
        name: 'seconds',
        title: 'Seconds on screen',
        type: 'number',
        description: 'How long the panel stays up, from 6 to 120 seconds.',
        initialValue: seconds,
        validation: secondsRule,
      }),
    ],
    preview: {
      select: { panel: 'panel', show: 'show', seconds: 'seconds' },
      prepare(step) {
        let subtitle = '';
        if (step.show === false) {
          subtitle = 'Hidden';
        } else if (step.seconds) {
          subtitle = step.seconds + ' seconds';
        }
        return { title: titleOf(panels, step.panel) || 'Panel not chosen', subtitle: subtitle };
      },
    },
  });
}

function panelList(name, title, description, panels, seconds) {
  return defineField({
    name: name,
    title: title,
    type: 'array',
    description: description,
    of: [stepMember(panels, seconds)],
    initialValue: startingList(panels, seconds),
  });
}

export function rotationField() {
  return defineField({
    name: 'rotation',
    title: 'Panels',
    type: 'object',
    group: 'panels',
    description: 'Which panels appear on the screen, in what order, and for how long.',
    fields: [
      panelList('grid1', 'Large panels', 'The big panels, one at a time. Drag to change the order.', largePanels, 16),
      panelList('grid2', 'Small panels', 'The small panels, one at a time. Drag to change the order.', smallPanels, 12),
      defineField({
        name: 'tickerSeconds',
        title: 'Seconds per ticker line',
        type: 'number',
        description: 'How long each line on the ticker at the bottom stays up, from 6 to 120 seconds.',
        initialValue: 24,
        validation: secondsRule,
      }),
    ],
  });
}
