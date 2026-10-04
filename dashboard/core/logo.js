// The hawk logo: five plates, plus four slashes on the wings, drawn on a
// 1100 x 884 grid. Each plate is drawn twice. A copy with a fat gold line goes
// underneath to make the outline, then the purple copy goes on top. frame.css
// finds each plate by its class name (wing-left, head and so on) so it can
// move it, and the figure group lets the whole hawk rise and fall together.
// The colours are in banner.css and announcement.css.

const plates = [
  ['wing-left', '29,27 95,299.5 251,430 442,430 385,266 231,150 200,27'],
  ['wing-right', '900,27 869,150 715,266 658,430 849,430 1005,299.5 1071,27'],
  ['head', '430.5,290.5 478.5,435 478.5,632 621.5,632 621.5,435 669.5,290.5 550,362'],
  ['face', '326.5,559 341.5,808 437.5,856.5 484,743 616,743 662.5,856.5 758.5,808 773.5,559 647.5,461.5 647.5,657 452.5,657 452.5,461.5'],
  ['jaw', '465.5,853 634.5,853 601.5,762 498.5,762'],
];

const slashes = [
  ['wing-left', '155.5,160 155.5,198 333.5,337.5 333.5,300'],
  ['wing-left', '169.5,242.5 169.5,280.5 309.5,392.5 309.5,356'],
  ['wing-right', '766.5,300 766.5,337.5 944.5,198 944.5,160'],
  ['wing-right', '790.5,356 790.5,392.5 930.5,280.5 930.5,242.5'],
];

function shapes(list, kind) {
  return list
    .map(item => `<polygon class="${item[0]} ${kind}" points="${item[1]}"/>`)
    .join('');
}

export function logoMarkup() {
  return `<svg viewBox="0 0 1100 884">
    <g class="figure">
      ${shapes(plates, 'outline')}
      ${shapes(plates, 'fill')}
      ${shapes(slashes, 'slash')}
    </g>
  </svg>`;
}
