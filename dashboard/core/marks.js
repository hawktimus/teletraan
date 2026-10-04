// Small pictures used on more than one panel. Each function returns SVG
// markup. The colours are set in base.css.

export function doubleSlash() {
  return `<svg class="double-slash" viewBox="0 0 70 94" width="54" height="72">
    <polygon points="0,56 70,0 70,16 0,72"/>
    <polygon points="8,71.6 64,26.8 64,42.8 8,87.6"/>
  </svg>`;
}

// A task status is always shown as a shape, a word and a colour together,
// so it can still be read by someone who cannot tell the colours apart.
const statusShapes = {
  'in-progress': `
    <polygon points="7,27.4 41,0.2 41,9.2 7,36.4"/>
    <polygon points="11,35.7 38,14.1 38,23.1 11,44.7"/>`,
  'up-next': `
    <polygon class="outlined" points="15,5 43,5 43,35 33,43 5,43 5,13"/>`,
  'done': `
    <polyline class="outlined" points="5,24 19,35.2 43,5.2"/>`,
  'blocked': `
    <polygon points="13,4 35,4 44,11.2 44,36.8 35,44 13,44 4,36.8 4,11.2"/>
    <rect class="cut" x="11" y="20" width="26" height="8"/>`,
};

export function statusMark(status) {
  return `<svg class="mark mark-${status}" viewBox="0 0 48 48">${statusShapes[status]}</svg>`;
}
