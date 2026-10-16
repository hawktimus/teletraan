// The map at the top of a Screen: a picture of the screen with the five letters of Start here,
// A Banner, B Main panel, C Countdown, D Side panel and E Ticker, in the arrangement of that
// Screen. Original and Cybertron have the standard arrangement, the boxes of Start here
// (start-here-parts.js). Minimal has the bar arrangement of dashboard/core/layout.js
// (barSettings): the name at the left of the banner and the war clock at its right end, a thin
// column at the left that holds the clock, date, weather, team plate, school and logo, which are
// the banner too, one main panel and the ticker. It has no side panel, so D is drawn dashed under
// the screen and opens nothing.
//
// Every number is a pixel of the screen's own 1920 by 1080, like the picture of Start here.
// check-schemas.mjs fails if the boxes differ from base.css and layout.js, or if the words do not
// fit their boxes. Plain functions only. screen-input.js draws the picture.

import { areas as standardAreas, widthOf } from '../inputs/start-here-parts.js';
import { rowsWord, words } from '../inputs/screen-parts.js';

// The tab of the form that each letter opens. The names are the groups of schemas/screen.js.
export const letterGroups = { A: 'banner', B: 'main', C: 'countdown', D: 'side', E: 'ticker' };

// The words under a letter, other than the rows of the two lists
const underLetter = { A: 'Team and effects', C: 'Title and dates', E: 'Tips and News' };

// The boxes of the bar arrangement, from barGeometry in dashboard/core/layout.js: the name's slot
// at the left of the banner, the side column and its rail, the war clock, the main panel and the
// ticker. The war clock is 766 by 128 and its slot is too small for words under its name.
const barBoxes = [
  { letter: 'A', name: 'Banner', x: 72, y: 32, width: 986, height: 160, mode: 'row' },
  { letter: 'A', name: 'Banner', x: 32, y: 216, width: 336, height: 736, mode: 'column' },
  { letter: 'C', name: 'Countdown', x: 1082, y: 48, width: 766, height: 128, mode: 'row', bare: true },
  { letter: 'B', name: 'Main panel', x: 404, y: 216, width: 1484, height: 736, mode: 'tall' },
  { letter: 'E', name: 'Ticker', x: 32, y: 976, width: 1856, height: 72, mode: 'row' },
];

// The side panel of a screen that has none: under the screen, dashed
const noSideBox = { letter: 'D', name: 'Side panel', x: 32, y: 1104, width: 1856, height: 96, mode: 'row', dashed: true, opens: false };

const screenWidth = 1920;
const screenHeight = 1080;

function linesOf(box, counts) {
  if (box.bare || box.mode === 'column') return [];
  if (box.letter === 'B') return [rowsWord(counts.main)];
  if (box.letter === 'D') return box.opens === false ? [words.noSidePanel] : [rowsWord(counts.side)];
  return underLetter[box.letter] ? [underLetter[box.letter]] : [];
}

// The picture for a style: { width, height, edge, boxes }. counts is { main, side }, the rows of
// the two lists. A box is { key, letter, name, x, y, width, height, mode, lines, dashed, opens }.
// The letters in the order A to E, the column of Minimal after the banner it belongs to.
export function mapFor(style, counts) {
  const size = counts || {};
  const edge = { x: 4, y: 4, width: screenWidth - 8, height: screenHeight - 8 };

  if (style === 'minimal') {
    const boxes = barBoxes.concat([noSideBox]);
    return {
      width: screenWidth,
      height: noSideBox.y + noSideBox.height + 24,
      edge: edge,
      boxes: boxes.map((box, index) => Object.assign({ key: box.letter + index, dashed: false, opens: true }, box, { lines: linesOf(box, size) })),
    };
  }

  const boxes = standardAreas.map(area => ({
    key: area.letter + '0',
    letter: area.letter,
    name: area.name,
    x: area.x,
    y: area.y,
    width: area.width,
    height: area.height,
    mode: area.height < 120 ? 'row' : 'tall',
    dashed: false,
    opens: true,
  }));
  return { width: screenWidth, height: screenHeight, edge: edge, boxes: boxes.map(box => Object.assign({}, box, { lines: linesOf(box, size) })) };
}

const gap = 28;

// Where the words of one box sit: the square with the letter, the name and the lines. Every x
// and y is the left end and the baseline of the words, except the letter, which is centred on x.
//   tall    the square and the name side by side, the lines under them (the boxes of Start here)
//   row     the square, the name and the lines in one row (a box that is not high)
//   column  the square, the name under it and the lines under that (a box that is not wide)
export function labelsFor(box) {
  const row = box.mode === 'row';
  const column = box.mode === 'column';
  const badgeSize = row ? 56 : 96;
  const nameSize = row ? 44 : column ? 52 : 64;
  const lineSize = row ? 44 : 52;
  const edge = row ? (box.height - badgeSize) / 2 : gap;

  const badge = { x: box.x + edge, y: box.y + edge, size: badgeSize };
  const middle = badge.y + badgeSize / 2;
  const letter = { text: box.letter, x: badge.x + badgeSize / 2, y: Math.round(middle + badgeSize * 0.25), size: Math.round(badgeSize * 0.7) };
  const name = column
    ? { text: box.name, x: box.x + gap, y: badge.y + badgeSize + nameSize + 8, size: nameSize }
    : { text: box.name, x: badge.x + badgeSize + gap, y: Math.round(middle + nameSize * 0.35), size: nameSize };

  const lines = (box.lines || []).map((text, index) => {
    if (row) return { text: text, x: name.x + widthOf(box.name, nameSize) + gap, y: name.y, size: lineSize };
    const top = column ? name.y : badge.y + badgeSize;
    return { text: text, x: box.x + gap, y: top + lineSize + 4 + index * (lineSize + 12), size: lineSize };
  });
  return { badge: badge, letter: letter, name: name, lines: lines };
}
