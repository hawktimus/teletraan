// The seasonal packs: the decorations that go with a holiday overlay.
//
// An overlay (themes/overlays/) is a few accent colours. A pack is the
// decorations that go with it: a mark for the panel headers, a scene along the
// bottom edge of the screen, and small pieces. A pack is plain data in
// seasons/<id>.js, and docs/seasonal-packs.md explains it. This file reads that
// data and draws it in three layers:
//
//   #season-back    behind the stage, as big as the screen. Its pieces drift
//                   behind the panels and show in the gaps between them.
//   #season-front   above the stage. It is made of ZONES: fixed rectangles that
//                   hold no text and clip what is inside them, so a piece can
//                   never cross a word, the logo, the clock or a panel.
//   #season-over    above the front layer, as big as the screen. Its pieces
//                   fall, drift or rise across the whole screen, over the
//                   panels. They are small, faint, slow and few, so one only
//                   touches a letter for a moment. It is not drawn in calm or
//                   none motion, or when the Look page's switch is off.
//
// The mark goes to core/marks.js, which draws it in place of the slashes at the
// right of every panel header.
//
// Corner art (core/corner-art.js) is line art in the two cut corners, drawn into the
// front layer's corner zones. A rule of the Look schedule picks it, or else the pack's
// own `defaults` do (core/pack-extras.js). Only the layouts that draw the front layer
// have the zones, so the others draw none.
//
// All three layers let every click through, and all sit under everything that
// takes over the screen: the hidden transitions, the night screen, an alert, an
// announcement and the demo. With no pack on, none of them exists.
//
// Nothing here moves. A piece names a motion and seasons/motion.css plays it,
// and only in full motion: in calm and none motion every piece rests, and the
// over layer is gone.
//
// The functions that decide and draw markup have no page in sight, so
// tools/test-seasons.mjs can run them. tools/check-seasons.mjs uses the same
// functions to check every pack.

import { overlays } from '../themes/overlays/registry.js';
import { cornerArtMarkup, cornerArtNone, cornerArtSize, isCornerArt } from './corner-art.js';
import { markBox, markSize, setPackMark } from './marks.js';
import { defaultsOf, defaultsProblems, mergeExtras, rememberDefaults } from './pack-extras.js';

// The zones. Every one is a rectangle of the 1920 x 1080 screen with nothing in
// it: no text, no frame and no screw. They were measured on the full sample
// board, and each sits at least 2 px clear of the nearest ink. If you change a
// panel size or a margin (base.css, plate.js), measure them again
// (docs/seasonal-packs.md, "How the zones were measured").
export const zones = {
  'top':      { x: 0,    y: 0,    width: 1920, height: 26 },  // the strip above the banner, whose first text starts at y 28
  'ground':   { x: 0,    y: 1054, width: 1920, height: 26 },  // the strip under the ticker, where the scene goes. Left of x 270 the ticker tag's edge reaches y 1066, so keep that part low
  'left':     { x: 0,    y: 360,  width: 30,   height: 690 },  // the margin left of the large panel, below its top left screw
  'right':    { x: 1890, y: 30,   width: 30,   height: 846 },  // the margin right of the countdown and the small panel, above the bottom right screw
  'gutter':   { x: 1198, y: 278,  width: 20,   height: 342 },  // the gap between the large panel and the countdown, above the small panel's screw
  'string-a': { x: 244,  y: 970,  width: 836,  height: 14 },   // the gap between the large panel and the ticker, left of its screw
  'string-b': { x: 1134, y: 970,  width: 654,  height: 14 },   // the same gap, between the two screws
  'corner-a': { x: 0,    y: 240,  width: 96,   height: 28 },   // the cut corner at the top left of the large panel
  'corner-b': { x: 1198, y: 238,  width: 52,   height: 34 },   // the cut corner at the top left of the countdown
};

// The scene is drawn in this zone, stretched to fill it
export const sceneZone = 'ground';

// Where corner art goes: the two cut corners, which are the corner zones above. The
// art is cornerArtSize square, and x and y say where its top left corner rests,
// measured from the top left corner of the zone. It is drawn after the pack's own
// pieces in the zone, so it lies over them. A layout that does not draw the front
// layer has no zones and so draws no corner art.
export const cornerPlaces = [
  { zone: 'corner-a', x: 34, y: 0 },
  { zone: 'corner-b', x: 12, y: 3 },
];

// The motions a piece may name. seasons/motion.css has the keyframes of each,
// and tools/check-seasons.mjs fails if the two lists differ.
export const motions = ['fall', 'sway', 'drift', 'rise', 'twinkle', 'bob', 'spin', 'pulse', 'draw', 'sweep', 'slide', 'flutter'];

