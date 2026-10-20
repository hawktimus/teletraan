// The width of the page the large panels are drawn on: 1152, or the width of the main panel
// in the bar layout (layouts/bar.css, --page-width). Panels that draw a bar or a card in code
// take their lengths from here, so a row fills the panel in either layout.

import { layoutNow } from './layout-core.js';
import { barGeometry } from './layout-bar.js';

const standardWidth = 1152;
const barEdge = 32; // the metal and the neon line at the right end of the main panel

export function pageWidth() {
  return layoutNow() === 'bar' ? barGeometry.areaWidth - barEdge : standardWidth;
}
