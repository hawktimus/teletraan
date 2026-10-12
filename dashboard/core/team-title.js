// What a panel writes where it names a team. A team is PRIME or NOVA, the short name the Studio sends for
// it. Content that belongs to both teams names none, and its header has no chip. A header that names a
// department reads BUILD TEAM, with the name of the team in a chip at its right end. These are plain
// functions, so tools/test-monday-rows.mjs can run them.

import { escapeHtml, hasText } from './text.js';
import { textWidth } from './text-width.js';

// The name of a team in capitals: its short name, or its full name or its code when it has none
export function teamNameOf(team) {
  if (!team) return '';
  return String(team.shortName || team.name || team.code || '').trim().toUpperCase();
}

// BUILD TEAM for a department called Build. A name that already ends in TEAM does not get a second one.
export function departmentTitle(name) {
  const text = String(name === undefined || name === null ? '' : name).trim().toUpperCase();
  if (text === '') return 'TEAM';
  return /(^|\s)TEAM$/.test(text) ? text : text + ' TEAM';
}

// The name a page of items carries. A page whose items all belong to both teams (their team is empty) has
// no name. Any other page is the team on the screen, which is teamName.
export function pageTeamName(items, teamName) {
  const list = Array.isArray(items) ? items : [];
  return list.length > 0 && list.every(item => !hasText(item && item.team)) ? '' : teamName;
}

// The chip at the right end of a header, in the accent of the team. With no name there is no chip.
export function teamChipMarkup(name) {
  return hasText(name) ? `<span class="team-chip">${escapeHtml(name)}</span>` : '';
}

// The class of the title of a header that has the chip of a team at its right end, with the slashes after
// it. The title is at the size of a heading, 96px, when it fits beside the chip and the slashes, and 60px,
// the size of a Monday card's title, when it does not. Beside a longer name than the room has, the title is
// cut off with an ellipsis (the stylesheet of the panel). A header with no chip leaves the room of the chip
// to the title.
const headerRoom = 1036;
const slashesRoom = 84;
const chipPadding = 28;
const gap = 24;

export function titleClass(title, chip) {
  const chipRoom = hasText(chip) ? gap + textWidth(chip, 700, 44) + chipPadding : 0;
  const taken = textWidth(title, 700, 96) + chipRoom + slashesRoom;
  return taken <= headerRoom ? 'title' : 'title title-small';
}
