// The rows of the Team Leads panel: one for each department (a subteam in
// Studio), in the order of the Order field. A department with a lead shows the
// lead's name, TEAM LEAD, a line (the typed Line, or the department) and, at the
// right end, the department in a chip. A department with no lead shows its own
// name and [lead], so a gap in the list can be seen from across the room. The
// panel shows as many rows as the Roster size leaves room for, four at 100, each
// time it comes round.

import { hasText, trimText } from './text.js';
import { visibleItems } from './content.js';

const noLeadRole = '[lead]';
const leadRole = 'TEAM LEAD';

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

// Every row, as { name, role, line, chip, lead }. line is the third line, the typed Line
// or the department, and chip is the department in capitals. lead is the typed name of the
// lead, or an empty text, and the panel uses it to find the lead's photo when the department
// has none of its own (photo and showPhoto, see leadPhotoOf). Hidden and
// expired departments are left out, and so is one with neither a name nor a
// lead, because there would be nothing to show.
export function departmentRows(subteams) {
  return visibleItems(subteams)
    .filter(subteam => hasText(subteam.name) || hasText(subteam.lead))
    .map(subteam => {
      const department = trimText(subteam.name);
      const lead = trimText(subteam.lead);
      const typedLine = trimText(subteam.line);

      // a department with no lead is a gap on purpose, so it never takes a photo, and its name is
      // already the first line, so it has no chip
      if (lead === '') return { name: department, role: noLeadRole, line: typedLine, chip: '', lead: '' };
      return Object.assign({ name: lead, role: leadRole, line: typedLine || department, chip: department.toUpperCase(), lead: lead }, leadPhotoOf(subteam));
    });
}

export function showcaseOf(subteam) {
  return {
    lead: trimText(subteam.lead),
    members: Array.isArray(subteam.members) ? subteam.members.filter(hasText) : [],
  };
}
