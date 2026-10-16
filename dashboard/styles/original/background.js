// The background of the Original theme, behind the panels (core/theme-bg.js puts it in #theme-bg). The setting
// background in Dashboard Settings (Look tab) picks which of these shows: sweep is the screen as it has always
// been and draws none of them, so a sweep screen has no extra layer to paint. The four others are drawn here and
// styled in theme.css. Each one moves with transform only, and calm and no motion draw them still.

// The sparks of the embers: the left edge in pixels, the size in pixels, how faint, the seconds one rise takes
const embers = [
  [120, 4, .35, 26], [340, 3, .25, 31], [560, 5, .4, 24], [780, 3, .2, 34], [1000, 4, .3, 28], [1220, 3, .25, 30],
  [1440, 5, .4, 23], [1660, 3, .2, 33], [1820, 4, .3, 27], [460, 2, .2, 36], [1120, 2, .2, 38], [1560, 2, .2, 35],
];

function emberMarkup(spark, index) {
  const delay = -(index * 2.3).toFixed(1);
  return `<div class="bg-ember" style="--x: ${spark[0]}px; --size: ${spark[1]}px; --alpha: ${spark[2]}; --rise: ${spark[3]}s; --lag: ${delay}s;"></div>`;
}

export function backgroundMarkup() {
  return `<div class="bg-group bg-original">
    <div class="bg-bp bg-bp-fine"></div>
    <div class="bg-bp bg-bp-coarse"></div>
    <div class="bg-ray bg-ray-1"></div>
    <div class="bg-ray bg-ray-2"></div>
    <div class="bg-ray bg-ray-3"></div>
    <div class="bg-pool"></div>
    <div class="bg-glow"></div>
    ${embers.map(emberMarkup).join('')}
  </div>`;
}
