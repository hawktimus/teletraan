// The seasonal packs: the decorations that go with a holiday overlay.
//
// An overlay (themes/overlays/) is a few accent colours. A pack is the
// decorations that go with it: a scene along the bottom edge of the screen and
// small pieces in the empty places. A pack is plain data in seasons/<id>.js, and
// docs/seasonal-packs.md explains it. This file reads that data and draws it in
// two layers:
//
//   #season-back    behind the stage, as big as the screen. Its pieces drift
//                   behind the panels and show in the gaps between them.
//   #season-front   above the stage. It is made of ZONES: fixed rectangles that
//                   hold no text and clip what is inside them, so a piece can
//                   never cross a word, the logo, the clock or a panel.
//
// Both layers let every click through, and both sit under everything that takes
// over the screen: the hidden transitions, the night screen, an alert, an
// announcement and the demo. With no pack on, neither layer exists.
//
// Nothing here moves. A piece names a motion and seasons/motion.css plays it,
// and only in full motion: in calm and none motion every piece rests.
//
// The functions that decide and draw markup have no page in sight, so
// tools/test-seasons.mjs can run them. tools/check-seasons.mjs uses the same
// functions to check every pack.

import { overlays } from '../themes/overlays/registry.js';

// The zones. Every one is a rectangle of the 1920 x 1080 screen with nothing in
// it: no text, no frame and no screw. They were measured on the full sample
// board, and each sits at least 2 px clear of the nearest ink. If you change a
// panel size or a margin (base.css, plate.js), measure them again
// (docs/seasonal-packs.md, "How the zones were measured").
export const zones = {
  'top':      { x: 0,    y: 0,    width: 1920, height: 26 },  // the strip above the banner, whose first text starts at y 28
  'ground':   { x: 0,    y: 1058, width: 1920, height: 22 },  // the strip under the ticker, where the scene goes. Left of x 270 the ticker tag's edge reaches y 1066, so keep that part low
  'left':     { x: 0,    y: 360,  width: 30,   height: 696 },  // the margin left of the large panel, below its top left screw
  'right':    { x: 1890, y: 30,   width: 30,   height: 846 },  // the margin right of the countdown and the small panel, above the bottom right screw
  'gutter':   { x: 1198, y: 278,  width: 20,   height: 342 },  // the gap between the large panel and the countdown, above the small panel's screw
  'string-a': { x: 244,  y: 970,  width: 836,  height: 14 },   // the gap between the large panel and the ticker, left of its screw
  'string-b': { x: 1134, y: 970,  width: 654,  height: 14 },   // the same gap, between the two screws
  'corner-a': { x: 0,    y: 240,  width: 96,   height: 28 },   // the cut corner at the top left of the large panel
  'corner-b': { x: 1198, y: 238,  width: 52,   height: 34 },   // the cut corner at the top left of the countdown
};

// The scene is drawn in this zone, stretched to fill it
export const sceneZone = 'ground';

// The motions a piece may name. seasons/motion.css has the keyframes of each,
// and tools/check-seasons.mjs fails if the two lists differ.
export const motions = ['fall', 'sway', 'drift', 'rise', 'twinkle', 'bob', 'spin', 'pulse', 'draw', 'sweep', 'slide'];

// A pack may have at most this many pieces that move, and this many in all.
// The screen is shown by an old Mac Mini, and every moving piece costs it a little.
export const mostMovingPieces = 24;
export const mostPieces = 60;

const screen = { width: 1920, height: 1080 };
const pieceKeys = ['shape', 'x', 'y', 'size', 'zone', 'motion', 'seconds', 'delay', 'travel', 'opacity'];
const packKeys = ['shapes', 'scene', 'back', 'front'];
const nameShape = /^[a-z][a-z0-9-]*$/;

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNumber(value) {
  return typeof value === 'number' && isFinite(value);
}

// Decorations

// True when the overlay has a pack: its entry in the registry says so
export function hasDecorations(overlayId) {
  return overlays.some(overlay => overlay.id === overlayId && overlay.decorations === true);
}

// '0 0 480 26' gives { x: 0, y: 0, width: 480, height: 26 }, or null when the text is not a view box
export function readViewBox(text) {
  const parts = typeof text === 'string' ? text.trim().split(/\s+/).map(Number) : [];
  if (parts.length !== 4 || parts.some(part => !isFinite(part)) || parts[2] <= 0 || parts[3] <= 0) return null;
  return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
}

function round(number) {
  return Math.round(number * 100) / 100;
}

