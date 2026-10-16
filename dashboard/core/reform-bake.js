// A frozen copy of a part of the page, for the reform transitions (docs/transitions.md).
//
// The squares of a turn show the old content on their face and the new content on their back, at the same time. The two
// looks cannot both be on the page, because the look (the team colors, the mirror, the layout) is classes of the root
// element and every rule reads them. So each side is copied as real elements with the look it has now written into
// each one as its own style, and it no longer reads the page. The copy is the same boxes, the same text and the same
// pictures, and nothing in it moves: animations and transitions are off.
//
// bake() copies in short turns, a few milliseconds each, so a big page does not stop the screen. slice() cuts the part of
// a baked copy that lies in a window and nothing else, which is what a square holds. A box that lies wholly outside the
// window is kept as an empty box of the same size, so what is left lays out as it did.

const svgNamespace = 'http://www.w3.org/2000/svg';

// The properties written into every copy. Sizes are the used sizes, so a copy never lays out differently from the page.
const boxProperties = [
  'display', 'position', 'top', 'right', 'bottom', 'left', 'z-index', 'box-sizing', 'width', 'height',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'align-content', 'align-self', 'justify-self', 'gap', 'order',
  'grid-template-columns', 'grid-template-rows', 'grid-column-start', 'grid-column-end', 'grid-row-start', 'grid-row-end', 'grid-auto-flow',
  'overflow-x', 'overflow-y', 'float', 'clear', 'visibility', 'opacity', 'transform', 'transform-origin', 'transform-box', 'clip-path', 'mix-blend-mode',
  'object-fit', 'object-position', 'aspect-ratio',
];
const paintProperties = [
  'color', 'background-color', 'background-image', 'background-position', 'background-size', 'background-repeat', 'background-clip', 'background-origin',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width', 'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  'border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius', 'box-shadow', 'outline',
  'fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'stroke-dashoffset', 'stop-color', 'stop-opacity', 'paint-order', 'vector-effect',
];
const textProperties = [
  'font-family', 'font-size', 'font-weight', 'font-style', 'font-stretch', 'font-variant-numeric', 'font-kerning', 'line-height', 'letter-spacing', 'word-spacing',
  'text-align', 'text-transform', 'text-indent', 'text-shadow', 'text-overflow', 'text-decoration', 'white-space', 'word-break', 'overflow-wrap', 'vertical-align', 'direction',
  '-webkit-text-stroke-width', '-webkit-text-stroke-color', '-webkit-background-clip', '-webkit-text-fill-color',
];
const properties = boxProperties.concat(paintProperties, textProperties);

// The elements that are never copied: the edge metal of a frame (it is drawn again by the transition), the pieces a frame
// breaks into, the glint, and anything that only exists to move
const defaultSkip = 'svg.plate:not(.fills), svg.plate.piece, script, style, [data-reform-skip]';

export function screenOrigin() {
  const box = document.getElementById('screen').getBoundingClientRect();
  return { left: box.left, top: box.top, scale: box.width / 1920 };
}

// Where an element is on the 1920 x 1080 screen
export function rectOf(element, origin) {
  const box = element.getBoundingClientRect();
  return { x: (box.left - origin.left) / origin.scale, y: (box.top - origin.top) / origin.scale, w: box.width / origin.scale, h: box.height / origin.scale };
}

