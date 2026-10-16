// Small helpers that write svg for the seasonal pieces. They only make text: nothing here moves.

export function round(number) {
  return Math.round(number * 10) / 10;
}

export function polygon(points, fill) {
  return '<polygon points="' + points + '" fill="' + fill + '"/>';
}

// A polygon from a list of [x, y] pairs
export function shape(pairs, fill) {
  return polygon(pairs.map(pair => round(pair[0]) + ',' + round(pair[1])).join(' '), fill);
}

// A rectangle, written as a polygon
export function block(x, y, width, height, fill) {
  return shape([[x, y], [x + width, y], [x + width, y + height], [x, y + height]], fill);
}

// The same pairs seen in a mirror that stands at x = width / 2, listed in reverse
// so the points still go round the same way
export function mirror(pairs, width) {
  return pairs.map(pair => [width - pair[0], pair[1]]).reverse();
}

// A thin four sided piece from (x1, y1) to (x2, y2), wider at the start. It is
// meant for things that point up: the left half is lit and the right half in shade.
export function limb(x1, y1, x2, y2, width1, width2, lit, shade) {
  const length = Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
  const nx = -(y2 - y1) / length;
  const ny = (x2 - x1) / length;
  const right = [[x1 + nx * width1 / 2, y1 + ny * width1 / 2], [x2 + nx * width2 / 2, y2 + ny * width2 / 2]];
  const left = [[x1 - nx * width1 / 2, y1 - ny * width1 / 2], [x2 - nx * width2 / 2, y2 - ny * width2 / 2]];
  return shape([left[0], [x1, y1], [x2, y2], left[1]], lit) + shape([[x1, y1], right[0], right[1], [x2, y2]], shade);
}

// An octagon, the faceted stand-in for a circle, with its right half in shade
export function ball(cx, cy, r, lit, shade) {
  const s = r * 0.38;
  const whole = [[cx - s, cy - r], [cx + s, cy - r], [cx + r, cy - s], [cx + r, cy + s], [cx + s, cy + r], [cx - s, cy + r], [cx - r, cy + s], [cx - r, cy - s]];
  const half = [[cx, cy - r], [cx + s, cy - r], [cx + r, cy - s], [cx + r, cy + s], [cx + s, cy + r], [cx, cy + r]];
  return shape(whole, lit) + shape(half, shade);
}

// A point on a circle round (c, c). The angle is 0 straight up and grows clockwise.
export function polar(c, radius, angle) {
  return [c + radius * Math.sin(angle), c - radius * Math.cos(angle)];
}