// The box a piece fills when it rests: its x and y, its size across, and the
// height that keeps the shape's proportions. null when the shape is unusable.
export function pieceBox(piece, shapes) {
  const shape = isRecord(shapes) && isRecord(shapes[piece.shape]) ? shapes[piece.shape] : null;
  const box = shape ? readViewBox(shape.viewBox) : null;
  if (!box || !isNumber(piece.size) || piece.size <= 0) return null;
  return { x: piece.x, y: piece.y, width: piece.size, height: round(piece.size * box.height / box.width) };
}

// What is wrong with one piece, in plain words. layer is 'back' or 'front'.
// An empty list means the piece can be drawn.
export function pieceProblems(piece, layer, shapes) {
  if (!isRecord(piece)) return ['is not a piece: it should be { shape, x, y, size ... }'];

  const problems = [];
  Object.keys(piece).filter(key => pieceKeys.indexOf(key) === -1)
    .forEach(key => problems.push('has "' + key + '", which a piece does not use. The names are ' + pieceKeys.join(', ')));

  if (!isRecord(shapes) || !isRecord(shapes[piece.shape])) problems.push('uses the shape "' + piece.shape + '", which is not listed in shapes');
  ['x', 'y', 'size'].filter(key => !isNumber(piece[key])).forEach(key => problems.push(key + ' should be a number'));
  if (isNumber(piece.size) && piece.size <= 0) problems.push('size should be more than 0');

  if (layer === 'front') {
    if (!zones[piece.zone]) problems.push('is in the zone "' + piece.zone + '", which is not in the zone list in core/season.js. The zones are ' + Object.keys(zones).join(', '));
  } else if (piece.zone !== undefined) {
    problems.push('is a back piece, so it has no zone: its x and y are screen pixels');
  }

  if (piece.motion !== undefined) {
    if (motions.indexOf(piece.motion) === -1) problems.push('has the motion "' + piece.motion + '", which is not one of: ' + motions.join(', '));
    if (!isNumber(piece.seconds) || piece.seconds < 1 || piece.seconds > 600) problems.push('a piece that moves needs seconds, from 1 to 600');
  } else if (piece.seconds !== undefined || piece.delay !== undefined || piece.travel !== undefined) {
    problems.push('has seconds, delay or travel but no motion');
  }
  if (piece.delay !== undefined && (!isNumber(piece.delay) || piece.delay < -600 || piece.delay > 600)) problems.push('delay should be a number of seconds from -600 to 600');
  if (piece.travel !== undefined && (!isNumber(piece.travel) || piece.travel <= 0)) problems.push('travel should be a number of pixels above 0');
  if (piece.opacity !== undefined && (!isNumber(piece.opacity) || piece.opacity < 0 || piece.opacity > 1)) problems.push('opacity should be a number from 0 to 1');

  // At rest it must be inside its zone, or on the screen for a back piece
  if (problems.length === 0) {
    const box = pieceBox(piece, shapes);
    const room = layer === 'front' ? zones[piece.zone] : screen;
    if (!box) {
      problems.push('uses a shape whose viewBox is not four numbers such as "0 0 24 24"');
    } else if (box.x < 0 || box.y < 0 || box.x + box.width > room.width + 0.001 || box.y + box.height > room.height + 0.001) {
      problems.push('does not fit at rest: it covers x ' + box.x + ' to ' + round(box.x + box.width) + ' and y ' + box.y + ' to ' + round(box.y + box.height) + ', and ' + (layer === 'front' ? 'the zone "' + piece.zone + '"' : 'the screen') + ' is ' + room.width + ' by ' + room.height);
    }
  }
  return problems;
}

function shapeProblems(name, shape) {
  if (!nameShape.test(name)) return ['the shape name "' + name + '" should be lowercase letters, digits and dashes, starting with a letter'];
  if (!isRecord(shape)) return ['the shape "' + name + '" should be { viewBox, markup }'];

  const problems = [];
  if (!readViewBox(shape.viewBox)) problems.push('the shape "' + name + '" has a viewBox that is not four numbers such as "0 0 24 24"');
  if (typeof shape.markup !== 'string' || shape.markup.trim() === '') problems.push('the shape "' + name + '" has no markup');
  return problems;
}

