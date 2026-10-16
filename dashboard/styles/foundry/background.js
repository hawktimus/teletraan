// The background of the Foundry theme (core/theme-bg.js puts it in #theme-bg): a dark shop floor with a fine
// vertical grain, a pool of work light that pans across it on a 70 second loop, bands of hazard stripes that creep
// along the very top and bottom edges on a 9 second loop, six specks of dust, and a hook on a chain that crosses an
// overhead rail once in 150 seconds. Styled in theme.css.

// The dust: left, top, size in pixels, the seconds a drift takes
const motes = [
  [200, 300, 3, 11], [600, 700, 2, 13], [1000, 200, 3, 10], [1400, 800, 2, 14], [1700, 400, 3, 12], [380, 950, 2, 15],
];

function moteMarkup(mote, index) {
  const lag = (index * 0.9).toFixed(1);
  return `<div class="fy-mote" style="--x: ${mote[0]}px; --y: ${mote[1]}px; --size: ${mote[2]}px; --drift: ${mote[3]}s; --lag: ${lag}s;"></div>`;
}

// The hook is a trolley on the rail, a chain and a hook, drawn as one svg 160 wide and 130 high
const hook = `<svg class="fy-hook" width="160" height="130" viewBox="0 0 160 130">
    <rect class="fy-trolley" x="60" y="0" width="40" height="12" rx="3"/>
    <path class="fy-chain" d="M80 12V84"/>
    <path class="fy-hook-curve" d="M80 84V96A18 18 0 1 1 62 114"/>
  </svg>`;

export function backgroundMarkup() {
  return `<div class="bg-group bg-foundry">
    <div class="fy-floor"></div>
    <div class="fy-lamp"></div>
    <div class="fy-hazard fy-hazard-top"></div>
    <div class="fy-hazard fy-hazard-bottom"></div>
    ${motes.map(moteMarkup).join('')}
    <div class="fy-rail"></div>
    ${hook}
  </div>`;
}
