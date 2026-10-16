// How the title of the countdown sits on its line in the clocks that never cut it off: the
// war clocks and the red countdown of Original (core/countdown.js). The title is 36 px with the
// date at the right end of the first line. When the two do not fit side by side, the title takes
// a second line. A title too long even for two lines is set a little smaller, so that nothing
// is cut off. The widths come from the advance table in text-width.js, which has no kerning and
// so only overstates a width: what fits here fits on the screen.
//
// These are plain functions, so tests/countdown-title.test.mjs can run them.

import { textWidth } from './text-width.js';

export const titleSize = 36;

// 36 first, then these, until two lines hold the title
const smallerSizes = [32, 28, 24, 20];

// The least space between the title and the date on the first line
const gap = 24;

// The room in px for a line of the title, which the date shares on the first line, in each clock. The
// stylesheet of the clock has the same number (panels/countdown/panel.css: the width of .war-lines, and of the top
// line of the red countdown less the lamp and the gap after it). Spacing is the letter spacing in em.
export const titleRooms = { original: 528, wide: 494, narrow: 660 };
export const titleSpacing = { original: 0, wide: .06, narrow: .06 };

function widthOf(text, size, spacing) {
  return textWidth(text, 700, size) + spacing * size * Array.from(text).length;
}

// The title in one line, or in two: as many words on the first line as fit beside the date, and the
// rest on the second. Null when the second line does not fit either.
function wrap(words, date, room, size, spacing) {
  const whole = words.join(' ');
  const dateRoom = date === '' ? 0 : gap + widthOf(date, size, spacing);
  if (widthOf(whole, size, spacing) + dateRoom <= room) return [whole];

  let taken = 0;
  let first = '';
  while (taken < words.length) {
    const next = first === '' ? words[taken] : first + ' ' + words[taken];
    if (widthOf(next, size, spacing) + dateRoom > room) break;
    first = next;
    taken += 1;
  }

  const second = words.slice(taken).join(' ');
  if (first === '' || widthOf(second, size, spacing) > room) return null;
  return [first, second];
}

// { lines, size } for a title and the date at the right end of its first line. date is '' when there
// is none. A title that nothing holds, even at the smallest size, is one line at that size, and the
// stylesheet clips it: a title the Studio accepts is never that long.
export function titleLines(title, date, room, spacing = 0) {
  const words = String(title).trim().split(/\s+/).filter(Boolean);
  const sizes = [titleSize].concat(smallerSizes);

  for (const size of sizes) {
    const lines = wrap(words, date, room, size, spacing);
    if (lines) return { lines: lines, size: size };
  }
  return { lines: [words.join(' ')], size: sizes[sizes.length - 1] };
}
