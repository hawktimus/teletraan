// The teams the screen can show, and the one that is on it. Three jobs:
//
//   choosing    chooseTeam() says which team the mode and the clock ask for. A preview (core/preview.js)
//               or ?team= in the address can hold a mode in place of the setting (previewTeam, askForTeam),
//               and the look rotation (core/look-rotation.js) can hold a team in place of the mode (rotateTeam)
//   filtering   showsForTeam() says whether an item belongs on the screen of that team.
//               visibleItems() in content.js asks it, so a panel that leaves out hidden and
//               expired items leaves out the other team's items too. No panel asks it itself
//   putting on  applyTeamLook() sets the seven colors, the initials and the mirror class on the html element
//
// A different team never goes on the page where people can watch it happen. useTeams() sees the
// change, and the items follow at once, so every page built from then on is the new team's. The
// banner name, the number, the logo, the colors and the mirror change together, in one call,
// at the moment the large frame is apart (core/areas.js calls changeTeamNow() there, beside the
// new theme). A change that has waited a minute goes on anyway, so a screen that has stopped
// changing pages still gets there. An edit to the team that is already on the screen, such as a
// new color, goes on at once.
//
// core/team-run.js asks useTeams() once a second and moves the pages on when the team changes.
// The one place that touches the page is applyTeamLook(), and it is given the page.

import { defaultSettings, primeTeam, teamModes } from '../config.js';

// The class on the html element while the team on the screen has Mirror the layout on. It does
// nothing by itself: the stylesheets that flip the layout read it.
export const mirrorClass = 'mirrored';

// The seven colors of a team and the custom property each one sets. teams.css starts them at the
// Prime values and has the rules that the default theme follows them with.
export const colorProperties = {
  primary: '--team-primary',
  plate: '--team-plate',
  accent: '--team-accent',
  neon: '--team-neon',
  pink: '--team-pink',
  background: '--team-background',
  text: '--team-text',
};

// The custom property that holds the letters at the front of the stamped id on each panel (HP in
// HP-01). base.css writes it, in the Original style. The value is a quoted string, as content needs.
export const initialsProperty = '--team-initials';

const waitedTooLong = 60 * 1000;

let teams = [primeTeam]; // every team there is, in order
let previewed = null; // { mode, until }: a preview (core/preview.js) holds a mode on the screen for a while
let asked = ''; // ?team= in the address, for this page only
let rotated = ''; // the code of the team the look rotation holds (core/look-rotation.js), or '' for none
let wanted = primeTeam; // the team the mode and the clock ask for. The items follow this one
let showing = null; // the team that is on the page, or null before the first one goes on
let waitingSince = null; // the time, in milliseconds, that wanted first differed from showing
const listeners = [];

// The teams that are switched on, in order. They are the choices of Alternate mode.
export function activeTeams(list = teams) {
  return (Array.isArray(list) ? list : []).filter(team => team.active !== false);
}

// Holds a mode on the screen until a time in milliseconds, whatever Team mode says and
// without writing it. A new call replaces the one before, and a name that is not a mode
// ends it.
export function previewTeam(mode, until) {
  previewed = teamModes.indexOf(mode) !== -1 && typeof until === 'number' && isFinite(until) ? { mode: mode, until: until } : null;
}

// ?team= in the address, like ?style=. A name that is not a mode is ignored.
export function askForTeam(mode) {
  asked = teamModes.indexOf(mode) !== -1 ? mode : '';
}

// The look rotation holds a team for the pass it is in, the way a preview holds a mode, but weaker: a
// preview and ?team= win over it, and it wins over Team mode. A code that is not an active team lets go.
export function rotateTeam(code) {
  rotated = typeof code === 'string' ? code : '';
}

function previewing(now) {
  return previewed !== null && now.getTime() < previewed.until;
}

// The mode that counts: a preview that has time left, then the address, then Team mode
function modeFor(settings, now) {
  if (previewing(now)) return previewed.mode;
  return asked || settings.teamMode;
}

// The team the look rotation holds, or null when it holds none, a preview or the address asks for another, or
// its team is not in the list or is switched off
function rotatedTeam(list, now) {
  if (rotated === '' || previewing(now) || asked !== '') return null;

  return activeTeams(list).find(team => team.code === rotated) || null;
}

// The team a mode asks for at a moment. prime and nova ask for the team with that code, and
// fall back to Prime when there is none, so a missing team leaves the screen as it was.
// alternate takes the active teams in turn, each for a whole number of minutes counted from
// the clock and not from when the screen started, so two screens agree. With fewer than
// two teams to alternate between it is that team.
export function chooseTeam(list, mode, minutes, now = new Date()) {
  const all = Array.isArray(list) && list.length > 0 ? list : [primeTeam];
  const named = code => all.find(team => team.code === code);

  if (mode === 'alternate') {
    const active = activeTeams(all);
    if (active.length > 1) {
      const length = typeof minutes === 'number' && isFinite(minutes) && minutes > 0 ? minutes : defaultSettings.alternateMinutes;
      return active[Math.floor(now.getTime() / (length * 60 * 1000)) % active.length];
    }
    return active[0] || named('prime') || primeTeam;
  }

  return named(mode === 'nova' ? 'nova' : 'prime') || named('prime') || primeTeam;
}

