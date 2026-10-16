// The Thanksgiving pack. Like the Christmas pack (christmas.js) it is plain data:
// a list of shapes, a scene, a mark and lists of pieces. docs/seasonal-packs.md
// explains every part, and "How to add a pack" there lists the steps.
//
// What it draws:
//   - a turkey with a fan of tail feathers in place of the slashes at the right of
//     every panel header (mark)
//   - twelve pieces that tumble down across the whole screen, over the panels:
//     maple, oak and ginkgo leaves and an acorn, in reds, oranges, golds and browns (over)
//   - in the empty places: two big faint leaves falling behind the panels in the
//     margins, a leaf falling down each margin and the gap between the columns, a
//     vine along the top edge with four leaves hanging from it (two swing in a
//     breeze), and a thinner vine in each gap above the ticker with a leaf blowing
//     along it (back and front)
//   - a spray of leaves and acorns in the cut corner of the large panel, and a
//     hanging acorn in the cut corner of the countdown
//   - a harvest scene along the bottom edge: a line of autumn trees, corn stalks,
//     pumpkins, hay bales, wheat, scarecrows and a turkey (scene)
//
// The pack holds no keyframes and no animation code: a piece names a motion
// ('fall', 'sway', 'drift') and seasons/motion.css plays it, and only in full
// motion. The colours are written out here and not taken from the theme, so a
// leaf stays red whatever theme is on. The accent colours of the screen's own
// text are in themes/overlays/thanksgiving.css.
//
// Every shape is flat polygons with hard edges, in the faceted style of the
// logo, with a lit side and a shaded side. There is no blur, no glow, no shadow
// and no gradient.

import { shape } from '../core/svg-pieces.js';
import { acorn, brown, drawn, elm, ginkgo, gold, hanging, maple, computerLeaf, oak, olive, orange, red, sceneMarkup, vine } from './art/thanksgiving-scene.js';
import { cluster, mark, spray } from './art/thanksgiving-marks.js';

