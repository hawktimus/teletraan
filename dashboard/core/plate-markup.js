// The pieces of a frame, the war clock housing and the markup each frame, card and plate returns (part of plate.js).

import { allLayers, areaHalves, barFillsMarkup, define, defineBar, defineFrame, edgeLayers, edgedShape, fillsMarkup, frameHalves, glintMarkup, neonLayers, screwHeadMarkup, screwShadowMarkup, shapeFor } from './plate-draw.js';
import { otherCorners, pathData, screenFrame, toPoints } from './plate-shapes.js';
import { liesOn, rivetsMarkup, trimmedScreenFrame, wearMarkup, weldGap } from './plate-trim.js';

// One piece of a frame, as an svg of its own just big enough to hold it. Its
// viewBox is the piece's rectangle of the panel, not the whole panel, so every
// point (and every gradient, which is measured in the same units) is where it
// is in the full frame. The piece is placed at that rectangle, so it sits
// exactly over the frame at rest, and moves as a picture of its own. Room is
// left round the points for the width of the edge, its shadow and a screw.
const pieceRoom = 32;

function pieceMarkup(kind, shape, piece, rivets, wear) {
  const points = piece.line || piece.points || piece.box;
  const xs = points.map(point => point[0]);
  const ys = points.map(point => point[1]);
  const left = Math.floor(Math.min.apply(null, xs) - pieceRoom);
  const top = Math.floor(Math.min.apply(null, ys) - pieceRoom);
  const width = Math.ceil(Math.max.apply(null, xs) + pieceRoom) - left;
  const height = Math.ceil(Math.max.apply(null, ys) + pieceRoom) - top;

  let art;
  if (piece.line) {
    const id = kind + '-piece-' + piece.name;
    define(id, `<polyline id="${id}" points="${toPoints(piece.line)}"/>`);
    let neon = '';
    if (piece.neon) {
      define(id + '-neon', `<polyline id="${id}-neon" points="${toPoints(piece.neon)}"/>`);
      neon = neonLayers(id + '-neon');
    }
    art = edgeLayers(id, undefined, allLayers, neon) + (rivets ? rivetsMarkup(rivets, false) : '') + wearMarkup(wear);
  } else {
    art = (piece.fill ? `<polygon class="${piece.fill}" points="${toPoints(piece.points)}"/>` : '') + (piece.art ? piece.art() : '');
  }

  // The screws are numbered as they are in the frame at rest, a's first. A piece
  // names its screws by half ('a' or 'b'), or lists the ones it has (the bar frames)
  let screws = '';
  if (piece.screws && piece.screws.length !== 0) {
    const all = shape.screws.a.concat(shape.screws.b);
    const centers = typeof piece.screws === 'string' ? shape.screws[piece.screws] : piece.screws;
    const numbered = centers.map(center => ({ center: center, index: all.findIndex(other => other[0] === center[0] && other[1] === center[1]) }));
    const at = center => `translate(${center[0]} ${center[1]})`;
    screws = numbered.map(item => `<g transform="${at(item.center)}">${screwShadowMarkup(item.index, shape.bar)}</g>`).join('') +
      numbered.map(item => `<g transform="${at(item.center)}">${screwHeadMarkup(item.index, shape.bar)}</g>`).join('');
  }

  return `<svg class="plate piece" data-piece="${piece.name}" style="left: ${left}px; top: ${top}px;" width="${width}" height="${height}" viewBox="${left} ${top} ${width} ${height}">
    ${art}
    ${screws}
  </svg>`;
}

// A rivet, and a patch of rust, goes in the first piece that has its place on the frame,
// so none is drawn twice
function piecesMarkup(kind, shape) {
  const unplaced = shape.rivets ? shape.rivets.a.concat(shape.rivets.b) : [];
  const unworn = (shape.wear || []).slice();

  return shape.pieces.map(piece => {
    const mine = piece.line ? unplaced.filter(center => liesOn(center, piece.line)) : [];
    mine.forEach(center => unplaced.splice(unplaced.indexOf(center), 1));
    const worn = piece.line ? unworn.filter(item => liesOn(item.anchor, piece.line)) : [];
    worn.forEach(item => unworn.splice(unworn.indexOf(item), 1));
    return pieceMarkup(kind, shape, piece, mine, worn);
  }).join('');
}


