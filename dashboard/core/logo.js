// The hawk logo, drawn from polygons on a 1100 x 884 grid.
//
// It is two pictures in one box. The emblem is four plates: the two wings,
// the body (the face and the jaw) and the head. The hawk is a side view that
// the plates turn into. It is five parts: the far wing, the tail, the body,
// the head and the near wing.
//
// Every plate and every part is a div with its own svg on the same grid, so
// frame.css can turn each one in 3D. A div turns in 3D in every browser, a
// shape inside an svg does not always.
//
// Each shape is drawn three times, back to front: a dark copy moved down and
// right (shadow), a fat metal line (outline) and the purple (fill). The
// colours and the moves are in the section called "The logo" in frame.css.

const wingLeft = '29,27 95,299.5 251,430 442,430 385,266 231,150 200,27';
const wingLeftSlashes = [
  '155.5,160 155.5,198 333.5,337.5 333.5,300',
  '169.5,242.5 169.5,280.5 309.5,392.5 309.5,356',
];
const wingRight = '900,27 869,150 715,266 658,430 849,430 1005,299.5 1071,27';
const wingRightSlashes = [
  '766.5,300 766.5,337.5 944.5,198 944.5,160',
  '790.5,356 790.5,392.5 930.5,280.5 930.5,242.5',
];
const face = '326.5,559 341.5,808 437.5,856.5 484,743 616,743 662.5,856.5 758.5,808 773.5,559 647.5,461.5 647.5,657 452.5,657 452.5,461.5';
const jaw = '465.5,853 634.5,853 601.5,762 498.5,762';
const head = '430.5,290.5 478.5,435 478.5,632 621.5,632 621.5,435 669.5,290.5 550,362';

// name, shapes, slashes. The slashes are the metal stripes on a plate.
const emblem = [
  ['wing-left', [wingLeft], wingLeftSlashes],
  ['wing-right', [wingRight], wingRightSlashes],
  ['body', [face, jaw], []],
  ['head', [head], []],
];

const farWing = '610,290 770,272 815,330 862,440 878,560 852,655 800,640 760,560 700,470 640,380';
const tailTip = '22,366 84,314 154,316 154,422 46,424';
const tailBase = '166,316 285,318 285,402 240,420 166,422';
const tailSlash = '236,326 222,410 262,408 276,324';
const hawkBody = '270,345 430,302 650,270 765,275 805,312 772,362 670,402 440,412 290,395';
const hawkHead = '752,290 770,222 826,196 890,202 930,236 934,266 900,292 846,318 790,318';
const beak = '926,240 994,264 984,308 956,290 934,274';
const eye = '838,232 908,242 908,258 848,252';
const nearWing = '360,330 680,280 748,352 762,494 371,494 360,440';
const nearWingSlash = '448,436 448,476 706,372 706,332';
const nearPanel2 = '373,506 761,506 724,668 446,656 404,686 384,560';
const nearPanel2Slash = '476,606 476,642 696,558 696,522';
const nearPanel3 = '452,668 721,680 640,866 596,790 556,828 520,736 478,768';
const nearPanel3Slash = '548,726 548,758 660,718 660,688';

function polygon(className, points) {
  return `<polygon class="${className}" points="${points}"/>`;
}

// All the shadows, then all the outlines, then all the fills. When a plate
// has two shapes this keeps the outline of one from covering the fill of the other.
function drawn(shapes, fill) {
  return ['shadow', 'outline', fill]
    .map(layer => shapes.map(points => polygon(layer, points)).join(''))
    .join('');
}

function slashes(list) {
  return list.map(points => polygon('slash', points)).join('');
}

function plate(className, inner) {
  return `<div class="${className}"><svg viewBox="0 0 1100 884">${inner}</svg></div>`;
}

// The tail slides out in two pieces: the tip comes out of the base, and the
// base comes out from under the body. The near wing unfolds in three panels,
// each from the lower edge of the one before. A group inside a group moves
// with the group around it.
function hawkMarkup() {
  return [
    plate('hawk-part hawk-far-wing', drawn([farWing], 'fill-far')),

    plate('hawk-part hawk-tail', `
      <g class="tail-base">
        <g class="tail-tip">${drawn([tailTip], 'fill-tail')}</g>
        ${drawn([tailBase], 'fill-tail')}${slashes([tailSlash])}
      </g>`),

    plate('hawk-part hawk-body', drawn([hawkBody], 'fill-purple')),

    plate('hawk-part hawk-head',
      drawn([hawkHead], 'fill-purple') + polygon('slash beak', beak) + slashes([eye])),

    plate('hawk-part hawk-near-wing',
      drawn([nearWing], 'fill-purple') + slashes([nearWingSlash]) + `
      <g class="near-panel-2">
        ${drawn([nearPanel2], 'fill-purple')}${slashes([nearPanel2Slash])}
        <g class="near-panel-3">${drawn([nearPanel3], 'fill-purple')}${slashes([nearPanel3Slash])}</g>
      </g>`),
  ].join('');
}

// The inside of an element with class logo. The element sets the size, and
// --k in its stylesheet says how much smaller than 1100 wide it is.
export function logoMarkup() {
  const plates = emblem
    .map(([name, shapes, stripes]) => plate('emblem ' + name, drawn(shapes, 'fill-purple') + slashes(stripes)))
    .join('');

  return `<div class="drawing"><div class="bob">${plates}<div class="hawk">${hawkMarkup()}</div></div></div>`;
}

// The emblem alone, drawn once as one flat svg on the same 1100 x 884 grid, for
// the night screen (core/night-screen.js). There is no shadow and no hawk. Every
// outline comes first, then every plate, then the stripes, so no outline covers
// a plate. The colours are not set here: the shapes carry the classes
// emblem-outline, emblem-plate and emblem-stripe (names of their own, because
// plate and slash are used elsewhere), and the stylesheet gives them CSS
// variables.
export function emblemMarkup() {
  const shapes = emblem.reduce((all, part) => all.concat(part[1]), []);
  const stripes = emblem.reduce((all, part) => all.concat(part[2]), []);

  return '<svg viewBox="0 0 1100 884" aria-hidden="true">' +
    shapes.map(points => polygon('emblem-outline', points)).join('') +
    shapes.map(points => polygon('emblem-plate', points)).join('') +
    stripes.map(points => polygon('emblem-stripe', points)).join('') +
    '</svg>';
}
