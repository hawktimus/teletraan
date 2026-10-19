// What a panel writes where it names a team. A team is PRIME or NOVA, the short name the Studio sends for
// it. Content that belongs to both teams names none, and its header has no chip. A header that names a
// department reads BUILD TEAM, with the name of the team in a chip at its right end. These are plain
// functions, so tests/blank-team.test.mjs and tests/team-name.test.mjs can run them.

import { titleRoom, titleSpare } from './header-room.js';
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

// A team's name is in the banner once on a page, so the headers of the panels draw no chip with it. The code that draws the
// chip is kept: tests/chips-off.test.mjs checks that it is off, and the tests of the chip's drawing turn it on with
// globalThis.teletraanTeamChips = true. With no name there is no chip either way.
function chipsOn() {
  return globalThis.teletraanTeamChips === true;
}

// The chip text a header may use: the name, or nothing while the chips are off
export function chipShown(name) {
  return chipsOn() ? name : '';
}

export function teamChipMarkup(name) {
  return chipsOn() && hasText(name) ? `<span class="team-chip">${escapeHtml(name)}</span>` : '';
}

// How wide the chip is, with the padding the stylesheet gives it (base.css, .team-chip). A header with no chip
// has none.
const chipPadding = 28;

export function chipWidth(chip) {
  return chipsOn() && hasText(chip) ? textWidth(chip, 700, 44) + chipPadding : 0;
}

// The class of the title of a header that has the chip of a team at its right end. The title is at the size of
// a heading, 96px, when it fits in the room before the line that ends the tab (core/header-room.js), and 60px,
// the size of a Monday card's title, when it does not. A department as long as PROGRAMMING TEAM, which is 685
// wide at 60px, is 56px (title-tight). A title that is longer than the room even then is cut off with an
// ellipsis (the stylesheet of the panel). The chip is on the other side of the line, so its size does not matter
// here.
export function titleClass(title) {
  if (textWidth(title, 700, 96) <= titleRoom) return 'title';
  return textWidth(title, 700, 60) <= titleRoom ? 'title title-small' : 'title title-tight';
}

// The class of the title of a Monday card, which is at 60px, at 56px when 60px does not fit, and at 44px, the
// smallest size, when 56px does not either. A title that is longer than the room at 44px is cut off with an
// ellipsis. The title keeps 8px to spare in its room.
export function smallTitleClass(title) {
  if (textWidth(title, 700, 60) <= titleRoom - titleSpare) return 'title';
  return textWidth(title, 700, 56) <= titleRoom - titleSpare ? 'title title-tight' : 'title title-tighter';
}
