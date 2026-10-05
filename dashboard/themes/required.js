// The variables a theme file must set, and the ones an overlay may set.
// Only tools/check-themes.mjs reads this file. The dashboard does not need it.
// What each variable is for is written at the top of hawktimus.css.

// Every theme file sets all of these.
export const requiredVariables = [
  '--ground', '--plate', '--card', '--purple', '--purple-dark',
  '--yellow', '--white', '--lilac', '--yellow-faint',
  '--danger', '--danger-bright', '--danger-plate', '--danger-hot', '--danger-dark',
  '--status-progress', '--status-next', '--status-done', '--status-blocked',
];

// A theme file may also set these. The three logo ones keep the brand colours
// (hawktimus.css) when a theme leaves them out.
export const optionalVariables = [
  '--logo-purple', '--logo-tail', '--logo-far',
  '--silhouette-light', '--silhouette-shade', '--silhouette-cut', '--silhouette-slash',
];

// An overlay is accent colours only. It may set these and nothing else.
export const overlayVariables = ['--yellow', '--yellow-faint', '--lilac'];

// An overlay must set these, so it always changes the accent.
export const requiredOverlayVariables = ['--yellow', '--yellow-faint'];
