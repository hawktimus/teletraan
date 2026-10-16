// The outlines of the frames and the rivets along them (part of plate.js).

// Where the colored tab of the large frame's header ends along the top edge. The tab is where a title stands,
// so this is what a title has room for (core/header-room.js has the rooms and tests/title-plate.test.mjs
// holds them to the shapes). The notch of Original reaches 16 left of it and 24 right of it, and the steel
// frames end the tab in a line that leans 22 to the left over the header. slantTop is where a tab with one
// slant of 60 degrees starts: it leans 55 to the left by the foot of the capitals of a title (y = 100), so
// it starts that much further right to be at the left end of the notch there.
export const tabTop = 772;
const slantTop = 811;

// The header of the large frames of the steel styles and of the bar layout: 120 high, the tab ending in a line
// that leans 22 to the left
export const largeHeader = { bottom: 120, tabTop: tabTop, tabBottom: tabTop - 22, slantTop: slantTop };

// the large panel on the left (1152 x 708)
export const grid1 = {
  width: 1152,
  height: 708,
  body: [[4, 120], [1148, 120], [1148, 640], [1068, 704], [4, 704]],
  headerLeft: [[84, 4], [tabTop, 4], [tabTop - 16, 52], [tabTop + 24, 52], [tabTop + 1.3, 120], [4, 120], [4, 68]],
  headerRight: [[tabTop, 4], [1148, 4], [1148, 120], [tabTop + 1.3, 120], [tabTop + 24, 52], [tabTop - 16, 52]],
  slantTop: slantTop,
  // The frame, clockwise from the bottom left. The halves meet at point
  // number split (counting from 0) and at the first point.
  outline: [[4, 704], [4, 68], [84, 4], [1148, 4], [1148, 640], [1068, 704]],
  split: 3,
  // the line under the header, and the notch shape between the two header plates
  seams: [
    [[4, 120], [1148, 120]],
    [[tabTop, 4], [tabTop - 16, 52], [tabTop + 24, 52], [tabTop + 1.3, 120]],
  ],
  // screws on the ends of the cut corners, shared out between the halves
  screws: { a: [[4, 68], [84, 4]], b: [[1148, 640], [1068, 704]] },
  glintDelay: 2, // seconds after the panel has arrived
};

// the small panel under the countdown (656 x 372)
export const grid2 = {
  width: 656,
  height: 372,
  body: [[4, 84], [652, 84], [652, 320], [592, 368], [4, 368]],
  headerLeft: [[64, 4], [480, 4], [453.3, 84], [4, 84], [4, 52]],
  headerRight: [[480, 4], [652, 4], [652, 84], [453.3, 84]],
  outline: [[4, 368], [4, 52], [64, 4], [652, 4], [652, 320], [592, 368]],
  split: 3,
  seams: [
    [[4, 84], [652, 84]],
    [[480, 4], [453.3, 84]],
  ],
  screws: { a: [[4, 52], [64, 4]], b: [[652, 320], [592, 368]] },
  glintDelay: 8,
};

// The pieces a large or small frame breaks into for the mechanical page
// change, listed from the back to the front. Together they are the whole
// frame: the plates, the two lines under the header, and the edge cut into
// bars. A piece is one of
//   points + fill   a plate: the polygon, and which fill class paints it
//   line            a bar of the frame: the line it follows, drawn as an edge
// A bar may also have screws: 'a' or 'b', the screws of that half of the frame.
// Bars end in a straight run, on a whole number, so neighbours meet exactly
// and the rebuilt frame looks like the one at rest. The name is what frame.css
// moves it by (data-piece), so grid1 and grid2 share their names.
grid1.pieces = [
  { name: 'plate-header-left', fill: 'header-left', points: grid1.headerLeft },
  { name: 'plate-header-right', fill: 'header-right', points: grid1.headerRight },
  { name: 'plate-body-left', fill: 'body', points: [[4, 120], [576, 120], [576, 704], [4, 704]] },
  { name: 'plate-body-right', fill: 'body', points: [[576, 120], [1148, 120], [1148, 640], [1068, 704], [576, 704]] },
  { name: 'seam-line', line: [[4, 120], [1148, 120]] },
  { name: 'seam-notch', line: grid1.seams[1] },
  { name: 'edge-top-left', line: [[230, 4], [tabTop, 4]] },
  { name: 'edge-top-right', line: [[tabTop, 4], [1148, 4], [1148, 170]] },
  { name: 'edge-right', line: [[1148, 170], [1148, 520]] },
  { name: 'edge-bottom', line: [[480, 704], [930, 704]] },
  { name: 'edge-bottom-left', line: [[4, 230], [4, 704], [480, 704]] },
  { name: 'corner-top-left', line: [[4, 230], [4, 68], [84, 4], [230, 4]], screws: 'a' },
  { name: 'corner-bottom-right', line: [[1148, 520], [1148, 640], [1068, 704], [930, 704]], screws: 'b' },
];

grid2.pieces = [
  { name: 'plate-header-left', fill: 'header-left', points: grid2.headerLeft },
  { name: 'plate-header-right', fill: 'header-right', points: grid2.headerRight },
  { name: 'plate-body', fill: 'body', points: grid2.body },
  { name: 'seam-line', line: [[4, 84], [652, 84]] },
  { name: 'seam-notch', line: grid2.seams[1] },
  { name: 'edge-top-left', line: [[160, 4], [480, 4]] },
  { name: 'edge-top-right', line: [[480, 4], [652, 4], [652, 100]] },
  { name: 'edge-right', line: [[652, 100], [652, 240]] },
  { name: 'edge-bottom', line: [[260, 368], [500, 368]] },
  { name: 'edge-bottom-left', line: [[4, 140], [4, 368], [260, 368]] },
  { name: 'corner-top-left', line: [[4, 140], [4, 52], [64, 4], [160, 4]], screws: 'a' },
  { name: 'corner-bottom-right', line: [[652, 240], [652, 320], [592, 368], [500, 368]], screws: 'b' },
];

