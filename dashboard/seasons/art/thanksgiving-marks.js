// The mark and the small pieces of the thanksgiving pack: the turkey, leaves and sprays (part of seasons/thanksgiving.js).

import { shape, block, limb } from '../../core/svg-pieces.js';
import { acorn, brown, elm, ginkgo, gold, hanging, maple, oak, olive, orange, put, red, stemBrown, trunk, trunkShade } from './thanksgiving-scene.js';

// The mark: a turkey seen from the front, 60 by 76, which is the biggest a mark may
// be (markBox in core/marks.js). Nine tail feathers in autumn colours fan out behind
// a round brown body with a pale head, a red wattle and an orange beak. Each feather
// is lit on the left and in shade on the right. The lit half of the middle feather is
// in <g class="double-slash">, which base.css paints with --yellow, the accent colour
// that the Thanksgiving overlay makes amber.

const fanMiddle = { x: 30, y: 52 }; // where the feathers start

// A point at a distance from the middle of the fan, at an angle from straight up
function fanPoint(distance, degrees) {
  const a = degrees * Math.PI / 180;
  return [fanMiddle.x + distance * Math.sin(a), fanMiddle.y - distance * Math.cos(a)];
}

// One tail feather: a kite from a narrow base, out to its widest at 60 percent of
// its length, and on to a point. The inner kite is a second colour at the tip.
function tailFeather(degrees, length, colours, tipColours) {
  const base = fanPoint(7, degrees);
  const left = fanPoint(length * 0.6, degrees - 14);
  const right = fanPoint(length * 0.6, degrees + 14);
  const tip = fanPoint(length, degrees);
  const eyeNear = fanPoint(length * 0.56, degrees);
  const eyeLeft = fanPoint(length * 0.72, degrees - 6);
  const eyeRight = fanPoint(length * 0.72, degrees + 6);
  const eyeFar = fanPoint(length * 0.9, degrees);

  return shape([base, left, tip], colours[0]) + shape([base, tip, right], colours[1]) +
    shape([eyeNear, eyeLeft, eyeFar], tipColours[0]) + shape([eyeNear, eyeFar, eyeRight], tipColours[1]);
}

const turkeyBody = '#9a6232';
const turkeyBodyShade = '#74461f';
const turkeyBreast = '#c99358';
const turkeyBreastShade = '#a9743a';
const turkeyHead = '#f2d7ae';
const turkeyHeadShade = '#d2ab78';
const beak = '#f0a028';
const wattle = '#d8322a';
const legs = '#c08a28';

// The feathers, outer ones first so that the middle ones lie on top: the angle from
// straight up, the length, the colours of the lit and shaded half, and the colours
// of the kite at the tip
const tail = [
  [-80, 27, brown, gold],
  [80, 27, brown, gold],
  [-60, 31, olive, brown],
  [60, 31, olive, brown],
  [-40, 36, red, gold],
  [40, 36, red, gold],
  [-20, 41, orange, red],
  [20, 41, orange, red],
];

const turkeyMark =
  tail.map(item => tailFeather(item[0], item[1], item[2], item[3])).join('') +
  '<g class="double-slash">' + shape([fanPoint(7, 0), fanPoint(27, -14), fanPoint(45, 0)], gold[0]) + '</g>' +
  shape([fanPoint(7, 0), fanPoint(45, 0), fanPoint(27, 14)], gold[1]) +
  shape([fanPoint(25, 0), fanPoint(32.4, -6), fanPoint(40.5, 0)], red[0]) + shape([fanPoint(25, 0), fanPoint(40.5, 0), fanPoint(32.4, 6)], red[1]) +
  // the legs and feet
  block(23.4, 68, 2.6, 6, legs) + block(34, 68, 2.6, 6, legs) +
  shape([[19, 76], [26.2, 76], [25, 72]], legs) + shape([[33.8, 76], [41, 76], [35, 72]], legs) +
  // the body
  shape([[23, 37], [30, 37], [30, 70], [22, 70], [15, 60], [15, 45]], turkeyBody) +
  shape([[30, 37], [37, 37], [45, 45], [45, 60], [38, 70], [30, 70]], turkeyBodyShade) +
  shape([[30, 43], [23, 52], [30, 65]], turkeyBreast) + shape([[30, 43], [30, 65], [37, 52]], turkeyBreastShade) +
  // the head, with its beak and wattle
  shape([[30, 20], [25, 22.4], [23.4, 28], [26, 34.6], [30, 35]], turkeyHead) + shape([[30, 20], [35, 22.4], [36.6, 28], [34, 34.6], [30, 35]], turkeyHeadShade) +
  shape([[27.6, 29], [32.4, 29], [30, 36]], beak) +
  shape([[30, 34.4], [34.4, 34.4], [32.4, 42]], wattle) +
  block(26.2, 24.4, 2.2, 2.2, '#2a1a10') + block(31.6, 24.4, 2.2, 2.2, '#2a1a10');

export const mark = { viewBox: '0 0 60 76', markup: turkeyMark };


// The shapes the pieces use, each drawn once

// A spray of leaves and acorns for the cut corner of the large panel: a twig
// rising to the right, with leaves along it and two acorns hanging
export const spray = {
  viewBox: '0 0 96 28',
  markup: limb(2, 25, 74, 8, 2.6, 1, trunk, trunkShade) +
    put(maple.make(red), 8, 7, 15, -20, 24, 24) +
    put(oak.make(orange), 26, 4, 7, 55, 16, 28) +
    put(maple.make(gold), 36, 3, 15, 25, 24, 24) +
    put(ginkgo.make(orange), 52, 6, 14, -30, 24, 24) +
    put(oak.make(olive), 66, 3, 7, -20, 16, 28) +
    put(acorn.make(), 24, 16, 8, 0, 14, 18) +
    put(acorn.make(), 56, 12, 8, 0, 14, 18) +
    put(maple.make(brown), 76, 3, 16, 15, 24, 24),
};

// An acorn and a leaf hanging from one stem, for the cut corner of the countdown
export const cluster = {
  viewBox: '0 0 22 34',
  markup: block(10.5, 0, 1, 12, stemBrown) +
    put(acorn.make(), 6, 11, 10, 0, 14, 18) +
    put(hanging(elm, olive).make(), 13, 1, 7, 0, 14, 26),
};
