// The frame of the Foundry theme, drawn as small hand written svg (core/theme-art.js asks for it). It is dark gunmetal
// armor, like a wall of a fort: a rim of steel with a lit edge on its upper left and a dark one on its lower right, armor
// plates split by seams, a row of hex bolts along the rim, steel brackets in the square corners, clamps across the top and
// the bottom, hinge knuckles on the left, lock catches with a deadbolt on the right, hazard stripes along the foot, and
// gears behind the cut corners with pistons beside the frame. The steel header plate ends in an accent bar of the team.
// No color is written here: each part has a class and styles/foundry/theme.css paints it, so the team metal only tints
// the trim (the accent bar and the lock tips) and never the plates.
//
// Only the gears and the rods of the pistons move (transform, styles/foundry/frame.css). The rest is drawn once.
// The sizes are the ones of core/theme-art.js (grid1, grid2, ticker and banner), and nothing here changes a size of
// the layout: the art stands on the rim and in the margin around it, never over the body of a frame.

const number = value => Math.round(value * 10) / 10;
const list = points => points.map(point => number(point[0]) + ',' + number(point[1])).join(' ');

// The points of a frame that has two corners cut. turned is true when the top right and bottom left are cut, the
// way a team with that trim has it (core/teams.js, data-corners)
function cutOutline(left, top, right, bottom, cut, turned) {
  if (turned) return [[left, top], [right - cut, top], [right, top + cut], [right, bottom], [left + cut, bottom], [left, bottom - cut]];
  return [[left, top + cut], [left + cut, top], [right, top], [right, bottom - cut], [right - cut, bottom], [left, bottom]];
}

// A polygon in the order the screen draws it clockwise, so that the normal of an edge points out of it
function clockwise(points) {
  const area = points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point[0] * next[1] - next[0] * point[1];
  }, 0);
  return area >= 0 ? points : points.slice().reverse();
}

// The polygon moved by distance along the normals of its edges (out when positive), with the corners where the moved edges meet
function shifted(points, distance) {
  const count = points.length;
  const lines = points.map((point, index) => {
    const next = points[(index + 1) % count];
    const length = Math.hypot(next[0] - point[0], next[1] - point[1]);
    const dx = (next[0] - point[0]) / length;
    const dy = (next[1] - point[1]) / length;
    return { x: point[0] + dy * distance, y: point[1] - dx * distance, dx: dx, dy: dy };
  });

  return points.map((point, index) => {
    const before = lines[(index + count - 1) % count];
    const after = lines[index];
    const cross = before.dx * after.dy - before.dy * after.dx;
    if (Math.abs(cross) < 1e-6) return [after.x, after.y];
    const along = ((after.x - before.x) * after.dy - (after.y - before.y) * after.dx) / cross;
    return [before.x + before.dx * along, before.y + before.dy * along];
  });
}

