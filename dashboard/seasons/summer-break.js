// The Summer Break pack: a day at the beach. It is built the way christmas.js is,
// the model for the packs. docs/seasonal-packs.md explains every part.
//
// What it draws:
//   - a sun rising out of three bands of waves in place of the slashes at the
//     right of every panel header (mark)
//   - twelve pieces over the panels, across the whole screen: soap bubbles
//     rising, two beach balls, two sun sparkles and two gulls that cross now and
//     then (over)
//   - in the empty places: a line of small flags along the top edge
//   - two little sailboats crossing the gaps above the ticker
//   - a palm with swaying fronds and a beach umbrella in one cut corner, and a sun
//     with turning rays in the other
//   - a beach ball bobbing in the gap between the two columns
//   - a beach along the bottom edge: three layers of waves that swell up and
//     down, a sandy edge, palms, umbrellas, sandcastles, surfboards and crabs
//
// The pack is data. It holds no keyframes and no animation code: a piece names a
// motion ('rise', 'bob', 'spin'...) and seasons/motion.css plays it, and only in
// full motion. The colours are written out here and not taken from the theme, so
// the sea stays blue and the palms stay green whatever theme is on. The accent
// colours of the screen's own text are in themes/overlays/summer-break.css.
//
// Every shape is flat polygons with hard edges, in the faceted style of the
// logo. There is no blur, no glow, no shadow and no gradient.

import { shape, ball, block } from '../core/svg-pieces.js';
import { beachBall, beachMarkup, boat, bubble, coral, frondLeft, frondRight, gull, mark, palmTree, rays, seaDeep, seaFar, seaMid, seaNear, sparkle, sun, sunShade, topBunting, umbrella, upLeaves, waterLine, wave } from './art/summer-break.js';

// The shapes the pieces use, each drawn once
const shapes = {
  'bubble': bubble,
  'gull': gull,
  'boat': boat,
  'water-a': { viewBox: '0 0 836 14', markup: waterLine(836) },
  'water-b': { viewBox: '0 0 654 14', markup: waterLine(654) },
  'palm-corner': { viewBox: '0 0 40 28', markup: palmTree(14, 28, 17, 8, upLeaves) },
  'frond-left': frondLeft,
  'frond-right': frondRight,
  'umbrella-corner': { viewBox: '0 0 34 28', markup: umbrella(17, 30, 2, 11, 28) + shape([[2, 26.4], [32, 26.4], [31, 28], [3, 28]], coral) },
  'sun-rays': { viewBox: '0 0 34 34', markup: rays() },
  'sun-disc': { viewBox: '0 0 16 16', markup: ball(8, 8, 8, sun, sunShade) + shape([[3.6, 4], [6, 2.6], [7, 3.8], [4.6, 5.4]], '#fff1a8') },
  'beach-ball': { viewBox: '0 0 20 20', markup: beachBall(10, 10, 10) },
  'sea-far': { viewBox: '0 -4 1920 26', markup: wave(seaFar, 11.8, 1.1, 40, 0, false) },
  'sea-mid': { viewBox: '0 -4 1920 26', markup: wave(seaMid, 14, 1, 36, 2, false) },
  'sea-near': { viewBox: '0 -4 1920 26', markup: wave(seaNear, 16, 0.8, 32, 4, true) },
  'beach': { viewBox: '0 -4 1920 26', markup: beachMarkup },
  'sparkle': sparkle,
  'top-bunting': { viewBox: '0 0 1920 26', markup: topBunting() },
};


