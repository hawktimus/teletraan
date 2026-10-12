// A Screen: what plays on the TV on the days it is picked for (Dashboard Settings, Look tab). There
// are three, Original, Cybertron and Minimal, each a document that exists once with a fixed id
// (screen-original, screen-cybertron, screen-minimal). The id says which style the Screen is, so
// no style is stored. They are in the sidebar under Settings, Screens (structure.js).
//
// The form opens on a map of the screen (screen-input.js). Its five letters are the five tabs:
//   A Banner      the Team document of the team chosen in the Editing switch, and how often the
//                 name effect and the flying hawk play and how long the swap takes
//   B Main panel  the rows the main panel plays, top to bottom, and the Monday style
//   C Countdown   the title and dates, which stay in Dashboard Settings and are shown here
//   D Side panel  the rows the side panel plays, on its own timer. Minimal has no side panel
//   E Ticker      a link to Tips and News. The ticker has no settings on the Screen
//
// A row of the main panel names a panel and, for a panel that is for one team, the team: a team
// code, Both teams (Milestones and Progress only) or nothing, which keeps the team that is on the
// screen. The screen swaps when the team of the next row is another. The rows are filled once from
// the Panel order of Dashboard Settings the first time the Screen is opened (screen-seed.js).
//
// The starting values are the same as defaultScreen in dashboard/config.js, and check-schemas.mjs
// fails if they differ. None of the numbers is required: a Screen with none uses the starting values.

import { defineType, defineField, defineArrayMember } from 'sanity';
import { ScreenInput } from '../screen-input.js';
import { BannerTeamInput, CountdownInput, TickerInput, RowTeamInput } from '../screen-fields.js';
import { largePanels, smallPanels, mondayPanels, panelTitle, teamKindOf, teamProblem, teamWord } from '../screen-panels.js';
import { screenStyles, screenTitles, styleOfScreenId } from '../screen-ids.js';

// The letters of the map, in order. The names are the ones in letterGroups in screen-map.js.
const groups = [
  { name: 'banner', title: 'A Banner', default: true },
  { name: 'main', title: 'B Main panel' },
  { name: 'countdown', title: 'C Countdown' },
  { name: 'side', title: 'D Side panel' },
  { name: 'ticker', title: 'E Ticker' },
];

// The values are the names in styles in dashboard/config.js
const styles = screenStyles.map(style => ({ title: screenTitles[style], value: style }));

// Minimal has no side panel, so its form has no rows for one and no tab
function hasNoSidePanel(context) {
  return styleOfScreenId(context.document && context.document._id) === 'minimal';
}

// A row with its own seconds stays up that long. With none it follows Seconds per page (Screen tab
// of Dashboard Settings), and the Photo panel follows Seconds per photo.
const secondsRule = Rule => Rule.integer().min(6).max(120).error('Use a whole number from 6 to 120.');

function secondsField() {
  return defineField({
    name: 'seconds',
    title: 'Seconds on screen',
    type: 'number',
    description: 'Optional. Leave empty and the row follows Seconds per page (Photo follows Seconds per photo). Otherwise from 6 to 120.',
    validation: secondsRule,
  });
}

function panelField(panels, description) {
  return defineField({
    name: 'panel',
    title: 'Panel',
    type: 'string',
    description: description,
    options: { list: panels },
    validation: Rule => [Rule.required().error('Pick a panel.'), Rule.valid(panels.map(panel => panel.value)).error('Pick a panel from the list.')],
  });
}

function secondsWords(row) {
  if (row.seconds) return row.seconds + ' seconds';
  return row.panel === 'photo' ? 'Follows Seconds per photo' : 'Follows Seconds per page';
}

