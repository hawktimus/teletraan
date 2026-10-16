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

// ---- Winter

const humpWidths = [96, 64, 120, 80, 104, 72];
const humpHeights = [14, 9, 17, 11, 15, 8];

// A drift of snow along a bar: round humps on a flat strip. rest is the thickness of the strip
// under the humps, and a hump is never taller than the box leaves room for.
export function snowCap(w, h, rest) {
  const base = h - (rest === undefined ? 3 : rest);
  const room = Math.max(4, base - 2);
  let x = 0;
  let i = 0;
  let d = 'M0 ' + h + 'L0 ' + base;

  while (x < w - 1) {
    const span = Math.min(humpWidths[i % humpWidths.length], w - x);
    const rise = Math.min(room, humpHeights[i % humpHeights.length] * (span / humpWidths[i % humpWidths.length] + 0.3) * 1.3);
    const lift = tenth(base - rise * 1.33);
    d += 'C' + tenth(x + span * 0.08) + ' ' + lift + ' ' + tenth(x + span * 0.92) + ' ' + lift + ' ' + tenth(x + span) + ' ' + base;
    x += span;
    i += 1;
  }
  d += 'L' + w + ' ' + h + 'Z';
  return path('sb-snow', d) + path('sb-snow-shade', 'M0 ' + (base + 1) + 'L' + w + ' ' + (base + 1));
}

const icicleSteps = [62, 48, 70, 54];
const icicleLengths = [0.6, 1, 0.72, 0.88, 0.5];

// Icicles hanging from the top edge of the box, with a bright line down each
export function icicles(w, h) {
  let x = 16;
  let i = 0;
  let body = '';
  let shine = '';

  while (x < w - 20) {
    const width = 11 + (i % 3) * 3;
    const length = Math.max(8, tenth(h * icicleLengths[i % icicleLengths.length]));
    body += 'M' + x + ' 0L' + (x + width) + ' 0L' + tenth(x + width / 2) + ' ' + length + 'Z';
    shine += 'M' + tenth(x + width * 0.34) + ' 2L' + tenth(x + width * 0.48) + ' ' + tenth(length * 0.62);
    x += icicleSteps[i % icicleSteps.length];
    i += 1;
  }
  return path('sb-ice', body) + path('sb-ice-shine', shine);
}

// Rays and small feathers from the corner of a cut, the frost on a window. The box is the two legs
// of the cut, and the drawing is made for the top left corner.
export function frostFan(w, h) {
  const rays = 7;
  let d = '';

  for (let i = 0; i < rays; i++) {
    const angle = (Math.PI / 2) * (i / (rays - 1));
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const length = 0.92 / (cos / w + sin / h);
    d += 'M0 0L' + tenth(cos * length) + ' ' + tenth(sin * length);

    [0.5, 0.76].forEach(at => {
      const px = cos * length * at;
      const py = sin * length * at;
      const feather = length * 0.15;
      [-0.7, 0.7].forEach(turn => {
        const a = angle + turn;
        d += 'M' + tenth(px) + ' ' + tenth(py) + 'L' + tenth(px + Math.cos(a) * feather) + ' ' + tenth(py + Math.sin(a) * feather);
      });
    });
  }
  return path('sb-frost', d);
}

const bulbClasses = ['sb-bulb-a', 'sb-bulb-b', 'sb-bulb-c', 'sb-bulb-d', 'sb-bulb-e'];

// A string of bulbs on a wire that sags between hooks. The bulbs are five colors, and each color
// is one shape that glows in its turn (data-move="glow").
export function bulbString(w, h) {
  const swag = 92;
  const sag = Math.min(7, h * 0.3);
  const groups = bulbClasses.map(() => '');
  let wire = '';
  let sockets = '';
  let count = 0;

  for (let x = 0; x < w; x += swag) {
    const end = Math.min(x + swag, w);
    wire += (x === 0 ? 'M0 2' : '') + 'Q' + tenth((x + end) / 2) + ' ' + tenth(2 + sag * 2) + ' ' + end + ' 2';

    [0.25, 0.75].forEach(t => {
      const bx = x + (end - x) * t;
      if (bx > w - 8) return;
      const by = 2 + sag * 4 * t * (1 - t);
      sockets += 'M' + tenth(bx - 2) + ' ' + tenth(by) + 'h4v3h-4Z';
      groups[count % bulbClasses.length] += ellipse(bx, by + 8, 4.6, 6);
      count += 1;
    });
  }

  let markup = path('sb-wire', wire) + path('sb-socket', sockets);
  bulbClasses.forEach((cls, index) => {
    markup += path(cls, groups[index], ' data-move="glow" style="--glow-delay:' + tenth(index * -0.7) + 's"');
  });
  return markup;
}

