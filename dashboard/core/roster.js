// The pages of the Subteam roster panel. A page shows one subteam: its lead
// and up to 16 members. A subteam with more members than that continues on
// the next page. The panel shows one page each time it comes round.

import { hasText } from './text.js';
import { visibleItems } from './content.js';
import { makePages } from './turns.js';

export const rowsPerColumn = 8;
export const membersPerPage = rowsPerColumn * 2;

function membersOf(subteam) {
  return Array.isArray(subteam.members) ? subteam.members.filter(hasText) : [];
}

// Every page, subteam by subteam in the order of the Subteams list in Studio
// (the order content.subteams already has). Each page is
//   { subteam, lead, members, pageNumber, pageCount }
// subteam and lead are the typed texts, lead is empty when there is none, and
// members are the names on this page. Hidden and expired subteams are left
// out, and so is one with neither a lead nor a member, because there would
// be nothing to show.
export function rosterPages(subteams) {
  const pages = [];

  visibleItems(subteams).forEach(subteam => {
    const lead = hasText(subteam.lead) ? String(subteam.lead).trim() : '';
    const members = membersOf(subteam);
    if (lead === '' && members.length === 0) return;

    // A subteam with a lead and no members still gets one page
    const pageCount = Math.max(1, Math.ceil(members.length / membersPerPage));
    for (let index = 0; index < pageCount; index++) {
      pages.push({
        subteam: String(subteam.name || '').trim(),
        lead: lead,
        members: members.slice(index * membersPerPage, (index + 1) * membersPerPage),
        pageNumber: index + 1,
        pageCount: pageCount,
      });
    }
  });
  return pages;
}

// The turn counter. next(subteams) gives the next page and the one after it,
// whose lead's photo can be loaded early, and starts again after the last
// page: { page, upcoming }. Both are null when there is no page, and upcoming
// is null when there is only one.
export function makeRosterTurns() {
  const nextTurn = makePages(1);

  return function next(subteams) {
    const turn = nextTurn(rosterPages(subteams));
    return { page: turn.items[0] || null, upcoming: turn.upcoming[0] || null };
  };
}
