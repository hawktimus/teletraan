// Which shape a frame kind has, and the layers that draw it: edges, screws, glint and fills (part of plate.js).

import { grid1, grid2, halves, pathData, shapes, toPoints } from './plate-shapes.js';
import { barFrames, barOptions, decorMarkup, makeBarShape, tabMarkup } from './plate-bar.js';
import { rivetsMarkup, trimmedCountdown, trimmedFrame, wearMarkup, wearRadius } from './plate-trim.js';

// The frames a team's trim asks for are made from the Prime ones, the first time they are asked for. The name of
// one is the Prime name, then -tr for the top right and bottom left corners cut, then -slant for the tab with one
// slant: grid1-tr, grid1-slant, grid1-tr-slant, bar-main-minimal-tr
const trimmedShapes = {};

function parseKind(kind) {
  const found = /^(.*?)(-tr)?(-slant)?$/.exec(kind);
  return { base: found[1], corner: found[2] ? 'tr' : 'tl', notch: found[3] ? 'slant' : 'step' };
}

export function shapeFor(kind) {
  if (shapes[kind]) return shapes[kind];
  if (trimmedShapes[kind]) return trimmedShapes[kind];

  const asked = parseKind(kind);
  const prime = shapes[asked.base];
  if (!prime || asked.base === kind) return undefined;

  if (prime.bar) trimmedShapes[kind] = makeBarShape(Object.assign({}, barOptions[asked.base], { corner: asked.corner, slant: asked.notch === 'slant' }));
  else if (prime.headerLeft) trimmedShapes[kind] = trimmedFrame(prime, asked.corner, asked.notch);
  else trimmedShapes[kind] = asked.corner === 'tr' ? trimmedCountdown(prime) : prime;
  return trimmedShapes[kind];
}

// The name of a frame for a trim, { corner, notch }: corner is 'tr' for the top right and bottom left corners cut,
// and notch is 'slant' for the tab with one slant. Anything else is the Prime frame, whose name is the one
// it was given. A frame with no header has no tab to slant, and a name that is not a frame is given back
export function trimmedKind(kind, trim = {}) {
  const prime = shapes[kind];
  if (!prime) return kind;

  const corner = trim && trim.corner === 'tr' ? '-tr' : '';
  const notch = trim && trim.notch === 'slant' && (prime.tab || prime.headerLeft) ? '-slant' : '';
  return kind + corner + notch;
}

export function barShape(kind) {
  const shape = shapeFor(kind);
  return shape && shape.bar ? shape : null;
}

// The frame a region draws in a layout: the large panel, the ticker and the banner have the
// bar frames in the bar layout, and the ticker has no frame in the others (core/areas.js)
// unless the style is Cybertron, which has a frame for each region the standard layout
// has and the sidebar layout shares. shapes is the corners the style has (core/style.js,
// shapesFor): '', 'cybertron' or 'minimal'. trim is the team's, { corner, notch } (core/teams.js,
// frameTrim), and gives the name of the frame with the other corners cut or the slanted tab
const barKinds = { grid1: 'bar-main', ticker: 'bar-ticker', banner: 'bar-banner' };
const cybertronKinds = { grid1: 'cybertron-grid1', grid2: 'cybertron-grid2', ticker: 'cybertron-ticker', banner: 'cybertron-banner' };

function styleKind(region, layout, shapes) {
  if (layout !== 'bar') return shapes === 'cybertron' && cybertronKinds[region] ? cybertronKinds[region] : region;
  if (!barKinds[region]) return region;

  const own = barKinds[region] + '-' + shapes;
  return shapes && barFrames[own] ? own : barKinds[region];
}

export function frameKind(region, layout, shapes = '', trim = {}) {
  return trimmedKind(styleKind(region, layout, shapes), trim);
}

