// The New Year's pack. It follows christmas.js, the model for every pack:
// docs/seasonal-packs.md explains each part.
//
// What it draws:
//   - a firework burst in place of the slashes at the right of every panel
//     header: gold and silver rays round a bright middle (mark)
//   - confetti, stars and two balloons that fall, tumble and rise across the whole
//     screen over the panels, and two sparkles in the margins that twinkle (over)
//   - in the empty places: fireworks, lines that draw themselves out from a point
//     and wipe away, in the margins and over the skyline
//   - a night skyline along the bottom edge, with a ball on a tall pole and
//     lit windows, a third of which twinkle
//   - a foil fringe along the top edge, whose strands shimmer in three groups
//   - bunting in the gap above the ticker
//   - two party hats and a folded streamer in one cut corner, and a clock at
//     midnight in the other
//
// The pack is data. It holds no keyframes and no animation code: a piece names a
// motion ('flutter', 'draw', 'twinkle'...) and seasons/motion.css plays it, and only
// in full motion. In calm and none motion every firework rests fully drawn, and the
// over layer is not drawn at all.
//
// Every shape is flat polygons with hard edges, in the faceted style of the logo.
// There is no blur, no glow, no shadow and no gradient. There is no text of any
// kind. The colours of the screen's own text are in themes/overlays/new-years.css.

import { shape } from '../core/svg-pieces.js';
import { balloon, bigStar, bunting, burst, clock, cream, diamond, fringeGroups, gold, goldShade, ice, mark, party, rail, rose, sceneMarkup, silver, slip, sparkle, star, strip, tones, windowsTwinkle } from './art/new-years.js';