// The pack. A piece is
//   shape    which of the shapes above
//   x, y     where its top left corner rests, in pixels. In the back and over
//            layers these are screen pixels, and the middle of the path of a
//            travelling piece. In the front layer they are measured from the
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

  // 1920 wide and 26 high, from y -4 to 22. Drawn in the "ground" zone along the
  // bottom edge. It is the deep water: the layers of sea and the beach are pieces
  // laid over it, so they can swell and be covered in the right order.
  scene: { viewBox: '0 -4 1920 26', markup: block(0, 10, 1920, 12, seaDeep) },

  // The picture that replaces the slashes in every panel header
  mark: mark,

  // Pieces over the panels, drifting across the whole screen like a day at the
  // beach: soap bubbles rising (outlines, so a word shows through), two beach
  // balls, two sun sparkles and two gulls, 26 to 44 px wide. A bubble or a sparkle
  // takes 28 to 48 seconds to cross, so it is only over a letter for a moment, and
  // a bubble is only a ring. The gulls cross now and then: their path is much longer than the
  // screen, so a gull is out of sight for more than half of its round (a gull
  // takes 110 or 150 seconds, and is on the screen for about 50 of them). The
  // delays are spread in steps of a golden ratio of each piece's own round, so the
  // first screen already has pieces at every height, and the gulls and the drifting
  // ball are set by hand so that they are on the screen early. All of the bubbles
  // are here: none rises behind the panels, because a pack may only move about
  // 24 pieces.
  over: [
    { shape: 'bubble', x: 90, y: 540, size: 44, opacity: 0.8, motion: 'rise', seconds: 30, delay: -3.9, travel: 1300 },
    { shape: 'sparkle', x: 250, y: 540, size: 38, opacity: 0.85, motion: 'rise', seconds: 34, delay: -25.4, travel: 1100 },
    { shape: 'bubble', x: 420, y: 540, size: 30, opacity: 0.85, motion: 'rise', seconds: 44, delay: -16.1, travel: 1300 },
    { shape: 'beach-ball', x: 960, y: 250, size: 44, opacity: 0.8, motion: 'drift', seconds: 90, delay: -40, travel: 2600 },
    { shape: 'bubble', x: 640, y: 540, size: 36, opacity: 0.85, motion: 'rise', seconds: 36, delay: -21.7, travel: 1300 },
    { shape: 'gull', x: 960, y: 480, size: 44, opacity: 0.85, motion: 'drift', seconds: 110, delay: -32, travel: 4400 },
    { shape: 'bubble', x: 1040, y: 540, size: 26, opacity: 0.85, motion: 'rise', seconds: 48, delay: -40.2, travel: 1300 },
    { shape: 'sparkle', x: 1190, y: 540, size: 32, opacity: 0.85, motion: 'rise', seconds: 38, delay: -17.3, travel: 1100 },
    { shape: 'bubble', x: 1330, y: 540, size: 44, opacity: 0.8, motion: 'rise', seconds: 28, delay: -2.1, travel: 1300 },
    { shape: 'beach-ball', x: 1500, y: 520, size: 38, opacity: 0.8, motion: 'fall', seconds: 40, delay: -27.7, travel: 1300 },
    { shape: 'gull', x: 960, y: 900, size: 40, opacity: 0.85, motion: 'drift', seconds: 150, delay: -70.5, travel: 5200 },
    { shape: 'bubble', x: 1700, y: 540, size: 34, opacity: 0.85, motion: 'rise', seconds: 40, delay: -37.1, travel: 1300 },
  ],

  front: [
    // A line of small flags along the top edge. They stand still: the gulls are in
    // the over layer.
    { zone: 'top', shape: 'top-bunting', x: 0, y: 0, size: 1920 },

    // A palm and a beach umbrella in the cut corner of the large panel
    { zone: 'corner-a', shape: 'umbrella-corner', x: 56, y: 0, size: 34 },
    { zone: 'corner-a', shape: 'palm-corner', x: 4, y: 0, size: 40 },
    { zone: 'corner-a', shape: 'frond-left', x: 15, y: 11, size: 22, motion: 'sway', seconds: 5.5, delay: -1 },
    { zone: 'corner-a', shape: 'frond-right', x: 15, y: 11, size: 22, motion: 'sway', seconds: 5.5, delay: -3.8 },

    // The sun in the cut corner of the countdown: the disc stays and the rays turn
    { zone: 'corner-b', shape: 'sun-rays', x: 9, y: 0, size: 34, motion: 'spin', seconds: 40 },
    { zone: 'corner-b', shape: 'sun-disc', x: 18, y: 9, size: 16 },

    // A beach ball bobbing in the gap between the columns
    { zone: 'gutter', shape: 'beach-ball', x: 1, y: 140, size: 18, motion: 'bob', seconds: 3.2, travel: 36 },

    // Sailboats crossing the gaps above the ticker, on a thin line of water
    { zone: 'string-a', shape: 'water-a', x: 0, y: 0, size: 836 },
    { zone: 'string-a', shape: 'boat', x: 400, y: 0, size: 26, motion: 'drift', seconds: 100, delay: -35, travel: 900 },
    { zone: 'string-b', shape: 'water-b', x: 0, y: 0, size: 654 },
    { zone: 'string-b', shape: 'boat', x: 300, y: 0, size: 26, motion: 'drift', seconds: 80, delay: -10, travel: 750 },

    // The beach. The three layers of sea swell up and down a few pixels each, out
    // of step, and the sand and everything on it is laid over them
    { zone: 'ground', shape: 'sea-far', x: 0, y: 0, size: 1920, motion: 'bob', seconds: 7, delay: 0, travel: 4 },
    { zone: 'ground', shape: 'sea-mid', x: 0, y: 0, size: 1920, motion: 'bob', seconds: 5.4, delay: -2.7, travel: 4 },
    { zone: 'ground', shape: 'sea-near', x: 0, y: 0, size: 1920, motion: 'bob', seconds: 4.4, delay: -1.5, travel: 4 },
    { zone: 'ground', shape: 'beach', x: 0, y: 0, size: 1920 },
  ],
};
