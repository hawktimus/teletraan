// The three Screen documents: Original, Cybertron and Minimal (schemas/screen.js). Each has a
// fixed id, and the id says which style the Screen is. No style field is stored: the dashboard
// reads the style from the id. Plain names and functions only, so that structure.js, the input
// of the form and check-schemas.mjs all use the same words.

export const screenType = 'screen';

// The same names as styles in dashboard/config.js
export const screenStyles = ['original', 'cybertron', 'minimal'];

export const screenTitles = { original: 'Original', cybertron: 'Cybertron', minimal: 'Minimal' };

export function screenIdOf(style) {
  return 'screen-' + style;
}

// The style of a Screen from its document id, with or without the drafts. in front. A document
// that is not one of the three gives nothing.
export function styleOfScreenId(id) {
  const plain = typeof id === 'string' ? id.replace(/^drafts\./, '') : '';
  return screenStyles.filter(style => screenIdOf(style) === plain)[0] || '';
}
