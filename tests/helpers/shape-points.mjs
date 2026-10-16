// The points of the fill of a plate, as pairs of numbers. A fill is either a polygon of its own or a <use> of a shape
// that the page holds once in its defs (core/plate.js), so the defs text is needed for the second.
export function shapePoints(markup, className, defs = '') {
  const own = new RegExp('<polygon class="' + className + '"[^>]*points="([^"]+)"').exec(markup);
  if (own) return pairs(own[1]);

  const used = new RegExp('<use class="' + className + '" href="#([^"]+)"').exec(markup);
  if (!used) throw new Error('the markup has no fill called ' + className);

  const shape = new RegExp(' id="' + used[1] + '"[^>]* points="([^"]+)"').exec(defs);
  if (!shape) throw new Error('the defs have no shape called ' + used[1]);
  return pairs(shape[1]);
}

const pairs = text => text.split(' ').map(pair => pair.split(',').map(Number));
