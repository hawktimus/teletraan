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

// The large panels a row can name, in groups. Each group is { title, panels: [{ value, title }] }. The retired Monday panels
// are in no group: a stored row that names one shows its title and plays nothing.
export const panelGroups = [
  { title: 'Wall panels', panels: largePanels },
  { title: 'Monday', panels: mondayPanels },
  { title: 'Competition, news, drive and robot', panels: rotationPanels.concat(placeholderPanels) },
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

// The panels that only draw a title and a dashed frame until they are designed (placeholder in dashboard/registry.js).
// Robot status and the Wireframe view are large panels, Mini panel idea 1 is a small one.
export const placeholderIds = ['robotStatus', 'wireframe', 'miniIdea1'];
export const placeholderNote = 'Placeholder: draws only a title';

// Registered panels that the board neither offers nor explains as automatic, each with the reason. A new panel in
// dashboard/registry.js must be offered in the board, explained in tools/rotation-auto.js or named here, or
// tests/rotation-panels-explained.test.mjs fails with its id.
export const internalPanels = [
  { id: 'stand-in-tile', reason: 'Only for the hardware test (?stress). It is never on the wall.' },
  { id: 'stand-in-ticker', reason: 'Only for the hardware test (?stress). It is never on the wall.' },
];
