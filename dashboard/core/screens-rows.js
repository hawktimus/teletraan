// Tidying the rows and the Screens that are stored, and the weekday schedule (part of screens.js).

import { defaultPhotoRow, defaultScreen, defaultSchedule, defaultSettings, limits, mondayCharts, mondayDepartments, mondayKinds, screenIds, styles, teamPanels, weekdays } from '../config.js';
import { panels } from '../registry.js';
import { keepInRange } from './content.js';
import { seedMainRows, seedSideRows } from './screen-seed.js';
import { dateIn, zoneNamed } from './theme.js';
import { isRecord } from './text.js';

export const handledKey = 'teletraan-next-look-handled';

const teamCode = /^[a-z0-9]+$/;

// The large panels that can name a department, the ones that can be one half of a list (a first and a second part), and the
// small panels a row can pair with (core/rotation.js, the side of a row)
const departmentPanels = ['roster'];
const halfPanels = ['events', 'roster', 'team-leads'];
const sideIds = panels.filter(item => item.region === 'grid2' && !item.testOnly && !item.lastResort).map(item => item.id);

function panelOf(id) {
  return panels.find(item => item.id === id);
}

export function isMondayPanel(id) {
  const panel = panelOf(id);
  return Boolean(panel && panel.monday);
}

// True for the code of a team. An empty team and both are not: a row with either keeps the team on the screen.
export function isTeamCode(team) {
  return typeof team === 'string' && team !== '' && team !== 'both';
}


// The documents

function tidySeconds(value) {
  if (typeof value !== 'number' || !isFinite(value) || value <= 0) return undefined;

  return keepInRange(value, limits.rowSeconds, limits.rowSeconds.min);
}

// The team of a row as it is stored: a code in lowercase, both, or empty
function tidyTeam(value) {
  const code = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return code === 'both' || teamCode.test(code) ? code : '';
}

// A row of the large panel becomes { panel, team, seconds }. The seconds are left out when there are none. A row
// of a panel that is not a large panel is dropped, and so is a row of one of the older Monday panels, which are not in the
// registry any more. Only a panel that follows the team has a team, so one stored on any other row is not read. A row of
// the two Monday panels (mondayKinds in config.js) also has the team of its tasks (tasksTeam: prime, nova, or empty for
// both), and the department and the list (Department tasks) or the chart (the TV charts). A row of the rotation gives the
// team of its tasks as tasksTeam (core/rotation.js, mainRowOf), and a row of a Screen or a view gives it as its team.
// rotating is true for a row of the rotation list.
export function tidyMainRow(raw, bothTeams = false, rotating = false) {
  if (!isRecord(raw) || typeof raw.panel !== 'string') return null;

  const panel = panelOf(raw.panel.trim());
  if (!panel || panel.region !== 'grid1' || panel.testOnly) return null;

  let team = tidyTeam(raw.team);
  const named = rotating && typeof raw.department === 'string' && raw.department.trim() !== '';
  if (panel.monday) {
    if (!mondayKinds[panel.id]) return null;
    if (team === 'both') team = '';
  } else if (!teamPanels.includes(panel.id) || team === 'both') {
    team = '';
  }

  const row = { panel: panel.id, team: team };
  if (panel.monday) Object.assign(row, mondaySettingsOf(raw, rotating ? raw.tasksTeam : raw.team, panel.id));
  else if (named && departmentPanels.includes(panel.id)) row.department = raw.department.trim();
  if (rotating && halfPanels.includes(panel.id) && (raw.part === 1 || raw.part === 2)) row.part = raw.part;
  if (rotating && typeof raw.side === 'string' && sideIds.includes(raw.side.trim())) row.side = raw.side.trim();
  const seconds = tidySeconds(raw.seconds);
  if (seconds) row.seconds = seconds;
  if (panel.id === 'photo') Object.assign(row, photoRowOf(raw));
  return row;
}

// The settings of a row of a Monday panel: the team of its tasks, and the department and list or the chart
function mondaySettingsOf(raw, tasksTeam, id) {
  const settings = { tasksTeam: tasksTeam === 'prime' || tasksTeam === 'nova' ? tasksTeam : '' };
  if (id === 'monday-department') {
    const department = typeof raw.department === 'string' ? raw.department.trim().toLowerCase() : '';
    settings.department = mondayDepartments.some(entry => entry.value === department) ? department : '';
    settings.list = raw.list === 'done' ? 'done' : 'open';
  } else {
    settings.chart = mondayCharts.some(entry => entry.value === raw.chart) ? raw.chart : 'status';
  }
  return settings;
}

