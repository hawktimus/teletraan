// The rows of the Team Leads panel: one for each department (a subteam in
// Studio), in the order of the Order field. A department with a lead shows the
// lead's name and, at the right end, the department. A department with no lead
// shows its own name and [lead], so a gap in the list can be seen from across
// the room. The panel shows as many rows as the Portrait size leaves room for,
// four at 100, each time it comes round.

import { hasText } from './text.js';
import { visibleItems } from './content.js';

const noLeadRole = '[lead]';

function trimmed(text) {
  return hasText(text) ? String(text).trim() : '';
}

// The lead's own photo and its switch go with the row, so the panel can ask
// core/portrait.js for the address (leadAddress). A department without them has
// the row it always had, and the switch is only there when it is off. The Roster
// pages use it too (core/roster.js).
export function leadPhotoOf(subteam) {
  const own = {};
  if (subteam.photo) own.photo = subteam.photo;
  if (subteam.showPhoto === false) own.showPhoto = false;
  return own;
}

// Every row, as { name, role, lead }. lead is the typed name of the lead, or an
// empty text, and the panel uses it to find the lead's photo when the department
// has none of its own (photo and showPhoto, see leadPhotoOf). Hidden and
// expired departments are left out, and so is one with neither a name nor a
// lead, because there would be nothing to show.
export function departmentRows(subteams) {
  return visibleItems(subteams)
    .filter(subteam => hasText(subteam.name) || hasText(subteam.lead))
    .map(subteam => {
      const department = trimmed(subteam.name);
      const lead = trimmed(subteam.lead);

      // a department with no lead is a gap on purpose, so it never takes a photo
      if (lead === '') return { name: department, role: noLeadRole, lead: '' };
      return Object.assign({ name: lead, role: department === '' ? 'LEAD' : department.toUpperCase() + ' LEAD', lead: lead }, leadPhotoOf(subteam));
    });
}

export function showcaseOf(subteam) {
  return {
    lead: trimmed(subteam.lead),
    members: Array.isArray(subteam.members) ? subteam.members.filter(hasText) : [],
  };
}
