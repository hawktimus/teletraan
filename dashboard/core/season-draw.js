// Drawing the pieces of a pack and showing the season on the page (part of season.js).

import { cornerArtMarkup, cornerArtNone, cornerArtSize, isCornerArt } from './corner-art.js';
import { setPackMark } from './marks.js';
import { defaultsOf, mergeExtras, rememberDefaults } from './pack-extras.js';
import { isRecord } from './text.js';
import { cornerPlaces, hasDecorations, markProblems, pieceBox, pieceProblems, readViewBox, sceneZone, zones } from './season-check.js';

// Markup

const shapeId = name => 'season-shape-' + name;

// Every shape of the pack, drawn once, hidden. Pieces point at them with <use>.
function symbolsMarkup(shapes) {
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
