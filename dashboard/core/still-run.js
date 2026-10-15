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

  return asTeam(ask.team, () => buildPage(step.panel, content, step.page));
}

// getContent() returns the newest content. Call after the fixed panels are drawn.
export async function holdPanel(ask, getContent) {
  try {
    const region = regionOf(ask.panel);
    if (region === null) throw new Error('"' + ask.panel + '" is not a panel in registry.js');

    if (region === 'grid1' || region === 'grid2') {
      await changePage(region, pageFor(ask, getContent()));
    }
    // the banner and the countdown are fixed panels that are on the page already

    if (ask.still) frame.tickOnce();
    document.documentElement.dataset.stillReady = '1';
  } catch (error) {
    failed(error);
  }
}
