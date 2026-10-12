// The parts of the Screen form that need no Studio: the words, the question the form asks Sanity
// when a Screen is opened, the teams for the pickers, and the lines that show the countdown.
// screen-input.js and screen-fields.js draw them. check-schemas.mjs reads them with node.

import { clockText } from './time-text.js';

// What the form reads, from the published documents: the Dashboard Settings that hold the Panel
// order, the Monday style and the countdown, and the active teams in order. The published copy
// is the one the screen follows.
const sourcesQuestion = '{ "settings": *[_id == "dashboardSettings"][0]{ rotation, mondayStyle, countdown }, "teams": *[_type == "team" && active != false] | order(order asc, name asc) { _id, name, shortName, code } }';

// What the form shows for a team when no team document has been made yet: the two built-in
// codes, with no document to open
export const builtInTeams = [
  { code: 'prime', label: 'Prime', id: '' },
  { code: 'nova', label: 'Nova', id: '' },
];

// The Dashboard Settings page. The same type and id as settingsType and settingsId in
// structure.js, which imports this folder's files and cannot be imported here.
export const settingsTarget = { id: 'dashboardSettings', type: 'dashboardSettings' };

// The page the Countdown tab of Dashboard Settings opens at
export const countdownTarget = Object.assign({}, settingsTarget, { path: 'countdown' });

// The line of Tips and News in the sidebar (structure.js): the id of the line after /structure/
export const tipsAndNewsPath = '/structure/tipOrNews';

// The Team document of a team. Its type is team.
export function teamTarget(team) {
  return { id: team.id, type: 'team' };
}

export const words = {
  editing: 'Editing',
  mapLabel: 'The screen. Click a letter to open that part below.',
  mapHelp: 'Click a letter to change what plays there. The team switch only changes which team document A opens.',
  noSidePanel: 'This screen has no side panel.',
  openTeam: 'Open the team document',
  noTeamDocument: 'That team has no document yet. Add it in Settings, Teams.',
  teamsUnreadable: 'The teams could not be read, so only the built-in teams are shown.',
  sharedCountdown: 'The countdown title and dates are the same on all three Screens and for both teams.',
  changeCountdown: 'Change them in Dashboard Settings',
  readingCountdown: 'Reading the countdown.',
  countdownUnreadable: 'The countdown could not be read.',
  noSettings: 'Dashboard Settings has not been published yet, so the countdown has its starting words.',
  openTips: 'Open Tips and News',
  pickPanelFirst: 'Pick the panel first.',
  bothTeamsPanel: 'This panel is for both teams.',
  clearTeam: 'Clear the team',
  unknownTeam: 'A team that is not in the list',
};

// The published settings and the active teams. This never fails: what cannot be read is reported,
// and the form still opens. unreadable is true when the read itself failed.
export async function readSources(client) {
  try {
    const found = await client.fetch(sourcesQuestion, {}, { perspective: 'published' });
    const source = found && typeof found === 'object' ? found : {};
    return {
      settings: source.settings && typeof source.settings === 'object' ? source.settings : null,
      teams: Array.isArray(source.teams) ? source.teams.filter(team => team && typeof team.code === 'string' && team.code !== '') : [],
      unreadable: false,
    };
  } catch (error) {
    return { settings: null, teams: [], unreadable: true };
  }
}

// A team in words for a picker: its short name, such as PRIME, in small letters with a capital,
// or its name when it has no short name
export function teamLabel(team) {
  const short = typeof team.shortName === 'string' ? team.shortName.trim() : '';
  const word = short !== '' ? short.toLowerCase() : String(team.name || team.code);
  return word.charAt(0).toUpperCase() + word.slice(1);
}

// The teams for the pickers: { code, label, id }, in order. With no team document, the two
// built-in teams, which have no document to open.
export function pickerTeams(teams) {
  const found = (teams || []).map(team => ({ code: team.code, label: teamLabel(team), id: team._id || '' }));
  return found.length > 0 ? found : builtInTeams;
}

// The codes of the active teams, for the first rows of a Screen. With no team document, none:
// the screen has only the built-in team then (screen-seed.js).
export function teamCodes(teams) {
  return (teams || []).map(team => team.code);
}

// The words under a letter of the map: how many rows the list has
export function rowsWord(count) {
  if (!count) return 'No rows yet';
  return count === 1 ? '1 row' : count + ' rows';
}

// The lines that show the countdown on the Countdown section: { label, text }. A date is written
// as it reads on the editor's own computer.
export function countdownLines(countdown) {
  const source = countdown && typeof countdown === 'object' ? countdown : {};
  const date = value => clockText(value) || 'Not set';
  const label = value => (typeof value === 'string' && value.trim() !== '' ? value : 'Not set');

  return [
    { label: 'Kickoff title', text: label(source.kickoffLabel) },
    { label: 'Kickoff date', text: date(source.kickoff) },
    { label: 'Rollout title', text: label(source.rolloutLabel) },
    { label: 'Rollout date', text: date(source.rollout) },
  ];
}
