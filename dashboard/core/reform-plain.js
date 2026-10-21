// The plain kit of the reform transitions (docs/transitions.md): what a theme plays when it has no kit of its own, or when its
// kit cannot be loaded. It draws no hardware and no chassis, the squares turn flat, and the folding edges are grey plates
// (reform-kit.css), so a theme that has no look of its own for a transition changes plainly and never plays the look of another
// theme.

import { easeStandard, reformTimes, squareShadeStops, squareTurnMs } from './reform-plan.js';

// A square turns over on its axis and nothing else. A square of a region that changes place travels while it turns.
function squares(square, move) {
  const turn = 'rotate' + square.axis.toUpperCase();
  const round = value => Math.round(value * 100) / 100;
  const at = (angle, travel) => 'translate(' + round(move.dx * travel) + 'px,' + round(move.dy * travel) + 'px) ' + turn + '(' + angle + 'deg) scale(' + round(1 + (move.sx - 1) * travel) + ',' + round(1 + (move.sy - 1) * travel) + ')';
  const start = square.startMs;

  return {
    transform: [[0, at(0, 1)], [start, at(0, 1), easeStandard], [start + squareTurnMs, at(180, 0)], [reformTimes.totalMs, at(180, 0)]],
    shade: squareShadeStops(square),
  };
}

export const kit = {
  id: 'plain',
  draw: () => '',
  hardware: () => null,
  squares: squares,
  light: () => [],
};
