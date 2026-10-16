// Teams, settings, the rotation, announcements and custom panels (part of sanity.js).

import { defaultSettings, primeTeam, teamMetals, teamPalettes, teamTrim } from '../config.js';
import { fixSettingValues } from './content.js';
import { logoUrl } from './images.js';
import { isRecord, trimText } from './text.js';
import { cleanObject, itemsFrom, objectsIn, sortByOrder, withTeamCode } from './sanity-tasks.js';

const hexColor = /^#[0-9A-Fa-f]{6}$/;
const teamCode = /^[a-z0-9]+$/;

// A team document from Studio becomes { code, name, shortName, number, logo, colors, metal, glow, mirror, the
// eight trim fields, active, order }. The name look (nameStyle) is not read from the document: the switch Outlined name
// (outlinedName) says it, outline when it is on and solid otherwise. The bird pose (logoPose) is not read either: the
// icon is always the usual mark, so a team that stores flight reads as auto. The code is lowercase letters and digits, and it is what the items point to,
// so a team without a usable one is dropped. The names are capitals, the way the team name
// has always been written in the banner, and a missing one is the other, or the code. The
// logo is the address of the picture at the width the screen needs (core/images.js), and
// empty when there is none or it cannot be used, which means the shared hawk. A sample file
// may give the logo as an address. A color that is not # and six hex digits is the Prime one, so a team made
// before Body and Label existed has Prime's. The metal is gold unless it says steel, and the glow is off unless
// it is on, so a team made before they existed is Prime's. The mirror is off unless it is on, and the team is active unless it is switched off. A trim field
// that is missing or not one of its values is the Prime one (teamTrim in config.js).
function normalizeTeamDocument(raw) {
  const code = trimText(raw.code).toLowerCase();
  if (!teamCode.test(code)) return null;

  const shortName = trimText(raw.shortName).toUpperCase();
  const name = trimText(raw.name).toUpperCase();
  const colors = {};
  Object.keys(primeTeam.colors).forEach(color => {
    const value = isRecord(raw.colors) ? trimText(raw.colors[color]) : '';
    colors[color] = hexColor.test(value) ? value : primeTeam.colors[color];
  });

  return {
    code: code,
    name: name || shortName || code.toUpperCase(),
    shortName: shortName || name || code.toUpperCase(),
    number: typeof raw.number === 'number' ? String(raw.number) : trimText(raw.number),
    logo: typeof raw.logo === 'string' ? raw.logo.trim() : logoUrl(raw.logo),
    colors: colors,
    metal: Object.prototype.hasOwnProperty.call(teamMetals, trimText(raw.metal)) ? trimText(raw.metal) : primeTeam.metal,
    palette: Object.prototype.hasOwnProperty.call(teamPalettes, trimText(raw.palette)) ? trimText(raw.palette) : primeTeam.palette,
    glow: raw.glow === true,
    mirror: raw.mirror === true,
    bolts: trimValue(raw, 'bolts'),
    cornerCut: trimValue(raw, 'cornerCut'),
    headerNotch: trimValue(raw, 'headerNotch'),
    grid: trimValue(raw, 'grid'),
    logoPose: primeTeam.logoPose,
    nameStyle: raw.outlinedName === true ? 'outline' : 'solid',
    tickerLabel: trimValue(raw, 'tickerLabel'),
    countAccent: trimValue(raw, 'countAccent'),
    active: raw.active !== false,
    order: typeof raw.order === 'number' && isFinite(raw.order) ? raw.order : primeTeam.order,
  };
}

function trimValue(raw, name) {
  const value = trimText(raw[name]);
  return Object.prototype.hasOwnProperty.call(teamTrim[name], value) ? value : primeTeam[name];
}

// The first team of a code is the one that counts. The list is in order.
export function teamsFrom(list) {
  const seen = [];

  return itemsFrom(list).map(normalizeTeamDocument).filter(team => {
    if (team === null || seen.indexOf(team.code) !== -1) return false;

    seen.push(team.code);
    return true;
  });
}

