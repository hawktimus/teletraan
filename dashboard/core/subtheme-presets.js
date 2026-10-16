// The three subthemes the screen ships: halloween, winter and kickoff (docs/subthemes.md). A preset is
// a list of pieces, and a piece is a drawing (core/subtheme-shapes.js) placed in a frame anchor
// (core/anchors.js). The anchors come from the frames of the layout, so a preset has the same places
// on every theme and in both layouts, and it never draws in the inside of a frame, where the text is.
//
// This file only works out what to draw. core/subtheme-preset-layer.js puts it on the page. It is
// plain functions with no page in sight, so the tests can run it.

import { frameAnchorBox } from './anchors.js';
import * as art from './subtheme-shapes.js';

export const presetIds = ['halloween', 'winter', 'kickoff'];

// The seasonal packs that bring a preset when the schedule rule says nothing about subthemes
export const packSubthemes = { halloween: 'halloween', christmas: 'winter' };

// What the Studio lists, in this order. The ids are stored and never change.
export const presetChoices = [
  { id: 'halloween', name: 'Halloween' },
  { id: 'winter', name: 'Winter' },
  { id: 'kickoff', name: 'Kickoff' },
];

export function isPreset(id) {
  return presetIds.indexOf(id) !== -1;
}

// A piece names the anchor, the drawing and, for a drawing that takes one, its options. A piece
// whose anchor the layout does not have is left out.
const presets = {
  halloween: [
    { anchor: 'banner-bar-top', draw: art.garland },
    { anchor: 'corner-bolt', draw: art.pumpkins },
    { anchor: 'corner-cut-main-a', draw: art.web },
    { anchor: 'ticker-bar-top', draw: art.bats },
  ],
  winter: [
    { anchor: 'banner-bar-top', draw: art.snowCap },
    { anchor: 'main-bar-top', draw: art.snowCap },
    { anchor: 'side-bar-top', draw: art.snowCap },
    { anchor: 'panel-b-bar-top', draw: art.snowCap },
    { anchor: 'ticker-bar-top', draw: art.snowCap },
    { anchor: 'ticker-bar-bottom', draw: art.snowCap, rest: 9 },
    { anchor: 'banner-bar-bottom', draw: art.icicles },
    { anchor: 'main-header-gap', draw: art.icicles },
    { anchor: 'corner-cut-main-a', draw: art.frostFan },
    { anchor: 'corner-cut-main-b', draw: art.frostFan },
    { anchor: 'corner-cut-aux-a', draw: art.frostFan },
    { anchor: 'corner-cut-aux-b', draw: art.frostFan },
    { anchor: 'banner-bar-bottom', draw: art.bulbString },
    { anchor: 'gap-column', draw: art.snowfall },
    { anchor: 'margin-left', draw: art.snowfall },
    { anchor: 'margin-right', draw: art.snowfall },
    { anchor: 'corner-bolt', draw: art.snowman },
  ],
  kickoff: [
    { anchor: 'banner-cut', draw: art.ribbon },
    { anchor: 'ticker-bar-top', draw: art.confetti },
    { anchor: 'side-corner', draw: art.flagsAndGear },
  ],
};

function svgOf(id, piece, found) {
  const inside = piece.draw(found.width, found.height, piece.rest);
  const content = found.kind === 'cut' ? art.inCorner(found.corner, found.width, found.height, inside) : inside;
  return '<svg class="sb-piece" data-preset="' + id + '" data-anchor="' + piece.anchor + '" viewBox="0 0 ' + found.width + ' ' + found.height + '"'
    + ' width="' + found.width + '" height="' + found.height + '" style="left:' + found.x + 'px;top:' + found.y + 'px">' + content + '</svg>';
}

// What to draw for one preset: a list of { anchor, box, markup, shapes, moving }. layout is
// standard or bar, and options are { mirrored, flipped } as in core/anchors.js. A layout with no
// frame anchors (sidebar) gives an empty list.
export function presetPieces(id, theme, layout, options) {
  if (!isPreset(id)) return [];

  return presets[id].map(piece => {
    const found = frameAnchorBox(theme, layout, piece.anchor, options);
    if (!found) return null;

    const markup = svgOf(id, piece, found);
    return {
      anchor: piece.anchor,
      box: { x: found.x, y: found.y, width: found.width, height: found.height, kind: found.kind, corner: found.corner },
      markup: markup,
      shapes: (markup.match(/<(path|circle|ellipse|rect)\b/g) || []).length,
      moving: (markup.match(/data-move="/g) || []).length,
    };
  }).filter(Boolean);
}

export function presetMarkup(pieces) {
  return pieces.map(piece => piece.markup).join('');
}

// The anchors a preset uses, in the order it draws them
export function presetAnchors(id) {
  return (presets[id] || []).map(piece => piece.anchor);
}

// The totals of a list of pieces, for the tests and the doc
export function countPieces(pieces) {
  return {
    pieces: pieces.length,
    shapes: pieces.reduce((sum, piece) => sum + piece.shapes, 0),
    moving: pieces.reduce((sum, piece) => sum + piece.moving, 0),
  };
}
