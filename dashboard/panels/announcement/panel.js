// The full screen announcement. takeover.js shows it twice in a row at
// the set times: the first line, then the second line with the logo flying.

import * as frame from '../../frame.js';
import { frameMarkup, rowBarMarkup } from '../../core/plate.js';
import { escapeHtml } from '../../core/text.js';
import { logoMarkup } from '../../core/logo.js';
import { teamShown, trimNow } from '../../core/teams.js';

const fallback = { text: 'WHAT TIME IS IT?', phase: 'title' };

// Even the smallest size cannot fit a single word longer than this on a line
const MAX_WORD_LETTERS = 20;

// Short text stays on one line. Longer text breaks at the space nearest the
// middle, and a single word that is too long is broken in the middle.
function splitLines(text) {
  const words = text.trim().split(' ');
  if (words.length === 1 && text.length > MAX_WORD_LETTERS) {
    const half = Math.ceil(text.length / 2);
    return [text.slice(0, half), text.slice(half)];
  }
  if (text.length <= 10 || words.length === 1) return [text];

  let best = 1;
  let bestDistance = Infinity;
  for (let count = 1; count < words.length; count++) {
    const distance = Math.abs(words.slice(0, count).join(' ').length - text.length / 2);
    if (distance < bestDistance) {
      best = count;
      bestDistance = distance;
    }
  }
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
}

// Every letter is its own part, so the letters slam in one after another
function lineMarkup(line, firstIndex) {
  let index = firstIndex;
  let markup = '';

  // Array.from keeps an emoji in one piece, where split('') would break it
  Array.from(line).forEach(letter => {
    if (letter === ' ') {
      markup += '<span class="space"></span>';
    } else {
      markup += `<span class="letter" data-part="letter" data-index="${index}">${escapeHtml(letter)}</span>`;
      index++;
    }
  });
  return markup;
}

// The longest line sets the size, so the text stays clear of the frame.
// The sizes are --size-announce and its variants in tokens.css.
function sizeFor(lines) {
  const longest = Math.max(...lines.map(line => line.length));
  if (longest <= 9) return 'big';
  if (longest <= 11) return 'medium';
  if (longest <= 14) return 'small';
  return 'tiny';
}

export function mount(host, content) {
  const info = content.announcement || fallback;
  const lines = splitLines(info.text);
  const withLogo = info.phase === 'follow-up';

  // Two lines of the bigger sizes would run into the logo above them
  let size = sizeFor(lines);
  if (withLogo && lines.length === 2 && (size === 'big' || size === 'medium')) size = 'small';

  let letters = 0;
  const words = lines.map(line => {
    const markup = `<div class="line">${lineMarkup(line, letters)}</div>`;
    letters += Array.from(line.replace(/ /g, '')).length;
    return markup;
  }).join('');

  const logo = withLogo ? `<div class="logo" data-part="logo">${logoMarkup()}</div>` : '';

  const team = teamShown(content);

  host.innerHTML = `
    <section class="panel announcement ${info.phase}" data-sequence="announce">
      ${frameMarkup({ corner: trimNow().corner })}
      <div class="scan-clip" style="width: 1920px; height: 1080px;">
        <div class="scan" data-part="scan" style="height: 1080px; --sweep: 1920px;"></div>
      </div>
      <div class="stripe stripe-top" data-part="stripe">${rowBarMarkup(1920)}</div>
      <div class="stripe stripe-bottom" data-part="stripe">${rowBarMarkup(1920)}</div>

      ${logo}
      <div class="words size-${size}">${words}</div>
      <div class="caption" data-part="caption">${escapeHtml(team.name)} · TEAM ${escapeHtml(team.number)}</div>
    </section>`;

  const flyer = host.querySelector('.logo');
  if (flyer) frame.flyLogo(flyer);
}
