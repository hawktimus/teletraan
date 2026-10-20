// Prime and Nova side by side, a page at a time: the season so far, the ratings from Match13, the points a match, the next match
// and the matches still to play. Each team's numbers are in its own color, from its Team document in Studio. The numbers are
// joined in core/team-metrics.js, and a number that is not there yet is written NOT YET.

import { cardState, cut, emptyMarkup, pageMarkup, pagedChartsMarkup, textAt } from '../../core/competition-draw.js';
import { currentMatch13 } from '../../core/match13.js';
import { activeTeams, teamProperties } from '../../core/teams.js';
import { lines, tagFor, valueParts } from '../../core/team-metrics-draw.js';
import { comparePages, compareTeams, metricsFor } from '../../core/team-metrics.js';

const NOT_ENOUGH = 'Not enough matches yet.';
const COLUMNS = { first: 790, second: 1096 };

function pagesFor(state) {
  const teams = compareTeams(state.frc);
  if (teams.length === 0) return { teams: [], pages: [] };

  return { teams: teams, pages: comparePages(metricsFor(state.frc, teams[0].team), metricsFor(state.frc, teams[1].team)) };
}

function nameOf(entry) {
  return cut(entry.team.toUpperCase(), 8);
}

// The page of whichever team has rows, which gives the labels
function labelsOf(page) {
  return page.first.rows.length > 0 ? page.first : page.second;
}

function shortOf(side, index) {
  const row = side.rows[index];
  return row && row.short !== null ? row.short : null;
}

function pageParts(page, teams) {
  const parts = [
    textAt(0, lines.sub, cut(labelsOf(page).sub, 20), 'sub'),
    textAt(COLUMNS.first, lines.sub, nameOf(teams[0]), 'head-first', 'end'),
    textAt(COLUMNS.second, lines.sub, nameOf(teams[1]), 'head-second', 'end'),
  ];

  labelsOf(page).rows.forEach((row, index) => {
    const y = lines.first + index * lines.step;
    parts.push(textAt(0, y, cut(row.tag, 22), 'label'));
    parts.push(valueParts(COLUMNS.first, y, shortOf(page.first, index), 'first', 'end'));
    parts.push(valueParts(COLUMNS.second, y, shortOf(page.second, index), 'second', 'end'));
  });
  return parts;
}

function describe(page, teams) {
  const words = labelsOf(page).rows.map((row, index) => {
    const ours = shortOf(page.first, index);
    const theirs = shortOf(page.second, index);
    return row.tag + ': ' + nameOf(teams[0]) + ' ' + (ours === null ? 'not yet' : ours) + ', ' + nameOf(teams[1]) + ' ' + (theirs === null ? 'not yet' : theirs);
  });
  return 'Both teams, ' + labelsOf(page).sub + ': ' + words.join('; ');
}

export function scrollPages(content) {
  return Math.max(1, pagesFor(cardState(content, new Date())).pages.length);
}

// The page as markup, for the time given. now is a Date.
export function markupFor(content, now) {
  const state = cardState(content, now);
  const built = pagesFor(state);
  const tag = tagFor(state.frc, currentMatch13(), now);

  if (built.pages.length === 0) return pageMarkup('competition-compare', 'COMPARE', tag, emptyMarkup(NOT_ENOUGH));
  const charts = built.pages.map(page => ({ description: describe(page, built.teams), parts: pageParts(page, built.teams) }));
  return pageMarkup('competition-compare', 'COMPARE', tag, pagedChartsMarkup(charts), built.pages.length);
}

// Each team's numbers are drawn in the accent color of its Team document. The page keeps the two colors as properties.
export function mount(host, content) {
  host.innerHTML = markupFor(content, new Date());

  const section = host.querySelector('.competition-compare');
  const built = pagesFor(cardState(content, new Date()));
  if (!section || built.teams.length < 2) return;

  const known = activeTeams();
  ['first', 'second'].forEach((name, index) => {
    const team = known.find(item => item.code === built.teams[index].team);
    if (team) section.style.setProperty('--compare-' + name, teamProperties(team)['--team-accent']);
  });
}