const shapes = {
  'maple-red': drawn(maple, red),
  'maple-orange': drawn(maple, orange),
  'maple-gold': drawn(maple, gold),
  'maple-brown': drawn(maple, brown),
  'oak-orange': drawn(oak, orange),
  'oak-brown': drawn(oak, brown),
  'oak-red': drawn(oak, red),
  'oak-gold': drawn(oak, gold),
  'ginkgo-gold': drawn(ginkgo, gold),
  'ginkgo-orange': drawn(ginkgo, orange),
  'acorn': drawn(acorn, null),
  'hang-maple-red': drawn(hanging(maple, red), null),
  'hang-oak-orange': drawn(hanging(oak, orange), null),
  'hang-ginkgo-gold': drawn(hanging(ginkgo, gold), null),
  'hang-elm-olive': drawn(hanging(elm, olive), null),
  'blown-leaf-red': { viewBox: '0 0 12 8', markup: computerLeaf(0.5, 4, 11, 0, red) },
  'blown-leaf-gold': { viewBox: '0 0 12 8', markup: computerLeaf(0.5, 4, 11, 0, gold) },
  'vine-top': vine(1920, 26, 9, 1.5, 30, 11, 330, 10),
  'vine-a': vine(836, 14, 6, 1, 26, 7, 190, 6),
  'vine-b': vine(654, 14, 6, 1, 26, 7, 170, 6),
  'spray': spray,
  'hang-cluster': cluster,
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

  // The corner art a rule gets when it picks none of its own (core/corner-art.js)
  defaults: { cornerArt: 'leaves' },

  // Leaves falling over the panels: eleven of three shapes (maple, oak and ginkgo)
  // and an acorn, in reds, oranges, golds and browns, each tumbling and swaying down
  // on its own slow round. A leaf takes 26 to 46 seconds to cross the screen, so it
  // is only over a letter for a moment, and it is faint enough (opacity .7 to .85)
  // that a word shows through it. The big ones are the faintest and fall fastest.
  // The delays are spread (golden ratio steps round each leaf's own round) so the
  // first screen already has leaves at every height.
  over: [
    { shape: 'maple-red', x: 70, y: 480, size: 44, opacity: 0.72, motion: 'flutter', seconds: 28, delay: -17.3, travel: 1300 },
    { shape: 'oak-orange', x: 215, y: 470, size: 30, opacity: 0.8, motion: 'flutter', seconds: 44, delay: -10.4, travel: 1300 },
    { shape: 'ginkgo-gold', x: 380, y: 490, size: 40, opacity: 0.75, motion: 'flutter', seconds: 30, delay: -25.6, travel: 1300 },
    { shape: 'maple-orange', x: 560, y: 495, size: 38, opacity: 0.78, motion: 'flutter', seconds: 34, delay: -16, travel: 1300 },
    { shape: 'oak-brown', x: 720, y: 470, size: 28, opacity: 0.85, motion: 'flutter', seconds: 46, delay: -4.1, travel: 1300 },
    { shape: 'ginkgo-orange', x: 890, y: 490, size: 38, opacity: 0.78, motion: 'flutter', seconds: 34, delay: -24.1, travel: 1300 },
    { shape: 'maple-brown', x: 1050, y: 490, size: 44, opacity: 0.72, motion: 'flutter', seconds: 26, delay: -8.5, travel: 1300 },
    { shape: 'oak-red', x: 1230, y: 470, size: 30, opacity: 0.8, motion: 'flutter', seconds: 42, delay: -39.6, travel: 1300 },
    { shape: 'maple-gold', x: 1400, y: 490, size: 40, opacity: 0.75, motion: 'flutter', seconds: 30, delay: -16.9, travel: 1300 },
    { shape: 'acorn', x: 1560, y: 500, size: 28, opacity: 0.85, motion: 'flutter', seconds: 44, delay: -7.9, travel: 1300 },
    { shape: 'oak-gold', x: 1700, y: 470, size: 28, opacity: 0.85, motion: 'flutter', seconds: 46, delay: -36.7, travel: 1300 },
    { shape: 'maple-red', x: 1845, y: 490, size: 38, opacity: 0.78, motion: 'flutter', seconds: 32, delay: -13.3, travel: 1300 },
  ],

  // Big, faint leaves falling behind the panels. They show only in the margins, and
  // go behind the frames' edges as they fall. The resting places are in the margins
  // too, so in calm motion they look like leaves that have settled at the edges.
  // Slow, so they never compete with the text.
  back: [
    { shape: 'maple-red', x: 4, y: 600, size: 30, opacity: 0.55, motion: 'fall', seconds: 54, delay: -20, travel: 1500 },
    { shape: 'ginkgo-gold', x: 1888, y: 520, size: 28, opacity: 0.55, motion: 'fall', seconds: 48, delay: -33, travel: 1500 },
  ],

  front: [
    // A leaf falling down each margin and the gap between the columns
    { zone: 'left', shape: 'maple-orange', x: 8, y: 130, size: 14, motion: 'fall', seconds: 24, delay: -6, travel: 800 },
    { zone: 'right', shape: 'maple-red', x: 8, y: 480, size: 14, motion: 'fall', seconds: 22, delay: -15, travel: 900 },
    { zone: 'gutter', shape: 'maple-gold', x: 5, y: 120, size: 10, motion: 'fall', seconds: 17, delay: -7, travel: 420 },

    // A vine along the top edge, with four leaves hanging from it. The two big ones swing
    { zone: 'top', shape: 'vine-top', x: 0, y: 0, size: 1920 },
    { zone: 'top', shape: 'hang-maple-red', x: 300, y: 8, size: 17, motion: 'sway', seconds: 4.6, delay: -1 },
    { zone: 'top', shape: 'hang-oak-orange', x: 880, y: 8, size: 10 },
    { zone: 'top', shape: 'hang-ginkgo-gold', x: 1330, y: 8, size: 17, motion: 'sway', seconds: 5, delay: -2 },
    { zone: 'top', shape: 'hang-elm-olive', x: 1740, y: 7, size: 10 },

    // A thinner vine in each gap above the ticker, with a leaf blowing along it
    { zone: 'string-a', shape: 'vine-a', x: 0, y: 0, size: 836 },
    { zone: 'string-a', shape: 'blown-leaf-red', x: 420, y: 5, size: 11, motion: 'drift', seconds: 26, delay: -10, travel: 1100 },
    { zone: 'string-b', shape: 'vine-b', x: 0, y: 0, size: 654 },
    { zone: 'string-b', shape: 'blown-leaf-gold', x: 330, y: 5, size: 11, motion: 'drift', seconds: 22, delay: -6, travel: 900 },

    // Leaves and acorns in the cut corner of the large panel, and an acorn that
    // swings in the cut corner of the countdown
    { zone: 'corner-a', shape: 'spray', x: 0, y: 0, size: 96 },
    { zone: 'corner-b', shape: 'hang-cluster', x: 15, y: 0, size: 22, motion: 'sway', seconds: 5, delay: -1.5 },
  ],
};
