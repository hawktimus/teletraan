// The hawk of the view transition (docs/transitions.md): the logo of the old team turns into the logo of the next team.
//
// It is drawn on its own over the page as the four plates of the emblem (core/logo.js, hawkPieces), on the logo's 1100 x 884
// grid. Each plate has two faces: the front in the colors of the team it was, and the back in the colors of the team it
// becomes. It uses the robot choreography the logo already has:
//
//    800 to 1150   the wings swing down into legs, the body and the head lift into the robot (the pose of each plate is
//                  hawkPieces(team).plates[].robot, the same transform as frame.css gives the logo)
//   1150 to 1450   every plate turns over on its own hinge. The back of a plate turns on the same point as the plate.
//   1450 to 2050   the robot rides across to the new place of the logo, with the side column, and stands up as the other hawk
//
// The plates are drawn inline, with colors written as plain values (colorsOf), because the page changes look while the hawk is
// on it, and a variable would give the old team the new colors.

import { hawkPieces } from './logo.js';
import { easePop, easeStandard, reformTimes } from './reform-plan.js';

const svgNamespace = 'http://www.w3.org/2000/svg';
export const hawkWidth = 1100;
export const hawkHeight = 884;

// 'var(--name)' as the value it has on the page now. Anything else is kept.
export function colorOf(value, style = window.getComputedStyle(document.documentElement)) {
  const found = /^var\((--[\w-]+)\)$/.exec(String(value).trim());
  if (!found) return value;

  const resolved = style.getPropertyValue(found[1]).trim();
  return resolved === '' ? value : resolved;
}

// The numbers of a pose transform: translate, rotate and scale
export function poseOf(text) {
  const read = (name, fallback) => {
    const found = new RegExp(name + '\\(([^)]*)\\)').exec(text || '');
    return found ? found[1].split(',').map(part => parseFloat(part)) : fallback;
  };
  const move = read('translate', [0, 0]);
  const turn = read('rotate', [0]);
  const size = read('scale', [1]);

  return { x: move[0] || 0, y: move[1] || 0, turn: turn[0] || 0, size: size[0] === undefined ? 1 : size[0] };
}

const pose = (value, flip) => 'translate(' + value.x + 'px,' + value.y + 'px) rotate(' + value.turn + 'deg) scale(' + value.size + ') rotateY(' + flip + 'deg)';

// The tracks of one plate
export function plateStops(plate) {
  const robot = poseOf(plate.robot);
  const rest = { x: 0, y: 0, turn: 0, size: 1 };
  const [robotAt, robotEnd] = [800, 1150];
  const [turnEnd, standEnd] = [1450, reformTimes.rideEnd];

  return [
    [0, pose(rest, 0)],
    [robotAt, pose(rest, 0), easeStandard],
    [robotEnd, pose(robot, 0), easePop],
    [turnEnd, pose(robot, 180), easeStandard],
    [standEnd, pose(rest, 180)],
    [reformTimes.totalMs, pose(rest, 180)],
  ];
}

// The place of the whole hawk: where the old logo was until the robot is turned, and the new place from the time it has
// ridden across. from and to are { x, y, w } on the screen.
export function rideStops(from, to) {
  const place = box => 'translate(' + Math.round(box.x * 100) / 100 + 'px,' + Math.round(box.y * 100) / 100 + 'px) scale(' + Math.round(box.w / hawkWidth * 10000) / 10000 + ')';

  return [[0, place(from)], [1300, place(from), easeStandard], [reformTimes.rideEnd, place(to)], [reformTimes.totalMs, place(to)]];
}

function shapeMarkup(plate, side) {
  const polygon = (points, style) => '<polygon points="' + points + '" style="' + style + '"/>';
  const stroke = (paint, width) => 'fill:' + paint + ';stroke:' + paint + ';stroke-width:' + width + 'px;stroke-linejoin:round;';
  const layer = (style, extra = '') => plate.shapes.map(points => polygon(points, style + extra)).join('');

  return layer(stroke(side.shadow, 52), 'transform:translate(12px,18px);') + layer(stroke(side.edge, 52)) + layer('fill:' + side.fill + ';') +
    plate.stripes.map(points => polygon(points, 'fill:' + side.edge + ';')).join('');
}

// One face of a plate: an svg on the logo's grid
function face(plate, side, className, flipped) {
  const element = document.createElement('div');
  element.className = className;
  element.style.cssText = 'transform-origin:' + plate.pivot.x + 'px ' + plate.pivot.y + 'px;' + (flipped ? 'transform:rotateY(180deg);' : '');
  element.innerHTML = '<svg viewBox="0 0 ' + hawkWidth + ' ' + hawkHeight + '" xmlns="' + svgNamespace + '">' + shapeMarkup(plate, side) + '</svg>';
  return element;
}

// Makes the hawk: the root, and the list of tracks. from and to are { x, y, w }, the old and the new box of the logo on
// the screen. oldTeam and newTeam are 'prime' or 'nova'. Colors are read now, so call this before the look changes.
export function drawHawk(from, to, oldTeam, newTeam) {
  const pieces = hawkPieces(oldTeam);
  const next = hawkPieces(newTeam);
  const style = window.getComputedStyle(document.documentElement);
  const side = value => ({ fill: colorOf(value.fill, style), edge: colorOf(value.edge, style), shadow: colorOf(value.shadow, style) });
  const root = document.createElement('div');
  const tracks = [{ element: root, property: 'transform', stops: rideStops(from, to) }];

  root.className = 'reform-hawk';
  root.style.cssText = 'left:0;top:0;width:' + hawkWidth + 'px;height:' + hawkHeight + 'px;transform-origin:0 0;';
  pieces.plates.forEach((plate, index) => {
    const element = document.createElement('div');
    element.className = 'reform-plate';
    element.style.cssText = 'transform-origin:' + plate.pivot.x + 'px ' + plate.pivot.y + 'px;';
    element.append(face(plate, side(plate.front), 'reform-plate-front', false), face(plate, side(next.plates[index].front), 'reform-plate-back', true));
    root.appendChild(element);
    tracks.push({ element: element, property: 'transform', stops: plateStops(plate) });
  });
  return { element: root, tracks: tracks };
}

// 'prime' or 'nova' for a logo on the page: the drawing carries the class that gives it the Nova colors
export function teamOfLogo(logo) {
  return logo && logo.querySelector('.drawing.logo-nova') ? 'nova' : 'prime';
}
