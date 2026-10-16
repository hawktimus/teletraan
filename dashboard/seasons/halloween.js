// The Halloween pack. Like the Christmas pack (christmas.js) it is plain data: a
// list of shapes, a scene, a mark and lists of pieces. docs/seasonal-packs.md explains
// every part, and "How to add a pack" there lists the steps.
//
// What it draws:
//   - a jack-o'-lantern in place of the slashes at the right of every panel header (mark)
//   - twelve small pieces that cross the whole screen over the panels: bats gliding
//     across, ghosts rising, candy corn and dry leaves tumbling down, and embers
//     floating up (over)
//   - in the empty places: two ghosts rising behind the panels in the margins,
//     candy corn falling down the margins and the gap between the columns,
//     cobwebs in the top corners of the screen and a web in the cut corner of the
//     large panel that draws itself, holds, and wipes away, spiders hanging on
//     threads from the top edge and from the school name, and bunting in the gap
//     above the ticker (back and front)
//   - a scene along the bottom edge: jack-o'-lanterns, tombstones, bare trees, a
//     fence and a haunted house. The carved faces and the windows flicker (scene)
//
// The pack holds no keyframes and no animation code: a piece names a motion
// ('rise', 'sway', 'draw'...) and seasons/motion.css plays it, and only in full
// motion. The colours are written out here and not taken from the theme, so a
// pumpkin stays orange whatever theme is on. The accent colours of the screen's
// own text are in themes/overlays/halloween.css.
//
// Every shape is flat polygons with hard edges, in the faceted style of the
// logo, with a lit side and a shaded side. There is no blur, no glow, no shadow
// and no gradient.

import { shape } from '../core/svg-pieces.js';
import { bat, batUp, bunting, candyCorn, cornerWeb, dryLeaf, ember, ghost, hangingSpider, lit, mark } from './art/halloween-marks.js';
import { sceneMarkup } from './art/halloween-scene.js';

const shapes = {
  'ghost': ghost,
  'bat': bat,
  'bat-up': batUp,
  'ember': ember,
  'dry-leaf': dryLeaf,
  'candy-corn': { viewBox: '0 0 12 16', markup: candyCorn() },
  'spider-short': hangingSpider(5),
  'spider-long': hangingSpider(6),
  'spider-corner': hangingSpider(8),
  'web-top-left': cornerWeb(64, 26, false),
  'web-top-right': { viewBox: '0 0 64 26', markup: '<g transform="translate(64 0) scale(-1 1)">' + cornerWeb(64, 26, false).markup + '</g>' },
  'web-draw': cornerWeb(96, 28, true),
  'bunting-a': bunting(836),
  'bunting-b': bunting(654),
  'flicker-0': { viewBox: '0 -4 1920 26', markup: lit(0) },
  'flicker-1': { viewBox: '0 -4 1920 26', markup: lit(1) },
};


// The pack. A piece is
//   shape    which of the shapes above
//   x, y     where its top left corner rests, in pixels. In the back layer these
//            are screen pixels. In the front layer they are measured from the
//            top left corner of the piece's zone
//   size     how wide it is, in pixels. The height follows from the shape
//   zone     (front only) which zone it is in: the list is at the top of core/season.js
//   motion   (optional) which motion: see the list at the top of seasons/motion.css
//   seconds  how long one round of the motion takes. A piece with a motion needs it
//   delay    (optional) seconds before the first round. Negative starts it part way in
//   travel   (optional) how far a travelling motion goes, in pixels
//   opacity  (optional) 0 to 1, for a piece that should be fainter
// A piece with no motion stays still.