// How far a bar frame reaches from the corner of its box, in the units it is drawn
// in: the box itself, the bolts and the shadow of the edge round the outline, and the
// brackets. A frame has to be placed so that this stays on the screen.
export function frameExtent(kind) {
  const shape = shapeFor(kind);
  const reach = 19; // the bolt is the widest part, 19 from its centre
  const xs = shape.outline.map(point => point[0]);
  const ys = shape.outline.map(point => point[1]);
  const bracket = shape.bracketLines.reduce((all, line) => all.concat(line), []);
  const wear = (shape.wear || []).map(item => item.smudge);

  return {
    left: Math.min.apply(null, xs.map(x => x - reach).concat(bracket.map(point => point[0] - 2), wear.map(point => point[0] - wearRadius))),
    top: Math.min.apply(null, ys.map(y => y - reach).concat(bracket.map(point => point[1] - 2), wear.map(point => point[1] - wearRadius))),
    right: Math.max.apply(null, xs.map(x => x + reach).concat(bracket.map(point => point[0] + 2), wear.map(point => point[0] + wearRadius))),
    bottom: Math.max.apply(null, ys.map(y => y + reach).concat(bracket.map(point => point[1] + 2), wear.map(point => point[1] + wearRadius))),
  };
}


// Shapes drawn once

// A gradient takes its colours from the place it sits in the page, not from the
// shape that uses it. index.html draws the three edge gradients once, for gold
// (data-metal="gold" on each), and this makes the same three for silver, so the
// stops are only written once. tokens.css points each frame at the gradients of
// its own metal. shell.js calls it once, before anything is drawn.
export function makeSilverGradients() {
  document.querySelectorAll('linearGradient[data-metal="gold"]').forEach(gold => {
    const silverId = gold.id.replace('gold', 'silver');
    if (document.getElementById(silverId)) return;

    const silver = gold.cloneNode(true);
    silver.id = silverId;
    silver.setAttribute('data-metal', 'silver');
    gold.parentNode.appendChild(silver);
  });
}

// Adds a shape to the hidden defs unless it is already there, and gives its id back
export function define(id, markup) {
  if (!document.getElementById(id)) {
    document.getElementById('metal-shapes').insertAdjacentHTML('beforeend', markup);
  }
  return id;
}

// pathLength="1" makes a line count as length 1 however long it really is.
// frame.css relies on that to draw every line, and to run the glint, the
// same way. Square ends let the two halves of a frame meet in a clean corner.
export function defineFrame(kind, shape) {
  const half = halves(shape);

  define(kind + '-a', `<polyline id="${kind}-a" pathLength="1" stroke-linecap="square" points="${toPoints(half.a)}"/>`);
  define(kind + '-b', `<polyline id="${kind}-b" pathLength="1" stroke-linecap="square" points="${toPoints(half.b)}"/>`);
  if (!shape.bar) define(kind + '-outline', `<polygon id="${kind}-outline" pathLength="1" points="${toPoints(shape.outline)}"/>`); // the glint runs on it, and a bar frame has none
  if (shape.seams) {
    define(kind + '-seams', `<path id="${kind}-seams" pathLength="1" d="${pathData(shape.seams)}"/>`);
  }
  if (shape.neon) {
    define(kind + '-neon-a', `<polyline id="${kind}-neon-a" pathLength="1" stroke-linecap="square" points="${toPoints(shape.neon.a)}"/>`);
    define(kind + '-neon-b', `<polyline id="${kind}-neon-b" pathLength="1" stroke-linecap="square" points="${toPoints(shape.neon.b)}"/>`);
  }
}

// A closed shape with a flat fill and a metal edge round it, as an svg. The
// shape is drawn once, in the defs, and the edge points at it. A tag, the
// team plate and a card are all made this way.
export function edgedShape(id, points, fillClass, svgClass, width, height) {
  define(id, `<polygon id="${id}" points="${toPoints(points)}"/>`);

  return `<svg class="${svgClass}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <use class="${fillClass}" href="#${id}"/>
    ${edgeLayers(id)}
  </svg>`;
}