// The war clock's housing

// The war clock (panels/countdown, docs/layouts.md, "The war clock") is drawn in two forms.
// The narrow one is 766 by 128, in the banner of the bar layout (Minimal). The wide one is
// 616 by 200, in the countdown's place in Cybertron. Each has a tall housing as well, 16 and 40
// higher, which the clock shows while its title takes two lines (the clock holds both and the
// stylesheet shows one). The housing of each is a plate in the metal of the team
// with the same edge as the frames: the line 4 inside the box, a cut corner at the top left
// and the bottom right (22 on the narrow one and 34 on the wide one), four rivets, one weld
// seam across the middle and rust at the bottom left and the top right. Everything in it is still.
// A team that has the other corners cut has them at the top right and the bottom left, and the
// rivets and the rust turned across with them.
const warForms = {
  narrow: {
    box: { width: 766, height: 128, chamfer: 22 },
    id: 'war-housing-shape',
    rivets: [[30, 22], [738, 22], [30, 100], [738, 100]],
    seam: { y: 48, from: 16, to: 750 }, // between the title and the plates. The light line is weldGap below the dark one
    rust: {
      patches: [{ cx: 50, cy: 108 }, { cx: 716, cy: 20 }],
      patchRadius: { x: 56, y: 16 },
      arcs: 'M6 80Q28 98 6 116M716 6Q734 24 752 6',
    },
  },
  'narrow-tall': {
    box: { width: 766, height: 144, chamfer: 22 },
    id: 'war-housing-tall-shape',
    rivets: [[30, 22], [738, 22], [30, 116], [738, 116]],
    seam: { y: 78, from: 16, to: 750 },
    rust: {
      patches: [{ cx: 50, cy: 124 }, { cx: 716, cy: 20 }],
      patchRadius: { x: 56, y: 16 },
      arcs: 'M6 96Q28 114 6 132M716 6Q734 24 752 6',
    },
  },
  wide: {
    box: { width: 616, height: 200, chamfer: 34 },
    id: 'war-housing-wide-shape',
    rivets: [[30, 38], [586, 38], [30, 178], [572, 178]], // the last one is clear of the cut corner
    seam: { y: 64, from: 16, to: 600 }, // between the title and the two plates
    rust: {
      patches: [{ cx: 56, cy: 172 }, { cx: 560, cy: 24 }],
      patchRadius: { x: 56, y: 16 },
      arcs: 'M6 128Q28 148 6 168M536 6Q554 24 572 6',
    },
  },
  'wide-tall': {
    box: { width: 616, height: 240, chamfer: 34 },
    id: 'war-housing-wide-tall-shape',
    rivets: [[30, 38], [586, 38], [30, 218], [572, 218]],
    seam: { y: 104, from: 16, to: 600 },
    rust: {
      patches: [{ cx: 56, cy: 212 }, { cx: 560, cy: 24 }],
      patchRadius: { x: 56, y: 16 },
      arcs: 'M6 168Q28 188 6 208M536 6Q554 24 572 6',
    },
  },
};

function warOutline(box, turned) {
  const left = 4;
  const top = 4;
  const right = box.width - 4;
  const bottom = box.height - 4;
  const cut = box.chamfer;

  if (turned) return otherCorners({ left: left, top: top, right: right, bottom: bottom, cutX: cut, cutY: cut }).outline;
  return [[left, bottom], [left, top + cut], [left + cut, top], [right, top], [right, bottom - cut], [right - cut, bottom]];
}

