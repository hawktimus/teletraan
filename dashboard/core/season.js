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
// tests/seasons.test.mjs can run them. tests/check-seasons.test.mjs uses the same
// functions to check every pack.

export {
  zones, sceneZone, cornerPlaces, motions, overRules, overMotions, mostMovingPieces, mostPieces, hasDecorations,
  pieceProblems, markProblems, packProblems, countPieces,
} from './season-check.js';
export {
  pieceMarkup, cornerArtPieceMarkup, layersMarkup, loadPack, seasonShown, setOverPanels, setLayers, setCornerArt,
  showSeason,
} from './season-draw.js';
