// Draws the one panel that ?panel= names and holds it (core/still.js). No rotation, no
// takeovers, no hidden effects and no swaps start in this mode: shell.js reads the same address
// and leaves them out. A panel that fails is written on the page (data-still-error) so that the
// screenshot tool can report it.

import * as frame from '../frame.js';
import { changePage } from './areas.js';
import { buildPage, regionOf } from './panels.js';
import { asTeam } from './teams.js';
import { mainPlaylist, tidyScreen } from './screens.js';
import { stillRow } from './still.js';
import { viewSideSteps } from './views.js';
import { viewKeys } from '../config.js';

// A page that can be drawn again from the newest content, so a change published in Sanity reaches a held panel in place
// (core/page-refresh.js asks for it, as it does for the pages of the rotation)
function refreshable(make) {
  const page = make();
  page.rebuild = make;
  return page;
}

function failed(error) {
  console.error('The panel could not be drawn', error);
  document.documentElement.dataset.stillError = String(error && error.message ? error.message : error);
}

// The page of the panel for this row. A Monday row asks the Screens for its steps, as the
// rotation does. When it has none (no tasks for that department) page 1 is drawn anyway, so
// that the preview shows what the panel does with nothing to show.
function pageFor(ask, content) {
  const screen = tidyScreen({ mainRows: [stillRow(ask)] }, ask.screen || 'original', 'original');
  const steps = mainPlaylist(content, new Date(), screen);
  const step = steps.length > 0 ? steps[0] : { panel: ask.panel };

  return asTeam(ask.team, () => buildPage(step.panel, content, step.page, step));
}

// The small panel of a row preview (?rowpreview=): the one the row pairs with it, or else the first small panel of its view, or else the team tile.
// The standard layout always draws a small frame, so the picture of a row is not left with an empty one.
async function holdSide(ask, getContent) {
  const content = getContent();
  const view = viewKeys.includes(ask.view) ? ask.view : 'general';
  const first = viewSideSteps(content, view)[0];
  const panel = ask.side || (first ? first.panel : 'team-tile');
  if (regionOf(panel) !== 'grid2') return;

  await changePage('grid2', refreshable(() => asTeam(ask.team, () => buildPage(panel, getContent(), 1, { panel: panel }))));
}

// getContent() returns the newest content. Call after the fixed panels are drawn.
export async function holdPanel(ask, getContent) {
  try {
    const region = regionOf(ask.panel);
    if (region === null) throw new Error('"' + ask.panel + '" is not a panel in registry.js');

    if (region === 'grid1' || region === 'grid2') {
      await changePage(region, refreshable(() => pageFor(ask, getContent())));
    }
    // the banner and the countdown are fixed panels that are on the page already

    // the bar layout has no small panel
    if (region === 'grid1' && ask.small && ask.layout !== 'bar') {
      try {
        await holdSide(ask, getContent);
      } catch (error) {
        console.error('The small panel of the row could not be drawn', error);
      }
    }

    if (ask.still) frame.tickOnce();
    document.documentElement.dataset.stillReady = '1';
  } catch (error) {
    failed(error);
  }
}
