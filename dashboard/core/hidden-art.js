// The two pictures of the hidden transitions (core/hidden-transitions.js), drawn
// from polygons and nothing else. Neither is a copy of anything. They are made
// here so a student can change them with a text editor and a refresh.
//
//   wallpaperMarkup()   the fake desktop wallpaper. Calm blues and teals in big
//                       angular facets. No icons, no windows, no logos.
//   redEyesMarkup()     the "red eyes" picture: a robot face of dark steel on
//                       black with two angular red eyes. The face is built the
//                       way the hawk logo is (core/logo.js): flat plates with cut
//                       corners and slashes, on the same kind of grid.
//
// Both are plain svg. Nothing in them moves by itself. frame.css fades the
// parts in and out with opacity (the data-look rules in the section "Hidden
// transitions"), and the colours are the --face and --eye tokens in tokens.css
// for the face. The wallpaper's colours are written here, because a theme
// should not change what the wallpaper looks like.

const wallpaperFacets = [
  // [points, fill]
  ['0,0 640,0 520,420 0,640', '#0f3446'],
  ['640,0 1920,0 1920,300 1500,560 980,760 520,420', '#1a4f73'],
  ['0,640 520,420 980,760 700,1080 0,1080', '#174a5a'],
  ['700,1080 980,760 1500,560 1240,1080', '#1d5a72'],
  ['1240,1080 1500,560 1920,820 1920,1080', '#1f6272'],
  ['1920,300 1920,820 1500,560', '#2a7186'],
  ['1080,0 1920,0 1920,120 1320,380', '#2a6a8d'],
  ['0,820 380,640 700,1080 0,1080', '#12404d'],
];

// Thin light facets on top, so the big shapes have edges that catch the light
const wallpaperGlints = [
  ['520,420 980,760 940,770 480,430', '#ffffff', 0.07],
  ['980,760 1500,560 1490,584 970,780', '#ffffff', 0.06],
  ['640,0 520,420 540,424 670,6', '#ffffff', 0.05],
];

function polygon(points, fill, opacity) {
  return '<polygon points="' + points + '" fill="' + fill + '"' + (opacity ? ' fill-opacity="' + opacity + '"' : '') + '/>';
}

export function wallpaperMarkup() {
  return '<svg viewBox="0 0 1920 1080" width="1920" height="1080" aria-hidden="true">' +
    '<defs><linearGradient id="wallpaper-base" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="#14465c"/><stop offset="1" stop-color="#0a2033"/>' +
    '</linearGradient></defs>' +
    '<rect width="1920" height="1080" fill="url(#wallpaper-base)"/>' +
    wallpaperFacets.map(facet => polygon(facet[0], facet[1])).join('') +
    wallpaperGlints.map(glint => polygon(glint[0], glint[1], glint[2])).join('') +
    '</svg>';
}


// The face is drawn for the left half and mirrored for the right, on a grid
// 1100 wide and 884 high, with the middle line at x = 550. Every point is a
// number pair, so a shape is easy to move.
const middle = 1100;

function mirror(points) {
  return points.split(' ').map(pair => {
    const parts = pair.split(',');
    return (middle - Number(parts[0])) + ',' + parts[1];
  }).join(' ');
}

// One shape of the left half and its mirror. lit is the class for the left, shade for the right.
function pair(points, lit, shade) {
  return '<polygon class="' + lit + '" points="' + points + '"/>' +
    '<polygon class="' + shade + '" points="' + mirror(points) + '"/>';
}

// The two sides of the head, a forehead plate and a cheek plate on each, and the
// cuts that make the sockets and the slashes on the cheeks
const skull = '550,96 430,110 338,196 312,330 330,470 386,590 430,700 500,790 550,838';
const foreheadPlate = '430,110 506,134 506,262 450,250 392,292 338,296 338,196';
const cheekPlate = '330,470 392,452 534,470 534,560 470,640 430,700 386,590';
const brow = '322,296 534,352 534,394 346,334';
const socket = '350,338 534,396 534,470 392,452 366,410';
const cheekSlashes = ['372,520 372,548 440,612 440,584', '392,576 392,604 452,660 452,632'];

// The plates that sit in the middle, once
const crest = '550,96 594,134 594,262 550,300 506,262 506,134';
const noseBridge = '528,392 550,384 572,392 572,560 550,620 528,560';
const jaw = '470,640 550,600 630,640 600,790 550,838 500,790';
const chin = '520,800 550,838 580,800 550,780';

// The eyes. Each has a flat bright slit inside it. They are separate from the
// plates, because they are the first thing seen on the black.
const eye = '372,358 530,408 530,450 410,438 388,404';
const eyeCore = '436,388 526,416 526,432 440,414';

export function redEyesMarkup() {
  const plates =
    pair(skull, 'face-lit', 'face-shade') +
    pair(foreheadPlate, 'face-lit-2', 'face-shade-2') +
    pair(cheekPlate, 'face-lit-2', 'face-shade-2') +
    pair(brow, 'face-dark', 'face-dark') +
    pair(socket, 'face-cut', 'face-cut') +
    cheekSlashes.map(slash => pair(slash, 'face-cut', 'face-cut')).join('') +
    '<polygon class="face-lit-2" points="' + crest + '"/>' +
    '<polygon class="face-dark" points="' + noseBridge + '"/>' +
    '<polygon class="face-dark" points="' + jaw + '"/>' +
    '<polygon class="face-cut" points="' + chin + '"/>';

  const eyes =
    pair(eye, 'eye', 'eye') +
    pair(eyeCore, 'eye-core', 'eye-core');

  return '<svg viewBox="0 0 1100 884" width="1100" height="884" aria-hidden="true">' +
    '<g class="face-plates">' + plates + '</g>' +
    '<g class="face-eyes">' + eyes + '</g>' +
    '</svg>';
}

// What goes inside #backdrop in index.html: the black, the wallpaper over it
// and the face over that. frame.css shows one of them at a time
// (data-look on #backdrop).
export function backdropMarkup() {
  return '<div class="wallpaper">' + wallpaperMarkup() + '</div>' +
    '<div class="red-eyes">' + redEyesMarkup() + '</div>';
}
