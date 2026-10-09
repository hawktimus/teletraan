// The line art a seasonal pack can draw in the cut corners of the large panel and the
// countdown (core/season.js, cornerPlaces). There are four ornaments, drawn by hand
// in a 28 by 28 box. Each is a few paths with a stroke and no fill, and the stroke is
// 3 px, so every coordinate stays 1.5 px or more inside the box. The colour is the
// pack's accent colour (currentColor, set in seasons/season.css).
//
// Every path has pathLength="1" and stroke-dasharray="1", which is what the draw
// keyframes in seasons/motion.css need to draw the lines in once. This file holds no
// animation. docs/seasonal-packs.md, "Corner art", explains the rest.

export const cornerArtSize = 28;
export const cornerArtLine = 3;

// The id a rule uses to ask for no corner art at all, whatever the pack's own is
export const cornerArtNone = 'none';

const ornaments = {
  leaves: [
    'M14 2.5L15.8 8.2L21.4 4.6L19.2 11.4L26 12.4L20.4 16.4L22.2 20.2L15.6 18.6L14 21L12.4 18.6L5.8 20.2L7.6 16.4L2 12.4L8.8 11.4L6.6 4.6L12.2 8.2Z',
    'M14 21L14 25.5',
  ],
  snowflakes: [
    'M14 2.5L14 25.5',
    'M24 8.3L4 19.8',
    'M24 19.8L4 8.3',
    'M23.6 16.4L21.2 14L23.6 11.6',
    'M20.9 6.9L17.6 7.8L16.7 4.5',
    'M11.3 4.5L10.4 7.8L7.1 6.9',
    'M4.4 11.6L6.8 14L4.4 16.4',
    'M7.1 21.1L10.4 20.2L11.3 23.5',
    'M16.7 23.5L17.6 20.2L20.9 21.1',
  ],
  gears: [
    'M16.1 6.1L15.8 2.3L12.2 2.3L11.9 6.1L8.2 8.2L4.8 6.6L3 9.8L6.1 11.9L6.1 16.1L3 18.2L4.8 21.4L8.2 19.8L11.9 21.9L12.2 25.7L15.8 25.7L16.1 21.9L19.8 19.8L23.2 21.4L25 18.2L21.9 16.1L21.9 11.9L25 9.8L23.2 6.6L19.8 8.2Z',
    'M14 10.8A3.2 3.2 0 1 0 14 17.2A3.2 3.2 0 1 0 14 10.8Z',
  ],
  fireworks: [
    'M14 7.5L14 2',
    'M18.6 9.4L21.1 6.9',
    'M20.5 14L26 14',
    'M18.6 18.6L21.1 21.1',
    'M14 20.5L14 26',
    'M9.4 18.6L6.9 21.1',
    'M7.5 14L2 14',
    'M9.4 9.4L6.9 6.9',
  ],
};

// The ids of the four ornaments, in the order Studio lists them
export const cornerArtIds = Object.keys(ornaments);

// The ids a rule may name: the ornaments, and none for a rule that wants no corner art
export const cornerArtChoices = cornerArtIds.concat([cornerArtNone]);

export function isCornerArt(id) {
  return cornerArtIds.indexOf(id) !== -1;
}

// The paths of one ornament, as the d of each. An id that is not an ornament has none.
export function cornerArtPaths(id) {
  return isCornerArt(id) ? ornaments[id].slice() : [];
}

// The inside of the svg for one ornament, or '' for an id that is not an ornament
export function cornerArtMarkup(id) {
  return cornerArtPaths(id).map(d =>
    '<path d="' + d + '" pathLength="1" stroke-dasharray="1" fill="none" stroke="currentColor" stroke-width="' + cornerArtLine + '" stroke-linejoin="round"/>').join('');
}

// Points along a circular arc from one point to another, for cornerArtPoints. large and
// sweep are the two flags of the svg arc command: the long way round, and the direction.
function arcPoints(from, to, radius, large, sweep) {
  const chord = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const r = Math.max(radius, chord / 2);
  const height = Math.sqrt(Math.max(0, r * r - chord * chord / 4));
  const middle = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
  const across = [-(to[1] - from[1]) / chord, (to[0] - from[0]) / chord];

  // The two circles through both points. The right one turns the way sweep says, by more than half a circle when large
  const turn = centre => {
    const start = Math.atan2(from[1] - centre[1], from[0] - centre[0]);
    let end = Math.atan2(to[1] - centre[1], to[0] - centre[0]) - start;
    while (sweep && end <= 0) end += 2 * Math.PI;
    while (!sweep && end >= 0) end -= 2 * Math.PI;
    return { centre: centre, start: start, end: end };
  };
  const options = [1, -1].map(side => turn([middle[0] + side * height * across[0], middle[1] + side * height * across[1]]));
  const wanted = options.find(option => (Math.abs(option.end) > Math.PI + 1e-9) === large) || options[0];

  const points = [];
  for (let step = 1; step <= 24; step++) {
    const angle = wanted.start + wanted.end * step / 24;
    points.push([wanted.centre[0] + r * Math.cos(angle), wanted.centre[1] + r * Math.sin(angle)]);
  }
  return points;
}

// Every point along the paths of one ornament, as [x, y], with the arcs sampled. The
// tests and tools/check-seasons.mjs use it to see that the lines stay inside the box.
// Only absolute M, L, A (a circle) and Z are used.
export function cornerArtPoints(id) {
  const points = [];

  cornerArtPaths(id).forEach(d => {
    const parts = d.match(/[A-Za-z]|-?\d*\.?\d+/g) || [];
    let at = null;
    let start = null;
    let index = 0;

    while (index < parts.length) {
      const command = parts[index++];
      if (command === 'Z') {
        at = start;
        points.push(start);
      } else if (command === 'A') {
        const numbers = parts.slice(index, index + 7).map(Number);
        index += 7;
        arcPoints(at, [numbers[5], numbers[6]], numbers[0], numbers[3] === 1, numbers[4] === 1).forEach(point => points.push(point));
        at = [numbers[5], numbers[6]];
      } else if (command === 'M' || command === 'L') {
        at = [Number(parts[index++]), Number(parts[index++])];
        points.push(at);
        if (command === 'M') start = at;
      } else {
        throw new Error('the ornament "' + id + '" uses the path command ' + command + ', and only M, L, A and Z are drawn here');
      }
    }
  });
  return points;
}
