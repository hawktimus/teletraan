// The slices of the status donut (panels/monday-pie): plain geometry with no page in it, so tests/monday-pie.test.mjs can
// run it. A slice is a ring segment drawn as one SVG path. The first slice starts at the top and they go clockwise.

const mostSweep = 359.9;

function round(number) {
  return Math.round(number * 100) / 100;
}

function pointAt(cx, cy, radius, degrees) {
  const angle = (degrees - 90) * (Math.PI / 180);
  return [round(cx + radius * Math.cos(angle)), round(cy + radius * Math.sin(angle))];
}

// The path of one ring segment from one angle to another, in degrees from the top. A full circle is kept a little short, because
// an arc cannot start and end at the same point.
export function slicePath(cx, cy, outer, inner, fromDegrees, toDegrees) {
  const sweep = Math.min(toDegrees - fromDegrees, mostSweep);
  const end = fromDegrees + sweep;
  const large = sweep > 180 ? 1 : 0;
  const outerStart = pointAt(cx, cy, outer, fromDegrees);
  const outerEnd = pointAt(cx, cy, outer, end);
  const innerEnd = pointAt(cx, cy, inner, end);
  const innerStart = pointAt(cx, cy, inner, fromDegrees);

  return 'M' + outerStart.join(' ') + ' A' + outer + ' ' + outer + ' 0 ' + large + ' 1 ' + outerEnd.join(' ')
    + ' L' + innerEnd.join(' ') + ' A' + inner + ' ' + inner + ' 0 ' + large + ' 0 ' + innerStart.join(' ') + ' Z';
}

// The slices for a list of { status, count }: those with a count, each with its share of the whole, its angles and its path.
// The shares are rounded so that they add up to 100.
export function pieSlices(counts, cx, cy, outer, inner) {
  const shown = counts.filter(item => item.count > 0);
  const total = shown.reduce((sum, item) => sum + item.count, 0);
  if (total === 0) return [];

  const percents = shown.map(item => Math.floor((item.count * 100) / total));
  let left = 100 - percents.reduce((sum, value) => sum + value, 0);
  const order = shown.map((item, at) => at).sort((a, b) => ((shown[b].count * 100) % total) - ((shown[a].count * 100) % total) || a - b);
  order.forEach(at => {
    if (left > 0) {
      percents[at] += 1;
      left -= 1;
    }
  });

  let from = 0;
  return shown.map((item, at) => {
    const to = from + (item.count / total) * 360;
    const slice = { status: item.status, count: item.count, percent: percents[at], from: round(from), to: round(to), path: slicePath(cx, cy, outer, inner, from, to) };
    from = to;
    return slice;
  });
}
