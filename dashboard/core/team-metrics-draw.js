// What the two metrics cards share (panels/competition-team-metrics, panels/competition-compare): the tag in the header and the
// lines of a page. Plain functions that return markup, so tests/team-metrics.test.mjs can run them. Both cards draw on the body of
// 1096 x 512 that the other competition cards use (core/competition-draw.js).

import { cut, tagTextFor, textAt, whenText } from './competition-draw.js';
import { match13Stale } from './match13.js';
import { notYet } from './team-metrics.js';

// The first line of a page, then rows one under the other. A row is a label on the left and a number on the right.
export const lines = { sub: 44, first: 116, step: 68, noted: 124, noteDrop: 52 };

// The words at the right end of the header: SAMPLE for made up numbers, then how old the competition data is, and STALE when
// the Match13 file is old
export function tagFor(frc, data, now) {
  if (data && data.sample === true && !(frc && frc.sample === true)) return 'SAMPLE';

  const old = tagTextFor(frc, now);
  if (old !== '') return old;
  return match13Stale(data, now) ? 'STALE' : '';
}

// The line under the title: the section of the page. The next match says when it is played.
export function subText(page, state) {
  if (page.id !== 'next' || typeof page.time !== 'string' || page.time === '') return page.sub;

  const moment = new Date(page.time);
  return isNaN(moment.getTime()) ? page.sub : page.sub + ', ' + whenText(state.zone, moment, state.today);
}

// A number or the words NOT YET, as the text of a row
export function valueParts(x, y, value, cssClass, anchor) {
  return value === null ? textAt(x, y, notYet, 'none', anchor) : textAt(x, y, value, cssClass, anchor);
}

// The rows of one team down the page. A row may have a note, a second line under it.
export function rowParts(rows) {
  const parts = [];
  let y = lines.first;

  rows.forEach(row => {
    parts.push(textAt(0, y, cut(row.label, 22), 'label'));
    parts.push(valueParts(1096, y, row.value === null ? null : cut(row.value, 24), 'value', 'end'));
    if (row.note) parts.push(textAt(0, y + lines.noteDrop, cut(row.note, 40), 'note'));
    y += row.note ? lines.noted : lines.step;
  });
  return parts;
}

// The words a screen reader says for a page
export function describe(title, page) {
  return title + ', ' + page.sub + ': ' + page.rows.map(row => row.label + ' ' + (row.value === null ? notYet : row.value)).join(', ');
}