// The rows of the large panel
function tidyMainRows(list) {
  return tidyRows(list, raw => tidyMainRow(raw));
}

// A Photos row shows photoCount photos, each for secondsPerPhoto seconds, and stays up for the product. That
// product is its seconds, in place of the seconds a row has of its own. A row saved before these fields existed
// gets four photos of ten seconds. A number out of range is brought into range.
function photoRowOf(raw) {
  const photoCount = Math.round(keepInRange(raw.photoCount, limits.photoCount, defaultPhotoRow.photoCount));
  const secondsPerPhoto = Math.round(keepInRange(raw.secondsPerPhoto, limits.secondsPerPhoto, defaultPhotoRow.secondsPerPhoto));
  return { photoCount: photoCount, secondsPerPhoto: secondsPerPhoto, seconds: photoCount * secondsPerPhoto };
}

// A row of the small panel becomes { panel, seconds }. It never has a team: the small panels take the colors of
// the team on the banner at that moment.
export function tidySideRow(raw) {
  if (!isRecord(raw) || typeof raw.panel !== 'string') return null;

  const panel = panelOf(raw.panel.trim());
  if (!panel || panel.region !== 'grid2' || panel.testOnly || panel.lastResort) return null;

  const row = { panel: panel.id };
  const seconds = tidySeconds(raw.seconds);
  if (seconds) row.seconds = seconds;
  return row;
}

function tidyRows(list, tidyRow) {
  return (Array.isArray(list) ? list : []).map(tidyRow).filter(row => row !== null);
}

function validMondayStyle(style) {
  return styles.includes(style) ? style : defaultSettings.mondayStyle;
}

// One Screen document, always complete: { style, mainRows, sideRows, nameEffectEveryMinutes, hawkEveryMinutes,
// swapSeconds, mondayStyle }. style is the style the document stands for. A Monday style that is missing is the
// one of Dashboard Settings, fallbackMondayStyle, which is how a screen that had set it there keeps it.
export function tidyScreen(raw, style, fallbackMondayStyle) {
  const source = isRecord(raw) ? raw : {};

  return {
    style: style,
    mainRows: tidyMainRows(source.mainRows),
    sideRows: tidyRows(source.sideRows, tidySideRow),
    nameEffectEveryMinutes: keepInRange(source.nameEffectEveryMinutes, limits.nameEffectEveryMinutes, defaultScreen.nameEffectEveryMinutes),
    hawkEveryMinutes: keepInRange(source.hawkEveryMinutes, limits.hawkEveryMinutes, defaultScreen.hawkEveryMinutes),
    swapSeconds: keepInRange(source.swapSeconds, limits.swapSeconds, defaultScreen.swapSeconds),
    mondayStyle: styles.includes(source.mondayStyle) ? source.mondayStyle : validMondayStyle(fallbackMondayStyle),
  };
}

function styleOfId(id) {
  return Object.keys(screenIds).find(style => screenIds[style] === id) || '';
}

// The Screens that the Studio has, from the documents as the query sends them. A document whose id is not one of the
// three is left out, and so is a second one with the same id.
export function tidyScreens(list, fallbackMondayStyle) {
  const found = [];

  (Array.isArray(list) ? list : []).forEach(raw => {
    const style = isRecord(raw) ? styleOfId(raw._id) : '';
    if (style !== '' && !found.some(screen => screen.style === style)) found.push(tidyScreen(raw, style, fallbackMondayStyle));
  });
  return found;
}


// The day

// The number of the weekday in a time zone, 0 for Sunday. A zone that Intl does not know is the Look page's default.
export function weekdayIn(timeZone, now) {
  const zone = zoneNamed(timeZone);
  const parts = dateIn(zone, now).split('-').map(Number);

  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])).getUTCDay();
}

// The Screen schedule of Dashboard Settings, always complete: a style for each weekday. A day that is missing, or has
// a name that is not a style, has the starting Screen of that day.
export function tidySchedule(raw) {
  const source = isRecord(raw) ? raw : {};
  const schedule = {};

  weekdays.forEach(day => {
    schedule[day] = styles.includes(source[day]) ? source[day] : defaultSchedule[day];
  });
  return schedule;
}

// The style of the Screen that plays on the day it is in a time zone. weekdays starts on Monday and weekdayIn on Sunday
export function screenStyleFor(schedule, timeZone, now) {
  return tidySchedule(schedule)[weekdays[(weekdayIn(timeZone, now) + 6) % 7]];
}


// Building a Screen from the Panel order (the rule that makes the rows is in core/screen-seed.js)
