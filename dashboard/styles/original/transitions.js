// The swap of the original theme: the pull apart and re-form of core/swap-plan.js. A theme that moves
// differently exports its own numbers under the same names. core/style-loader.js loads this file by the
// id of the theme.

import { swapReform, swapShape, swapTimes } from '../../core/swap-plan.js';

export const swapVariant = { name: 'pull-apart', times: swapTimes, reform: swapReform, shape: swapShape };

// The kit of the theme for the panel and view transitions (core/reform-draw.js): the drawing of each piece of hardware
// and of the chassis behind the squares. The pieces are drawn on a 40 x 40 grid and sized by the engine, and take
// their colors from the metal tokens, so a team's metal reaches them. The classes are styled in reform.css.
const pieces = {
  screw: '<svg viewBox="0 0 40 40"><circle class="rk-rim" cx="20" cy="20" r="18"/><circle class="rk-metal" cx="20" cy="20" r="14"/><rect class="rk-slot" x="8" y="17" width="24" height="6"/></svg>',
  latch: '<svg viewBox="0 0 40 40"><rect class="rk-rim" x="2" y="12" width="36" height="16" rx="3"/><rect class="rk-metal" x="5" y="15" width="30" height="10" rx="2"/><circle class="rk-slot" cx="10" cy="20" r="3"/></svg>',
  brace: '<svg viewBox="0 0 40 40"><rect class="rk-rim" x="0" y="14" width="40" height="12"/><rect class="rk-metal" x="3" y="17" width="34" height="6"/></svg>',
  rivet: '<svg viewBox="0 0 40 40"><circle class="rk-rim" cx="20" cy="20" r="16"/><circle class="rk-metal" cx="20" cy="20" r="11"/><circle class="rk-lit" cx="16" cy="16" r="4"/></svg>',
  gear: '<svg viewBox="0 0 40 40"><circle class="rk-teeth" cx="20" cy="20" r="16"/><circle class="rk-rim" cx="20" cy="20" r="13"/><circle class="rk-metal" cx="20" cy="20" r="10"/><circle class="rk-slot" cx="20" cy="20" r="4"/></svg>',
  piston: '<svg viewBox="0 0 40 40" preserveAspectRatio="none"><rect class="rk-rim" x="0" y="0" width="40" height="40"/><rect class="rk-metal" x="2" y="5" width="36" height="30"/></svg>',
  tooth: '<svg viewBox="0 0 40 40" preserveAspectRatio="none"><path class="rk-rim" d="M4 40 L8 4 L32 4 L36 40 Z"/><path class="rk-metal" d="M10 40 L12 9 L28 9 L30 40 Z"/></svg>',
  chassis: '',
};

export const kit = {
  id: 'original',
  draw: role => pieces[role] === undefined ? '' : pieces[role],
};
