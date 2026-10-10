// Which panels appear in each area of the screen, in what order, and for how
// long. The panel names must match the ids in dashboard/registry.js. Seconds
// are optional: a row or the ticker with none follows Seconds per page, which
// is in dashboardSettings.js.
//
// The order is one list, Panel order, with every panel in it. The large panels
// and the small panels each follow the rows that are theirs, in the order they
// have there. The two older lists, Large panels and Small panels, stay in the
// schema, hidden, with what was saved in them. The screen follows Panel order,
// and builds it from the older lists when it is empty (dashboard/core/panel-order.js).

import { defineField, defineArrayMember } from 'sanity';
import { titleOf } from './fields.js';
import { PanelOrderInput } from '../panel-order-input.js';

const largePanels = [
  { title: 'Tasks', value: 'tasks' },
  { title: 'Upcoming events', value: 'events' },
  { title: 'Daily Agenda', value: 'tonight' },
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

// The one list that Panel order starts with, the large panels first
const allPanels = largePanels.concat(smallPanels);

// The Monday cards are offered in Panel order so that a coach can see them, but they are not in the starting list.
// They run in the Monday pass of the look rotation (dashboard/core/monday.js).
const mondayPanels = [
  { title: 'Monday tasks', value: 'monday-tasks' },
  { title: 'Monday milestones', value: 'monday-milestones' },
  { title: 'Monday progress', value: 'monday-progress' },
];

// Not required: an empty field is allowed and means "follow Seconds per page".
// The Photo panel follows Seconds per photo (Screen tab) instead.
const secondsRule = Rule => Rule.integer().min(6).max(120).error('Use a whole number from 6 to 120.');

// A new Studio starts with every panel in the list, in this order, with no
// seconds of its own
function startingList(panels) {
  return panels.map(panel => ({ panel: panel.value, show: true }));
}

// The rows of a hidden list have no rules, because nobody can fix a row in a field
// they cannot open, and a page saved with an odd row must still publish.
function stepMember(panels, hasRules) {
  const rule = check => (hasRules ? check : undefined);

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
        validation: rule(Rule => Rule.required().error('Pick a panel.')),
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
        validation: rule(secondsRule),
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
        if (smallPanels.some(panel => panel.value === step.panel)) subtitle = 'Small panel · ' + subtitle;
        else if (step.panel) subtitle = 'Large panel · ' + subtitle;
        return { title: titleOf(panels, step.panel) || 'Panel not chosen', subtitle: subtitle };
      },
    },
  });
}

// The two older lists are kept for pages saved before Panel order existed. Nobody
// edits them now, so they are hidden.
function panelList(name, title, description, panels) {
  return defineField({
    name: name,
    title: title,
    type: 'array',
    hidden: true,
    description: description,
    of: [stepMember(panels, false)],
    initialValue: startingList(panels),
  });
}

export function rotationField() {
  return defineField({
    name: 'rotation',
    title: 'Panels',
    type: 'object',
    group: 'screen',
    description: 'Which panels appear on the screen, in what order, and for how long. Neon Prime shows no small panels.',
    fields: [
      defineField({
        name: 'order',
        title: 'Panel order',
        type: 'array',
        description: 'Every panel in one list. Drag to change the order. A row can have its own seconds. Large and small panels each follow their own order here.',
        of: [stepMember(allPanels.concat(mondayPanels), true)],
        initialValue: startingList(allPanels),
        components: { input: PanelOrderInput },
      }),
      defineField({
        name: 'tickerSeconds',
        title: 'Seconds per ticker line',
        type: 'number',
        description: 'Optional. Leave empty and each line stays one and a half times Seconds per page. Otherwise from 6 to 120 seconds.',
        validation: secondsRule,
      }),
      panelList('grid1', 'Large panels', 'The big panels, one at a time. Not used any more: the screen follows Panel order, and builds it from this list while it is empty.', largePanels),
      panelList('grid2', 'Small panels', 'The small panels, one at a time. Not used any more: the screen follows Panel order, and builds it from this list while it is empty.', smallPanels),
    ],
  });
}