// A straight line of the given length, drawn once. A row bar points at it.
export function defineBar(length) {
  return define('bar-' + length, `<line id="bar-${length}" pathLength="1" x1="0" y1="0" x2="${length}" y2="0"/>`);
}


// The five layers of an edge, back to front, all pointing at one shape. When
// part is given they are wrapped in a group with that data-part, so frame.css
// draws the five together as one animation. No layer sets a dash pattern of
// its own, which is what lets the group's dash reach all of them. A frame
// that keeps its shadow in an svg of its own asks for just some of the layers.
// A bar frame adds its neon lines after the five, in the same group, so they
// are drawn with them (neonLayers, and the extra markup the group is given).
const shadowOnly = ['edge-shadow'];
const withoutShadow = ['edge-rim', 'edge-face', 'edge-shade', 'edge-ridge'];
export const allLayers = shadowOnly.concat(withoutShadow);

export function edgeLayers(id, part, names = allLayers, extra = '') {
  const layers = names
    .map(layer => `<use class="${layer}" href="#${id}"/>`)
    .join('') + extra;

  return part ? `<g data-part="${part}">${layers}</g>` : layers;
}

// The neon line, and the two wider and fainter ones behind it, all on one inset shape. The
// wider ones are hidden unless the team has Glow on (base.css)
const neonNames = ['edge-neon-wide-2', 'edge-neon-wide-1', 'edge-neon'];

export function neonLayers(id) {
  return neonNames.map(layer => `<use class="${layer}" href="#${id}"/>`).join('');
}

// A screw centred on a corner: its shadow, and the head. They arrive, unscrew
// and screw back in together. The two are separate shapes so a turning head
// never turns its shadow. --n is the screw's number, for the delay in frame.css.
// The bar frames have a hex bolt in place of each screw. It has no shadow of its own.
export function screwShadowMarkup(index, bolt) {
  if (bolt) return '';
  return `<use class="screw-shadow" data-part="stud" data-index="${index}" style="--n: ${index}" href="#screw-shadow-shape"/>`;
}

export function screwHeadMarkup(index, bolt) {
  return `<use class="screw" data-part="stud" data-index="${index}" style="--n: ${index}" href="#${bolt ? 'bolt-shape' : 'screw-shape'}"/>`;
}

function screwPair(center, index, bolt) {
  return `<g transform="translate(${center[0]} ${center[1]})">${screwShadowMarkup(index, bolt)}${screwHeadMarkup(index, bolt)}</g>`;
}

// One half of a frame: its five layers, then its screws. drawPart is the
// data-part that frame.js draws line by line.
function halfMarkup(kind, side, shape, red, drawPart, firstScrew) {
  const screws = shape.screws[side].map((center, index) => screwPair(center, firstScrew + index, shape.bar)).join('');
  const rivets = shape.rivets ? rivetsMarkup(shape.rivets[side], true) : '';
  const neon = shape.neon ? neonLayers(kind + '-neon-' + side) : '';
  const wear = side === 'b' ? wearMarkup(shape.wear, true) : '';

  return `<svg class="plate${red}" data-part="frame-${side}" width="${shape.width}" height="${shape.height}" viewBox="0 0 ${shape.width} ${shape.height}">
    ${edgeLayers(kind + '-' + side, drawPart, allLayers, neon)}
    ${rivets}
    ${wear}
    ${screws}
  </svg>`;
}

// The two halves of a frame, one after the other
export function frameHalves(kind, shape, red, drawPart) {
  return halfMarkup(kind, 'a', shape, red, drawPart, 0) +
    halfMarkup(kind, 'b', shape, red, drawPart, shape.screws.a.length);
}