// Everything wrong with a pack, in plain words, each line saying where. An
// empty list means it can be drawn. A pack with no pieces and no scene is fine:
// it is how a new pack starts.
export function packProblems(pack) {
  if (!isRecord(pack)) return ['the pack should be an object: { shapes, scene, back, front }'];

  const problems = [];
  Object.keys(pack).filter(key => packKeys.indexOf(key) === -1)
    .forEach(key => problems.push('the pack has "' + key + '", which it does not use. The names are ' + packKeys.join(', ')));

  const shapes = pack.shapes === undefined ? {} : pack.shapes;
  if (!isRecord(shapes)) problems.push('shapes should be an object of named shapes');
  else Object.keys(shapes).forEach(name => shapeProblems(name, shapes[name]).forEach(text => problems.push(text)));

  if (pack.scene !== undefined && pack.scene !== null) {
    const box = isRecord(pack.scene) ? readViewBox(pack.scene.viewBox) : null;
    const room = zones[sceneZone];
    if (!box || typeof pack.scene.markup !== 'string') {
      problems.push('the scene should be { viewBox, markup }, with a viewBox such as "0 0 ' + room.width + ' ' + room.height + '"');
    } else if (Math.abs(box.width / box.height - room.width / room.height) > 0.01) {
      problems.push('the scene viewBox is ' + box.width + ' by ' + box.height + ', but the "' + sceneZone + '" zone is ' + room.width + ' by ' + room.height + '. It would be stretched');
    }
  }

  ['back', 'front'].forEach(layer => {
    const list = pack[layer] === undefined ? [] : pack[layer];
    if (!Array.isArray(list)) return problems.push(layer + ' should be a list of pieces');

    list.forEach((piece, index) => {
      const label = layer + ' piece ' + (index + 1) + (isRecord(piece) && piece.shape ? ' (' + piece.shape + ')' : '');
      pieceProblems(piece, layer, isRecord(shapes) ? shapes : {}).forEach(text => problems.push(label + ' ' + text));
    });
  });

  const counts = countPieces(pack);
  if (counts.moving > mostMovingPieces) problems.push('the pack has ' + counts.moving + ' pieces that move, and the most is ' + mostMovingPieces + '. The Mini would struggle');
  if (counts.all > mostPieces) problems.push('the pack has ' + counts.all + ' pieces, and the most is ' + mostPieces);
  return problems;
}

// How many pieces a pack has, and how many of them move
export function countPieces(pack) {
  const list = (isRecord(pack) ? [].concat(Array.isArray(pack.back) ? pack.back : [], Array.isArray(pack.front) ? pack.front : []) : []).filter(isRecord);
  return { all: list.length, moving: list.filter(piece => piece.motion !== undefined).length };
}

// Markup

const shapeId = name => 'season-shape-' + name;

// Every shape of the pack, drawn once, hidden. Pieces point at them with <use>.
export function symbolsMarkup(shapes) {
  const symbols = Object.keys(shapes).map(name =>
    '<symbol id="' + shapeId(name) + '" viewBox="' + shapes[name].viewBox + '">' + shapes[name].markup + '</symbol>');
  return '<svg class="season-defs" width="0" height="0" aria-hidden="true"><defs>' + symbols.join('') + '</defs></svg>';
}

// One piece. Its motion, how long it takes and how late it starts go to the
// stylesheet as a name and two or three variables (seasons/motion.css). The
// opacity is on the picture inside, so a motion that fades the piece is not
// fighting it.
export function pieceMarkup(piece, shapes) {
  const box = pieceBox(piece, shapes);
  let style = 'left: ' + piece.x + 'px; top: ' + piece.y + 'px; width: ' + box.width + 'px; height: ' + box.height + 'px;';
  let move = '';

  if (piece.motion !== undefined) {
    move = ' data-move="' + piece.motion + '"';
    style += ' --seconds: ' + piece.seconds + '; --delay: ' + (piece.delay || 0) + ';';
    if (piece.travel !== undefined) style += ' --travel: ' + piece.travel + 'px;';
  }

  const dim = piece.opacity === undefined ? '' : ' style="opacity: ' + piece.opacity + '"';
  const size = 'width="' + box.width + '" height="' + box.height + '"';
  return '<div class="season-piece"' + move + ' style="' + style + '">' +
    '<svg ' + size + dim + ' aria-hidden="true"><use href="#' + shapeId(piece.shape) + '" ' + size + '/></svg></div>';
}

function zoneMarkup(name, inner) {
  const zone = zones[name];
  return '<div class="season-zone" data-zone="' + name + '" style="left: ' + zone.x + 'px; top: ' + zone.y + 'px; width: ' + zone.width + 'px; height: ' + zone.height + 'px;">' + inner + '</div>';
}

function sceneMarkup(scene) {
  const room = zones[sceneZone];
  return '<svg class="season-scene" viewBox="' + scene.viewBox + '" width="' + room.width + '" height="' + room.height + '" preserveAspectRatio="none" aria-hidden="true">' + scene.markup + '</svg>';
}

