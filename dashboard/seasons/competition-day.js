// The Competition Day pack: race day in the pit lane. It is built the way
// christmas.js is, the model for the packs. docs/seasonal-packs.md explains every part.
//
// What it draws:
//   - a chequered flag on a gold pole in place of the slashes at the right of
//     every panel header (mark)
//   - twelve pieces over the panels, across the whole screen: gears, little
//     chequered flags, chequer tiles, confetti and sparks, falling or rising
//     slowly (over)
//   - in the empty places: a line of pennants along the top edge, with a start
//     light gantry in the middle and two chequered banners that swing beside it
//   - a gear and sparks in each cut corner, and a wrench
//   - a chequered strip along each side margin, and a dashed pit lane line in the gap
//     between the two columns
//   - two chequered ribbons above the ticker
//   - a pit lane along the bottom edge: a chequered kerb, tyre stacks, cones,
//     tool boxes, flags, light towers and pit robots, with a race car and a
//     robot that cross it now and then
//
// The pack is data. It holds no keyframes and no animation code: a piece names a
// motion ('spin', 'draw', 'sweep'...) and seasons/motion.css plays it, and only
// in full motion. The colours are written out here and not taken from the theme,
// so the flag stays black and white and the gold stays gold whatever theme is
// on. The accent colours of the screen's own text are in
// themes/overlays/competition-day.css.
//
// Every shape is flat polygons with hard edges, in the faceted style of the
// logo. There is no blur, no glow, no shadow and no gradient.

import { shape } from '../core/svg-pieces.js';
import { banner, bigGear, bunting, car, chequer, confetti, flagOnStick, gantry, gear, glint, gold, goldShade, goldSquares, laneDashes, mark, ribbon, rover, sceneMarkup, spark, startLights, steel, tile, violet, violetLit, violetShade, violetSquares, white, whiteShade, wrench } from './art/competition-day.js';

