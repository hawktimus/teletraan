// The Tasks panel built from plain plates, for comparing against the real
// dashboard on the TV. Same size, same place on the screen, same animation
// module. The difference is how it is made. The dashboard draws its frame as
// svg lines, five layers each. Here every plate is a plain box cut to shape
// with clip-path, every edge is a few more boxes, and nothing is a drawn line.
// The pieces move only by transform and opacity.
//
// Compare it with   dashboard/index.html?only=tasks
// Add ?perf for the readout, ?motion=calm or ?motion=none, ?stress for shorter holds.
//
// ?finish=metal (the default, as on the dashboard) gives every edge a shadow,
// a dark rim, a banded metal face and a bright ridge, as four boxes.
// ?finish=flat gives every edge one plain colour. ?metal=silver switches the
// metal from gold. Run both finishes for the same time and compare the numbers
// to see what the metal costs.

import * as frame from '../../dashboard/frame.js';
import { doubleSlash, statusMark } from '../../dashboard/core/marks.js';
import { escapeHtml } from '../../dashboard/core/text.js';

// How this panel arrives. Same format as the tables in frame.js. The
// comparison page registers its own because it is a throwaway test. A real
// panel does not need one: it only marks its slats.
frame.sequences.stack = {
  'body': ['unfold', 0],
  'header-left': ['latch-left', 150],
  'header-right': ['latch-right', 150],
  'edges': ['fade', 550],
  'bolt': ['pop', 1250, 50],
  'title': ['fade', 1000],
  'tag': ['fade', 1100],
  'row': ['fade', 1200, 120],
};

// The same groups as dashboard/panels/tasks, without blocked
const groups = [
  { status: 'in-progress', label: 'IN PROGRESS' },
  { status: 'up-next', label: 'UP NEXT' },
  { status: 'done', label: 'RECENTLY DONE' },
];

// The shapes of the large panel, the same points as in dashboard/core/plate.js
const bodyShape = [[4, 120], [1148, 120], [1148, 640], [1068, 704], [4, 704]];
const headerLeftShape = [[84, 4], [664, 4], [648, 52], [688, 52], [665.3, 120], [4, 120], [4, 68]];
const headerRightShape = [[664, 4], [1148, 4], [1148, 120], [665.3, 120], [688, 52], [648, 52]];

// The frame lines as pairs of points: the outline, the seam under the header,
// and the shape between the two header plates
const frameLines = [
  [[4, 704], [4, 68]],
  [[4, 68], [84, 4]],
  [[84, 4], [1148, 4]],
  [[1148, 4], [1148, 640]],
  [[1148, 640], [1068, 704]],
  [[1068, 704], [4, 704]],
  [[4, 120], [1148, 120]],
  [[664, 4], [648, 52]],
  [[648, 52], [688, 52]],
  [[688, 52], [665.3, 120]],
];
const boltCenters = [[4, 68], [84, 4], [1148, 640], [1068, 704]];

// The layers of an edge, back to front: how wide the band is and how far it is
// moved. The same widths and offsets as the dashboard's edge. The flat finish
// shows only the face.
const edgeLayers = [
  { name: 'shadow', width: 16, dx: 5, dy: 6 },
  { name: 'rim', width: 16, dx: 0, dy: 0 },
  { name: 'face', width: 12, dx: 0, dy: 0 },
  { name: 'ridge', width: 3, dx: -4, dy: -4 },
];

const params = new URLSearchParams(location.search);
const holdSeconds = params.has('stress') ? 3 : 12;

run();

async function run() {
  fitToScreen();
  window.addEventListener('resize', fitToScreen);
  document.documentElement.dataset.finish = params.get('finish') === 'flat' ? 'flat' : 'metal';
  document.documentElement.dataset.metal = params.get('metal') === 'silver' ? 'silver' : 'gold';
  frame.start({ motion: params.get('motion') || 'full', draw: 'stroke' });

  await Promise.all([
    document.fonts.load('700 96px "Tomorrow"'),
    document.fonts.load('600 44px "Tomorrow"'),
    document.fonts.load('500 56px "Atkinson Hyperlegible Next"'),
  ]);
  const content = await (await fetch('../../dashboard/data/sample/content.json')).json();

  if (params.has('perf')) {
    const perf = await import('../../dashboard/perf.js');
    perf.start();
  }

  const region = document.getElementById('region');
  while (true) {
    region.innerHTML = panelMarkup(content.tasks);
    const panel = region.firstElementChild;
    await frame.enter(panel);
    await frame.wait(holdSeconds * 1000);
    await frame.exit(panel);
    panel.remove();
  }
}


