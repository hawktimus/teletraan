// The background of the Retro theme (core/theme-bg.js puts it in #theme-bg): a deep blue sky that is lighter at the
// foot, eleven stars that twinkle, and a sunburst that turns once every 180 seconds. Styled in theme.css.

// The stars: left, top, size in pixels, the seconds a twinkle takes
const stars = [
  [120, 80, 4, 2.1], [400, 300, 3, 2.9], [760, 150, 5, 1.7], [1100, 420, 3, 2.4], [1500, 90, 4, 3.1], [1800, 500, 3, 2],
  [300, 900, 4, 2.6], [900, 980, 3, 1.9], [1650, 950, 5, 2.3], [640, 620, 3, 2.8], [1350, 760, 4, 2.2],
];

function starMarkup(star, index) {
  const lag = (index * 0.37).toFixed(2);
  return `<div class="rt-star" style="--x: ${star[0]}px; --y: ${star[1]}px; --size: ${star[2]}px; --twinkle: ${star[3]}s; --lag: ${lag}s;"></div>`;
}

export function backgroundMarkup() {
  return `<div class="bg-group bg-retro">
    <div class="rt-sky"></div>
    ${stars.map(starMarkup).join('')}
    <div class="rt-burst"></div>
  </div>`;
}
