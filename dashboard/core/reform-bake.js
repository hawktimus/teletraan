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

// The properties written into every copy. Sizes are the used sizes, so a copy never lays out differently from the page. A
// property is written only when it is not what an element has anyway: an inherited one that is the parent's value, and any other
// that is the starting value (initialValues). A copy is cloned a few hundred times, so its style is kept short.
const boxProperties = [
  'display', 'position', 'top', 'right', 'bottom', 'left', 'z-index', 'box-sizing', 'width', 'height',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'align-content', 'align-self', 'justify-self', 'gap', 'order',
  'grid-template-columns', 'grid-template-rows', 'grid-column-start', 'grid-column-end', 'grid-row-start', 'grid-row-end', 'grid-auto-flow',
  'overflow-x', 'overflow-y', 'float', 'clear', 'opacity', 'transform', 'transform-origin', 'transform-box', 'clip-path', 'mix-blend-mode',
  'object-fit', 'object-position', 'aspect-ratio',
];
const paintProperties = [
  'background-color', 'background-image', 'background-position', 'background-size', 'background-repeat', 'background-clip', 'background-origin',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width', 'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  'border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius', 'box-shadow',
  'stop-color', 'stop-opacity', 'vector-effect',
];
// These are inherited, so a child that has its parent's value says nothing
const inheritedProperties = [
  'visibility', 'color', 'fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'stroke-dashoffset', 'paint-order',
  'font-family', 'font-size', 'font-weight', 'font-style', 'font-stretch', 'font-variant-numeric', 'font-kerning', 'line-height', 'letter-spacing', 'word-spacing',
  'text-align', 'text-transform', 'text-indent', 'text-shadow', 'white-space', 'word-break', 'overflow-wrap', 'direction',
  '-webkit-text-stroke-width', '-webkit-text-stroke-color', '-webkit-text-fill-color',
];
// These are not, and are written only when they are not the starting value
const otherProperties = ['text-overflow', 'text-decoration', 'vertical-align', '-webkit-background-clip'];
const initialValues = {
  position: 'static', top: 'auto', right: 'auto', bottom: 'auto', left: 'auto', 'z-index': 'auto', float: 'none', clear: 'none',
  'flex-direction': 'row', 'flex-wrap': 'nowrap', 'justify-content': 'normal', 'align-items': 'normal', 'align-content': 'normal', 'align-self': 'auto', 'justify-self': 'auto',
  gap: 'normal', order: '0', 'grid-template-columns': 'none', 'grid-template-rows': 'none', 'grid-column-start': 'auto', 'grid-column-end': 'auto',
  'grid-row-start': 'auto', 'grid-row-end': 'auto', 'grid-auto-flow': 'row', 'overflow-x': 'visible', 'overflow-y': 'visible', opacity: '1', transform: 'none',
  'transform-box': 'view-box', 'clip-path': 'none', 'mix-blend-mode': 'normal', 'object-fit': 'fill', 'object-position': '50% 50%', 'aspect-ratio': 'auto',
  'margin-top': '0px', 'margin-right': '0px', 'margin-bottom': '0px', 'margin-left': '0px', 'padding-top': '0px', 'padding-right': '0px', 'padding-bottom': '0px', 'padding-left': '0px',
  'background-color': 'rgba(0, 0, 0, 0)', 'background-image': 'none', 'background-position': '0% 0%', 'background-size': 'auto', 'background-repeat': 'repeat', 'background-clip': 'border-box', 'background-origin': 'padding-box',
  'border-top-width': '0px', 'border-right-width': '0px', 'border-bottom-width': '0px', 'border-left-width': '0px', 'border-top-style': 'none', 'border-right-style': 'none', 'border-bottom-style': 'none', 'border-left-style': 'none',
  'border-top-left-radius': '0px', 'border-top-right-radius': '0px', 'border-bottom-right-radius': '0px', 'border-bottom-left-radius': '0px', 'box-shadow': 'none',
  'stop-color': 'rgb(0, 0, 0)', 'stop-opacity': '1', 'vector-effect': 'none', 'text-overflow': 'clip', 'text-decoration': 'none solid rgb(0, 0, 0)', 'vertical-align': 'baseline',
  'box-sizing': 'content-box', 'width': 'auto', 'height': 'auto', 'transform-origin': '', '-webkit-background-clip': 'border-box',
};