// One svg of the frame of an area that stays on screen: the shadow of one
// half, or the bars and screw heads of one half. There are four in all. When
// the halves lift off, each shadow travels further than its bars, and that
// growing gap is what reads as depth. Because each of the four is a whole
// svg, the browser moves it as a picture and does not draw its lines again.
// The shadows come first, so both shadows are under both halves' bars.
//
// A bar frame that is still (the ticker) has other names for its four, so the page
// change does not lift it, and it has no shadow for its bolts, which have none.
function areaLayer(kind, shape, side, firstScrew, shadow) {
  const screws = shadow && shape.bar ? '' : shape.screws[side].map((center, index) => {
    const screw = shadow ? screwShadowMarkup(firstScrew + index) : screwHeadMarkup(firstScrew + index, shape.bar);
    return `<g transform="translate(${center[0]} ${center[1]})">${screw}</g>`;
  }).join('');
  const neon = !shadow && shape.neon ? neonLayers(kind + '-neon-' + side) : '';
  const layers = edgeLayers(kind + '-' + side, 'outline', shadow ? shadowOnly : withoutShadow, neon);
  const rivets = shadow || !shape.rivets ? '' : rivetsMarkup(shape.rivets[side], true);
  const wear = shadow || side !== 'b' ? '' : wearMarkup(shape.wear, true);
  const part = (shape.still ? 'still-' : '') + (shadow ? 'shadow-' : 'frame-') + side;

  return `<svg class="plate${shadow ? ' shadow-layer' : ''}" data-part="${part}" width="${shape.width}" height="${shape.height}" viewBox="0 0 ${shape.width} ${shape.height}">
    ${layers}
    ${rivets}
    ${wear}
    ${screws}
  </svg>`;
}

export function areaHalves(kind, shape) {
  const firstInB = shape.screws.a.length;

  return areaLayer(kind, shape, 'a', 0, true) +
    areaLayer(kind, shape, 'b', firstInB, true) +
    areaLayer(kind, shape, 'a', 0, false) +
    areaLayer(kind, shape, 'b', firstInB, false);
}

// The bright dash that runs round a frame now and then. It is in an svg of
// its own, so while it moves nothing else on the panel is redrawn.
export function glintMarkup(kind, shape, red) {
  return `<svg class="plate glint-layer${red}" width="${shape.width}" height="${shape.height}" viewBox="0 0 ${shape.width} ${shape.height}">
    <use class="glint" href="#${kind}-outline" style="--glint-delay: ${shape.glintDelay}s"/>
  </svg>`;
}

// The fills of a plate and its seams, in one svg. They stay where they are
// when the frame's halves lift.
export function fillsMarkup(kind, shape, red) {
  let svg = `<svg class="plate fills${red}" width="${shape.width}" height="${shape.height}" viewBox="0 0 ${shape.width} ${shape.height}">`;
  svg += `<polygon class="body" data-part="body" points="${toPoints(shape.body)}"/>`;

  if (shape.headerLeft) {
    svg += `<polygon class="header-left" data-part="header-left" points="${toPoints(shape.headerLeft)}"/>`;
    svg += `<polygon class="header-right" data-part="header-right" points="${toPoints(shape.headerRight)}"/>`;
  }
  if (shape.seams) svg += edgeLayers(kind + '-seams', 'seam');
  return svg + '</svg>';
}


// The fills of a bar frame, in one svg like the other frames': the body, and for the
// main panel the header with its tab, then the decoration. The decoration is one group
// with its own part, so it comes in after the lines are drawn (frame.css and
// frame.js). The tab is a group of its own with its details, so they slide in with it.
export function barFillsMarkup(shape) {
  let svg = `<svg class="plate fills" width="${shape.width}" height="${shape.height}" viewBox="0 0 ${shape.width} ${shape.height}">`;
  svg += `<polygon class="body" data-part="body" points="${toPoints(shape.body)}"/>`;

  if (shape.tab) {
    svg += `<g data-part="header-left"><polygon class="header-left" points="${toPoints(shape.headerLeft)}"/>${tabMarkup(shape)}</g>`;
    svg += `<polygon class="header-right" data-part="header-right" points="${toPoints(shape.headerRight)}"/>`;
  }
  const decor = decorMarkup(shape);
  return svg + (decor ? `<g data-part="decor">${decor}</g>` : '') + '</svg>';
}