function union(a, b) {
  if (!a) return b;
  if (!b) return a;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x: x, y: y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

function meets(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// What a copy knows about the element it came from: where it and everything under it lay, and whether it is inline
// (an inline element is never emptied, because its text shapes the line it is in)
const facts = new WeakMap();

function copyStyle(copy, source, style) {
  for (const name of properties) copy.style.setProperty(name, style.getPropertyValue(name));
  copy.style.setProperty('animation', 'none');
  copy.style.setProperty('transition', 'none');
  copy.style.setProperty('will-change', 'auto');
  if (style.display !== 'inline' && style.display !== 'contents') copy.style.setProperty('flex', '0 0 auto');
}

// Copies one element and, one turn at a time, everything under it. The walk keeps its place in a list, so it can stop
// after budgetMs and be asked to go on (bakeOnce).
function copyElement(source, origin, skip, hidden) {
  const style = window.getComputedStyle(source);
  if (style.display === 'none') return null;

  const copy = source.cloneNode(false);
  copy.removeAttribute('class');
  copy.removeAttribute('style');
  if (source.tagName.toLowerCase() === 'canvas') return null;
  copyStyle(copy, source, style);
  if (hidden || style.visibility === 'hidden') copy.style.setProperty('visibility', 'hidden');
  facts.set(copy, { own: rectOf(source, origin), all: null, inline: style.display === 'inline' });
  return copy;
}

// Copies a part of the page. source is the element at the top; the copy is placed where the source is, on the screen,
// and holds everything of the source that is not in skip. Resolves with { root, rect }. When budgetMs is more than 0 the
// work stops now and then and waits a frame, so no frame is long.
export async function bake(source, options = {}) {
  const origin = options.origin || screenOrigin();
  const skip = options.skip || defaultSkip;
  const budget = options.budgetMs || 0;
  const frameWait = options.wait || (() => new Promise(resolve => requestAnimationFrame(() => resolve())));
  let turnEnds = budget > 0 ? performance.now() + budget : Infinity;

  async function walk(from, copy) {
    for (const child of Array.from(from.childNodes)) {
      if (child.nodeType === 3) {
        copy.appendChild(child.cloneNode(false));
        continue;
      }
      if (child.nodeType !== 1 || child.matches(skip)) continue;

      const made = copyElement(child, origin, skip, false);
      if (!made) continue;
      copy.appendChild(made);
      await walk(child, made);
      const fact = facts.get(made);
      fact.all = union(fact.own, childrenOf(made));
      if (performance.now() > turnEnds) {
        await frameWait();
        turnEnds = performance.now() + budget;
      }
    }
  }

  const root = copyElement(source, origin, skip, false);
  await walk(source, root);
  const rect = rectOf(source, origin);
  const fact = facts.get(root);
  fact.all = union(fact.own, childrenOf(root));
  // The copy sits where the source sits on the screen, in a box of the screen's own size
  root.style.setProperty('position', 'absolute');
  root.style.setProperty('left', rect.x + 'px');
  root.style.setProperty('top', rect.y + 'px');
  root.style.setProperty('margin', '0');
  root.style.setProperty('transform', 'none');
  root.style.setProperty('opacity', '1');
  root.style.setProperty('visibility', 'visible');
  return { root: root, rect: rect };
}

function childrenOf(copy) {
  let all = null;
  for (const child of copy.children) {
    const fact = facts.get(child);
    if (fact && fact.all) all = union(all, fact.all);
  }
  return all;
}

// What one square holds: a box the size of the window, with the copy placed so that the window shows the right part. The
// box clips. A box wholly outside the window is emptied and keeps its size.
export function slice(baked, windowRect) {
  const holder = document.createElement('div');
  holder.className = 'reform-window';
  holder.style.cssText = 'position:absolute;left:0;top:0;width:' + windowRect.w + 'px;height:' + windowRect.h + 'px;overflow:hidden;';
  const origin = document.createElement('div');
  origin.style.cssText = 'position:absolute;left:' + -windowRect.x + 'px;top:' + -windowRect.y + 'px;width:0;height:0;';
  holder.appendChild(origin);
  origin.appendChild(cut(baked.root, windowRect));
  return holder;
}

function cut(node, windowRect) {
  const fact = facts.get(node);
  const copy = node.cloneNode(false);
  if (fact && fact.all && !fact.inline && !meets(fact.all, windowRect)) return copy;

  for (const child of node.childNodes) copy.appendChild(child.nodeType === 1 ? cut(child, windowRect) : child.cloneNode(false));
  return copy;
}

// The whole of a baked copy, flat, for the cover that lies over the squares before and after the turn
export function wholeOf(baked, windowRect) {
  return slice(baked, windowRect);
}

// How many elements a baked copy holds
export function countOf(baked) {
  return baked.root.querySelectorAll('*').length + 1;
}

export { svgNamespace };
