// Builds the SVG behind each panel: a steel body, a header with a purple
// tab, a bevelled frame, brass seams and bolts. Measurements are pixels on
// the 1920x1080 screen. The frame sits 4px inside the edge so its 8px
// stroke fills the edge exactly.
//
// Colours and gradients are not set here. base.css gives each class its
// fill from tokens.css, and the gradients are drawn once in index.html.
// A panel that wants another colour sets --panel-face, --panel-frame or
// --bolt-fill on itself. See "The metal look" in docs/adding-a-panel.md.
//
// Every piece is labelled with data-part so frame.js can move it.
// The panel sizes here are repeated in base.css and in each panel's own
// stylesheet. Change them together.

// the large panel on the left (1152 x 708)
const grid1 = {
  width: 1152,
  height: 708,
  body: [[4, 120], [1148, 120], [1148, 640], [1068, 704], [4, 704]],
  headerLeft: [[84, 4], [664, 4], [648, 52], [688, 52], [665.3, 120], [4, 120], [4, 68]],
  headerRight: [[664, 4], [1148, 4], [1148, 120], [665.3, 120], [688, 52], [648, 52]],
  outline: [[4, 68], [84, 4], [1148, 4], [1148, 640], [1068, 704], [4, 704]],
  // the bolt shape between the two header plates, and the line under the header
  seams: [
    [[664, 4], [648, 52], [688, 52], [665.3, 120]],
    [[8, 120], [1144, 120]],
  ],
  // bolts on the ends of the cut corners and where the header plates meet
  studs: [[84, 4], [4, 68], [1148, 640], [1068, 704], [664, 4]],
  // slots in the header strip. The header text of some panels runs in from
  // the right, so they stay close to the tab.
  vents: { x: 728, y: 38, height: 46, count: 4 },
};

// the small panel under the countdown (656 x 372)
const grid2 = {
  width: 656,
  height: 372,
  body: [[4, 84], [652, 84], [652, 320], [592, 368], [4, 368]],
  headerLeft: [[64, 4], [480, 4], [453.3, 84], [4, 84], [4, 52]],
  headerRight: [[480, 4], [652, 4], [652, 84], [453.3, 84]],
  outline: [[4, 52], [64, 4], [652, 4], [652, 320], [592, 368], [4, 368]],
  seams: [
    [[8, 84], [648, 84]],
    [[480, 4], [453.3, 84]],
  ],
  studs: [[64, 4], [4, 52], [652, 320], [592, 368], [480, 4]],
  vents: { x: 508, y: 26, height: 34, count: 3 },
};

// the countdown (656 x 320). It has no header, and its top edge is cut
// into 24 teeth like a jaw.
const countdown = (function () {
  const teeth = [];
  const toothWidth = (652 - 64) / 24;
  for (let i = 0; i < 24; i++) {
    teeth.push([64 + i * toothWidth, 4]);
    teeth.push([64 + i * toothWidth + toothWidth / 2, 16]);
  }
  const outline = [[4, 52]].concat(teeth, [[652, 4], [652, 268], [592, 316], [4, 316]]);

  return {
    width: 656,
    height: 320,
    body: outline,
    outline: outline,
    seams: [],
    studs: [[64, 4], [4, 52], [652, 268], [592, 316]],
  };
})();

const shapes = { grid1: grid1, grid2: grid2, countdown: countdown };

// the frame of the full screen alert and announcement
const screenFrame = {
  outline: [[64, 120], [120, 72], [1856, 72], [1856, 960], [1800, 1008], [64, 1008]],
  studs: [[64, 120], [120, 72], [1856, 72], [1856, 960], [1800, 1008], [64, 1008]],
};

// [[1, 2], [3, 4]] becomes "1,2 3,4", which is how SVG wants a list of points
function toPoints(list) {
  return list.map(point => point.join(',')).join(' ');
}

function moved(list, dx, dy) {
  return list.map(point => [point[0] + dx, point[1] + dy]);
}

// Moves every edge of a polygon inwards and returns the new corners. The
// corners must run clockwise on the screen, as the ones above do.
function inset(points, distance) {
  const lines = points.map((from, index) => {
    const to = points[(index + 1) % points.length];
    const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const dx = (to[0] - from[0]) / length;
    const dy = (to[1] - from[1]) / length;
    // (-dy, dx) points to the inside of a clockwise polygon
    return { x: from[0] - dy * distance, y: from[1] + dx * distance, dx: dx, dy: dy };
  });

  // each new corner is where an edge meets the edge before it
  return lines.map((line, index) => {
    const before = lines[(index + lines.length - 1) % lines.length];
    const turn = before.dx * line.dy - before.dy * line.dx;
    const along = ((line.x - before.x) * line.dy - (line.y - before.y) * line.dx) / turn;
    return [before.x + before.dx * along, before.y + before.dy * along];
  });
}

// pathLength="1" makes a line count as length 1 however long it really is.
// frame.css relies on that to draw every line the same way.
function drawnPolygon(className, part, points) {
  return `<polygon class="${className}" data-part="${part}" pathLength="1" points="${toPoints(points)}"/>`;
}

