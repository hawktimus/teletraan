// The plain words the pages use for things the wall stores under an id: a panel, a view, a theme, a team and a layout. They are
// the words of the Rotation board in the Studio, so the same panel has the same name on the TV, in the Studio and here.

import { panelChoices, panelTitleOf, sideChoices } from '../../studio/tools/rotation-titles.js';
import { themeNames, viewNames } from './requests.js';

// The title of every panel in ids, and of every panel the Rotation board offers. A panel with no title keeps its id.
export function panelNamesOf(ids) {
  const names = {};
  panelChoices.concat(sideChoices).forEach(panel => { names[panel.value] = panel.title; });
  (ids || []).forEach(id => { if (id && !names[id]) names[id] = panelTitleOf(id) || id; });
  return names;
}

const layoutNames = { standard: 'Standard', bar: 'Bar', sidebar: 'Sidebar' };
const teamNames = { both: 'Both teams', prime: 'Prime', nova: 'Nova' };

// What the Now on the wall card needs to turn the ids of a report into words
export function namesFor(report) {
  const panel = report && report.panel ? [report.panel] : [];
  return { panels: panelNamesOf(panel), views: viewNames, themes: themeNames, layouts: layoutNames, teams: teamNames };
}
