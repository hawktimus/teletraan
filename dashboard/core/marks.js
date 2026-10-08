// Small pictures used on more than one panel. Each function returns SVG
// markup. The colours are set in base.css.

// The biggest a seasonal pack's header mark may be, in pixels. It was measured
// on the large panel's header (docs/seasonal-packs.md, "The header mark"): the
// free space round the slashes is 94 px high and the tag text beside them has
// to stay clear of the notch in the middle of the header. tools/check-seasons.mjs
// fails for a mark that is bigger.
export const markBox = { width: 60, height: 76 };

// The mark of the seasonal pack that is on the screen now, or null. It is
// { viewBox, markup, width, height } with a width and a height that already fit
// the box. core/season.js sets it when a pack goes on and clears it when the pack
// goes. It only changes what the next doubleSlash() draws: a page that is already
// on the screen keeps the mark it was built with until its next page.
let packMark = null;

function isNumber(value) {
  return typeof value === 'number' && isFinite(value);
}

// The size a mark is drawn at: the width and height the pack gives, or else the
// biggest size that fits the box and keeps the proportions of the viewBox.
// null when the viewBox is not four numbers.
export function markSize(mark) {
  const parts = typeof mark.viewBox === 'string' ? mark.viewBox.trim().split(/\s+/).map(Number) : [];
  if (parts.length !== 4 || parts.some(part => !isFinite(part)) || parts[2] <= 0 || parts[3] <= 0) return null;

  if (isNumber(mark.width) && isNumber(mark.height)) return { width: mark.width, height: mark.height };

  const scale = Math.min(markBox.width / parts[2], markBox.height / parts[3]);
  return { width: Math.round(parts[2] * scale * 100) / 100, height: Math.round(parts[3] * scale * 100) / 100 };
}

// Takes the mark of a pack, or null for the slashes. A mark that cannot be drawn,
// or is bigger than the box, is the same as none, so a header never loses its
// picture and never gets one that crowds the text beside it.
export function setPackMark(mark) {
  const usable = mark && typeof mark === 'object' && typeof mark.markup === 'string' && mark.markup.trim() !== '';
  const size = usable ? markSize(mark) : null;
  const fits = size && size.width > 0 && size.height > 0 && size.width <= markBox.width && size.height <= markBox.height;
  packMark = fits ? { viewBox: mark.viewBox, markup: mark.markup, width: size.width, height: size.height } : null;
}

// The picture at the right of a panel's header. Every panel that has one calls
// this, so a pack's mark replaces the slashes everywhere without a panel changing.
export function doubleSlash() {
  if (packMark) {
    return `<svg class="pack-mark" viewBox="${packMark.viewBox}" width="${packMark.width}" height="${packMark.height}" aria-hidden="true">${packMark.markup}</svg>`;
  }

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
