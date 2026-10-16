// The drawings of the shipped subthemes (core/subtheme-presets.js): snow caps, icicles, bulbs,
// pumpkins, bats, a ribbon, confetti and the rest. Each function gives the inside of one svg as
// text, for a box of w by h pixels. The svg has the size of its anchor and clips what is drawn
// past it. Nothing here moves: a shape that moves has data-move="name", and subthemes.css plays
// the motion, in full motion only. Colors are classes (sb-snow, sb-orange...), and each class
// takes its color from a --subtheme-* token in tokens.css.
//
// Every function is plain text work with no page in sight, so the tests can run it.

const tenth = value => Math.round(value * 10) / 10;

function path(cls, d, extra) {
  return '<path class="' + cls + '" d="' + d + '"' + (extra || '') + '/>';
}

function dot(cx, cy, r) {
  return 'M' + tenth(cx - r) + ' ' + tenth(cy) + 'a' + r + ' ' + r + ' 0 1 0 ' + 2 * r + ' 0a' + r + ' ' + r + ' 0 1 0 ' + -2 * r + ' 0Z';
}

function ellipse(cx, cy, rx, ry) {
  return 'M' + tenth(cx - rx) + ' ' + tenth(cy) + 'a' + rx + ' ' + ry + ' 0 1 0 ' + 2 * rx + ' 0a' + rx + ' ' + ry + ' 0 1 0 ' + -2 * rx + ' 0Z';
}

// A drawing made for the top left corner of its box, turned to the corner a cut is at
export function inCorner(corner, w, h, inside) {
  const turn = {
    tl: '',
    tr: ' transform="translate(' + w + ' 0) scale(-1 1)"',
    bl: ' transform="translate(0 ' + h + ') scale(1 -1)"',
    br: ' transform="translate(' + w + ' ' + h + ') scale(-1 -1)"',
  }[corner] || '';
  return turn === '' ? inside : '<g' + turn + '>' + inside + '</g>';
}

// ---- Halloween

const swagWidth = 200;

// A string hung in swags along a bar, with a triangle flag every so often, orange and purple. The
// flags are as tall as the box allows.
export function garland(w, h) {
  const sag = Math.round(h * 0.22);
  const tall = Math.round(h * 0.55);
  const half = Math.round(tall * 0.6);
  let string = '';
  let orange = '';
  let purple = '';
  let index = 0;

  for (let x = 0; x < w; x += swagWidth) {
    const end = Math.min(x + swagWidth, w);
    const span = end - x;
    string += (x === 0 ? 'M0 3' : '') + 'Q' + tenth(x + span / 2) + ' ' + (3 + sag * 2) + ' ' + end + ' 3';

    for (let k = 1; k <= 6; k++) {
      const t = k / 7;
      const px = x + span * t;
      const py = 3 + sag * 4 * t * (1 - t);
      const flag = 'M' + tenth(px - half) + ' ' + tenth(py) + 'L' + tenth(px + half) + ' ' + tenth(py) + 'L' + tenth(px) + ' ' + tenth(Math.min(h - 1, py + tall)) + 'Z';
      if (index % 2 === 0) orange += flag;
      else purple += flag;
      index += 1;
    }
  }
  return path('sb-string', string) + path('sb-orange', orange) + path('sb-purple', purple);
}