// True when the item is for the team with this code, or for both teams: its team is empty.
// Without a code it is the team the screen is changing to, or already showing.
export function showsForTeam(item, code = wanted.code) {
  const team = item && typeof item.team === 'string' ? item.team : '';
  return team === '' || team === code;
}

// The first letter of each word in the team's name, in capitals: Hawktimus Prime is HP and Hawktimus Nova
// is HN. A name of one word gives its first two letters, and at most three letters are used.
export function teamInitials(team) {
  const words = (team && typeof team.name === 'string' ? team.name : '').match(/\p{L}+/gu) || [];
  const letters = words.length === 1 ? words[0].slice(0, 2) : words.map(word => word[0]).join('');

  return letters.slice(0, 3).toUpperCase();
}

// The custom properties a team sets, by name
export function teamProperties(team) {
  const properties = {};
  Object.keys(colorProperties).forEach(name => {
    properties[colorProperties[name]] = team.colors[name];
  });
  return properties;
}

// Puts a team's colors, initials and mirror on the page. page is the html element, and only the
// tests give another.
export function applyTeamLook(team, page = typeof document === 'undefined' ? null : document.documentElement) {
  if (!page) return;

  const properties = teamProperties(team);
  Object.keys(properties).forEach(name => page.style.setProperty(name, properties[name]));
  page.style.setProperty(initialsProperty, '"' + teamInitials(team) + '"');

  if (team.mirror === true) page.classList.add(mirrorClass);
  else page.classList.remove(mirrorClass);
}

// The one place a team goes on. The colors, the initials and the mirror are applied here, and the banner and the
// sidebar draw the team's name, number and logo from teamShown() when they are told to update
// (onTeamChange). A style or layout that needs something more to change with the team adds its
// line here.
function swapTo(team) {
  applyTeamLook(team);
  showing = team;
  waitingSince = null;
}

function tell() {
  listeners.forEach(listener => {
    try {
      listener();
    } catch (error) {
      console.error('Something that follows the team could not change with it', error);
    }
  });
}

// Called after the team on the page changes, and when the team that is wanted changes. shell.js
// asks for the banner and the events to be drawn again.
export function onTeamChange(listener) {
  listeners.push(listener);
}

// The team on the page now. Before the first one goes on it is the one that is wanted.
export function currentTeam() {
  return showing || wanted;
}

// The team the mode and the clock ask for. It is the one on the page now unless a change is waiting.
export function wantedTeam() {
  return wanted;
}

// True while the wanted team is not yet the one on the page
export function teamPending() {
  return showing !== null && wanted.code !== showing.code;
}

// The team the banner and the sidebar draw. The team the screen starts with, when the Studio has
// no Teams, takes its name and number from the Team box in Dashboard Settings (content.team), as the
// banner always has.
export function teamShown(content) {
  const team = currentTeam();
  if (!team.builtIn) return team;

  const details = content && content.team ? content.team : {};
  return Object.assign({}, team, {
    name: typeof details.name === 'string' ? details.name : team.name,
    number: typeof details.number === 'string' ? details.number : team.number,
  });
}

// Reads the team list and the Teams settings from the content and works out the wanted team.
// The first call puts the team on the page at once, because there is nothing yet to change. After
// that a different team waits for changeTeamNow(), or goes on after waitedTooLong. The same
// team with new details goes on at once. now is a Date, and only the tests give another.
export function useTeams(content, now = new Date()) {
  const source = content || {};
  const settings = source.settings || {};
  const before = wanted.code;

  teams = Array.isArray(source.teams) && source.teams.length > 0 ? source.teams : [primeTeam];
  wanted = rotatedTeam(teams, now) || chooseTeam(teams, modeFor(settings, now), settings.alternateMinutes, now);
  let changed = wanted.code !== before;

  if (showing === null) {
    swapTo(wanted);
    changed = true;
  } else if (showing.code === wanted.code) {
    waitingSince = null;
    if (JSON.stringify(showing) !== JSON.stringify(wanted)) {
      swapTo(wanted);
      changed = true;
    }
  } else {
    if (waitingSince === null) waitingSince = now.getTime();
    if (now.getTime() - waitingSince >= waitedTooLong) {
      swapTo(wanted);
      changed = true;
    }
  }

  if (changed) tell();
}

// Called by areas.js while the large panel's frame is apart. If a different team is waiting,
// this is when it goes on. It never throws, because the page change that calls it must go on.
export function changeTeamNow() {
  if (!teamPending()) return;

  try {
    swapTo(wanted);
  } catch (error) {
    console.error('Could not change the team', error);
    return;
  }
  tell();
}