// A path that is only pairs of numbers after its letters, turned across a box that is width wide
function mirroredPath(data, width) {
  return data.replace(/(-?[\d.]+) (-?[\d.]+)/g, (pair, x, y) => (width - Number(x)) + ' ' + y);
}

// form is 'narrow' (the default) or 'wide', and tall is true for the housing of a title on two lines. trim is the
// team's, { corner, notch }: with corner 'tr' the cut corners are the top right and the bottom left, and the rivets
// and the rust are turned across with them
export function warHousingMarkup(form = 'narrow', trim = {}, tall = false) {
  const housing = warForms[tall ? form + '-tall' : form] || warForms.narrow;
  const box = housing.box;
  const turned = Boolean(trim) && trim.corner === 'tr';
  const outline = warOutline(box, turned);
  const shapeId = housing.id + (turned ? '-tr' : '');
  const id = define(shapeId, `<polygon id="${shapeId}" points="${toPoints(outline)}"/>`);
  const seam = [[[housing.seam.from, housing.seam.y], [housing.seam.to, housing.seam.y]]];
  const light = [[[housing.seam.from, housing.seam.y + weldGap], [housing.seam.to, housing.seam.y + weldGap]]];
  const patchRadius = housing.rust.patchRadius;
  const patches = housing.rust.patches.map(item => ({ cx: turned ? box.width - item.cx : item.cx, cy: item.cy }));
  const patch = item => `<ellipse class="war-smudge" cx="${item.cx}" cy="${item.cy}" rx="${patchRadius.x}" ry="${patchRadius.y}"/>`;
  const arcs = turned ? mirroredPath(housing.rust.arcs, box.width) : housing.rust.arcs;
  const rivets = turned ? housing.rivets.map(center => [box.width - center[0], center[1]]) : housing.rivets;

  return `<svg class="war-housing${tall ? ' war-housing-tall' : ''}" width="${box.width}" height="${box.height}" viewBox="0 0 ${box.width} ${box.height}">
    <use class="war-housing-fill" href="#${id}"/>
    <path class="war-weld-dark" d="${pathData(seam)}"/>
    <path class="war-weld-light" d="${pathData(light)}"/>
    ${edgeLayers(id)}
    <g class="war-rust">${patches.map(patch).join('')}<path class="war-wear" d="${arcs}"/></g>
    ${rivetsMarkup(rivets, false, 'war-rivet')}
  </svg>`;
}


// What panels call

// The whole plate of a panel that sits outside the areas and draws its own:
// the fills, the frame in two halves that draw line by line, and the glint.
// kind is 'countdown', or a banner of the bar layout ('bar-banner', or 'bar-banner-minimal'), or the banner of Cybertron ('cybertron-banner'), which have no glint.
export function plateMarkup(kind) {
  const shape = shapeFor(kind);
  const red = shape.red ? ' red-metal' : '';
  defineFrame(kind, shape);

  if (shape.bar) return barFillsMarkup(shape) + frameHalves(kind, shape, red, 'outline');
  return fillsMarkup(kind, shape, red) + frameHalves(kind, shape, red, 'outline') + glintMarkup(kind, shape, red);
}

// The frame of the large or the small panel area, drawn once for as long as
// the screen is up. It holds no page content. kind is 'grid1' or 'grid2', or what frameKind
// gives for a steel style: 'cybertron-grid1', 'cybertron-grid2' and 'cybertron-ticker', or in the
// bar layout 'bar-main' or 'bar-ticker'. After the frame come its
// pieces, which are the same frame cut up and stay hidden until a mechanical page
// change shows them in its place (frame.css). A bar frame has no glint.
export function areaMarkup(kind) {
  const shape = shapeFor(kind);
  defineFrame(kind, shape);

  if (shape.bar) return barFillsMarkup(shape) + areaHalves(kind, shape) + piecesMarkup(kind, shape);
  return fillsMarkup(kind, shape, '') + areaHalves(kind, shape) + glintMarkup(kind, shape, '') + piecesMarkup(kind, shape);
}

