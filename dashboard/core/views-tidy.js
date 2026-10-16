// Tidying the views that are stored, and the names and titles of a view (part of views.js).

import { countdownPlaces, defaultSettings, defaultViews, familyPanels, viewColors, viewIds, viewKeys, viewLayoutNames, viewLimits, viewTeams } from '../config.js';
import { keepInRange } from './content.js';
import { tidyMainRow, tidySideRow } from './screens.js';
import { hasText, isRecord } from './text.js';

const teamCode = /^[a-z0-9]+$/;

function tidyTeam(value) {
  const code = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return teamCode.test(code) && code !== 'both' ? code : '';
}

function trimmed(value, longest, fallback) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text === '' ? fallback : text.slice(0, longest);
}


// The settings

export const longestName = 24;
const longestTitle = 40;

export function viewOrderOf(content) {
  const settings = isRecord(content) && isRecord(content.settings) ? content.settings : {};
  const order = Array.isArray(settings.viewOrder) ? settings.viewOrder.filter((key, at, list) => viewKeys.includes(key) && list.indexOf(key) === at) : [];

  return order.length > 0 ? order : viewKeys.slice();
}


// The documents

// The rows of the large panel of one view. A team view gives its team to every row, so a row of a panel that does not
// follow the team is still drawn in the team of the view. The rows of Family are the two fixed ones.
function tidyPanels(rows, key, team) {
  const wanted = (Array.isArray(rows) ? rows : []).map(raw => {
    if (!isRecord(raw)) return null;
    return tidyMainRow(team === '' ? raw : Object.assign({}, raw, { team: team }));
  }).filter(row => row !== null);

  if (key !== 'family') return wanted;

  return familyPanels.map(panel => wanted.find(row => row.panel === panel) || tidyMainRow(defaultViews.family.panels.find(row => row.panel === panel)));
}

function tidyRows(list) {
  return (Array.isArray(list) ? list : []).map(tidySideRow).filter(row => row !== null);
}

// One view document, always complete: { key, title, team, layout, mirror, countdownIn, viewTag, teamChip, colors, minutes, panels,
// sidePanels }. A list of rows that is
// empty is the starting one. The small panel exists in the standard layout only, so the other views have no side rows.
export function tidyView(raw, key) {
  const source = isRecord(raw) ? raw : {};
  const start = defaultViews[key];
  const team = viewTeams[key] === '' ? '' : tidyTeam(source.team) || viewTeams[key];
  const panels = tidyPanels(source.panels, key, team);
  const layout = viewLayoutNames.includes(source.layout) ? source.layout : start.layout;
  const sidePanels = tidyRows(source.sidePanels);
  const flag = (value, fallback) => (typeof value === 'boolean' ? value : fallback);

  return {
    key: key,
    title: typeof source.title === 'string' ? source.title.trim() : '',
    team: team,
    layout: layout,
    mirror: flag(source.mirror, start.mirror),
    countdownIn: countdownPlaces.includes(source.countdownIn) ? source.countdownIn : start.countdownIn,
    viewTag: key === 'family' ? false : flag(source.viewTag, start.viewTag),
    teamChip: flag(source.teamChip, start.teamChip),
    colors: viewColors.includes(source.colors) ? source.colors : start.colors,
    minutes: Math.round(keepInRange(source.minutes, viewLimits.minutes, start.minutes)),
    panels: panels.length > 0 ? panels : tidyPanels(start.panels, key, team),
    sidePanels: layout !== 'standard' ? [] : sidePanels.length > 0 ? sidePanels : tidyRows(start.sidePanels),
  };
}

function keyOfId(id) {
  return viewKeys.find(key => viewIds[key] === id) || '';
}

// The views that the Studio has, from the documents as the query sends them. A document whose id is not one of the
// four is left out, and so is a second one with the same id.
export function tidyViews(list) {
  const found = [];

  (Array.isArray(list) ? list : []).forEach(raw => {
    const key = isRecord(raw) ? keyOfId(raw._id) : '';
    if (key !== '' && !found.some(view => view.key === key)) found.push(tidyView(raw, key));
  });
  return found;
}

// The view of a key, always complete: the document when the Studio has it and the starting view when it has not
export function resolveView(content, key) {
  const found = (isRecord(content) && Array.isArray(content.views) ? content.views : []).find(view => view.key === key);
  return found || tidyView(null, key);
}


// The names

// The name of a view as the tag in the banner says it, and the title of the banner. A team view is named for its
// team (the short name) and titled with the whole name of the team that is on the screen, which the banner knows.
export function viewNameOf(content, key) {
  const settings = isRecord(content) && isRecord(content.settings) ? content.settings : {};
  const view = resolveView(content, key);

  if (key === 'general') return trimmed(settings.generalViewName, longestName, defaultSettings.generalViewName);
  if (key === 'family') return view.title !== '' ? view.title : 'Family';

  const team = (isRecord(content) && Array.isArray(content.teams) ? content.teams : []).find(item => item.code === view.team);
  if (team && hasText(team.shortName)) return String(team.shortName).trim();
  return view.title !== '' ? view.title : view.team.toUpperCase();
}

// The title of the banner when the view has one of its own: General and Family carry the title of Dashboard Settings,
// and a team view carries its team's name, which is the banner's own
export function viewTitleOf(content, key) {
  if (key !== 'general' && key !== 'family') return '';

  const settings = isRecord(content) && isRecord(content.settings) ? content.settings : {};
  return trimmed(settings.generalViewTitle, longestTitle, defaultSettings.generalViewTitle);
}

// Whether the tag with the name of the view is drawn. Family is not named on the screen, and a view can switch it off.
export function viewShowsTag(content, key) {
  return key !== 'family' && resolveView(content, key).viewTag;
}