// What the over layer allows. Its pieces cross the panels, and so cross words,
// so they are small, faint, slow and few: a piece only touches a letter for a
// moment and never hides a word. The seconds are the fewest one round of that
// motion may take. tools/check-seasons.mjs also asks every finished pack for a
// mark and for at least leastPieces pieces here.
export const overRules = {
  size: { least: 18, most: 44 },
  opacityMost: 0.85,
  leastPieces: 8,
  mostPieces: 14,
  seconds: { fall: 12, flutter: 12, drift: 12, rise: 12, sway: 2, twinkle: 2 },
};
export const overMotions = Object.keys(overRules.seconds);

// A pack may have at most this many pieces that move, and this many in all.
// The screen is shown by an old Mac Mini, and every moving piece costs it a little.
export const mostMovingPieces = 24;
export const mostPieces = 60;

const screen = { width: 1920, height: 1080 };
const pieceKeys = ['shape', 'x', 'y', 'size', 'zone', 'motion', 'seconds', 'delay', 'travel', 'opacity'];
const packKeys = ['shapes', 'scene', 'mark', 'back', 'front', 'over', 'defaults'];
const markKeys = ['viewBox', 'markup', 'width', 'height'];
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

// What is wrong with one piece, in plain words. layer is 'back', 'front' or
// 'over'. An empty list means the piece can be drawn.
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
    problems.push('is ' + (layer === 'over' ? 'an over' : 'a ' + layer) + ' piece, so it has no zone: its x and y are screen pixels');
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

  if (layer === 'over') overProblems(piece).forEach(text => problems.push(text));

  // At rest it must be inside its zone, or on the screen for a back or over piece
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

// The extra rules of the over layer (overRules at the top of this file), for a
// piece whose other fields are already known to be well formed
function overProblems(piece) {
  const problems = [];
  const rules = overRules;

  if (isNumber(piece.size) && (piece.size < rules.size.least || piece.size > rules.size.most)) {
    problems.push('is ' + piece.size + ' px wide, and the over layer allows ' + rules.size.least + ' to ' + rules.size.most);
  }
  if (!isNumber(piece.opacity) || piece.opacity > rules.opacityMost) {
    problems.push('needs an opacity of ' + rules.opacityMost + ' or less, so that a word shows through it');
  }

  if (piece.motion === undefined) {
    problems.push('needs a motion, because a piece that stays still would sit on a word for ever. The over layer allows ' + overMotions.join(', '));
  } else if (overMotions.indexOf(piece.motion) === -1) {
    if (motions.indexOf(piece.motion) !== -1) problems.push('has the motion "' + piece.motion + '", which is too quick for the over layer. It allows ' + overMotions.join(', '));
  } else if (isNumber(piece.seconds) && piece.seconds < rules.seconds[piece.motion]) {
    problems.push('takes ' + piece.seconds + ' seconds for a round of ' + piece.motion + ', and the least the over layer allows is ' + rules.seconds[piece.motion]);
  }
  return problems;
}

