// The drawing that the Retro and Foundry themes put on the frames of the standard layout. The Original and
// Cybertron themes draw their frames in plate.js; these two are drawn here, as small hand written svg, and
// plate.js adds the markup after the frame of each area (areas.js) and the banner adds it before its text.
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

// A gear as one closed path: teeth that are trapezoids on a round body, a hole for the hub and three round
// holes. The center is 0,0, so the element can turn about its middle. outer is the radius at the tips.
function gearPath(teeth, outer) {
  const root = outer * 0.82;
  const step = Math.PI * 2 / teeth;
  const points = [];
  for (let index = 0; index < teeth; index++) {
    const start = index * step;
    [[0.1, root], [0.22, outer], [0.5, outer], [0.62, root]].forEach(mark => {
      const angle = start + mark[0] * step;
      points.push([mark[1] * Math.cos(angle), mark[1] * Math.sin(angle)]);
    });
  }
  const holes = [0, 1, 2].map(index => {
    const angle = index * Math.PI * 2 / 3;
    const cx = outer * 0.5 * Math.cos(angle);
    const cy = outer * 0.5 * Math.sin(angle);
    const r = outer * 0.14;
    return `M${number(cx - r)} ${number(cy)}a${number(r)} ${number(r)} 0 1 0 ${number(r * 2)} 0a${number(r)} ${number(r)} 0 1 0 ${number(-r * 2)} 0Z`;
  }).join('');
  return 'M' + points.map(point => number(point[0]) + ' ' + number(point[1])).join('L') + 'Z' + holes;
}

function gear(name, cx, cy, outer, teeth, seconds, direction) {
  const half = outer + 4;
  return `<svg class="fa-gear fa-gear-${name}" style="left: ${number(cx - half)}px; top: ${number(cy - half)}px; --gear-turn: ${seconds}s; --gear-way: ${direction};" width="${half * 2}" height="${half * 2}" viewBox="${-half} ${-half} ${half * 2} ${half * 2}">
      <path class="fa-gear-body" d="${gearPath(teeth, outer)}"/>
      <circle class="fa-gear-hub" r="${number(outer * 0.17)}"/>
    </svg>`;
}

// A piston: a cylinder that stays and a rod that strokes in and out by a few pixels. side is -1 for the left
// edge of the frame and 1 for the right edge. seconds is how long one stroke back and forth takes.
function piston(x, y, side, seconds, delay) {
  return `<svg class="fa-piston" style="left: ${number(x)}px; top: ${number(y)}px; --stroke: ${seconds}s; --wait: ${delay}s;" width="22" height="150" viewBox="0 0 22 150">
      <rect class="fa-piston-body" x="${side < 0 ? 4 : 2}" y="0" width="16" height="96" rx="3"/>
      <rect class="fa-piston-rod" x="${side < 0 ? 8 : 6}" y="70" width="8" height="70"/>
    </svg>`;
}