// The elements that are never copied: the edge metal of a frame (it is drawn again by the transition), the pieces a frame
// breaks into, the glint, and anything that only exists to move
const defaultSkip = 'svg.plate:not(.fills), svg.plate.piece, script, style, [data-reform-skip]';
const skipKeepingEdges = 'svg.plate.piece, script, style, [data-reform-skip]';
const marginedTags = /^(H[1-6]|P|UL|OL|DL|DD|BLOCKQUOTE|FIGURE|PRE|FORM|HR)$/i;

const edgeSelector = 'svg.plate:not(.fills)';

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

function copyStyle(copy, style, parentStyle) {
  const write = (name, value) => copy.style.setProperty(name, value);
  const borders = ['top', 'right', 'bottom', 'left'].filter(side => style.getPropertyValue('border-' + side + '-width') !== '0px' && style.getPropertyValue('border-' + side + '-style') !== 'none');

  for (const name of boxProperties) {
    const value = style.getPropertyValue(name);
    if (name === 'transform-origin') {
      if (style.transform !== 'none') write(name, value);
    } else if (value !== initialValues[name]) {
      write(name, value);
    }
  }
  for (const name of paintProperties) {
    const value = style.getPropertyValue(name);
    const side = /^border-(top|right|bottom|left)-color$/.exec(name);
    if (side) {
      if (borders.includes(side[1])) write(name, value);
    } else if (value !== initialValues[name]) {
      write(name, value);
    }
  }
  for (const name of inheritedProperties) {
    const value = style.getPropertyValue(name);
    if (!parentStyle || value !== parentStyle.getPropertyValue(name)) write(name, value);
  }
  for (const name of otherProperties) {
    const value = style.getPropertyValue(name);
    if (value !== initialValues[name]) write(name, value);
  }
  // An element whose browser style gives it a margin (a heading, a paragraph) is copied with the margin it really has: a margin of
  // 0 is the initial value and is not written above, so the copy would have had the browser's own, which moved the team name down
  if (marginedTags.test(copy.tagName)) ['top', 'right', 'bottom', 'left'].forEach(side => write('margin-' + side, style.getPropertyValue('margin-' + side)));
  write('animation', 'none');
  write('transition', 'none');
  if (style.display !== 'inline' && style.display !== 'contents') write('flex', '0 0 auto');
}

// Copies one element and, one turn at a time, everything under it. The walk keeps its place in a list, so it can stop
// after budgetMs and be asked to go on (bakeOnce).
function copyElement(source, origin, hidden, parentStyle) {
  const style = window.getComputedStyle(source);
  if (style.display === 'none') return null;

  const copy = source.cloneNode(false);
  copy.removeAttribute('class');
  copy.removeAttribute('style');
  // A copy is never found by the code that looks a part of the page up (data-panel, an id): only svg ids stay, which gradients need
  for (const attribute of Array.from(copy.attributes)) {
    if (attribute.name.startsWith('data-') || (attribute.name === 'id' && copy.namespaceURI !== svgNamespace)) copy.removeAttribute(attribute.name);
  }
  if (source.tagName.toLowerCase() === 'canvas') return null;
  copyStyle(copy, style, parentStyle);
  if (hidden) copy.style.setProperty('visibility', 'hidden');
  facts.set(copy, { own: rectOf(source, origin), all: null, inline: style.display === 'inline', edge: false, hasEdge: false });
  return copy;
}

