// Finding rows on the Rotation board: the rows the wall skips now, the placeholder rows, a search over panel titles and the
// Jump to links of the blocks. Plain functions only, so that tests/rotation-find.test.mjs can run them with node.

import { isShown } from './rotation-board.js';
import { panelTitleOf, placeholderIds, placeholderNote, viewTitleOf } from './rotation-titles.js';

export { placeholderNote };

// A placeholder row is one whose panel, or whose small panel, only draws its title (placeholderIds)
export function isPlaceholder(row) {
  return placeholderIds.indexOf(row.panel) !== -1 || placeholderIds.indexOf(row.side) !== -1;
}

// The badge words of a placeholder row, or nothing. A placeholder small panel is named, so the badge is not taken for the large one.
export function placeholderBadge(row) {
  if (placeholderIds.indexOf(row.panel) !== -1) return placeholderNote;
  if (placeholderIds.indexOf(row.side) !== -1) return 'Small panel ' + panelTitleOf(row.side) + ' is a placeholder: draws only a title';
  return '';
}

// A row the wall does not play now: it is switched off, or it is on and has nothing to show (a note from skipNotes)
export function isSkippedNow(row, skips) {
  return !isShown(row) || Boolean(skips && skips[row._key]);
}

// Whether the text is in the title of the panel, the small panel or the view of the row, or in a panel id. Empty matches every row.
export function matchesSearch(row, text) {
  const words = String(text || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;

  const hay = [panelTitleOf(row.panel), row.panel, panelTitleOf(row.side), viewTitleOf(row.view), row.department].join(' ').toLowerCase();
  return words.every(word => hay.indexOf(word) !== -1);
}

export function hasFilter(filters) {
  return Boolean(filters && (filters.onlySkipped || filters.onlyPlaceholders || String(filters.search || '').trim() !== ''));
}

// The blocks with only the rows that pass the filters. A block with no row left is dropped. The counts of a block stay those of
// the whole block, and each kept row keeps its index in the whole list.
export function filterBlocks(blocks, filters, skips) {
  if (!hasFilter(filters)) return blocks;

  return blocks
    .map(block => Object.assign({}, block, {
      rows: block.rows.filter(item =>
        (!filters.onlySkipped || isSkippedNow(item.row, skips)) &&
        (!filters.onlyPlaceholders || isPlaceholder(item.row)) &&
        matchesSearch(item.row, filters.search)),
    }))
    .filter(block => block.rows.length > 0);
}

// One link for each block: Robotics, rows 1 to 13
export function jumpLinks(blocks) {
  return blocks.map(block => {
    const first = block.rows[0].index + 1;
    const last = block.rows[block.rows.length - 1].index + 1;
    return { key: block.key, label: viewTitleOf(block.view) + ', ' + (first === last ? 'row ' + first : 'rows ' + first + ' to ' + last) };
  });
}

// The id of the line of a block, for the Jump to links
export function blockId(key) {
  return 'rb-block-' + key;
}

export function findingWords(shown, total) {
  return shown === 0 ? 'No row matches. Clear the filters to see the whole list.' : 'Showing ' + shown + (shown === 1 ? ' row' : ' rows') + ' of ' + total + '.';
}
