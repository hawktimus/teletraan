// What the wall would do with each row of the rotation list, for the Display tab. It does not guess: it builds the content
// the way the wall does (the same query, the same cleaning), puts the calendar files of this computer in, and asks the same
// functions the wall asks (viewSteps for the steps of a row, and the hasContent of each panel). When the wall changes a rule,
// this follows, because the rule is not copied here. Only the wording of the reasons is written here.
//
// The data comes from two places. Monday tasks, FRC news and the TBA data (frc-status) are Sanity documents the Teletraan
// computer writes, so they are read from Sanity like the wall reads them. The calendar files and match13.json are files of
// this computer. Match13 never goes to Sanity: this file reads it and the answer goes only to the page behind the PIN.

import fs from 'node:fs';
import path from 'node:path';
import { contentQuery, normalizeContent } from '../../dashboard/core/sanity.js';
import { expandEvents, parseIcs } from '../../dashboard/core/calendar.js';
import { eventDate, mergeEvents } from '../../dashboard/core/events.js';
import { shownPages } from '../../dashboard/core/event-pages.js';
import { viewSteps } from '../../dashboard/core/views.js';
import { mainRowOf, tidyRotationRow, viewKeyOfRotation } from '../../dashboard/core/rotation.js';
import { isMondayPanel, tidyMainRow } from '../../dashboard/core/screens-rows.js';
import { asTeam } from '../../dashboard/core/teams.js';
import { newsIsStale, newsItems } from '../../dashboard/core/news.js';
import { photosToShow } from '../../dashboard/core/photos.js';
import { recordText, teamEntry } from '../../dashboard/core/frc.js';
import { chartsView, departmentTitle, departmentView } from '../../dashboard/core/monday-views.js';
import { retiredWords } from '../../dashboard/config-lists.js';
import { match13Stale, matchForecastFor, tidyMatch13 } from '../../dashboard/core/match13.js';
import { timeZoneOf } from '../../dashboard/core/theme.js';
import { panels } from '../../dashboard/registry.js';

const cacheSeconds = 60;
const daysAhead = 60;
const dayMs = 86400000;
const mostItems = 5;
const longestItem = 80;

// ----- the content -----

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (error) {
    return '';
  }
}

// The events of the calendar files in the data folder, with the Calendar filters applied, as the wall merges them
function calendarEvents(dataDir, content, now) {
  const found = [];
  const from = new Date(now.getTime() - dayMs);
  const to = new Date(now.getTime() + daysAhead * dayMs);

  (content.settings.calendars || []).filter(calendar => calendar && /^[a-z0-9_]+$/.test(calendar.id || '') && calendar.show !== false).forEach(calendar => {
    const text = readText(path.join(dataDir, 'calendars', calendar.id + '.ics'));
    if (!/BEGIN:V(CALENDAR|EVENT)/i.test(text)) return;
    try {
      expandEvents(parseIcs(text), from, to).forEach(event => {
        event.calendar = String(calendar.name || '');
        event.calendarId = calendar.id;
        found.push(event);
      });
    } catch (error) {
      // one bad calendar file never stops the others, as on the wall
    }
  });
  return mergeEvents(found, content.theme && content.theme.timeZone, now, content.calendarFilters);
}

// match13.json as the cards clean it, or null when there is none. It stays on this computer.
export function readMatch13(dataDir) {
  const text = readText(path.join(dataDir, 'match13.json'));
  if (text === '') return null;
  try {
    return tidyMatch13(JSON.parse(text));
  } catch (error) {
    return null;
  }
}

// Builds the content once a minute at most. A failure is kept for the same time, so a down network is not asked every press.
export async function loadWorld(ctx, sanity, now = new Date(), fresh = false) {
  const kept = ctx.state.displayWorld;
  if (!fresh && kept && now.getTime() - kept.at < cacheSeconds * 1000) return kept.world;

  let world;
  try {
    const content = normalizeContent(await sanity.queryLong(contentQuery), now);
    content.events = calendarEvents(ctx.dataDir, content, now);
    world = { content: content, now: now, match13: readMatch13(ctx.dataDir), problem: '' };
  } catch (error) {
    world = { content: null, now: now, match13: null, problem: 'The Teletraan computer could not read the content from Sanity, so it cannot say what each row would do.' };
  }
  ctx.state.displayWorld = { at: now.getTime(), world: world };
  return world;
}

