// The chances: how likely each of our teams is to reach the District Championship and the World Championship,
// as a percentage and a bar, with the district rank under the name and the cutline at the foot. The numbers come
// from the district standings of match13.json (core/match13.js, docs/match13.md). A team that has a seat, or
// can no longer get one, says so in words in place of a percentage.

import { chartMarkup, emptyMarkup, dataNow, pageMarkup, percentText, teamLabel, textAt } from '../../core/match13-draw.js';
import { qualifyRows } from '../../core/match13.js';

const BAR = { left: 250, width: 846, height: 24 };
const BLOCK = { height: 190, first: 0 };

// What the bar and the words say for one chance. A status that settles the matter beats the percentage.
export function chanceOf(chance, status) {
  if (status === 'qualified' || status === 'locked') return { fill: 1, words: status === 'qualified' ? 'QUALIFIED' : 'LOCKED IN' };
  if (status === 'locked_out') return { fill: 0, words: 'OUT OF REACH' };
  if (typeof chance !== 'number' || !isFinite(chance)) return { fill: 0, words: 'NOT KNOWN' };
  return { fill: Math.min(1, Math.max(0, chance)), words: percentText(chance) };
}

function barParts(top, name, chance) {
  const width = Math.round(BAR.width * chance.fill);
  return [
    textAt(BAR.left, top + 40, name, 'what'),
    textAt(BAR.left + BAR.width, top + 40, chance.words, 'percent', 'end'),
    `<rect class="lane" x="${BAR.left}" y="${top + 54}" width="${BAR.width}" height="${BAR.height}"/>`,
    `<rect class="fill" x="${BAR.left}" y="${top + 54}" width="${width}" height="${BAR.height}"/>`,
  ];
}

function rowParts(row, label, top) {
  const parts = [textAt(0, top + 44, label, 'name')];
  if (row.rank !== null) parts.push(textAt(0, top + 100, 'RANK ' + Math.round(row.rank), 'rank'));
  if (row.total !== null) parts.push(textAt(0, top + 150, Math.round(row.total) + ' POINTS', 'points'));
  parts.push(...barParts(top, 'DISTRICT CHAMPIONSHIP', chanceOf(row.pDcmp, row.dcmpStatus)));
  parts.push(...barParts(top + 90, 'WORLD CHAMPIONSHIP', chanceOf(row.pCmp, row.cmpStatus)));
  return parts;
}

function cutlineWords(data) {
  const lines = [];
  const pool = data.district.pools.find(item => item.cutline !== null);
  if (pool && pool.capacity !== null) lines.push('DISTRICT: ' + Math.round(pool.capacity) + ' SEATS, ABOUT ' + Math.round(pool.cutline.q50) + ' POINTS');
  if (data.district.cmpCutline !== null && data.district.cmpSlots !== null) lines.push('WORLD: ' + Math.round(data.district.cmpSlots) + ' SEATS, ABOUT ' + Math.round(data.district.cmpCutline.q50) + ' POINTS');
  return lines;
}

function chart(data, rows) {
  const parts = [];
  const words = [];
  rows.forEach((row, index) => {
    const label = teamLabel(data.ours, row.teamNumber);
    parts.push(...rowParts(row, label, BLOCK.first + index * BLOCK.height));
    words.push(label + ' ' + chanceOf(row.pDcmp, row.dcmpStatus).words + ' for the District Championship, ' + chanceOf(row.pCmp, row.cmpStatus).words + ' for the World Championship');
  });
  cutlineWords(data).forEach((line, index) => parts.push(textAt(0, 448 + 52 * index, line, 'cutline')));
  return chartMarkup('Chances: ' + words.join('. '), parts);
}

// The page as markup, for the time given. now is a Date.
export function markupFor(content, now) {
  const data = dataNow();
  const rows = qualifyRows(data);
  const inner = rows.length > 0 ? chart(data, rows) : emptyMarkup('Match13 has no district standings yet.');

  return pageMarkup('competition-qualify', 'CHANCES', data, now, inner);
}

export function mount(host, content) {
  host.innerHTML = markupFor(content, new Date());
}
