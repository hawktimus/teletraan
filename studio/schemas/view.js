// A View: what plays on the TV for a while, with its own arrangement, main panel rows and small panel
// rows. There are four, General, Prime, Nova and Family, each a document that exists once with a fixed
// id (view-general, view-prime, view-nova, view-family). The id says which view it is, and key stores
// the same word. They are under Settings, Views, in the sidebar (structure.js).
//
// The form opens on the map of the screen (view-input.js) with a picker of the four views above it. Its
// five letters are the five tabs, as on a Screen:
//   A Banner      the name of the view, its team and the arrangement (layout, mirror, view tag, team chip, colors)
//   B Main panel  the minutes the view stays and the rows it plays, top to bottom
//   C Countdown   where the countdown sits. Its title and dates stay in Dashboard Settings
//   D Side panel  the small panels, one after the other. Only the standard arrangement has them
//   E Ticker      a link to Tips and News
//
// Family plays two panels and no others, Overall progress and Status by department, so its list is
// locked. The starting values are the ones in defaultViews (tools/view-defaults.js), which the screen has
// as well, and the first rows of a view are filled once, when it is first opened (tools/view-seed.js).
// None of the numbers is required: a view with none uses the starting values.

import { defineType, defineField } from 'sanity';
import { ViewInput } from '../inputs/view-input.js';
import { CountdownInput, TickerInput } from '../inputs/screen-fields.js';
import { mainRow, sideRow } from './screen.js';
import { noteField, tooLong } from './fields.js';
import { viewKeys, viewTitles, viewMinutes, minutesLimits, viewLayouts, keyOfViewId } from '../inputs/view-ids.js';

// The letters of the map, in order. The names are the ones in letterGroups in screen-map.js.
const groups = [
  { name: 'banner', title: 'A Banner', default: true },
  { name: 'main', title: 'B Main panel' },
  { name: 'countdown', title: 'C Countdown' },
  { name: 'side', title: 'D Side panel' },
  { name: 'ticker', title: 'E Ticker' },
];

const countdownPlaces = [
  { title: 'In the side column', value: 'side' },
  { title: 'In the banner', value: 'banner' },
];

const colorChoices = [
  { title: 'Colors of the team', value: 'team' },
  { title: 'General colors', value: 'general' },
];

function keyOf(context) {
  const document = context.document || {};
  return document.key || keyOfViewId(document._id);
}

// The views that are for one team
const hasNoTeam = context => viewKeys.indexOf(keyOf(context)) === -1 || ['general', 'family'].indexOf(keyOf(context)) !== -1;
const isFamily = context => keyOf(context) === 'family';
const hasNoSidePanel = context => Boolean(context.document) && context.document.layout === 'bar';

export default defineType({
  name: 'view',
  title: 'View',
  type: 'document',
  groups: groups,
  components: { input: ViewInput },
  fields: [
    defineField({
      name: 'key',
      title: 'Key',
      type: 'string',
      group: 'banner',
      hidden: true,
      readOnly: true,
      description: 'Which view this is. The Studio sets it. Do not edit it.',
      options: { list: viewKeys.map(key => ({ title: viewTitles[key], value: key })) },
      validation: Rule => Rule.valid(viewKeys).error('Use general, prime, nova or family.'),
    }),
    defineField({
      name: 'title',
      title: 'Name on the screen',
      type: 'string',
      group: 'banner',
      description: 'Optional. The name in the view tag. Empty uses the Look tab name (General) or the short name of the team. Up to 16 characters fit.',
      validation: Rule => tooLong(Rule, 16),
    }),
    defineField({
      name: 'team',
      title: 'Team',
      type: 'reference',
      to: [{ type: 'team' }],
      group: 'banner',
      hidden: hasNoTeam,
      description: 'The team whose name, colors and Monday cards this view shows. General and Family have no team.',
      options: { filter: 'active != false' },
    }),
    defineField({
      name: 'layout',
      title: 'Arrangement',
      type: 'string',
      group: 'banner',
      description: 'Standard has the banner, a main panel, the countdown and the small panels. Bar has the banner across the top, a column at one side and one main panel.',
      options: { list: viewLayouts, layout: 'radio', direction: 'horizontal' },
      validation: Rule => Rule.valid(viewLayouts.map(item => item.value)).error('Pick standard or bar.'),
    }),
    defineField({
      name: 'mirror',
      title: 'Mirror the arrangement',
      type: 'boolean',
      group: 'banner',
      description: 'On: the column is at the other side and the main panel is at the left.',
    }),
    defineField({
      name: 'viewTag',
      title: 'Show the view tag',
      type: 'boolean',
      group: 'banner',
      description: 'On: the name of the view shows at the far edge of the banner.',
    }),
    defineField({
      name: 'teamChip',
      title: 'Show the team chip',
      type: 'boolean',
      group: 'banner',
      description: 'On: the cards of the view carry the chip of their team.',
    }),
    defineField({
      name: 'colors',
      title: 'Colors',
      type: 'string',
      group: 'banner',
      description: 'Which colors the view is drawn in.',
      options: { list: colorChoices, layout: 'radio', direction: 'horizontal' },
      validation: Rule => Rule.valid(colorChoices.map(item => item.value)).error('Pick team or general.'),
    }),

    noteField('rotationNote', 'The order of the panels, their seconds and which view each one plays in is the Rotation list in Dashboard Settings, Look tab.', 'main'),
    defineField({
      name: 'minutes',
      title: 'Minutes on the screen',
      type: 'number',
      group: 'main',
      hidden: true,
      description: 'Not used any more. A block of the Rotation list stays for the seconds of its rows. The saved number, from 1 to 30 minutes, is kept.',
      validation: Rule => Rule.integer().min(minutesLimits.min).max(minutesLimits.max).error('Use a whole number of minutes from ' + minutesLimits.min + ' to ' + minutesLimits.max + '.'),
    }),
    defineField({
      name: 'panels',
      title: 'Main panel rows',
      type: 'array',
      group: 'main',
      hidden: true,
      readOnly: isFamily,
      description: 'Not used any more. The Rotation list in Dashboard Settings, Look tab, replaces these rows, and is filled from them the first time it is opened.',
      of: [mainRow],
    }),

    defineField({
      name: 'countdownIn',
      title: 'Countdown',
      type: 'string',
      group: 'countdown',
      description: 'Where the countdown sits.',
      options: { list: countdownPlaces, layout: 'radio', direction: 'horizontal' },
      validation: Rule => Rule.valid(countdownPlaces.map(item => item.value)).error('Pick side or banner.'),
    }),
    defineField({
      name: 'countdownShown',
      title: 'Title and dates',
      type: 'string',
      group: 'countdown',
      readOnly: true,
      description: 'The title and dates are content of Dashboard Settings, Countdown tab. They are shown here and are the same on every view.',
      components: { input: CountdownInput },
    }),

    defineField({
      name: 'sidePanels',
      title: 'Side panel rows',
      type: 'array',
      group: 'side',
      hidden: hasNoSidePanel,
      description: 'The small panels, one after the other, on their own timer. Only the standard arrangement has them.',
      of: [sideRow],
    }),

    defineField({
      name: 'tickerLink',
      title: 'Tips and News',
      type: 'string',
      group: 'ticker',
      readOnly: true,
      description: 'The ticker shows every published tip and news item in order.',
      components: { input: TickerInput },
    }),
  ],
  preview: {
    select: { id: '_id' },
    prepare(view) {
      return { title: viewTitles[keyOfViewId(view.id)] || 'View' };
    },
  },
});