// ----- the panels -----

const modules = {};

async function moduleOf(id) {
  if (!(id in modules)) {
    const panel = panels.find(item => item.id === id);
    try {
      modules[id] = panel ? await import(new URL('../../dashboard/' + panel.script, import.meta.url).href) : null;
    } catch (error) {
      modules[id] = null;
    }
  }
  return modules[id];
}

// The wall's own question (canShow in core/panels.js): a panel with no hasContent always has something to draw
async function hasContent(step, content) {
  const loaded = await moduleOf(step.panel);
  if (!loaded) return false;
  if (typeof loaded.hasContent !== 'function') return true;
  try {
    return asTeam(step.team, () => loaded.hasContent(content, step.page));
  } catch (error) {
    return false;
  }
}

// ----- the words -----

function cut(text) {
  const line = String(text || '').replace(/\s+/g, ' ').trim();
  return line.length > longestItem ? line.slice(0, longestItem - 3) + '...' : line;
}

const emptyReasons = {
  photo: 'no photo is visible. Every photo is hidden or past its expiry.',
  events: 'no event is coming up in the calendar files, or the Calendar filters hide them all.',
  'frc-news': 'there is no FRC news post to show. News is off, or no post is newer than 60 days.',
  tonight: 'the Daily Agenda has no plan for today.',
  tasks: 'no task is on the TV for this team.',
  spotlight: 'there is no subteam to show.',
  'sponsor-feature': 'there is no sponsor to feature.',
  leadership: 'there are no Leadership entries to show.',
  'team-leads': 'there are no Team leads to show.',
  roster: 'there is nobody on the roster for this department.',
  custom: 'there is no Extra panel to show.',
  driveHours: 'there are no drive hours to show.',
};

function teamWords(team) {
  return team === '' || team === undefined ? 'both teams' : 'the ' + team.charAt(0).toUpperCase() + team.slice(1) + ' team';
}

// row is a tidy row of the rotation, whose team is the team of the tasks
function mondayReason(row) {
  const who = teamWords(row.team);
  if (row.panel === 'monday-charts') return 'no Monday task is on the TV for ' + who + ' to chart.';
  const department = departmentTitle(row.department);
  if (department === '') return 'pick a Department for this row.';
  return 'no ' + (row.list === 'done' ? 'done' : 'open') + ' ' + department + ' task is on the TV for ' + who + '.';
}

function emptyReason(row) {
  if (isMondayPanel(row.panel)) return mondayReason(row);
  return emptyReasons[row.panel] || 'this panel has nothing to show right now.';
}

// ----- the items a row would draw -----

function eventLines(content, step, now) {
  const zone = timeZoneOf(content);
  const part = step.page && (step.page.part === 1 || step.page.part === 2) ? step.page.part : 0;
  const pages = shownPages(content, now);
  const rows = (part === 0 ? pages : pages.slice(part - 1, part)).reduce((all, page) => all.concat(page), []);
  return rows.map(row => cut(eventDate(row.event, zone).text + '  ' + row.event.title));
}

function mondayLines(content, step, now) {
  if (step.panel === 'monday-charts') {
    const chart = chartsView(content, now, step.page);
    return chart && chart.chart === 'status' ? chart.rows.map(row => row.name + ': ' + row.done + ' done, ' + row.progress + ' in progress, ' + row.todo + ' to do') : [];
  }
  const view = departmentView(content, now, step.page);
  return view ? view.rows.map(row => row.project + ', ' + row.contact) : [];
}

// The TBA lines (the frc-status document) for a team, and the Match13 line of its next match when the file has one
function rankLines(content, step, match13) {
  const entry = asTeam(step.team, () => teamEntry(content.frc));
  if (!entry) return [];
  const lines = [];
  if (entry.ranking) {
    const event = (entry.events || []).find(item => item.key === entry.ranking.event);
    const of = entry.ranking.teamsRanked === null ? '' : ' of ' + entry.ranking.teamsRanked;
    const record = recordText(entry.ranking.record);
    lines.push('TBA: rank ' + entry.ranking.rank + of + (event ? ' at ' + (event.shortName || event.name) : '') + (record ? ', record ' + record : ''));
  }
  const next = entry.nextMatch;
  if (next && next.match) {
    const forecast = matchForecastFor(next.match, match13);
    lines.push('TBA: next match ' + (next.label || next.match) + (forecast && forecast.redWin !== null ? '. Match13: red wins ' + Math.round(forecast.redWin * 100) + ' percent.' : ''));
  }
  return lines;
}