// What is wrong with a pack's header mark, in plain words. An empty list means
// it can be drawn. It has the rules of core/marks.js: a size that fits markBox.
export function markProblems(mark) {
  if (!isRecord(mark)) return ['should be { viewBox, markup }'];

  const problems = [];
  Object.keys(mark).filter(key => markKeys.indexOf(key) === -1)
    .forEach(key => problems.push('has "' + key + '", which a mark does not use. The names are ' + markKeys.join(', ')));

  if (!readViewBox(mark.viewBox)) problems.push('has a viewBox that is not four numbers such as "0 0 ' + markBox.width + ' ' + markBox.height + '"');
  if (typeof mark.markup !== 'string' || mark.markup.trim() === '') problems.push('has no markup');

  const given = [mark.width, mark.height].filter(value => value !== undefined).length;
  if (given === 1) {
    problems.push('has a width or a height but not both. Give both, or neither, and the size follows the viewBox');
  } else if (given === 2 && !(isNumber(mark.width) && isNumber(mark.height) && mark.width > 0 && mark.height > 0)) {
    problems.push('should have a width and a height that are numbers above 0');
  }

  if (problems.length === 0) {
    const size = markSize(mark);
    if (size.width > markBox.width || size.height > markBox.height) {
      problems.push('is ' + size.width + ' by ' + size.height + ' pixels, and the box for a mark is ' + markBox.width + ' by ' + markBox.height);
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
  if (!isRecord(pack)) return ['the pack should be an object: { shapes, scene, mark, back, front, over, defaults }'];

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

  if (pack.mark !== undefined && pack.mark !== null) markProblems(pack.mark).forEach(text => problems.push('the mark ' + text));
  if (pack.defaults !== undefined) defaultsProblems(pack.defaults).forEach(text => problems.push('the defaults ' + text));

  ['back', 'front', 'over'].forEach(layer => {
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
  if (counts.over > overRules.mostPieces) problems.push('the pack has ' + counts.over + ' over pieces, and the most is ' + overRules.mostPieces + '. They cross the panels, so few is better');
  return problems;
}

// How many pieces a pack has in all three layers, how many of them move, and
// how many are in the over layer
export function countPieces(pack) {
  const layer = name => (isRecord(pack) && Array.isArray(pack[name]) ? pack[name] : []).filter(isRecord);
  const list = [].concat(layer('back'), layer('front'), layer('over'));
  return { all: list.length, moving: list.filter(piece => piece.motion !== undefined).length, over: layer('over').length };
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

// One ornament in one corner place. Its lines draw in once when it appears and then it
// holds still: the rule is in seasons/motion.css, and in calm and none motion it is
// drawn whole. The colour is the accent colour (seasons/season.css).
export function cornerArtPieceMarkup(art, place) {
  const size = cornerArtSize;
  return '<div class="season-piece season-corner-art" style="left: ' + place.x + 'px; top: ' + place.y + 'px; width: ' + size + 'px; height: ' + size + 'px;">' +
    '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" aria-hidden="true">' + cornerArtMarkup(art) + '</svg></div>';
}

// The layers of a pack, and the ones a layout draws by default. The zones and the
// back layer were measured on the standard layout, so another layout draws only
// some of them (decorationLayers in core/layout.js). The mark is drawn in every layout.
const allLayers = ['back', 'front', 'over'];

// The inside of the layers, the mark, and the lines to log about any piece or
// mark that was left out. A piece with a problem is left out and the rest are
// drawn, so one slip in a pack never takes the whole pack away. layers is the
// list of layers to draw, from allLayers: a layer that is not in it is left
// empty, and its pieces are not looked at. The shapes the pieces point at are
// in the back layer's markup, so they are there for the over layer even when
// no back piece is drawn. art is the corner art to draw, an id from core/corner-art.js;
// anything else draws none. It goes in the front layer, so a layout without that layer
// has none.
export function layersMarkup(pack, layers, art) {
  const shapes = isRecord(pack.shapes) ? pack.shapes : {};
  const skipped = [];
  const wanted = Array.isArray(layers) ? layers : allLayers;

  function usable(layer) {
    return (Array.isArray(pack[layer]) ? pack[layer] : []).filter((piece, index) => {
      const problems = pieceProblems(piece, layer, shapes);
      problems.forEach(text => skipped.push(layer + ' piece ' + (index + 1) + ' ' + text));
      return problems.length === 0;
    });
  }

  const back = wanted.indexOf('back') !== -1 ? usable('back') : [];
  const front = wanted.indexOf('front') !== -1 ? usable('front') : [];
  const over = wanted.indexOf('over') !== -1 ? usable('over') : [];
  const scene = wanted.indexOf('front') !== -1 && isRecord(pack.scene) && readViewBox(pack.scene.viewBox) && typeof pack.scene.markup === 'string' ? pack.scene : null;

  const corners = wanted.indexOf('front') !== -1 && isCornerArt(art) ? cornerPlaces : [];

  const inZones = Object.keys(zones).map(name => {
    const own = front.filter(piece => piece.zone === name);
    const corner = corners.filter(place => place.zone === name).map(place => cornerArtPieceMarkup(art, place)).join('');
    const inner = (scene && name === sceneZone ? sceneMarkup(scene) : '') + own.map(piece => pieceMarkup(piece, shapes)).join('') + corner;
    return inner === '' ? '' : zoneMarkup(name, inner);
  }).join('');

  const markWrong = pack.mark === undefined || pack.mark === null ? [] : markProblems(pack.mark);
  markWrong.forEach(text => skipped.push('mark ' + text));

  const empty = back.length === 0 && inZones === '' && over.length === 0;
  return {
    empty: empty,
    skipped: skipped,
    mark: pack.mark && markWrong.length === 0 ? pack.mark : null,
    back: symbolsMarkup(shapes) + back.map(piece => pieceMarkup(piece, shapes)).join(''),
    front: inZones,
    over: over.map(piece => pieceMarkup(piece, shapes)).join(''),
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
  rememberDefaults(overlayId, module.pack.defaults);
  return module.pack;
}

// The page

const backId = 'season-back';
const frontId = 'season-front';
const overId = 'season-over';
let shown = ''; // the pack on the page now, or '' for none
let asks = 0; // counts the asks, so a slow load never lands after a newer ask
let overWanted = true; // the Look page's switch, "Seasonal pieces over the panels" (setOverPanels)
let layersWanted = allLayers; // the layers the layout draws (setLayers)
let overMarkup = ''; // what the over layer of the pack on the page holds, kept so the switch can draw it again
let artTyped = ''; // the corner art typed on the pack's rule, or '' (setCornerArt)
let artDrawn = cornerArtNone; // the corner art in the front layer now

// The id of the pack on the page, or ''
export function seasonShown() {
  return shown;
}

function removeLayers() {
  [backId, frontId, overId].forEach(id => {
    const layer = document.getElementById(id);
    if (layer) layer.remove();
  });
  shown = '';
  overMarkup = '';
  artDrawn = cornerArtNone;
  setPackMark(null); // the slashes come back, on the next page that is built
}

function makeLayer(id, className, html) {
  const layer = document.createElement('div');
  layer.id = id;
  layer.className = 'season-layer ' + className;
  layer.innerHTML = html;
  return layer;
}

// The over layer, drawn again from what was kept: it goes straight after the
// front layer, so the red flicker, the connection text, the night screen and
// everything in #overlay cover it too. It is left out while the switch is off.
function drawOver() {
  const old = document.getElementById(overId);
  if (old) old.remove();

  const world = document.getElementById('world');
  const after = document.getElementById(frontId) || document.getElementById('stage');
  if (!overWanted || overMarkup === '' || !world || !after) return;

  world.insertBefore(makeLayer(overId, 'season-over', overMarkup), after.nextSibling);
}

// Turns the over layer on or off while the screen runs. shell.js calls it with
// the Look page's switch each time the content changes. Anything but false is on.
export function setOverPanels(on) {
  const wanted = on !== false;
  if (wanted === overWanted) return;

  overWanted = wanted;
  if (shown) drawOver();
}

// Which layers of a pack are drawn: the list from decorationLayers() in
// core/layout.js. shell.js gives it before the first pack is asked for. The
// layout does not change while the screen runs, so it is read when a pack is drawn.
export function setLayers(layers) {
  layersWanted = Array.isArray(layers) ? layers : allLayers;
}

// The corner art to draw for a pack: the one typed on its rule, else the pack's own
// default, else none. A layout that does not draw the front layer draws none.
function cornerArtFor(overlayId) {
  if (layersWanted.indexOf('front') === -1) return cornerArtNone;
  return mergeExtras({ cornerArt: artTyped }, defaultsOf(overlayId)).cornerArt;
}

// Gives the corner art typed on the rule of the pack on the page, or '' when the rule
// leaves it empty. shell.js calls it each time the content changes, like setOverPanels.
// A different art than the one drawn is drawn at once, which draws the pack again.
export function setCornerArt(art) {
  const typed = isCornerArt(art) || art === cornerArtNone ? art : '';
  if (typed === artTyped) return;

  artTyped = typed;
  if (shown && loaded[shown] && cornerArtFor(shown) !== artDrawn) {
    try {
      drawLayers(shown, loaded[shown]);
    } catch (error) {
      console.error('The corner art for "' + shown + '" could not be drawn.', error);
    }
  }
}

// The old layers go and the new ones come in one step. The back layer goes in
// before #backdrop, so the hidden transitions cover it. The front layer goes in
// straight after #stage, and the over layer after that.
function drawLayers(overlayId, pack) {
  const world = document.getElementById('world');
  const backdrop = document.getElementById('backdrop');
  const stage = document.getElementById('stage');
  if (!world || !backdrop || !stage) throw new Error('index.html has no #world, #backdrop or #stage');

  const art = cornerArtFor(overlayId);
  const drawn = layersMarkup(pack, layersWanted, art);
  drawn.skipped.forEach(text => console.error('The ' + overlayId + ' pack: the ' + text + '. It was left out.'));

  removeLayers();
  shown = overlayId;
  artDrawn = art;
  setPackMark(drawn.mark); // a pack with only a mark still changes the headers
  if (drawn.empty) return; // a new pack with nothing in it yet

  world.insertBefore(makeLayer(backId, 'season-back', drawn.back), backdrop);
  world.insertBefore(makeLayer(frontId, 'season-front', drawn.front), stage.nextSibling);
  overMarkup = drawn.over;
  drawOver();
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