// The frame behind the full screen alert and announcement: the plate, then
// the frame in two halves. options.red makes the frame red, and options.corner 'tr'
// cuts the top right and bottom left corners (a team's trim, core/teams.js)
const screenFrameTr = trimmedScreenFrame(screenFrame);

export function frameMarkup(options = {}) {
  const red = options.red ? ' red-metal' : '';
  const turned = options.corner === 'tr';
  const frame = turned ? screenFrameTr : screenFrame;
  const name = turned ? 'screen-tr' : 'screen';
  defineFrame(name, frame);

  return `<svg class="plate${red}" width="1920" height="1080" viewBox="0 0 1920 1080">
    <use class="body" href="#${name}-outline"/>
  </svg>` + frameHalves(name, frame, red, 'frame');
}

// A bar of light that sweeps across the panel once while it assembles.
// It is cut to the panel's outline so it never shows outside the plate.
export function scanMarkup(kind) {
  const shape = shapeFor(kind);
  const clip = shape.outline.map(point => point[0] + 'px ' + point[1] + 'px').join(', ');

  return `<div class="scan-clip" style="width: ${shape.width}px; height: ${shape.height}px; clip-path: polygon(${clip});">
    <div class="scan" data-part="scan" style="height: ${shape.height}px; --sweep: ${shape.width}px;"></div>
  </div>`;
}

// A thin metal bar between two rows, as its own svg, for a panel that places
// it with its own stylesheet. It is length wide and 20 high, and the line
// runs through the middle. In the stylesheet, give .row-bar a left and a top
// (it is positioned like a plate), for example 14px from the left and the
// bottom of the row minus 10px. The bar is part of its row, so it turns over
// with the row when the page changes.
export function rowBarMarkup(length) {
  return `<svg class="row-bar" width="${length}" height="20" viewBox="0 0 ${length} 20">
    <g class="thin" transform="translate(0 10)">${edgeLayers(defineBar(length))}</g>
  </svg>`;
}

// A card with a purple fill and a thin metal edge, and the bottom right
// corner cut. It is placed like a plate: at the top left of its parent, which
// should be position: relative and width by height big.
export function cardMarkup(width, height) {
  const points = [[2, 2], [width - 2, 2], [width - 2, height - 34], [width - 42, height - 2], [2, height - 2]];
  return edgedShape('card-' + width + 'x' + height, points, 'card-fill', 'card-outline thin', width, height);
}

// The team plate in the banner (520 x 76). The sidebar layout draws it at
// another width, and each width is its own shape, so the id carries the width
// (the 520 one keeps the id it has always had).
//
// The metal of this plate and of the ticker's tag is the thin plate edge (base.css, "The thin
// plate edge"): a rim 10 wide, not 16. The line of the shape runs 1 in from the sides, which puts the
// outer edge of the metal where it was, and 8 in from the top and 7 in from the bottom, which
// keeps the metal and its shadow inside the 76, so it never reaches the name above it or the
// wordmark below it. The plain plate, between the metal and the dark that its shadow throws
// inside the top and the left, is 15 to 64 high.
export function teamPlateMarkup(width = 520) {
  const points = [[1, 8], [width - 1, 8], [width - 1, 38], [width - 41, 69], [1, 69]];
  const id = width === 520 ? 'team-plate-shape' : 'team-plate-shape-' + width;
  return edgedShape(id, points, 'team-fill', 'team-plate-art', width, 76);
}

// The slanted label at the left end of the ticker. A longer word needs a
// wider tag, so the width is passed in. It is 77 high, 5 more than the row: the thin edge
// and the same line 1 in from the sides and the top put the metal where it was, and the ticker's
// frame is as high (barOptions, bar-ticker), so the tag fits into it.
export function tagMarkup(width = 208) {
  const right = width - 1;
  const points = [[26, 1], [right - 25, 1], [right, 76], [1, 76]];
  return edgedShape('tag-' + width, points, 'tag-fill', 'tag-plate', width, 77);
}