function lineCount(count, noun) {
  return count + ' ' + noun + (count === 1 ? '' : 's');
}

async function itemsFor(step, content, now, match13) {
  let lines = [];
  if (step.panel === 'events') lines = eventLines(content, step, now);
  else if (step.panel === 'monday-department' || step.panel === 'monday-charts') lines = mondayLines(content, step, now);
  else if (step.panel === 'frc-news') lines = newsItems(content, now).map(item => item.title);
  else if (step.panel === 'competition-rank') lines = rankLines(content, step, match13);
  else if (step.panel === 'photo') {
    const count = photosToShow(content, now).length;
    lines = [lineCount(count, 'photo') + ' visible'];
  }
  return lines.map(cut).filter(line => line !== '').slice(0, mostItems);
}

// ----- the answer for a row -----

// { state, reason, items } for one row of the list. state is show, skip, off or unknown.
export async function checkRow(raw, world) {
  const row = tidyRotationRow(raw);
  if (!row) return { state: 'skip', reason: 'The wall cannot play this row. It needs a view and a panel it knows.', items: [] };
  if (!row.shown) return { state: 'off', reason: 'Shown is off, so the wall skips this row.', items: [] };
  if (row.retired) return { state: 'skip', reason: retiredWords, items: [] };
  if (!world.content) return { state: 'unknown', reason: world.problem, items: [] };

  const content = world.content;
  const main = tidyMainRow(mainRowOf(row, content), row.view === 'robotics', true);
  const steps = main ? viewSteps(content, viewKeyOfRotation(row.view), world.now, -1, [main]) : [];
  const named = Object.assign({}, row, { team: row.team || '' });

  if (steps.length === 0) {
    const why = isMondayPanel(row.panel) ? emptyReason(named) : 'the team of this row is not switched on.';
    return { state: 'skip', reason: 'Skipped now: ' + why, items: [] };
  }

  for (const step of steps) {
    if (!(await hasContent(step, content))) continue;
    const items = await itemsFor(step, content, world.now, world.match13);
    const stale = step.panel === 'frc-news' && newsIsStale(content, world.now) ? ' The list is old: the last read was more than 12 hours ago.' : '';
    return { state: 'show', reason: 'Will show now.' + stale, items: items };
  }
  return { state: 'skip', reason: 'Skipped now: ' + emptyReason(named), items: [] };
}

export async function checkRows(rows, world) {
  const answers = {};
  for (const row of Array.isArray(rows) ? rows : []) {
    if (row && typeof row === 'object' && typeof row._key === 'string') answers[row._key] = await checkRow(row, world);
  }
  return answers;
}

// ----- what the wall adds by itself -----

// The competition cards come and go on their own, so they are not rows. This is the data behind them, for the card at the
// foot of the tab: the TBA ranks and the Match13 matches. Match13 stays on this computer and reaches only this page.
export function extrasOf(world) {
  if (!world.content) return { tba: null, match13: null };

  const frc = world.content.frc;
  const tba = frc ? {
    lastSyncAt: frc.lastSyncAt,
    lastError: frc.lastError,
    teams: frc.teams.map(team => ({
      team: team.team,
      number: team.number,
      rank: team.ranking ? team.ranking.rank : null,
      of: team.ranking ? team.ranking.teamsRanked : null,
      nextMatch: team.nextMatch && team.nextMatch.match ? (team.nextMatch.label || team.nextMatch.match) : '',
    })),
  } : null;

  const data = world.match13;
  const match13 = data ? {
    generatedAt: data.generatedAt,
    stale: match13Stale(data, world.now),
    sample: data.sample === true,
    events: Object.keys(data.events).map(key => ({
      key: key,
      matches: data.events[key].matches.slice(0, 12).map(match => ({
        key: match.key,
        played: !match.unplayed,
        redWin: match.pred.winProb === null ? null : Math.round(match.pred.winProb * 100),
        redScore: match.pred.redScore,
        blueScore: match.pred.blueScore,
      })),
    })),
  } : null;
  return { tba: tba, match13: match13 };
}