export function normalizeTeam(team) {
  const result = {};
  Object.keys(team || {}).forEach(key => {
    result[key] = String(team[key]);
  });
  return result;
}

export function normalizeSettings(raw) {
  const settings = cleanObject(isRecord(raw) ? raw : {});

  if (isRecord(settings.rotation)) settings.rotation = normalizeRotation(settings.rotation);
  else delete settings.rotation;

  // The choices, switches and numbers in a range are checked in content.js.
  // That includes the screen glitch, where an old everyMinutes becomes seconds.
  fixSettingValues(settings);

  // The Studio keeps these four, hidden, but the screen uses the fixed values in constants.js
  ['nightStart', 'nightEnd', 'noShowMinutes', 'graceMinutes'].forEach(name => delete settings[name]);

  // The Teletraan computer reads the two Monday blocks (computer/scripts/monday-sync.sh). The screen has no use for them
  ['mondayTaskBoard', 'mondayMilestoneBoard'].forEach(name => delete settings[name]);

  tidyList(settings, 'announcements', normalizeAnnouncements);
  tidyList(settings, 'calendars', calendars => calendars.filter(calendar => calendar.id));
  return settings;
}

// Something that is not a list is dropped, so that the default list is used.
// An empty list stays empty: the editors emptied it on purpose.
function tidyList(settings, name, tidy) {
  if (Array.isArray(settings[name])) settings[name] = tidy(settings[name]);
  else delete settings[name];
}

// Zero, a negative number or anything that is not a number would make the
// schedule spin without waiting, so it is not used
function isPositive(number) {
  return typeof number === 'number' && isFinite(number) && number > 0;
}

// The schedule needs a panel from every step. Seconds are optional: a row
// with none, or with a number that cannot be used, has no seconds at all and
// follows pageSeconds. The same goes for tickerSeconds.
function normalizeSteps(steps) {
  return steps
    .filter(step => step.panel)
    .map(step => {
      const row = { panel: step.panel, show: step.show !== false };
      if (isPositive(step.seconds)) row.seconds = step.seconds;
      return row;
    });
}

// order is the one list of panels (core/panel-order.js). Something that is not
// a list is dropped, so the two older lists decide, as they do for an empty one.
function normalizeRotation(rotation) {
  const result = Object.assign({}, rotation);

  ['grid1', 'grid2'].forEach(area => {
    result[area] = normalizeSteps(Array.isArray(result[area]) ? result[area] : defaultSettings.rotation[area]);
  });

  if (Array.isArray(result.order)) result.order = normalizeSteps(result.order);
  else delete result.order;

  if (!isPositive(result.tickerSeconds)) delete result.tickerSeconds;
  return result;
}

// The takeover code reads time and days on every second, so an announcement
// that cannot be read, or is switched off, is left out here, not there
function normalizeAnnouncements(list) {
  const fallback = defaultSettings.announcements[0];

  return list
    .filter(item => item.show !== false && /^\d{1,2}:\d\d$/.test(item.time || ''))
    .map(item => ({
      time: item.time,
      title: item.title || '',
      followUp: item.followUp || '',
      titleSeconds: isPositive(item.titleSeconds) ? item.titleSeconds : fallback.titleSeconds,
      followUpSeconds: isPositive(item.followUpSeconds) ? item.followUpSeconds : fallback.followUpSeconds,
      days: (Array.isArray(item.days) ? item.days : []).filter(day => Number.isInteger(day) && day >= 0 && day <= 6),
    }));
}

export function customPanelsFrom(list) {
  const panels = objectsIn(list).map(panel => {
    const result = withTeamCode(cleanObject(panel));
    result.blocks = objectsIn(panel.blocks).filter(block => block._type).map(normalizeBlock);
    return result;
  });
  return sortByOrder(panels);
}

// The _type has to be read before cleanObject drops it.
// headingBlock becomes { type: 'heading' }, listBlock becomes { type: 'list' }.
function normalizeBlock(block) {
  const result = cleanObject(Object.assign({ type: String(block._type).replace(/Block$/, '') }, block));
  if (result.type === 'list' && !result.items) result.items = [];
  return result;
}
