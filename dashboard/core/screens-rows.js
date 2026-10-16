// Tidying the rows and the Screens that are stored, and the weekday schedule (part of screens.js).

import { defaultPhotoRow, defaultScreen, defaultSchedule, defaultSettings, limits, mondayKinds, mondayOldPanels, screenIds, styles, teamPanels, weekdays } from '../config.js';
import { panels } from '../registry.js';
import { keepInRange } from './content.js';
import { seedMainRows, seedSideRows } from './screen-seed.js';
import { dateIn, zoneNamed } from './theme.js';
import { isRecord } from './text.js';

export const handledKey = 'teletraan-next-look-handled';

const teamCode = /^[a-z0-9]+$/;

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
// of a panel that is not a large panel is dropped. Only a panel that follows the team has a team, so one
// stored on any other row is not read. A Monday row is for a team, as the kind of its panel says (mondayKinds in
// config.js): the tasks panel for a team and a department (a Team lead, stored as department), done, timeline and board for a
// team, and status by department and overall progress for neither. A Monday row that needs a team and has none is
// dropped, except a tasks row of the Robotics view (bothTeams), which is for the departments of both teams. A row that names one of the older Monday panels is the tasks panel of its team, for the first department that has
// tasks, and a row for both teams that is dropped.
export function tidyMainRow(raw, bothTeams = false) {
  if (!isRecord(raw) || typeof raw.panel !== 'string') return null;

  const panel = panelOf(raw.panel.trim());
  if (!panel || panel.region !== 'grid1' || panel.testOnly) return null;

  let team = tidyTeam(raw.team);
  let id = panel.id;
  let older = false;
  if (panel.monday) {
    if (mondayOldPanels.includes(id)) {
      older = true;
      id = 'monday-tasks';
    }
    const kind = mondayKinds[id];
    if (!kind) return null;
    if (kind === 'none') team = '';
    // a tasks row with no team is a department of both teams, which only the Robotics view plays (bothTeams)
    else if (team === 'both' || (team === '' && !(bothTeams && kind === 'department'))) return null;
  } else if (!teamPanels.includes(panel.id) || team === 'both') {
    team = '';
  }

  const row = { panel: id, team: team };
  if (panel.monday && mondayKinds[id] === 'department') row.department = typeof raw.department === 'string' && !older ? raw.department.trim() : '';
  const seconds = tidySeconds(raw.seconds);
  if (seconds) row.seconds = seconds;
  if (older) Object.defineProperty(row, 'older', { value: true, enumerable: false });
  if (panel.id === 'photo') Object.assign(row, photoRowOf(raw));
  return row;
}

// The rows of the large panel. A row that was one of the older Monday panels and is now the same as an earlier row is left out,
// so a Screen that had the three older cards for a team plays one tasks panel and not three.
function tidyMainRows(list) {
  const rows = [];
  const same = (a, b) => a.panel === b.panel && a.team === b.team && a.department === b.department;

  tidyRows(list, raw => tidyMainRow(raw)).forEach(row => {
    if (!(row.older === true && rows.some(earlier => same(earlier, row)))) rows.push(row);
  });
  return rows;
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
