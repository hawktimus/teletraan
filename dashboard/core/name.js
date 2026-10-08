// The team name, built from letters so the name effect can split each one
// (frame.js plays it, the section "The team name" in frame.css moves it).
//
// A letter is the real letter, in a span called whole, and three empty pieces
// that draw the same letter through CSS (data-letter). That keeps the text of
// the page plain: the name can still be selected and copied as one word, and
// the pieces are only there for the effect.

import { escapeHtml } from './text.js';

const nonBreakingSpace = '\u00a0';

// A space gets a real width this way, even though it sits alone in its box
function letterMarkup(letter, index) {
  const shown = letter === ' ' ? nonBreakingSpace : escapeHtml(letter);
  const cut = number => `<span class="cut cut-${number}" data-letter="${escapeHtml(letter)}"></span>`;
  const pieces = letter === ' ' ? '' : cut(1) + cut(2) + cut(3);

  // --i is the letter's place in the name. frame.css starts each letter a
  // little after the one before it.
  return `<span class="letter" style="--i: ${index}"><span class="whole">${shown}</span>${pieces}</span>`;
}

// Array.from keeps an emoji in one piece, where split('') would break it
export function nameMarkup(name) {
  return Array.from(name).map(letterMarkup).join('');
}

// The name on two lines, for a place where a name is too wide for one line at
// 96px. No layout uses it now, because the strip of the sidebar layout is wide
// enough for the name on one line (nameMarkup above). It is kept, with its
// tests, for a layout that has a narrow place for the name. The effect needs
// nothing else: it moves every .letter inside the heading, so the letters of the
// first line go first and then the letters of the second.
//
// A name of one word stays on one line. With more words the line break goes
// where the longer of the two lines is the shortest, and the first such place
// wins a tie, so HAWKTIMUS PRIME is HAWKTIMUS over PRIME. Spaces at the ends
// and doubled spaces are dropped, and a name with nothing in it is one empty
// line.
export function splitName(name) {
  const text = String(name === undefined || name === null ? '' : name).trim().replace(/\s+/g, ' ');
  const words = text.split(' ');
  if (words.length < 2) return [text];

  let best = null;
  for (let cut = 1; cut < words.length; cut++) {
    const lines = [words.slice(0, cut).join(' '), words.slice(cut).join(' ')];
    const longest = Math.max(Array.from(lines[0]).length, Array.from(lines[1]).length);
    if (best === null || longest < best.longest) best = { lines: lines, longest: longest };
  }
  return best.lines;
}

// Each line is a span of its own (name-line). --i carries on counting from the
// first line into the second, so frame.css starts the second line's letters
// after the first line's last one.
export function nameLinesMarkup(name) {
  let index = 0;

  return splitName(name).map(line => {
    const letters = Array.from(line).map(letter => letterMarkup(letter, index++)).join('');
    return `<span class="name-line">${letters}</span>`;
  }).join('');
}
