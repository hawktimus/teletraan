// How long each line of the ticker stays, and the older lists of panels. The panels of the main and
// side area, their order and their seconds are rows of the three Screens now (Screens in the sidebar,
// schemas/screen.js). The panel names must match the ids in dashboard/registry.js.
//
// The order was one list, Panel order, with every panel in it. It stays in the schema, hidden, with
// what was saved in it, and so do the two lists before it, Large panels and Small panels. The first
// time a Screen is opened its rows are worked out from them (studio/tools/screen-seed.js), and the
// dashboard does the same for a Screen that has none (dashboard/core/panel-order.js).

import { defineField, defineArrayMember } from 'sanity';
import { titleOf } from './fields.js';
import { PanelOrderInput } from '../inputs/panel-order-input.js';
import { largePanels, smallPanels } from '../inputs/screen-panels.js';

// The one list that Panel order starts with, the large panels first
const allPanels = largePanels.concat(smallPanels);

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
    title: 'Ticker',
    type: 'object',
    group: 'screen',
    description: 'How long each ticker line stays. The panels, their order and their seconds are set in Screens, under Start here in the sidebar.',
    fields: [
      defineField({
        name: 'order',
        title: 'Panel order',
        type: 'array',
        hidden: true,
        description: 'Not used any more. The rows of each Screen (Screens in the sidebar) replace this list. It stays so that a saved list is kept.',
        of: [stepMember(allPanels, true)],
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
      panelList('grid1', 'Large panels', 'The big panels, one at a time. Not used any more: a Screen with no rows builds them from this list.', largePanels),
      panelList('grid2', 'Small panels', 'The small panels, one at a time. Not used any more: a Screen with no rows builds them from this list.', smallPanels),
    ],
  });
}