// The inside of the two layers, and the lines to log about any piece that was
// left out. A piece with a problem is left out and the rest are drawn, so one
// slip in a pack never takes the whole pack away.
export function layersMarkup(pack) {
  const shapes = isRecord(pack.shapes) ? pack.shapes : {};
  const skipped = [];

  function usable(layer) {
    return (Array.isArray(pack[layer]) ? pack[layer] : []).filter((piece, index) => {
      const problems = pieceProblems(piece, layer, shapes);
      problems.forEach(text => skipped.push(layer + ' piece ' + (index + 1) + ' ' + text));
      return problems.length === 0;
    });
  }

  const back = usable('back');
  const front = usable('front');
  const scene = isRecord(pack.scene) && readViewBox(pack.scene.viewBox) && typeof pack.scene.markup === 'string' ? pack.scene : null;

  const inZones = Object.keys(zones).map(name => {
    const own = front.filter(piece => piece.zone === name);
    const inner = (scene && name === sceneZone ? sceneMarkup(scene) : '') + own.map(piece => pieceMarkup(piece, shapes)).join('');
    return inner === '' ? '' : zoneMarkup(name, inner);
  }).join('');

  const empty = back.length === 0 && inZones === '';
  return {
    empty: empty,
    skipped: skipped,
    back: symbolsMarkup(shapes) + back.map(piece => pieceMarkup(piece, shapes)).join(''),
    front: inZones,
  };
}

// Loading

const loaded = {}; // id -> pack, so a pack is read from its file once

// The pack of an overlay, read from seasons/<id>.js. importModule is only for
// the tests. It resolves with the pack, or throws when the file is missing or
// has no pack in it. A failure is not remembered, so the next ask tries again.
export async function loadPack(overlayId, importModule) {
  if (loaded[overlayId]) return loaded[overlayId];
  if (!hasDecorations(overlayId)) throw new Error('the overlay "' + overlayId + '" has no decorations in its registry entry');

  const read = importModule || (path => import(path));
  const module = await read('../seasons/' + overlayId + '.js');
  if (!module || !isRecord(module.pack)) throw new Error('seasons/' + overlayId + '.js should export a pack');

  loaded[overlayId] = module.pack;
  return module.pack;
}

// The page

const backId = 'season-back';
const frontId = 'season-front';
let shown = ''; // the pack on the page now, or '' for none
let asks = 0; // counts the asks, so a slow load never lands after a newer ask

// The id of the pack on the page, or ''
export function seasonShown() {
  return shown;
}

function removeLayers() {
  [backId, frontId].forEach(id => {
    const layer = document.getElementById(id);
    if (layer) layer.remove();
  });
  shown = '';
}

function makeLayer(id, className, html) {
  const layer = document.createElement('div');
  layer.id = id;
  layer.className = 'season-layer ' + className;
  layer.innerHTML = html;
  return layer;
}

// The old layers go and the new ones come in one step. The back layer goes in
// before #backdrop, so the hidden transitions cover it. The front layer goes in
// straight after #stage, so the red flicker, the connection text, the night
// screen and everything in #overlay cover it.
function drawLayers(overlayId, pack) {
  const world = document.getElementById('world');
  const backdrop = document.getElementById('backdrop');
  const stage = document.getElementById('stage');
  if (!world || !backdrop || !stage) throw new Error('index.html has no #world, #backdrop or #stage');

  const drawn = layersMarkup(pack);
  drawn.skipped.forEach(text => console.error('The ' + overlayId + ' pack: the ' + text + '. It was left out.'));

  removeLayers();
  shown = overlayId;
  if (drawn.empty) return; // a new pack with nothing in it yet

  world.insertBefore(makeLayer(backId, 'season-back', drawn.back), backdrop);
  world.insertBefore(makeLayer(frontId, 'season-front', drawn.front), stage.nextSibling);
}

// Shows the pack of this overlay, replacing the one on the page, or takes the
// decorations away when the overlay has none ('' for no overlay). theme-apply.js
// calls it through shell.js each time the look changes. It never throws: a pack
// that cannot be loaded or drawn is logged, and the screen carries on without it.
export async function showSeason(overlayId, importModule) {
  const id = typeof overlayId === 'string' ? overlayId : '';
  const ask = ++asks;

  if (!hasDecorations(id)) {
    removeLayers();
    return;
  }
  if (shown === id) return;

  try {
    const pack = await loadPack(id, importModule);
    if (ask !== asks) return; // asked again while this one was loading
    drawLayers(id, pack);
  } catch (error) {
    console.error('The decorations for "' + id + '" could not be shown. The screen carries on without them.', error);
    if (ask === asks) removeLayers();
  }
}