const mainRow = defineArrayMember({
  type: 'object',
  title: 'Row',
  fields: [
    panelField(largePanels.concat(mondayPanels), 'Which panel this row plays in the main panel. The Monday rows are the cards from the Monday boards.'),
    defineField({
      name: 'team',
      title: 'Team',
      type: 'string',
      description: 'Leave blank to keep the team on the screen. A Monday row needs a team, or Both teams for Milestones and Progress.',
      components: { input: RowTeamInput },
      validation: Rule => Rule.custom((team, context) => {
        const problem = teamProblem(context.parent && context.parent.panel, team);
        return problem === '' ? true : problem;
      }),
    }),
    secondsField(),
  ],
  preview: {
    select: { panel: 'panel', team: 'team', seconds: 'seconds' },
    prepare(row) {
      const team = row.team ? teamWord(row.team) : teamKindOf(row.panel) === 'optional' ? 'Keeps the team on the screen' : '';
      return { title: panelTitle(row.panel) || 'Panel not chosen', subtitle: [team, secondsWords(row)].filter(Boolean).join(' · ') };
    },
  },
});

const sideRow = defineArrayMember({
  type: 'object',
  title: 'Row',
  fields: [panelField(smallPanels, 'Which small panel this row plays in the side panel.'), secondsField()],
  preview: {
    select: { panel: 'panel', seconds: 'seconds' },
    prepare(row) {
      return { title: panelTitle(row.panel) || 'Panel not chosen', subtitle: secondsWords(row) };
    },
  },
});

export default defineType({
  name: 'screen',
  title: 'Screen',
  type: 'document',
  groups: groups,
  components: { input: ScreenInput },
  fields: [
    defineField({
      name: 'bannerTeam',
      title: 'Team document',
      type: 'string',
      group: 'banner',
      readOnly: true,
      description: 'Opens the document of the team chosen in Editing, with its name, number, logo, colors and the Outlined name switch.',
      components: { input: BannerTeamInput },
    }),
    defineField({
      name: 'nameEffectEveryMinutes',
      title: 'Name effect every (minutes)',
      type: 'number',
      group: 'banner',
      description: 'How often each letter of the team name splits apart and locks back together, from 1 to 240 minutes. Starts at 10.',
      initialValue: 10,
      validation: Rule => Rule.integer().min(1).max(240).error('Use a whole number of minutes from 1 to 240.'),
    }),
    defineField({
      name: 'hawkEveryMinutes',
      title: 'Flying hawk every (minutes)',
      type: 'number',
      group: 'banner',
      description: 'How often the logo changes into a hawk and flies, from 1 to 240 minutes. Starts at 15.',
      initialValue: 15,
      validation: Rule => Rule.integer().min(1).max(240).error('Use a whole number of minutes from 1 to 240.'),
    }),
    defineField({
      name: 'swapSeconds',
      title: 'Swap time (seconds)',
      type: 'number',
      group: 'banner',
      description: 'How long the screen takes to pull apart and re-form when the team or the style changes, from 0.5 to 3. Starts at 1.25.',
      initialValue: 1.25,
      validation: Rule => Rule.min(0.5).max(3).error('Use a number from 0.5 to 3.'),
    }),

    defineField({
      name: 'mainRows',
      title: 'Main panel rows',
      type: 'array',
      group: 'main',
      description: 'Keep the Prime rows together and the Nova rows together. The screen transforms every time the team changes.',
      of: [mainRow],
    }),
    defineField({
      name: 'mondayStyle',
      title: 'Monday style',
      type: 'string',
      group: 'main',
      description: 'The style the screen takes while a Monday row plays. It changes back when the next row is not a Monday row.',
      options: { list: styles, layout: 'radio', direction: 'horizontal' },
      validation: Rule => Rule.valid(screenStyles).error('Pick original, cybertron or minimal.'),
    }),

    defineField({
      name: 'countdownShown',
      title: 'Countdown',
      type: 'string',
      group: 'countdown',
      readOnly: true,
      description: 'The title and dates are content of Dashboard Settings, Countdown tab. They are shown here and are the same on every Screen.',
      components: { input: CountdownInput },
    }),

    defineField({
      name: 'sideRows',
      title: 'Side panel rows',
      type: 'array',
      group: 'side',
      hidden: hasNoSidePanel,
      description: 'The small panels, one after the other, on their own timer. A row has no team: the panel takes the colors of the team on the screen.',
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
    prepare(screen) {
      return { title: screenTitles[styleOfScreenId(screen.id)] || 'Screen' };
    },
  },
});
