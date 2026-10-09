// Which panels appear in each area of the screen, in what order, and for how
// long. The panel names must match the ids in dashboard/registry.js. Seconds
// are optional: a row or the ticker with none follows Seconds per page, which
// is in dashboardSettings.js.

import { defineField, defineArrayMember } from 'sanity';
import { titleOf } from './fields.js';

const largePanels = [
  { title: 'Tasks', value: 'tasks' },
  { title: 'Upcoming events', value: 'events' },
  { title: 'Up Next', value: 'tonight' },
  { title: 'Subteam spotlight', value: 'spotlight' },
  { title: 'Sponsor feature', value: 'sponsor-feature' },
  { title: 'Photo', value: 'photo' },
  { title: 'Leadership', value: 'leadership' },
  { title: 'Team leads', value: 'team-leads' },
  { title: 'Subteam roster', value: 'roster' },
  { title: 'Extra panel', value: 'custom' },
];

const smallPanels = [
  { title: 'Task counts', value: 'task-counts' },
  { title: 'Next event', value: 'next-event' },
  { title: 'Weather forecast', value: 'forecast' },
  { title: 'Safety days', value: 'safety-days' },
  { title: 'Sponsor logo', value: 'sponsor-logo' },
];

// Not required: an empty field is allowed and means "follow Seconds per page".
// The Photo panel follows Seconds per photo (Photos tab) instead.
const secondsRule = Rule => Rule.integer().min(6).max(120).error('Use a whole number from 6 to 120.');

// A new Studio starts with every panel in the list, in this order, with no
// seconds of its own
function startingList(panels) {
  return panels.map(panel => ({ panel: panel.value, show: true }));
}

function stepMember(panels) {
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
        description: 'Optional. Leave empty and the panel follows Seconds per page (Photo follows Seconds per photo). Otherwise how long it stays up, from 6 to 120.',
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
        } else {
          subtitle = step.panel === 'photo' ? 'Follows Seconds per photo' : 'Follows Seconds per page';
        }
        return { title: titleOf(panels, step.panel) || 'Panel not chosen', subtitle: subtitle };
      },
    },
  });
}

function panelList(name, title, description, panels) {
  return defineField({
    name: name,
    title: title,
    type: 'array',
    description: description,
    of: [stepMember(panels)],
    initialValue: startingList(panels),
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
      panelList('grid1', 'Large panels', 'The big panels, one at a time. Drag to change the order. A row can have its own seconds. With Neon Prime this list is the whole rotation.', largePanels),
      panelList('grid2', 'Small panels', 'The small panels, one at a time. Drag to change the order. A row can have its own seconds. Not used while Neon Prime (a sidebar) is on.', smallPanels),
      defineField({
        name: 'tickerSeconds',
        title: 'Seconds per ticker line',
        type: 'number',
        description: 'Optional. Leave empty and each line stays one and a half times Seconds per page. Otherwise from 6 to 120 seconds.',
        validation: secondsRule,
      }),
    ],
  });
}
