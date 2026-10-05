// The pages of the Leadership panel. A page shows people of one role only:
// the coaches, then the captains, then the mentors. A role with more people
// than fit on a page is shared out evenly over as many pages as it needs, so
// 4 coaches are 2 and 2, not 3 and 1. The panel shows one page each time it
// comes round.

import { hasText } from './text.js';
import { visibleItems } from './content.js';
import { slotsPerPage } from './portrait.js';

// Roles are shown in this order. A role that is not in the list (an old
// entry, or a typed one) comes after them, each such role on pages of its own.
// The president is not a role of their own: the Studio gives a president the
// role Captain and a title, so they are with the captains.
export const roleOrder = ['coach', 'captain', 'mentor'];

function roleOf(person) {
  return String(person.role || '').trim().toLowerCase();
}

// The people in a list as groups, one group for each role, in the order of
// roleOrder. People of one role stay in the order the list has them in.
// A role nobody has is left out.
function groupsOf(people) {
  const roles = roleOrder.slice();
  people.forEach(person => {
    if (roles.indexOf(roleOf(person)) === -1) roles.push(roleOf(person));
  });

  return roles
    .map(role => people.filter(person => roleOf(person) === role))
    .filter(group => group.length > 0);
}

// A list cut into the fewest pages that hold size each, with the people shared
// out as evenly as possible. The first pages take the extra person when the
// list does not divide evenly, so 5 people on pages of 3 are 3 and 2, and 7
// are 3, 2 and 2.
export function splitEvenly(list, size) {
  if (list.length === 0) return [];

  const pageCount = Math.ceil(list.length / size);
  const smallest = Math.floor(list.length / pageCount);
  const withExtra = list.length % pageCount;
  const pages = [];
  let start = 0;

  for (let index = 0; index < pageCount; index++) {
    const count = index < withExtra ? smallest + 1 : smallest;
    pages.push(list.slice(start, start + count));
    start += count;
  }
  return pages;
}

// Every page, in the order they are shown. A page is the list of the people
// on it, at most slotsPerPage. Hidden and expired people are left out, and so
// is a person with neither a name nor a role.
export function leadershipPages(people) {
  const showing = visibleItems(people).filter(person => hasText(person.name) || hasText(person.role));
  const pages = [];

  groupsOf(showing).forEach(group => {
    splitEvenly(group, slotsPerPage).forEach(page => pages.push(page));
  });
  return pages;
}
