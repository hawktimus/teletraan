// The weather pictures, drawn on a 48 by 48 grid from straight lines only. The
// cuts rise 4 for every 5 across, the same angle as the double slash.

import { describeWeather } from './weather.js';

const slope = 0.8;

// colours come from the theme (themes/hawktimus.css), and var() only works inside a style attribute
const colors = {
  sun: 'var(--yellow)',
  cloud: 'var(--white)',
  rain: 'var(--status-progress)',
  snow: 'var(--white)',
  fog: 'var(--status-next)',
};

function round(value) {
  return Math.round(value * 10) / 10;
}

function polygon(points, color) {
  const text = points.map(point => round(point[0]) + ',' + round(point[1])).join(' ');
  return `<polygon points="${text}" style="fill: ${color}"/>`;
}

function rect(left, top, width, height, color) {
  return `<rect x="${left}" y="${top}" width="${width}" height="${height}" style="fill: ${color}"/>`;
}

// A box with its four corners cut off. cut is how far along the top edge
// each cut starts.
function octagon(left, top, width, height, cut) {
  const right = left + width;
  const bottom = top + height;
  const rise = cut * slope;
  return [
    [left + cut, top], [right - cut, top],
    [right, top + rise], [right, bottom - rise],
    [right - cut, bottom], [left + cut, bottom],
    [left, bottom - rise], [left, top + rise],
  ];
}

// Moves and shrinks a group of shapes
function placed(x, y, scale, shapes) {
  return `<g transform="translate(${x} ${y}) scale(${scale})">${shapes}</g>`;
}

const rays = {
  top: rect(21, 1, 6, 7, colors.sun),
  bottom: rect(21, 40, 6, 7, colors.sun),
  left: rect(1, 21, 7, 6, colors.sun),
  right: rect(40, 21, 7, 6, colors.sun),
};

// The sun is two plates with a thin gap down the middle, like a seam in armour.
// Together they are the octagon at (12, 12), 24 across, with 1.6 cut out of it.
const sunPlates = [
  [[19, 12], [23.2, 12], [23.2, 36], [19, 36], [12, 30.4], [12, 17.6]],
  [[24.8, 12], [29, 12], [36, 17.6], [36, 30.4], [29, 36], [24.8, 36]],
];

// A sun that is partly hidden leaves out the rays that would be hidden too
function sun(sides = ['top', 'bottom', 'left', 'right']) {
  return sunPlates.map(points => polygon(points, colors.sun)).join('') + sides.map(side => rays[side]).join('');
}

// A crescent with its points facing the top right. The inner edge is where
// a smaller circle was cut out of a bigger one.
function moon() {
  return polygon([
    [20, 5], [16, 13], [16, 21], [20, 28], [27, 32], [35, 32], [43, 28],
    [38, 38], [29, 43], [19, 43], [10, 38], [5, 29], [5, 19], [10, 10],
  ], colors.sun);
}

// Three bumps on a wide flat base, 42 wide and 28 tall. The base is two plates
// with a thin gap between them, the same seam as in the sun. Together they are
// the octagon at (0, 12), 42 across and 16 down, with 1.6 cut out of it.
function cloud() {
  return [
    [[6, 12], [36, 12], [42, 16.8], [42, 22.4], [0, 22.4], [0, 16.8]],
    [[1, 24], [41, 24], [36, 28], [6, 28]],
    octagon(3, 6, 15, 14, 5),
    octagon(14, 0, 20, 22, 7),
    octagon(28, 8, 14, 14, 5),
  ].map(points => polygon(points, colors.cloud)).join('');
}

function partlyCloudy(isDay) {
  const body = isDay ? placed(0, 0, 0.75, sun(['top', 'left', 'right'])) : placed(0, -1, 0.74, moon());
  return body + placed(13.5, 23, 0.8, cloud());
}

// A slanted bar whose ends are cut at the slash angle
function drop(x, y, length) {
  return polygon([[x, y + 4.8], [x + 6, y], [x + 3, y + length], [x - 3, y + length + 4.8]], colors.rain);
}

// The cloud above rain, snow and lightning is smaller to leave room below
function highCloud() {
  return placed(5.5, 1.5, 0.88, cloud());
}

function drizzle() {
  return highCloud() + drop(17, 31, 8) + drop(31, 31, 8);
}

function rain() {
  return highCloud() + drop(12, 29, 12) + drop(24, 29, 12) + drop(36, 29, 12);
}

function flake(x, y) {
  return polygon([[x, y - 5], [x + 5, y], [x, y + 5], [x - 5, y]], colors.snow);
}

function snow() {
  return highCloud() + flake(14, 36) + flake(34, 36) + flake(24, 42);
}

function storm() {
  const bolt = [[26, 27], [37, 27], [31, 35], [38, 35], [21, 47], [26, 39], [19, 39]];
  return highCloud() + polygon(bolt, colors.sun);
}

function bar(left, right, top) {
  const shift = 7 / slope;
  return polygon([[left + shift, top], [right, top], [right - shift, top + 7], [left, top + 7]], colors.fog);
}

function fog() {
  return bar(8, 44, 4) + bar(4, 40, 15) + bar(8, 44, 26) + bar(4, 40, 37);
}

const pictures = {
  'clear': isDay => isDay ? sun() : moon(),
  'partly-cloudy': partlyCloudy,
  'cloudy': () => placed(3, 10, 1, cloud()),
  'fog': fog,
  'drizzle': drizzle,
  'rain': rain,
  'snow': snow,
  'storm': storm,
};

// size is the width and height in pixels. 44 is the smallest the screen allows.
export function weatherIcon(code, isDay = true, size = 44) {
  const name = describeWeather(code).icon;
  return `<svg viewBox="0 0 48 48" width="${size}" height="${size}" style="display: block">${pictures[name](isDay)}</svg>`;
}