export const pack = {
  shapes: shapes,

  // 1920 wide and 26 high, from y -4 to 22. Drawn in the "ground" zone along the bottom edge.
  scene: { viewBox: '0 -4 1920 26', markup: sceneMarkup },

  // The picture that replaces the slashes in every panel header
  mark: mark,

  // Over the panels: twelve small pieces that cross the whole screen. Four bats
  // glide across at their own heights and speeds, two ghosts rise, two pieces of
  // candy corn and two dry leaves tumble down, and two embers float up. Each takes
  // 28 to 72 seconds for a trip, so it is only over a letter for a moment, and
  // each is faint enough (opacity .7 to .85) that a word shows through it. The
  // delays are spread (golden ratio steps round each piece's own round) so the
  // first screen already has pieces in flight. A bat's x and y are the middle of
  // its path: it starts 1150 px left of x and ends 1150 px right of it.
  over: [
    { shape: 'dry-leaf', x: 110, y: 500, size: 32, opacity: 0.8, motion: 'flutter', seconds: 30, delay: -18.5, travel: 1300 },
    { shape: 'ghost', x: 290, y: 510, size: 40, opacity: 0.7, motion: 'rise', seconds: 46, delay: -10.9, travel: 1300 },
    { shape: 'bat', x: 898, y: 150, size: 44, opacity: 0.85, motion: 'drift', seconds: 52, delay: -44.4, travel: 2300 },
    { shape: 'candy-corn', x: 560, y: 506, size: 28, opacity: 0.85, motion: 'flutter', seconds: 34, delay: -16, travel: 1300 },
    { shape: 'ember', x: 770, y: 520, size: 26, opacity: 0.85, motion: 'rise', seconds: 28, delay: -2.5, travel: 1300 },
    { shape: 'bat-up', x: 941, y: 410, size: 36, opacity: 0.85, motion: 'drift', seconds: 64, delay: -45.3, travel: 2300 },
    { shape: 'candy-corn', x: 1190, y: 512, size: 24, opacity: 0.85, motion: 'flutter', seconds: 40, delay: -13, travel: 1300 },
    { shape: 'bat', x: 941, y: 690, size: 42, opacity: 0.85, motion: 'drift', seconds: 58, delay: -54.8, travel: 2300 },
    { shape: 'ghost', x: 1490, y: 514, size: 32, opacity: 0.7, motion: 'rise', seconds: 54, delay: -30.3, travel: 1300 },
    { shape: 'dry-leaf', x: 1690, y: 506, size: 26, opacity: 0.8, motion: 'flutter', seconds: 38, delay: -6.8, travel: 1300 },
    { shape: 'bat-up', x: 947, y: 900, size: 34, opacity: 0.85, motion: 'drift', seconds: 72, delay: -57.5, travel: 2300 },
    { shape: 'ember', x: 1830, y: 522, size: 22, opacity: 0.85, motion: 'rise', seconds: 34, delay: -14.1, travel: 1300 },
  ],

  // Pieces behind the panels. They show only in the margins and in the gap between
  // the two columns, where two ghosts rise slowly, so in calm motion they hover there.
  back: [
    { shape: 'ghost', x: 2, y: 860, size: 30, opacity: 0.5, motion: 'rise', seconds: 70, delay: -24, travel: 1300 },
    { shape: 'ghost', x: 1888, y: 400, size: 28, opacity: 0.5, motion: 'rise', seconds: 80, delay: -52, travel: 1300 },
  ],

  front: [
    // Cobwebs in the top corners of the screen. They stay still.
    { zone: 'top', shape: 'web-top-left', x: 0, y: 0, size: 64 },
    { zone: 'top', shape: 'web-top-right', x: 1856, y: 0, size: 64 },

    // Spiders on threads from the top edge, swinging a little
    { zone: 'top', shape: 'spider-short', x: 330, y: 0, size: 22, motion: 'sway', seconds: 4.4, delay: -1 },
    { zone: 'top', shape: 'spider-long', x: 1560, y: 0, size: 22, motion: 'sway', seconds: 5.2, delay: -3 },

    // Bunting in the two gaps above the ticker
    { zone: 'string-a', shape: 'bunting-a', x: 0, y: 0, size: 836 },
    { zone: 'string-b', shape: 'bunting-b', x: 0, y: 0, size: 654 },

    // A web in the cut corner of the large panel that draws itself, holds, and wipes away
    { zone: 'corner-a', shape: 'web-draw', x: 0, y: 0, size: 96, motion: 'draw', seconds: 20, delay: -4 },

    // A spider that swings from the school name above the countdown
    { zone: 'corner-b', shape: 'spider-corner', x: 16, y: 0, size: 20, motion: 'sway', seconds: 4.8, delay: -2 },

    // Candy corn falling down the margins and the gap between the columns
    { zone: 'left', shape: 'candy-corn', x: 6, y: 120, size: 12, motion: 'fall', seconds: 22, delay: -5, travel: 800 },
    { zone: 'right', shape: 'candy-corn', x: 8, y: 160, size: 12, motion: 'fall', seconds: 24, delay: -3, travel: 900 },
    { zone: 'gutter', shape: 'candy-corn', x: 4, y: 140, size: 10, motion: 'fall', seconds: 18, delay: -8, travel: 420 },

    // The scene's candles and windows flicker, in two groups so they are not in step
    { zone: 'ground', shape: 'flicker-0', x: 0, y: 0, size: 1920, motion: 'twinkle', seconds: 3.2, delay: -1 },
    { zone: 'ground', shape: 'flicker-1', x: 0, y: 0, size: 1920, motion: 'twinkle', seconds: 4.1, delay: -2.6 },
  ],
};