// Two pumpkins side by side, the big one with a face
export function pumpkins(w, h) {
  const bigX = w * 0.38;
  const bigY = h - 14;
  const smallX = w - 12;
  const smallY = h - 9;
  const bodies = ellipse(bigX, bigY, 13, 11) + ellipse(smallX, smallY, 8, 7);
  const ribs = 'M' + tenth(bigX - 5) + ' ' + (bigY - 10) + 'Q' + tenth(bigX - 10) + ' ' + bigY + ' ' + tenth(bigX - 5) + ' ' + (bigY + 10)
    + 'M' + tenth(bigX + 5) + ' ' + (bigY - 10) + 'Q' + tenth(bigX + 10) + ' ' + bigY + ' ' + tenth(bigX + 5) + ' ' + (bigY + 10)
    + 'M' + tenth(smallX - 3) + ' ' + (smallY - 6) + 'Q' + tenth(smallX - 6) + ' ' + smallY + ' ' + tenth(smallX - 3) + ' ' + (smallY + 6);
  const stems = 'M' + tenth(bigX - 2) + ' ' + (bigY - 10) + 'l1-5h4l1 5Z' + 'M' + tenth(smallX - 1) + ' ' + (smallY - 6) + 'l1-4h3l1 4Z';
  const face = 'M' + tenth(bigX - 6) + ' ' + (bigY - 3) + 'l3-4 3 4Z' + 'M' + tenth(bigX + 1) + ' ' + (bigY - 3) + 'l3-4 3 4Z'
    + 'M' + tenth(bigX - 6) + ' ' + (bigY + 3) + 'l2 3h8l2-3-3 1-1-2-2 2-2-2-1 2Z';
  return path('sb-orange', bodies) + path('sb-orange-deep', ribs) + path('sb-stem', stems) + path('sb-ink', face);
}

// A web in a cut: rays from the corner and three rings that sag between them, drawn once. The
// box is the two legs of the cut, and the drawing is made for the top left corner.
export function web(w, h) {
  const rays = 5;
  const points = [];
  let d = '';

  for (let i = 0; i < rays; i++) {
    const angle = (Math.PI / 2) * (i / (rays - 1));
    const length = 0.97 / (Math.cos(angle) / w + Math.sin(angle) / h);
    points.push([Math.cos(angle) * length, Math.sin(angle) * length]);
    d += 'M0 0L' + tenth(points[i][0]) + ' ' + tenth(points[i][1]);
  }
  [0.32, 0.58, 0.84].forEach(ring => {
    for (let i = 0; i < rays - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const pull = ring * 0.86;
      d += 'M' + tenth(a[0] * ring) + ' ' + tenth(a[1] * ring) + 'Q' + tenth(((a[0] + b[0]) / 2) * pull) + ' ' + tenth(((a[1] + b[1]) / 2) * pull) + ' ' + tenth(b[0] * ring) + ' ' + tenth(b[1] * ring);
    }
  });

  const spiderX = points[2][0] * 0.58;
  const spiderY = points[2][1] * 0.58;
  let legs = dot(spiderX, spiderY, 2.4);
  [-1, 1].forEach(side => {
    [-3, 0, 3].forEach(spread => {
      legs += 'M' + tenth(spiderX) + ' ' + tenth(spiderY) + 'l' + tenth(side * 5) + ' ' + spread;
    });
  });
  return '<path class="sb-web" pathLength="1" data-move="draw" d="' + d + '"/>' + path('sb-spider', legs);
}

// One bat, wings spread, with its middle at 0 0
const batShape = 'M0-1C-5-9-13-8-15-3C-12-4-10-2-9 1C-7-1-4 0-3 3L0 1L3 3C4 0 7-1 9 1C10-2 12-4 15-3C13-8 5-9 0-1ZM-3-3L-2-7L0-3L2-7L3-3Z';

// Bats sitting along a bar, as big as the box allows, each moving a little at its own pace
export function bats(w, h) {
  const places = [0.2, 0.52, 0.81];
  const scale = Math.min(2.8, (h - 4) / 12);
  return places.map((at, index) => {
    const x = tenth(w * at);
    return '<g transform="translate(' + x + ' ' + tenth(h - 3 - scale * 3) + ') scale(' + tenth(scale) + ')"><path class="sb-bat" data-move="flutter" style="--flutter-seconds:' + (3.4 + index * 0.9) + 's;--flutter-delay:' + tenth(index * -1.3) + 's" d="' + batShape + '"/></g>';
  }).join('');
}
