// The drawing that the Retro and Foundry themes put on the frames of the standard layout. The Original and
// Cybertron themes draw their frames in plate.js; Retro is drawn here and Foundry in theme-art-foundry.js, as small hand
// written svg, and plate.js adds the markup after the frame of each area (areas.js) and the banner adds it before its text.
//
// The markup is always in the page, for every theme, and a stylesheet shows it only while its theme is on
// (styles/retro/theme.css and styles/foundry/theme.css). That is how the rivets of Original work too, and it
// means a theme that goes on while the screen runs finds its frames drawn. No color is written here: each
// part has a class and the stylesheet of the theme paints it.
//
// Every region has a box in pixels. The sizes are the ones in base.css and in plate.js:
//
//   grid1   1152 by 708, the large frame, with a header 120 high
//   grid2   656 by 372, the small frame, with a header 84 high
//   ticker  1840 by 72
//   banner  1840 by 212, which has no frame of its own in the standard layout, so its art stands a little past it
//
// Only the standard layout has this art. The bar layout draws Minimal's frames in every theme.
//
// The gears and the pistons are svg elements of their own, so that the browser moves each as a picture and does
// not draw the frame again. Only transform moves (styles/foundry/frame.css).

import { foundryMarkup } from './theme-art-foundry.js';

const boxes = {
  grid1: { width: 1152, height: 708, header: 120, tab: 780, cut: 54 },
  grid2: { width: 656, height: 372, header: 84, tab: 470, cut: 40 },
  ticker: { width: 1840, height: 72, header: 0, tab: 0, cut: 20 },
  banner: { width: 1840, height: 212, header: 0, tab: 0, cut: 54 },
};

// The art of a region stands this far past the box on each side: left, top, right, bottom
const bleed = {
  grid1: [0, 0, 0, 0],
  grid2: [0, 0, 0, 0],
  ticker: [20, 6, 20, 8],
  banner: [30, 16, 30, 16],
};

const number = value => Math.round(value * 10) / 10;
const list = points => points.map(point => number(point[0]) + ',' + number(point[1])).join(' ');

// The region a kind of frame belongs to ('grid1', 'grid1-tr', 'grid2-tr-slant'), or '' for the frames of the
// other themes and layouts (they begin with cybertron- or bar-)
export function regionOfKind(kind) {
  const region = String(kind).split('-')[0];
  return boxes[region] ? region : '';
}

// A star with five points, outlined, for the corners of a retro frame
function star(cx, cy, outer) {
  const inner = outer * 0.45;
  const points = [];
  for (let index = 0; index < 10; index++) {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + index * Math.PI / 5;
    points.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
  }
  return `<polygon class="ra-star" points="${list(points)}"/>`;
}

// The retro frame of a region: a cel with round corners, an ink line and a hard offset of ink behind it
function retroMarkup(region, box, size) {
  const { width, height } = size;
  const chrome = region === 'ticker' || region === 'banner';
  const edge = chrome ? 10 : 16;
  const radius = region === 'ticker' ? 30 : (region === 'banner' ? 40 : 44);
  const inset = edge / 2 + 3;
  const rect = (extra, grow = 0) => `x="${number(inset + grow)}" y="${number(inset + grow)}" width="${number(width - 2 * (inset + grow))}" height="${number(height - 2 * (inset + grow))}" rx="${number(radius - grow)}" ${extra}`;
  const offset = chrome ? 6 : 12;
  const clip = 'themeart-clip-' + region;
  let svg = `<svg class="ra-frame" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect class="ra-offset" ${rect('', 0)} transform="translate(${offset} ${offset})"/>
      <rect class="ra-face" ${rect('')}/>
      <rect class="ra-line" ${rect('', edge / 2 + 5)}/>`;

  if (region !== 'ticker') {
    const right = width - inset;
    const bottom = height - inset;
    svg += `
      <clipPath id="${clip}"><rect ${rect('', edge / 2)}/></clipPath>
      <rect class="ra-halftone" clip-path="url(#${clip})" x="${right - 330}" y="${bottom - 150}" width="330" height="150"/>`;
  }
  if (box.header > 0) {
    const bottom = box.header - 4;
    const top = inset + edge / 2 + 5;
    const left = top;
    const round = radius - edge / 2 - 5;
    svg += `
      <path class="ra-header" d="M${left} ${bottom}V${left + round}Q${left} ${top} ${left + round} ${top}H${box.tab}L${box.tab - 28} ${bottom}Z"/>
      <path class="ra-header-line" d="M${left} ${bottom}H${box.tab - 28}L${box.tab} ${top}"/>`;
  }
  // The white strokes of the light: two on the top left of the header plate or of the cel, drawn over it
  const glintY = box.header > 0 ? inset + edge / 2 + 5 + 7 : inset + edge / 2 + 9;
  const glintX = inset + edge / 2 + 5 + (box.header > 0 ? 40 : radius + 14);
  if (region === 'grid1') svg += `
      <path class="ra-glint" d="M${glintX} ${glintY}H${glintX + 150}M${glintX + 176} ${glintY}H${glintX + 196}"/>`;
  // Small stars on two corners, half over the ink line. The banner has one, at the top right end of the clock
  const spot = region === 'ticker' ? 12 : 16;
  svg += star(width - inset - spot, inset + spot, region === 'ticker' ? 14 : 20);
  if (region === 'grid1' || region === 'grid2') svg += star(inset + spot, height - inset - spot, 16);
  return svg + '\n    </svg>';
}

// The markup that goes after the frame of the area, or in the banner. kind is a frame kind of plate.js (grid1,
// grid1-tr, grid2, ticker, ...) or 'banner'. A kind of another theme or layout gives ''.
export function themeArtMarkup(kind) {
  const region = regionOfKind(kind);
  if (region === '') return '';

  const box = boxes[region];
  const turned = String(kind).split('-').includes('tr');
  const gap = bleed[region];
  const size = { width: box.width + gap[0] + gap[2], height: box.height + gap[1] + gap[3] };
  const place = gap.every(value => value === 0) ? '' : ` style="left: ${-gap[0]}px; top: ${-gap[1]}px; width: ${size.width}px; height: ${size.height}px;"`;

  return `<div class="theme-art theme-art-${region}" aria-hidden="true"${place}>
    <div class="art-retro">${retroMarkup(region, box, size)}</div>
    <div class="art-foundry">${foundryMarkup(region, box, size, turned)}</div>
  </div>`;
}
