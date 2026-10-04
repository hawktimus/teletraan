// Small pictures used on more than one panel. Each function returns SVG
// markup. The colours are set in base.css.

// A recessed window cut into the steel of a Grid 2 panel (656 x 372). It sits
// 16px inside the body, and its bottom right corner follows the panel's cut
// corner. No real panel uses it, because it hides the brushed steel behind
// the text. The ?stress stand-in tile still draws one.
const bayCorners = [[20, 100], [636, 100], [636, 312.3], [586.4, 352], [20, 352]];

function pointText(corners, down = 0) {
  return corners.map(point => point[0] + ',' + (point[1] + down)).join(' ');
}

export function bayMarkup() {
  return `<svg class="bay" data-part="content" width="656" height="372" viewBox="0 0 656 372" style="position: absolute; left: 0; top: 0">
    <polygon class="pocket-lit" points="${pointText(bayCorners, 2)}"/>
    <polygon class="pocket" points="${pointText(bayCorners)}"/>
  </svg>`;
}

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