// The shapes the pieces use, each drawn once
const shapes = {
  'confetti-gold': { viewBox: '0 0 10 16', markup: confetti(gold, goldShade) },
  'confetti-white': { viewBox: '0 0 10 16', markup: confetti(white, whiteShade) },
  'confetti-violet': { viewBox: '0 0 10 16', markup: confetti(violetLit, violetShade) },
  'bunting': { viewBox: '0 0 1920 26', markup: bunting() },
  'gantry': { viewBox: '0 0 140 22', markup: gantry() },
  'lights-a': { viewBox: '0 0 140 22', markup: startLights([0, 3]) },
  'lights-b': { viewBox: '0 0 140 22', markup: startLights([1, 4]) },
  'lights-c': { viewBox: '0 0 140 22', markup: startLights([2]) },
  'banner': banner,
  'gear-big': { viewBox: '0 0 26 26', markup: gear(26, 10, gold, goldShade) },
  'gear-corner': { viewBox: '0 0 30 30', markup: gear(30, 10, gold, goldShade) },
  'spark': { viewBox: '0 0 22 22', markup: spark(22, [gold, white]) },
  'spark-small': { viewBox: '0 0 16 16', markup: spark(16, [white, gold]) },
  'wrench': wrench,
  'edge-left': { viewBox: '0 0 6 690', markup: chequer(0, 0, 2, 230, 3, violet, white) },
  'edge-right': { viewBox: '0 0 6 846', markup: chequer(0, 0, 2, 282, 3, violet, white) },
  'lane': { viewBox: '0 0 20 342', markup: laneDashes() },
  'ribbon-a': { viewBox: '0 0 836 14', markup: ribbon(836) },
  'ribbon-b': { viewBox: '0 0 654 14', markup: ribbon(654) },
  'car': car,
  'rover': rover,

  // The shapes of the pieces over the panels
  'gear-gold': bigGear(40, 10, gold, goldShade),
  'gear-violet': bigGear(32, 10, '#a56cf0', '#7a35cc'),
  'gear-white': bigGear(26, 8, white, '#9a97b8'),
  'flag-violet': { viewBox: '0 0 28 34', markup: flagOnStick(violetSquares, gold) },
  'flag-gold': { viewBox: '0 0 28 34', markup: flagOnStick(goldSquares, steel) },
  'tile-violet': { viewBox: '0 0 20 20', markup: tile(violetSquares) },
  'tile-gold': { viewBox: '0 0 20 20', markup: tile(goldSquares) },
  'glint-gold': { viewBox: '0 0 24 24', markup: glint('#ffe27a', gold) },
  'glint-white': { viewBox: '0 0 24 24', markup: glint(white, whiteShade) },
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

  // 1920 wide and 26 high, from y -4 to 22. Drawn in the "ground" zone along the bottom edge.
  scene: { viewBox: '0 -4 1920 26', markup: sceneMarkup },

  // The picture that replaces the slashes in every panel header
  mark: mark,

  // The corner art a rule gets when it picks none of its own (core/corner-art.js)
  defaults: { cornerArt: 'gears' },

  // Pieces over the panels: gears, little chequered flags, chequer tiles, confetti
  // and glints falling or rising across the whole screen, a finish line
  // celebration in the team colours. The pieces are 22 to 44 px wide. A piece takes
  // 26 to 46 seconds to cross, so it is only over a letter for a moment, and it is
  // faint enough (opacity .7 to .85) that a word shows through it. The big gears
  // are the faintest and the quickest.
  // The delays are spread in steps of a golden ratio of each piece's own round, so
  // the first screen already has pieces at every height. All of the confetti is
  // here: none falls behind the panels, because a pack may only move about 24 pieces.
  over: [
    { shape: 'glint-gold', x: 55, y: 540, size: 34, opacity: 0.85, motion: 'rise', seconds: 26, delay: -3.4, travel: 1100 },
    { shape: 'gear-gold', x: 210, y: 520, size: 44, opacity: 0.7, motion: 'fall', seconds: 26, delay: -19.4, travel: 1300 },
    { shape: 'flag-violet', x: 365, y: 528, size: 40, opacity: 0.8, motion: 'flutter', seconds: 32, delay: -11.7, travel: 1300 },
    { shape: 'confetti-gold', x: 545, y: 532, size: 22, opacity: 0.85, motion: 'flutter', seconds: 38, delay: -37.4, travel: 1300 },
    { shape: 'gear-violet', x: 720, y: 522, size: 38, opacity: 0.75, motion: 'fall', seconds: 34, delay: -20.5, travel: 1300 },
    { shape: 'tile-violet', x: 900, y: 530, size: 30, opacity: 0.8, motion: 'flutter', seconds: 36, delay: -7.9, travel: 1300 },
    { shape: 'glint-white', x: 1070, y: 540, size: 30, opacity: 0.85, motion: 'rise', seconds: 30, delay: -25.1, travel: 1100 },
    { shape: 'gear-white', x: 1235, y: 528, size: 32, opacity: 0.8, motion: 'fall', seconds: 42, delay: -19.2, travel: 1300 },
    { shape: 'flag-gold', x: 1400, y: 524, size: 36, opacity: 0.8, motion: 'flutter', seconds: 34, delay: -2.5, travel: 1300 },
    { shape: 'confetti-violet', x: 1565, y: 532, size: 24, opacity: 0.85, motion: 'flutter', seconds: 44, delay: -30.5, travel: 1300 },
    { shape: 'tile-gold', x: 1730, y: 526, size: 26, opacity: 0.8, motion: 'flutter', seconds: 40, delay: -12.4, travel: 1300 },
    { shape: 'confetti-white', x: 1855, y: 534, size: 22, opacity: 0.85, motion: 'flutter', seconds: 46, delay: -42.7, travel: 1300 },
  ],

  front: [
    // Pennants along the top edge, with the start lights in the middle. The
    // lights are in three groups that come on one after another, and a chequered
    // banner swings at each side.
    { zone: 'top', shape: 'bunting', x: 0, y: 0, size: 1920 },
    { zone: 'top', shape: 'gantry', x: 890, y: 0, size: 140 },
    { zone: 'top', shape: 'lights-a', x: 890, y: 0, size: 140, motion: 'twinkle', seconds: 3, delay: 0 },
    { zone: 'top', shape: 'lights-b', x: 890, y: 0, size: 140, motion: 'twinkle', seconds: 3, delay: -1 },
    { zone: 'top', shape: 'lights-c', x: 890, y: 0, size: 140, motion: 'twinkle', seconds: 3, delay: -2 },
    { zone: 'top', shape: 'banner', x: 846, y: 0, size: 24, motion: 'sway', seconds: 4.4, delay: -1 },
    { zone: 'top', shape: 'banner', x: 1050, y: 0, size: 24, motion: 'sway', seconds: 4.4, delay: -3.2 },

    // The workshop corner of the large panel: a gear, sparks and a wrench
    { zone: 'corner-a', shape: 'gear-big', x: 3, y: 1, size: 26, motion: 'spin', seconds: 9 },
    { zone: 'corner-a', shape: 'spark', x: 31, y: 3, size: 22, motion: 'draw', seconds: 3.2, delay: -0.5 },
    { zone: 'corner-a', shape: 'wrench', x: 57, y: 7, size: 38 },

    // A gear and sparks in the cut corner of the countdown
    { zone: 'corner-b', shape: 'gear-corner', x: 1, y: 2, size: 30, motion: 'spin', seconds: 11, delay: -3 },
    { zone: 'corner-b', shape: 'spark', x: 32, y: 7, size: 20, motion: 'draw', seconds: 3.6, delay: -1.8 },

    // A chequered strip along each side margin, and a pit lane line in the gap
    { zone: 'left', shape: 'edge-left', x: 0, y: 0, size: 6 },
    { zone: 'right', shape: 'edge-right', x: 24, y: 0, size: 6 },
    { zone: 'gutter', shape: 'lane', x: 0, y: 0, size: 20 },

    // Chequered ribbons above the ticker. They stand still: the pieces over the
    // panels take the moving budget
    { zone: 'string-a', shape: 'ribbon-a', x: 0, y: 0, size: 836 },
    { zone: 'string-b', shape: 'ribbon-b', x: 0, y: 0, size: 654 },

    // The pit lane. The race car and the robot rest in the middle of the lane
    // and cross it from one side to the other, once a round and then out of sight
    { zone: 'ground', shape: 'car', x: 860, y: 13, size: 28, motion: 'sweep', seconds: 60, delay: -10, travel: 2300 },
    { zone: 'ground', shape: 'rover', x: 1230, y: 13, size: 26, motion: 'sweep', seconds: 110, delay: -20, travel: 2400 },
    { zone: 'ground', shape: 'spark-small', x: 592, y: 0, size: 16 },
    { zone: 'ground', shape: 'spark-small', x: 1512, y: 0, size: 16 },
  ],
};
