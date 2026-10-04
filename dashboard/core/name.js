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
