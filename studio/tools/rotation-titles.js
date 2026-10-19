// The one table of plain titles the Rotation board uses: the three views and the panels, grouped by kind. The panel titles
// are the ones of inputs/screen-panels.js, which tests/schemas.test.mjs keeps in step with dashboard/registry.js.
//
// Plain functions only, so that the test can run them with node.

import { largePanels, mondayPanels, olderMondayPanels, pairedPanels, panelTitle, placeholderPanels, rotationPanels, smallPanels } from '../inputs/screen-panels.js';

// The view of a row, its words and the colour of its group. Prime is purple, Nova is gold and Robotics is neutral.
export const viewTable = [
  { value: 'robotics', title: 'Robotics', colour: '#6b7280', tint: 'rgba(107, 114, 128, 0.14)' },
  { value: 'prime', title: 'Prime', colour: '#7c3aed', tint: 'rgba(124, 58, 237, 0.14)' },
  { value: 'nova', title: 'Nova', colour: '#b7791f', tint: 'rgba(214, 158, 46, 0.18)' },
];

export function viewEntry(view) {
  return viewTable.filter(item => item.value === view)[0] || { value: '', title: 'No view', colour: '#9ca3af', tint: 'rgba(156, 163, 175, 0.14)' };
}

export function viewTitleOf(view) {
  return viewEntry(view).title;
}

// The large panels a row can name, in groups. Each group is { title, panels: [{ value, title }] }.
const mondayChoices = mondayPanels.concat(rotationPanels.filter(item => item.value === 'monday-pie'));
const otherChoices = rotationPanels.filter(item => item.value !== 'monday-pie').concat(placeholderPanels);

export const panelGroups = [
  { title: 'Wall panels', panels: largePanels },
  { title: 'Monday cards', panels: mondayChoices },
  { title: 'Competition, news, drive and robot', panels: otherChoices },
];

// The small panels a split row can sit beside
export const sidePanelGroups = [
  { title: 'Small panels', panels: smallPanels },
  { title: 'Only beside a row', panels: pairedPanels },
];

export const panelChoices = panelGroups.reduce((all, group) => all.concat(group.panels), []);
export const sideChoices = sidePanelGroups.reduce((all, group) => all.concat(group.panels), []);

export function panelTitleOf(panel) {
  return panelTitle(panel) || (olderMondayPanels.filter(item => item.value === panel)[0] || {}).title || '';
}
