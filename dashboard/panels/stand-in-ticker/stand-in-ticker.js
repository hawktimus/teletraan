// Only used by ?stress. See stand-in-tile.js.

import { tagMarkup, boltMarkup } from '../../core/plate.js';

// The steel strip is a copy of the one in ticker.js, so the test paints the
// same area. When the strip there changes, change this one to match.
const stripBody = '0,0 1720,0 1720,40 1690,64 0,64';
const stripFrame = '2,2 1718,2 1718,39 1689.3,62 2,62';
const stripBevel = '5,5 1715,5 1715,37.6 1688.2,59 5,59';

function stripSlot(x) {
  const slot = [[x + 16, 18], [x + 26, 18], [x + 10, 46], [x, 46]];
  const lit = slot.map(point => [point[0] + 2, point[1] + 2]);
  return `<polygon class="vent-lit" points="${lit.join(' ')}"/><polygon class="vent" points="${slot.join(' ')}"/>`;
}

function stripMarkup() {
  return `<svg class="plate strip" width="1720" height="64" viewBox="0 0 1720 64">
    <polygon class="body" points="${stripBody}"/>
    <polygon class="brush" points="${stripBody}"/>
    <polygon class="outline" points="${stripFrame}"/>
    <polygon class="bevel" points="${stripBevel}"/>
    ${stripSlot(1628)}${stripSlot(1650)}
    ${boltMarkup(1698, 32, 24)}
  </svg>`;
}

export function mount(host) {
  host.innerHTML = `
    <section class="panel stand-in-ticker" data-sequence="ticker">
      ${stripMarkup()}
      <div class="ticker-tag" data-part="tag">
        ${tagMarkup()}
        <span>NEWS</span>
      </div>
      <div class="ticker-message" data-part="message">[Placeholder message at about the longest the line allows]</div>
    </section>`;
}