// the countdown (656 x 320). It has no header, its frame is red, and its
// top edge is cut into teeth like a jaw. The first tooth starts clear of the
// screw, which covers the top edge up to about x = 88.
const countdown = (function () {
  const top = [[64, 4]];
  for (let x = 100; x < 628; x += 24) {
    top.push([x, 4], [x + 12, 14]);
  }
  top.push([628, 4], [652, 4]);

  const outline = [[4, 316], [4, 52]].concat(top, [[652, 268], [592, 316]]);
  const split = outline.length - 3; // the top right corner, (652, 4)

  return {
    width: 656,
    height: 320,
    red: true,
    // the plate is flat along the top. The teeth are only in the frame.
    body: [[64, 4], [652, 4], [652, 268], [592, 316], [4, 316], [4, 52]],
    outline: outline,
    split: split,
    screws: { a: [[64, 4]], b: [[592, 316]] },
    glintDelay: 5,
  };
})();

export const shapes = { grid1: grid1, grid2: grid2, countdown: countdown };

// the frame of the full screen alert and announcement
export const screenFrame = {
  width: 1920,
  height: 1080,
  outline: [[64, 1008], [64, 120], [120, 72], [1856, 72], [1856, 960], [1800, 1008]],
  split: 3,
  screws: { a: [[64, 120], [120, 72]], b: [[1856, 960], [1800, 1008]] },
};

// [[1, 2], [3, 4]] becomes "1,2 3,4", which is how SVG wants a list of points
export function toPoints(list) {
  return list.map(point => point.join(',')).join(' ');
}

// A list of lines becomes one path: "M4 120L1148 120M664 4L648 52"
export function pathData(lines) {
  return lines.map(points => 'M' + points.map(point => point.join(' ')).join('L')).join('');
}

// The two halves of an outline, each as a list of points
export function halves(shape) {
  return {
    a: shape.outline.slice(0, shape.split + 1),
    b: shape.outline.slice(shape.split).concat([shape.outline[0]]),
  };
}


// Rivets

// A long straight edge carries a row of rivets, one every 90px, the row centred on
// the edge. An edge under 180px has none, which leaves out the cut corners, where
// the screws are, and the teeth of the countdown. A rivet is a dot of radius 5.
const rivetGap = 90;
export const rivetRadius = 5;
const rivetEdgeLeast = 2 * rivetGap;

export function tenth(number) {
  return Math.round(number * 10) / 10;
}

// The centres of the rivets along the edge from one point to another
export function rivetsAlong(from, to) {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  if (length < rivetEdgeLeast) return [];

  const count = Math.floor(length / rivetGap);
  const margin = (length - (count - 1) * rivetGap) / 2;

  return Array.from({ length: count }, (item, index) => {
    const along = (margin + index * rivetGap) / length;
    return [tenth(from[0] + (to[0] - from[0]) * along), tenth(from[1] + (to[1] - from[1]) * along)];
  });
}

// The rivets along every edge of a line that goes through the points
export function rivetsOf(points) {
  return points.slice(1).reduce((all, point, index) => all.concat(rivetsAlong(points[index], point)), []);
}

// Each half of a frame carries the rivets of its own edges, so they lift with it
export function giveRivets(shape) {
  const half = halves(shape);
  shape.rivets = { a: rivetsOf(half.a), b: rivetsOf(half.b) };
}

[grid1, grid2, countdown].forEach(giveRivets);


// The frames of a team's trim

// One slant of 60 degrees in place of the line that ends a header tab. The line is a list of points from the
// top of the header down. The slant starts where the line starts, or at x when a frame says so, and leans the way
// the tabs of the bar frames do
export const slantDegrees = 60;

export function slantOf(line, x = line[0][0]) {
  const top = [x, line[0][1]];
  const bottom = line[line.length - 1];
  return [top, [tenth(top[0] - (bottom[1] - top[1]) / Math.tan(slantDegrees * Math.PI / 180)), bottom[1]]];
}

// The lines of a Prime frame, and how far its cut corners reach along each edge. The outline of these frames
// starts at the foot of the bottom left corner, has the cut corner at the top left in its second and third points,
// and has the top right corner, which is square, third from the end
export function boxOf(prime) {
  const corner = prime.outline[prime.outline.length - 3];

  return {
    left: prime.outline[0][0],
    bottom: prime.outline[0][1],
    top: corner[1],
    right: corner[0],
    cutX: prime.outline[2][0] - prime.outline[0][0],
    cutY: prime.outline[1][1] - corner[1],
  };
}

// The outline of a frame with the top right and bottom left corners cut, clockwise from the foot of the bottom left
// cut, and the screws on the ends of the two cuts, the way the Prime frames have them
export function otherCorners(box) {
  const { left, top, right, bottom, cutX, cutY } = box;

  return {
    outline: [[left + cutX, bottom], [left, bottom - cutY], [left, top], [right - cutX, top], [right, top + cutY], [right, bottom]],
    split: 3,
    screws: { a: [[left + cutX, bottom], [left, bottom - cutY]], b: [[right - cutX, top], [right, top + cutY]] },
  };
}