// The points of a frame that has two corners cut. turned is true when the top right and bottom left are cut, the
// way a team with that trim has it (core/teams.js, data-corners)
function cutOutline(left, top, right, bottom, cut, turned) {
  if (turned) return [[left, top], [right - cut, top], [right, top + cut], [right, bottom], [left + cut, bottom], [left, bottom - cut]];
  return [[left, top + cut], [left + cut, top], [right, top], [right, bottom - cut], [right - cut, bottom], [left, bottom]];
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

// The foundry frame of a region: a steel rim with cut corners, a bolt flange along the top and the bottom, weld
// stitches down the sides, a hazard strip along the foot, the caution plate at the bottom right, the steel header
// with its accent bar, gears behind the cuts and pistons at the sides
function foundryMarkup(region, box, size, turned) {
  const { width, height } = size;
  const thin = region === 'ticker' || region === 'banner';
  const rim = thin ? 14 : 22;
  const inset = rim / 2;
  const cut = box.cut;
  const outline = cutOutline(inset, inset, width - inset, height - inset, cut, turned);
  const inside = cutOutline(rim, rim, width - rim, height - rim, Math.max(cut - 10, 8), turned);
  const along = [inset + cut + 14, width - inset - cut - 14];
  // The bolt flange is two lines of round dots, one along the top and one along the bottom of the rim. A line with a
  // dash of no length and round ends draws a dot, so the row is two elements and not a bolt each
  const flange = `M${along[0]} ${inset}H${along[1]}M${along[0]} ${height - inset}H${along[1]}`;

  let svg = '';
  if (!thin) {
    // The gears stand behind the frame, so only what the cuts leave open shows
    const edge = turned ? width - 22 : 22;
    const far = turned ? 24 : width - 24;
    const bigR = region === 'grid1' ? 56 : 42;
    const smallR = region === 'grid1' ? 40 : 30;
    // the two that mesh stand a little less than the sum of their radii apart, so the teeth go between each other
    const apart = Math.round((bigR + smallR) * 0.91);
    svg += gear('big', edge, 22, bigR, 12, 90, 1);
    svg += gear('small', turned ? width - 22 - apart : 22 + apart, 14, smallR, 9, 67.5, -1);
    svg += gear('far', far, height - 24, region === 'grid1' ? 48 : 36, 10, 120, 1);
  }

  svg += `<svg class="fa-frame" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <polygon class="fa-shadow" points="${list(outline)}"/>
      <polygon class="fa-body" points="${list(inside)}"/>
      <polygon class="fa-grain" points="${list(inside)}"/>`;

  if (box.header > 0) {
    const bottom = box.header;
    const left = rim;
    const tabTop = box.tab;
    const head = turned ?
      [[left, rim], [tabTop, rim], [tabTop - 34, bottom], [left, bottom]] :
      [[left, rim + cut - 10], [left + cut - 10, rim], [tabTop, rim], [tabTop - 34, bottom], [left, bottom]];
    svg += `
      <polygon class="fa-header" points="${list(head)}"/>
      <polygon class="fa-header-grain" points="${list(head)}"/>
      <path class="fa-header-line" d="M${left} ${bottom}H${width - rim}"/>
      <rect class="fa-accent" x="${tabTop + 20}" y="${bottom - 28}" width="${width - rim - tabTop - 48}" height="10"/>`;
  }

  svg += `
      <polygon class="fa-rim-dark" points="${list(outline)}"/>
      <polygon class="fa-rim" points="${list(outline)}"/>
      <polygon class="fa-rim-light" points="${list(outline)}"/>
      <path class="fa-flange" d="${flange}"/>
      <path class="fa-flange-face" d="${flange}"/>`;

  if (!thin) {
    const stitchTop = rim + cut + 24;
    const stitchBottom = height - rim - cut - 24;
    svg += `
      <path class="fa-stitch" d="M${inset} ${stitchTop}V${stitchBottom}M${width - inset} ${stitchTop}V${stitchBottom}"/>
      <rect class="fa-hazard" x="${turned ? along[0] + 160 : along[0] + 10}" y="${height - rim - 2}" width="${along[1] - along[0] - 230}" height="10"/>`;
    // The caution plate sits at the foot, the side the cut corner is not on, and is line art: no letters
    const plateX = turned ? rim + cut + 20 : width - rim - cut - 150;
    svg += `
      <rect class="fa-caution" x="${plateX}" y="${height - rim - 6}" width="130" height="18" rx="2"/>
      <path class="fa-caution-mark" d="M${plateX + 55} ${height - rim - 2}H${plateX + 75}L${plateX + 65} ${height - rim + 8}Z"/>`;
  }
  svg += '\n    </svg>';

  if (!thin) {
    // Pistons stroke on the sides of the frame, one a little off the other
    const stroke = region === 'grid1' ? 6.4 : 7.4;
    svg += piston(-16, height * 0.46, -1, stroke, 0);
    svg += piston(width - 6, height * 0.3, 1, region === 'grid1' ? 7.4 : 6.2, 1.5);
  }
  return svg;
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