// Copies a part of the page. source is the element at the top; the copy is placed where the source is, on the screen,
// and holds everything of the source that is not in skip. Resolves with { root, rect }. When budgetMs is more than 0 the
// work stops now and then and waits a frame, so no frame is long.
export async function bake(source, options = {}) {
  const origin = options.origin || screenOrigin();
  const skip = options.skip || (options.edges ? skipKeepingEdges : defaultSkip);
  const hide = options.hide || '';
  const budget = options.budgetMs || 0;
  const frameWait = options.wait || (() => new Promise(resolve => requestAnimationFrame(() => resolve())));
  let turnEnds = budget > 0 ? performance.now() + budget : Infinity;

  async function walk(from, copy, covered = false) {
    const parentStyle = window.getComputedStyle(from);
    for (const child of Array.from(from.childNodes)) {
      if (child.nodeType === 3) {
        copy.appendChild(child.cloneNode(false));
        continue;
      }
      if (child.nodeType !== 1 || child.matches(skip)) continue;

      const made = copyElement(child, origin, covered || (hide !== '' && child.matches(hide)), parentStyle);
      if (!made) continue;
      copy.appendChild(made);
      const fact = facts.get(made);
      // The edge metal of a frame is marked, so that a slice can leave it out or take only it
      if (options.edges && child.matches(edgeSelector)) {
        made.setAttribute('data-reform-edge', '');
        fact.edge = true;
      }
      await walk(child, made, covered || (hide !== '' && child.matches(hide)));
      fact.hasEdge = fact.edge || Array.from(made.children).some(item => facts.get(item) && facts.get(item).hasEdge);
      fact.all = union(fact.own, childrenOf(made));
      if (performance.now() > turnEnds) {
        await frameWait();
        turnEnds = performance.now() + budget;
      }
    }
  }

  const root = copyElement(source, origin, false, null);
  await walk(source, root);
  const rect = rectOf(source, origin);
  const fact = facts.get(root);
  fact.hasEdge = Array.from(root.children).some(item => facts.get(item) && facts.get(item).hasEdge);
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

// What one square holds: a box the size of the window, with the copy placed so that the window shows the right part. The box
// clips. A box wholly outside the window is emptied and keeps its size. mode is 'content' (the default, no edge metal), or
// 'edges', which is only the edge metal of the frames, for the part of the transition where the old frames are still there.
export function slice(baked, windowRect, mode = 'content') {
  const holder = document.createElement('div');
  holder.className = 'reform-window';
  holder.style.cssText = 'position:absolute;left:0;top:0;width:' + windowRect.w + 'px;height:' + windowRect.h + 'px;overflow:hidden;';
  const origin = document.createElement('div');
  origin.style.cssText = 'position:absolute;left:' + -windowRect.x + 'px;top:' + -windowRect.y + 'px;width:0;height:0;';
  holder.appendChild(origin);
  origin.appendChild(cut(baked.root, windowRect, mode));
  return holder;
}

// A box that holds the edge metal must lay out as it did and paint nothing of its own
function muted(copy) {
  copy.style.setProperty('background', 'none');
  copy.style.setProperty('box-shadow', 'none');
  copy.style.setProperty('border-color', 'transparent');
  return copy;
}

function cut(node, windowRect, mode) {
  const fact = facts.get(node);

  if (mode === 'edges') {
    if (fact && fact.edge) return node.cloneNode(true);
    const shell = muted(node.cloneNode(false));
    if (!fact || !fact.hasEdge) return shell;
    for (const child of node.children) shell.appendChild(cut(child, windowRect, mode));
    return shell;
  }

  const copy = node.cloneNode(false);
  if (fact && fact.all && !fact.inline && !meets(fact.all, windowRect)) return copy;

  for (const child of node.childNodes) {
    if (child.nodeType !== 1) {
      copy.appendChild(child.cloneNode(false));
    } else if (!(facts.get(child) && facts.get(child).edge)) {
      copy.appendChild(cut(child, windowRect, mode));
    }
  }
  return copy;
}