// Shapes made of boxes

function round(value) {
  return Math.round(value * 10) / 10;
}

// A div just big enough for the corners, cut to their shape. The points count
// from the panel's top left corner, and clip-path counts from the div's own.
function shapeBox(corners, className, attributes = '') {
  const xs = corners.map(point => point[0]);
  const ys = corners.map(point => point[1]);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const width = Math.ceil(Math.max(...xs) - left);
  const height = Math.ceil(Math.max(...ys) - top);
  const cut = corners.map(point => round(point[0] - left) + 'px ' + round(point[1] - top) + 'px').join(', ');

  return `<div class="${className}" ${attributes} style="left: ${round(left)}px; top: ${round(top)}px; width: ${width}px; height: ${height}px; clip-path: polygon(${cut});"></div>`;
}

// The four corners of a band that is width wide along the line from a to b,
// with square ends, moved by dx and dy
function bandCorners(a, b, width, dx, dy) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const along = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
  const across = [-along[1], along[0]];
  const half = width / 2;

  // each corner is an end (the start or the finish) and a side of the line
  const corners = [[a, -1, 1], [b, 1, 1], [b, 1, -1], [a, -1, -1]];
  return corners.map(corner => {
    const end = corner[0];
    const atEnd = corner[1];
    const side = corner[2];
    return [
      end[0] + along[0] * atEnd * half + across[0] * side * half + dx,
      end[1] + along[1] * atEnd * half + across[1] * side * half + dy,
    ];
  });
}

// Every frame line, one layer at a time, so every shadow is under every rim
function edgesMarkup() {
  const bands = edgeLayers.map(layer => frameLines
    .map(line => shapeBox(bandCorners(line[0], line[1], layer.width, layer.dx, layer.dy), 'edge edge-' + layer.name))
    .join('')
  ).join('');

  return `<div class="edges" data-part="edges">${bands}</div>`;
}

// A hexagon with a shadow copy, a rim, a metal face and a dark socket
function boltMarkup(center, index) {
  return `<div class="bolt" data-part="bolt" data-index="${index}" style="left: ${center[0] - 21}px; top: ${center[1] - 18}px;">
    <div class="bolt-shadow"></div><div class="bolt-rim"></div><div class="bolt-face"></div><div class="bolt-core"></div>
  </div>`;
}


// The panel

function panelMarkup(tasks) {
  const rows = groups.map((group, index) => rowMarkup(group, index, tasks, index === groups.length - 1)).join('');
  const bolts = boltCenters.map(boltMarkup).join('');

  return `
    <section class="panel stack" data-sequence="stack">
      ${shapeBox(bodyShape, 'fill fill-body', 'data-part="body"')}
      ${shapeBox(headerLeftShape, 'fill fill-header-left', 'data-part="header-left"')}
      ${shapeBox(headerRightShape, 'fill fill-header-right', 'data-part="header-right"')}
      ${edgesMarkup()}
      ${bolts}

      <div class="header">
        <h2 class="title" data-part="title">TASKS</h2>
        <div data-part="tag">${doubleSlash()}</div>
      </div>

      <div class="rows">${rows}</div>
    </section>`;
}

// Like the real Tasks panel: a mark, the group's name, and up to two tasks
// with their subteams. A thin metal bar under the row, except the last.
function rowMarkup(group, index, tasks, isLast) {
  const lines = tasks
    .filter(task => task.status === group.status)
    .slice(0, 2)
    .map(task => `<div class="task-line">
        <div class="task-title">${escapeHtml(task.title)}</div>
        <div class="subteam">${escapeHtml(task.subteam)}</div>
      </div>`)
    .join('');

  return `
    <div class="row status-${group.status}" data-part="row" data-index="${index}">
      ${isLast ? '' : '<div class="row-bar"></div>'}
      <div class="row-mark">${statusMark(group.status)}</div>
      <div class="row-text">
        <div class="row-label">${group.label}</div>
        ${lines}
      </div>
    </div>`;
}

// the same as fitToScreen in dashboard/shell.js
function fitToScreen() {
  const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
  document.getElementById('stage').style.transform = scale === 1 ? '' : 'scale(' + scale + ')';
}