const shapes = {
  'rect-gold': slip(tones[0]),
  'rect-rose': slip(tones[3]),
  'rect-ice': slip(tones[2]),
  'strip-rose': strip(tones[3]),
  'strip-ice': strip(tones[2]),
  'diamond-silver': diamond(tones[1]),
  'star-gold': bigStar(tones[0]),
  'star-silver': bigStar(tones[1]),
  'sparkle-gold': sparkle(tones[0]),
  'sparkle-silver': sparkle(tones[1]),
  'balloon-gold': balloon(tones[0], cream),
  'balloon-silver': balloon(tones[1], '#ffffff'),
  'burst-gold': burst(gold, silver),
  'burst-silver': burst(silver, ice),
  'burst-rose': burst(rose, gold),
  'burst-ice': burst(ice, silver),
  'rail': rail,
  'fringe-0': fringeGroups[0],
  'fringe-1': fringeGroups[1],
  'fringe-2': fringeGroups[2],
  'bunting-a': bunting(836, 14, 8, 0.8, 2, 4),
  'bunting-b': bunting(654, 14, 6, 0.8, 2, 4),
  'party': party,
  'clock': clock,
  'star': { viewBox: '0 0 14 14', markup: star(7, 7.6, 7, 3, gold, goldShade) },
  'windows': { viewBox: '0 -4 1920 26', markup: windowsTwinkle.join('') },
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
  defaults: { cornerArt: 'fireworks' },

  // Over the panels: ten pieces that fall, tumble or rise across the whole screen, and
  // two sparkles that twinkle in the margins, where there is no text. Confetti,
  // stars and a diamond flutter or fall, slowly: a trip takes 26 to 48 seconds, so a
  // piece is only over a letter for a moment, and each is faint enough (opacity .7
  // to .85, the bigger the fainter) that the word shows through it. Two balloons rise,
  // the slowest pieces of all. The pieces are spread over the width of the screen (each in a column of its
  // own) and over the stages of their trips (golden ratio steps, so there is no
  // pattern), so the first screen already has pieces at every height and the screen
  // is never empty and never crowded. This layer carries all of the confetti: none
  // falls behind the panels or in the margins, because a pack may only move about
  // 24 pieces in all.
  over: [
    { shape: 'star-gold', x: 70, y: 520, size: 44, opacity: 0.7, motion: 'flutter', seconds: 30, delay: -6, travel: 1300 },
    { shape: 'rect-rose', x: 293, y: 525, size: 44, opacity: 0.75, motion: 'flutter', seconds: 36, delay: -29.4, travel: 1300 },
    { shape: 'strip-ice', x: 459, y: 530, size: 28, opacity: 0.8, motion: 'flutter', seconds: 42, delay: -18.3, travel: 1300 },
    { shape: 'balloon-gold', x: 680, y: 520, size: 40, opacity: 0.75, motion: 'rise', seconds: 46, delay: -2.5, travel: 1400 },
    { shape: 'diamond-silver', x: 846, y: 525, size: 32, opacity: 0.8, motion: 'fall', seconds: 34, delay: -22.9, travel: 1300 },
    { shape: 'rect-gold', x: 1005, y: 530, size: 40, opacity: 0.75, motion: 'flutter', seconds: 26, delay: -7.5, travel: 1300 },
    { shape: 'star-silver', x: 1232, y: 520, size: 36, opacity: 0.75, motion: 'flutter', seconds: 38, delay: -34.5, travel: 1300 },
    { shape: 'strip-rose', x: 1404, y: 525, size: 24, opacity: 0.8, motion: 'flutter', seconds: 48, delay: -25.3, travel: 1300 },
    { shape: 'rect-ice', x: 1619, y: 530, size: 36, opacity: 0.8, motion: 'flutter', seconds: 40, delay: -5.8, travel: 1300 },
    { shape: 'balloon-silver', x: 1782, y: 520, size: 36, opacity: 0.75, motion: 'rise', seconds: 54, delay: -41.2, travel: 1400 },
    { shape: 'sparkle-gold', x: 0, y: 640, size: 30, opacity: 0.85, motion: 'twinkle', seconds: 3.4, delay: -1 },
    { shape: 'sparkle-silver', x: 1892, y: 420, size: 28, opacity: 0.85, motion: 'twinkle', seconds: 4.2, delay: -2.5 },
  ],

  front: [
    // Fireworks in the margins. They start at different times, so there is nearly
    // always one drawing and one fading. The gap between the two columns is 20 px
    // wide, too narrow for a firework to show, so it has none.
    { zone: 'left', shape: 'burst-gold', x: 0, y: 110, size: 30, motion: 'draw', seconds: 6.5, delay: -1 },
    { zone: 'left', shape: 'burst-ice', x: 0, y: 470, size: 30, motion: 'draw', seconds: 7.5, delay: -4.5 },
    { zone: 'right', shape: 'burst-rose', x: 0, y: 210, size: 30, motion: 'draw', seconds: 7, delay: -2.5 },
    { zone: 'right', shape: 'burst-silver', x: 0, y: 590, size: 30, motion: 'draw', seconds: 6, delay: -5 },

    // The foil fringe along the top edge: the rail stays, and the three groups of
    // strands shimmer one after another
    { zone: 'top', shape: 'rail', x: 0, y: 0, size: 1920 },
    { zone: 'top', shape: 'fringe-0', x: 0, y: 0, size: 1920, motion: 'twinkle', seconds: 4.5, delay: 0 },
    { zone: 'top', shape: 'fringe-1', x: 0, y: 0, size: 1920, motion: 'twinkle', seconds: 4.5, delay: -1.5 },
    { zone: 'top', shape: 'fringe-2', x: 0, y: 0, size: 1920, motion: 'twinkle', seconds: 4.5, delay: -3 },

    // Bunting in the gap above the ticker
    { zone: 'string-a', shape: 'bunting-a', x: 0, y: 0, size: 836 },
    { zone: 'string-b', shape: 'bunting-b', x: 0, y: 0, size: 654 },

    // Two hats and a streamer in the cut corner of the large panel, with a star that swells
    { zone: 'corner-a', shape: 'party', x: 0, y: 0, size: 96 },
    { zone: 'corner-a', shape: 'star', x: 76, y: 0, size: 14, motion: 'pulse', seconds: 4, delay: -1 },

    // The clock in the cut corner of the countdown
    { zone: 'corner-b', shape: 'clock', x: 11, y: 2, size: 30 },

    // Along the skyline: a third of the windows twinkle, and two fireworks
    { zone: 'ground', shape: 'windows', x: 0, y: 0, size: 1920, motion: 'twinkle', seconds: 5, delay: -1 },
    { zone: 'ground', shape: 'burst-gold', x: 840, y: 1, size: 24, motion: 'draw', seconds: 7, delay: -2 },
    { zone: 'ground', shape: 'burst-rose', x: 1300, y: 1, size: 24, motion: 'draw', seconds: 6.5, delay: -5 },
  ],
};
