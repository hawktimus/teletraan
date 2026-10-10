// The people on the Leadership panel: the coaches first, then the captains, then
// the mentors. The panel shows as many rows as the Portrait size leaves room for,
// four at 100, and each time it comes round it shows the next rows, so everyone is
// shown. With two coaches and two captains, which is the team, those four are one
// page at 100.

import { hasText } from './text.js';
import { visibleItems } from './content.js';

// Roles are shown in this order. A role that is not in the list (an old
// entry, or a typed one) comes after them.
// The president is not a role of their own: the Studio gives a president the
// role Captain and a title, so they are with the captains.
export const roleOrder = ['coach', 'captain', 'mentor'];

function roleOf(person) {
  return String(person.role || '').trim().toLowerCase();
}

// The people in a list as groups, one group for each role, in the order of
// roleOrder. People of one role stay in the order the list has them in, which
// is the order of the Order field. A role nobody has is left out.
function groupsOf(people) {
  const roles = roleOrder.slice();
  people.forEach(person => {
    if (roles.indexOf(roleOf(person)) === -1) roles.push(roleOf(person));
  });

  return roles
    .map(role => people.filter(person => roleOf(person) === role))
    .filter(group => group.length > 0);
}

// Everyone to show, in the order of the rows. Hidden and expired people are
// left out, and so is a person with neither a name nor a role.
export function leaders(people) {
  const showing = visibleItems(people).filter(person => hasText(person.name) || hasText(person.role));

  return groupsOf(showing).reduce((all, group) => all.concat(group), []);
}