// A steel (or purple) piece: its colour, with the brushed streaks on top.
// The streaks are their own shape so the colour can stay a plain gradient.
function metalPiece(className, part, points, extra = '') {
  return `<g data-part="${part}">
    <polygon class="${className}" points="${toPoints(points)}"/>
    <polygon class="brush" points="${toPoints(points)}"/>
    ${extra}
  </g>`;
}

// A row of slanted slots. Each has a light copy 2px below it, so it looks cut in.
function vents(spec) {
  let markup = '';
  for (let i = 0; i < spec.count; i++) {
    const x = spec.x + i * 22;
    const slot = [[x + 16, spec.y], [x + 26, spec.y], [x + 10, spec.y + spec.height], [x, spec.y + spec.height]];
    markup += `<polygon class="vent-lit" points="${toPoints(moved(slot, 2, 2))}"/>`;
    markup += `<polygon class="vent" points="${toPoints(slot)}"/>`;
  }
  return markup;
}

// A hex bolt centred on x, y, size pixels wide. The bolt itself is drawn once
// in index.html. For a brass one, pass the class name 'brass'.
export function boltMarkup(x, y, size = 32, className = '') {
  const half = size / 2;
  const brass = className ? ` class="${className}"` : '';
  return `<use href="#bolt"${brass} x="${x - half}" y="${y - half}" width="${size}" height="${size}"/>`;
}

// The outer group puts the bolt in place and the inner group is what turns
// in, so the turn does not fight with the position.
function bolt(center, index) {
  return `<g transform="translate(${center[0]} ${center[1]})">
    <g data-part="stud" data-index="${index}">${boltMarkup(0, 0)}</g>
  </g>`;
}

// The bevelled frame: a bright steel line, and a thin line just inside it
// that is lit at the top and dark at the bottom.
function frameLines(outline, part) {
  return drawnPolygon('outline', part, outline) + drawnPolygon('bevel', part, inset(outline, 5));
}

// kind is 'grid1', 'grid2' or 'countdown'.
// options.dividers is a list of heights for thin lines across the body.
export function plateMarkup(kind, options = {}) {
  const shape = shapes[kind];
  let svg = `<svg class="plate" width="${shape.width}" height="${shape.height}" viewBox="0 0 ${shape.width} ${shape.height}">`;

  svg += metalPiece('body', 'body', shape.body);

  if (shape.headerLeft) {
    svg += metalPiece('header-left', 'header-left', shape.headerLeft);
    svg += metalPiece('header-right', 'header-right', shape.headerRight, vents(shape.vents));
  }

  svg += frameLines(shape.outline, 'outline');
  if (shape.headerLeft) svg += drawnPolygon('well', 'outline', inset(shape.body, 10));

  // a seam is a rod of brass: dark underneath, then the brass, then a bright
  // line along its upper side
  shape.seams.forEach(points => {
    svg += `<polyline class="seam" data-part="seam" pathLength="1" points="${toPoints(points)}"/>`;
    svg += `<polyline class="seam-body" data-part="seam" pathLength="1" points="${toPoints(moved(points, -1, -1))}"/>`;
    svg += `<polyline class="seam-lit" data-part="seam" pathLength="1" points="${toPoints(moved(points, -2, -2))}"/>`;
  });

  // a divider is a dark groove with a light line along its lower side
  (options.dividers || []).forEach((y, index) => {
    svg += `<line class="divider" data-part="divider" data-index="${index}" pathLength="1" x1="8" y1="${y}" x2="1144" y2="${y}"/>`;
    svg += `<line class="divider-lit" data-part="divider" data-index="${index}" pathLength="1" x1="8" y1="${y + 3}" x2="1144" y2="${y + 3}"/>`;
  });

  shape.studs.forEach((center, index) => {
    svg += bolt(center, index);
  });

  return svg + '</svg>';
}

// The frame behind the full screen alert and announcement. It is a plate with
// the same parts as the others, so a panel colours it the same way.
export function frameMarkup() {
  const points = toPoints(screenFrame.outline);
  let svg = '<svg class="plate" width="1920" height="1080" viewBox="0 0 1920 1080">';

  svg += `<polygon class="body" points="${points}"/>`;
  svg += `<polygon class="brush" points="${points}"/>`;
  svg += frameLines(screenFrame.outline, 'frame');
  screenFrame.studs.forEach((center, index) => {
    svg += bolt(center, index);
  });

  return svg + '</svg>';
}

// A bar of light that sweeps across the panel once while it assembles.
// It is cut to the panel's outline so it never shows outside the plate.
export function scanMarkup(kind) {
  const shape = shapes[kind];
  const clip = shape.outline.map(point => point[0] + 'px ' + point[1] + 'px').join(', ');

  return `<div class="scan-clip" style="width: ${shape.width}px; height: ${shape.height}px; clip-path: polygon(${clip});">
    <div class="scan" data-part="scan" style="height: ${shape.height}px; --sweep: ${shape.width}px;"></div>
  </div>`;
}

// The slanted label at the left end of the ticker. A longer word needs a
// wider tag, so the width is passed in.
export function tagMarkup(width = 208) {
  const right = width - 4;
  const points = `25.3,4 ${right - 21.3},4 ${right},68 4,68`;

  return `<svg class="tag-plate" width="${width}" height="72" viewBox="0 0 ${width} 72">
    <polygon points="${points}"/>
    <polyline class="tag-lit" points="30,11 ${right - 25},11"/>
  </svg>`;
}