// The edges of a polygon that face the light (up and to the left) and the ones that do not, as the data of two paths
function bevelOf(points) {
  const outline = clockwise(points);
  const lit = [];
  const dark = [];

  outline.forEach((point, index) => {
    const next = outline[(index + 1) % outline.length];
    const length = Math.hypot(next[0] - point[0], next[1] - point[1]);
    const nx = (next[1] - point[1]) / length;
    const ny = -(next[0] - point[0]) / length;
    const toward = -(nx + ny) > 0.2 || (Math.abs(nx + ny) <= 0.2 && ny < 0);
    (toward ? lit : dark).push('M' + number(point[0]) + ' ' + number(point[1]) + 'L' + number(next[0]) + ' ' + number(next[1]));
  });
  return { lit: lit.join(''), dark: dark.join('') };
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
// The rod is an svg of its own, because a transform that moves a shape inside an svg makes the browser lay the whole page out
// again on every frame, and one that moves an svg is only a move of its picture.
function piston(x, y, side, seconds, delay) {
  const place = `style="left: ${number(x)}px; top: ${number(y)}px; --stroke: ${seconds}s; --wait: ${delay}s;" width="22" height="150"`;
  return `<svg class="fa-piston" ${place} viewBox="0 0 22 150">
      <rect class="fa-piston-body" x="${side < 0 ? 4 : 2}" y="0" width="16" height="96" rx="3"/>
      <path class="fa-piston-band" d="M${side < 0 ? 4 : 2} 10H${side < 0 ? 20 : 18}M${side < 0 ? 4 : 2} 80H${side < 0 ? 20 : 18}"/>
    </svg><svg class="fa-piston fa-piston-moving" ${place} viewBox="0 0 22 150">
      <rect class="fa-piston-rod" x="${side < 0 ? 8 : 6}" y="70" width="8" height="70"/>
    </svg>`;
}

// The parts that stand on the rim are collected and drawn as a few paths each, so that the frame has few elements: the screen
// copies the page into every square of a transition (core/reform-bake.js), and each element of a frame is copied a hundred times.
// A collector holds the plates (closed outlines), the lit lines of their upper left edges, the grooves and the bolts.
function collector() {
  return { plates: [], lits: [], grooves: [], bolts: [] };
}

// A hexagon with its middle at x, y and this radius
function hexPath(x, y, radius, turn = 0) {
  const points = [0, 1, 2, 3, 4, 5].map(index => {
    const angle = (60 * index + turn) * Math.PI / 180;
    return number(x + radius * Math.cos(angle)) + ' ' + number(y + radius * Math.sin(angle));
  });
  return 'M' + points.join('L') + 'Z';
}

// The bolts as four paths: the dark hexagon, the steel face, a lit line on the upper left of the face and the socket
function boltsMarkup(bolts) {
  const rim = bolts.map(([x, y, size, turn]) => hexPath(x, y, size / 2, turn)).join('');
  const face = bolts.map(([x, y, size, turn]) => hexPath(x, y, size / 2 * 0.72, turn)).join('');
  const dot = bolts.map(([x, y, size, turn]) => hexPath(x, y, size / 2 * 0.24, turn)).join('');
  const lit = bolts.map(([x, y, size]) => {
    const r = size / 2 * 0.72;
    return `M${number(x - r)} ${number(y)}L${number(x - r / 2)} ${number(y - r * 0.866)}H${number(x + r / 2)}`;
  }).join('');

  return `<path class="fa-bolt-rim" d="${rim}"/><path class="fa-bolt-face" d="${face}"/><path class="fa-bolt-lit" d="${lit}"/><path class="fa-bolt-dot" d="${dot}"/>`;
}

function platesMarkup(set) {
  return `<path class="fa-plate" d="${set.plates.join('')}"/><path class="fa-lit" d="${set.lits.join('')}"/><path class="fa-groove" d="${set.grooves.join('')}"/>`;
}

// A part with a steel face, a dark line around it and a lit line on the edges that face up and left, drawn 2.5 px inside
function part(set, points) {
  const outline = clockwise(points);
  set.plates.push('M' + list(outline).replace(/ /g, 'L').replace(/,/g, ' ') + 'Z');
  set.lits.push(bevelOf(shifted(outline, -2.5)).lit);
}

// The L-shaped bracket of a square corner, in the frame of its corner: arm is how far it runs along each edge and
// thick how wide it is. sx and sy say which corner it is (1 for the left and the top, -1 for the right and the bottom).
function bracket(set, cx, cy, sx, sy, arm, thick, round) {
  const chamfer = Math.round(thick * 0.32);
  const local = [[0, 0], [arm, 0], [arm, thick - chamfer], [arm - chamfer, thick], [thick, thick], [thick, arm - chamfer], [thick - chamfer, arm], [0, arm]];
  const place = point => [cx + sx * point[0], cy + sy * point[1]];
  const middle = thick / 2;

  part(set, local.map(place));
  set.bolts.push([...place([middle, middle]), round, 0], [...place([arm - thick * 0.55, middle]), round * 0.8, 0], [...place([middle, arm - thick * 0.55]), round * 0.8, 0]);
}

// The plate of a cut corner: a block laid along the diagonal with a bolt at each end
function gusset(set, cx, cy, sx, sy, cut, thick) {
  const reach = cut * 0.5;
  const middle = [cx + sx * cut / 2, cy + sy * cut / 2];
  // along the diagonal that goes from the top left toward the bottom right when sx and sy agree, the other way when they do not
  const along = [sx * 0.7071, -sy * 0.7071];
  const across = [sy * 0.7071, sx * 0.7071];
  const corner = (a, b) => [middle[0] + along[0] * a + across[0] * b, middle[1] + along[1] * a + across[1] * b];
  const size = Math.round(thick * 0.6);

  part(set, [corner(-reach, -thick / 2), corner(reach, -thick / 2), corner(reach, thick / 2), corner(-reach, thick / 2)]);
  set.bolts.push([...corner(-reach + thick * 0.55, 0), size, 0], [...corner(reach - thick * 0.55, 0), size, 0]);
}

const boxPoints = box => [[box[0], box[1]], [box[0] + box[2], box[1]], [box[0] + box[2], box[1] + box[3]], [box[0], box[1] + box[3]]];

// A clamp across the rim: a block with two bolts and a groove, over the rim of the top or the bottom at x
function clamp(set, x, y, rim) {
  const stand = rim > 16 ? 7 : 1;
  const box = [x - 32, y - stand, 64, rim + stand * 2];

  part(set, boxPoints(box));
  set.grooves.push(`M${number(x)} ${box[1] + 3}V${box[1] + box[3] - 3}`);
  set.bolts.push([x - 20, y + rim / 2, rim - 6, 0], [x + 20, y + rim / 2, rim - 6, 0]);
}

// A hinge knuckle on the left edge: a barrel with three bands and two pins, standing out of the rim
function hinge(set, y, tall, rim) {
  const box = [-14, y, rim + 12, tall];

  part(set, boxPoints(box));
  [1, 2, 3].forEach(step => set.grooves.push(`M${box[0] + 2} ${number(y + tall * step / 4)}H${box[0] + box[2] - 2}`));
  set.bolts.push([box[0] + 12, y + 9, 16, 0], [box[0] + 12, y + tall - 9, 16, 0]);
}

// A lock catch on the right edge: a plate that stands out of the rim, with a deadbolt across the rim that ends in a tip of the
// team's accent. The bolt lies over the rim and never reaches the body of the frame. Its rectangles go in the lists of the
// frame (tongues and tips).
function lock(set, tongues, right, y, rim) {
  const box = [right - 6, y, 22, 76];
  const middle = y + 38;

  part(set, boxPoints(box));
  tongues.bars.push(`M${right - rim + 1} ${middle - 6}h${rim + 12}v12h${-(rim + 12)}Z`);
  tongues.tips.push(`M${right - rim + 1} ${middle - 6}h9v12h-9Z`);
  set.bolts.push([box[0] + 11, y + 10, 14, 0], [box[0] + 11, y + 66, 14, 0]);
}

// The rows of hex bolts along the rim, a pitch apart, and the seams that stand between two of them, three pitches apart. A bolt
// is on the middle of the rim.
function rowOf(first, length, pitch, rim, across, at) {
  const bolts = [];
  const marks = [];
  for (let step = pitch / 2; step < length; step += pitch) bolts.push(across ? [first + step, at + rim / 2] : [at + rim / 2, first + step]);
  for (let step = pitch * 3; step < length - pitch; step += pitch * 3) marks.push(first + step);
  return { bolts: bolts, marks: marks };
}

function seamPath(marks, rim, across, at, shift) {
  return marks.map(place => across ? `M${number(place + shift)} ${at}V${at + rim}` : `M${at} ${number(place + shift)}H${at + rim}`).join('');
}

// The foundry frame of a region. region is grid1, grid2, ticker or banner, box its sizes (core/theme-art.js), size the width and
// height the art is drawn for, and turned says that the top right and bottom left corners are the cut ones
export function foundryMarkup(region, box, size, turned) {
  const { width, height } = size;
  const thin = region === 'ticker' || region === 'banner';
  const rim = thin ? 14 : 22;
  const inset = rim / 2;
  const cut = box.cut;
  const pitch = thin ? 48 : 64;
  const outline = cutOutline(inset, inset, width - inset, height - inset, cut, turned);
  const inside = cutOutline(rim, rim, width - rim, height - rim, Math.max(cut - 10, 8), turned);
  const along = [inset + cut + 14, width - inset - cut - 14];
  const reach = Math.floor((along[1] - along[0]) / pitch) * pitch;
  const lip = thin ? 4 : 8;
  const outer = bevelOf(shifted(outline, lip));
  const inner = bevelOf(shifted(outline, -lip));
  const innerLit = bevelOf(inside);
  const rowSize = thin ? 11 : 17;

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
      <path class="fa-inset-dark" d="${innerLit.lit}"/>
      <path class="fa-inset-lit" d="${innerLit.dark}"/>`;

  if (box.header > 0) {
    const bottom = box.header;
    const left = rim;
    const tabTop = box.tab;
    const head = turned ?
      [[left, rim], [tabTop, rim], [tabTop - 34, bottom], [left, bottom]] :
      [[left, rim + cut - 10], [left + cut - 10, rim], [tabTop, rim], [tabTop - 34, bottom], [left, bottom]];
    svg += `
      <polygon class="fa-header" points="${list(head)}"/>
      <path class="fa-header-line" d="M${left} ${bottom}H${width - rim}"/>
      <path class="fa-header-lit" d="M${left} ${bottom - 5}H${width - rim}"/>
      <rect class="fa-accent" x="${tabTop + 20}" y="${bottom - 28}" width="${width - rim - tabTop - 48}" height="10"/>
      <rect class="fa-accent-hazard" x="${tabTop + 20}" y="${bottom - 14}" width="${width - rim - tabTop - 48}" height="6"/>`;
  }

  svg += `
      <polygon class="fa-rim-dark" points="${list(outline)}"/>
      <polygon class="fa-rim" points="${list(outline)}"/>
      <polygon class="fa-rim-brush" points="${list(outline)}"/>
      <path class="fa-lip-lit" d="${outer.lit}"/>
      <path class="fa-lip-dark" d="${outer.dark}${inner.lit}"/>
      <path class="fa-lip-lit fa-lip-low" d="${inner.dark}"/>`;

  // The seams between the armor plates and the rows of bolts: along the top and the bottom, and down the sides of the large frames
  const rows = { bolts: [], dark: '', lit: '' };
  const top = rowOf(along[0], reach, pitch, rim, true, 0);
  const bottom = rowOf(along[0], reach, pitch, rim, true, height - rim);
  rows.bolts.push(...top.bolts, ...bottom.bolts);
  rows.dark += seamPath(top.marks, rim, true, 0, 0) + seamPath(top.marks, rim, true, height - rim, 0);
  rows.lit += seamPath(top.marks, rim, true, 0, 2.5) + seamPath(top.marks, rim, true, height - rim, 2.5);
  if (!thin) {
    const start = inset + cut + 14;
    const run = Math.floor((height - 2 * start) / pitch) * pitch;
    const left = rowOf(start, run, pitch, rim, false, 0);
    const right = rowOf(start, run, pitch, rim, false, width - rim);
    rows.bolts.push(...left.bolts, ...right.bolts);
    rows.dark += seamPath(left.marks, rim, false, 0, 0) + seamPath(left.marks, rim, false, width - rim, 0);
    rows.lit += seamPath(left.marks, rim, false, 0, 2.5) + seamPath(left.marks, rim, false, width - rim, 2.5);
  }
  svg += `
      <path class="fa-seam" d="${rows.dark}"/>
      <path class="fa-seam-lit" d="${rows.lit}"/>
      ${boltsMarkup(rows.bolts.map(point => [point[0], point[1], rowSize, 0]))}`;

  // The square corners hold a bracket and the cut ones a gusset along the diagonal, the clamps stand across the rim at the seams,
  // and the large frames have hinges on the left and lock catches on the right
  const set = collector();
  const tongues = { bars: [], tips: [] };
  const arm = thin ? 44 : 78;
  const thick = thin ? 22 : 34;
  const corners = [[0, 0, 1, 1], [width, 0, -1, 1], [0, height, 1, -1], [width, height, -1, -1]];
  const cutAt = turned ? [[width, 0], [0, height]] : [[0, 0], [width, height]];
  corners.forEach(([cx, cy, sx, sy]) => {
    const isCut = cutAt.some(spot => spot[0] === cx && spot[1] === cy);
    if (isCut) gusset(set, cx, cy, sx, sy, cut + 6, thin ? 20 : 30);
    else bracket(set, cx, cy, sx, sy, arm, thick, thin ? 14 : 20);
  });
  top.marks.forEach((place, index) => clamp(set, place, index % 2 === 0 ? 0 : height - rim, rim));
  if (!thin) {
    const large = height > 500;
    (large ? [Math.round(height * 0.2), Math.round(height * 0.68)] : [Math.round(height * 0.22)]).forEach(spot => hinge(set, spot, 64, rim));
    lock(set, tongues, width, large ? Math.round(height * 0.62) : Math.round(height * 0.72), rim);
  }
  svg += `
      ${platesMarkup(set)}
      ${boltsMarkup(set.bolts)}`;
  if (tongues.bars.length > 0) svg += `
      <path class="fa-tongue" d="${tongues.bars.join('')}"/>
      <path class="fa-tongue-tip" d="${tongues.tips.join('')}"/>`;

  if (!thin) {
    // The hazard stripes along the foot and the caution plate, which is line art and has no letters
    const stripeX = turned ? along[0] + 160 : along[0] + 10;
    const stripeWidth = along[1] - along[0] - 230;
    const plateX = turned ? rim + cut + 20 : width - rim - cut - 150;
    svg += `
      <rect class="fa-hazard" x="${stripeX}" y="${height - rim - 2}" width="${stripeWidth}" height="10"/>
      <rect class="fa-hazard-line" x="${stripeX}" y="${height - rim - 2}" width="${stripeWidth}" height="10"/>
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