// Flakes that fall through a narrow box. Each group is flakes spaced the same distance apart, and
// the group moves down by that distance and starts again, so the loop has no seam. Resting, the
// flakes stay where they begin.
export function snowfall(w, h) {
  const plans = [
    { gap: 270, seconds: 14, shift: 0 },
    { gap: 330, seconds: 21, shift: 7 },
  ];
  let markup = '';

  plans.forEach((plan, index) => {
    const count = Math.ceil(h / plan.gap) + 2;
    let flakes = '';
    for (let i = 0; i < count; i++) {
      const x = 4 + ((i * 37 + plan.shift * 11 + index * 13) % Math.max(1, w - 8));
      flakes += dot(x, -plan.gap + i * plan.gap + plan.shift * 9, i % 2 === 0 ? 2.6 : 1.8);
    }
    markup += '<g data-move="fall" style="--fall:' + plan.gap + 'px;--fall-seconds:' + plan.seconds + 's;--fall-delay:' + tenth(index * -5) + 's">' + path('sb-flake', flakes) + '</g>';
  });
  return markup;
}

// A snowman standing in the box, hat and scarf, for a box about 40 by 64
export function snowman(w, h) {
  const cx = w / 2;
  const floor = h - 3;
  const lower = Math.min(15, w * 0.38);
  const middle = lower * 0.74;
  const head = lower * 0.54;
  const lowerY = floor - lower;
  const middleY = lowerY - lower * 0.8 - middle * 0.5;
  const headY = middleY - middle * 0.85 - head * 0.45;

  const body = dot(cx, lowerY, lower) + dot(cx, middleY, middle) + dot(cx, headY, head);
  const hat = 'M' + tenth(cx - head * 1.15) + ' ' + tenth(headY - head * 0.7) + 'h' + tenth(head * 2.3) + 'v3h' + tenth(-head * 2.3) + 'ZM' + tenth(cx - head * 0.7) + ' ' + tenth(headY - head * 0.7) + 'v' + tenth(-head * 1.1) + 'h' + tenth(head * 1.4) + 'v' + tenth(head * 1.1) + 'Z';
  const scarf = 'M' + tenth(cx - middle * 0.9) + ' ' + tenth(middleY - middle * 0.75) + 'h' + tenth(middle * 1.8) + 'v5h' + tenth(-middle * 1.1) + 'v9h-4v-9h' + tenth(-middle * 0.7) + 'Z';
  const nose = 'M' + tenth(cx) + ' ' + tenth(headY) + 'l' + tenth(head * 1.1) + ' 1.6l' + tenth(-head * 1.1) + ' 1.8Z';
  const coal = dot(cx - head * 0.4, headY - head * 0.3, 1.1) + dot(cx + head * 0.4, headY - head * 0.3, 1.1) + dot(cx, middleY + 1, 1.2) + dot(cx, middleY + middle * 0.5, 1.2);

  return path('sb-snow', body) + path('sb-coal', hat) + path('sb-scarf', scarf) + path('sb-carrot', nose) + path('sb-coal', coal);
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

// ---- Kickoff

// A ribbon laid across the cut, with a bow at its middle. The box is the two legs of the cut, and
// the drawing is made for the top left corner.
export function ribbon(w, h) {
  const mx = w * 0.5;
  const my = h * 0.5;
  const u = Math.min(w, h) / 34;
  const loop = 17 * u;
  const band = 'M' + w + ' 0L0 ' + h;
  const loops = 'M' + tenth(mx) + ' ' + tenth(my) + 'C' + tenth(mx - loop) + ' ' + tenth(my - loop * 0.95) + ' ' + tenth(mx - loop * 1.15) + ' ' + tenth(my + loop * 0.25) + ' ' + tenth(mx) + ' ' + tenth(my) + 'Z'
    + 'M' + tenth(mx) + ' ' + tenth(my) + 'C' + tenth(mx + loop * 0.25) + ' ' + tenth(my + loop * 1.15) + ' ' + tenth(mx + loop * 1.15) + ' ' + tenth(my + loop * 0.95) + ' ' + tenth(mx) + ' ' + tenth(my) + 'Z';
  const tails = 'M' + tenth(mx) + ' ' + tenth(my) + 'l' + tenth(-loop * 0.3) + ' ' + tenth(loop * 1.1) + 'l' + tenth(loop * 0.35) + ' ' + tenth(-loop * 0.2) + 'l' + tenth(loop * 0.3) + ' ' + tenth(loop * 0.3) + 'l' + tenth(loop * 0.1) + ' ' + tenth(-loop * 1.2) + 'Z';
  return '<path class="sb-ribbon-band" style="stroke-width:' + tenth(Math.max(9, u * 9)) + 'px" d="' + band + '"/>' + path('sb-ribbon-line', band) + path('sb-ribbon', loops + tails) + path('sb-gold', dot(mx, my, 3.4 * u));
}

const confettiColors = ['sb-confetti-a', 'sb-confetti-b', 'sb-confetti-c'];

// Small paper pieces scattered along a bar, each color a shape that brightens and dims
export function confetti(w, h) {
  const groups = confettiColors.map(() => '');
  const turns = [[3, 5], [5, 2], [2, 5], [5, -3], [4, 4]];
  const k = Math.max(1, h / 20);
  const count = Math.round(w / 34);

  for (let i = 0; i < count; i++) {
    const x = (i * 53.7 + 17) % (w - 14) + 4;
    const y = 4 + ((i * 11) % Math.max(1, Math.round(h - 4 - 8 * k)));
    const turn = turns[i % turns.length];
    const a = tenth(turn[0] * k * 1.1);
    const b = tenth(turn[1] * k * 1.1);
    groups[i % confettiColors.length] += 'M' + tenth(x) + ' ' + tenth(y) + 'l' + a + ' ' + b + 'l' + tenth(-b * 0.55) + ' ' + tenth(a * 0.55 + 1) + 'l' + (-a) + ' ' + (-b) + 'Z';
  }
  return confettiColors.map((cls, index) => path(cls, groups[index], ' data-move="twinkle" style="--twinkle-seconds:' + tenth(2.4 + index * 0.8) + 's;--twinkle-delay:' + tenth(index * -0.9) + 's"')).join('');
}

// A gear of eight teeth around (cx, cy)
function gearPath(cx, cy, outer, inner, teeth) {
  const steps = teeth * 4;
  const points = [];
  for (let i = 0; i < steps; i++) {
    const angle = (Math.PI * 2 * i) / steps;
    const radius = i % 4 === 1 || i % 4 === 2 ? outer : inner;
    points.push(tenth(cx + Math.cos(angle) * radius) + ' ' + tenth(cy + Math.sin(angle) * radius));
  }
  return 'M' + points.join('L') + 'Z';
}

// Two flags crossed on their poles and a small gear under them, for a box about 38 by 104
export function flagsAndGear(w, h) {
  const cx = w / 2;
  const u = w / 34;
  const top = 6;
  const cross = tenth(top + 52 * u);
  const reach = tenth(14 * u);
  const poles = 'M' + tenth(cx - reach) + ' ' + tenth(Number(cross) + 26 * u) + 'L' + tenth(cx + 10 * u) + ' ' + top + 'M' + tenth(cx + reach) + ' ' + tenth(Number(cross) + 26 * u) + 'L' + tenth(cx - 10 * u) + ' ' + top;
  const flag = side => 'M' + tenth(cx + side * 9 * u) + ' ' + (top + 1) + 'L' + tenth(cx + side * 19 * u) + ' ' + tenth(top + 6 * u) + 'L' + tenth(cx + side * 16 * u) + ' ' + tenth(top + 16 * u) + 'L' + tenth(cx + side * 5 * u) + ' ' + tenth(top + 21 * u) + 'Z';
  const gearY = h - 15 * u;

  return path('sb-pole', poles)
    + path('sb-flag-a', flag(1), ' data-move="wave" style="--wave-seconds:3.2s"')
    + path('sb-flag-b', flag(-1), ' data-move="wave" style="--wave-seconds:4.1s;--wave-delay:-1.4s;transform-origin:right center"')
    + path('sb-steel', gearPath(cx, gearY, 12 * u, 9 * u, 8) + dot(cx, gearY, 3.4 * u), ' data-move="spin" fill-rule="evenodd"');
}
