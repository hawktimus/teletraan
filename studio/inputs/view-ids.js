// The four View documents: General, Prime, Nova and Family (schemas/view.js). Each exists once with
// a fixed id, and the id says which view it is. Plain names and functions only, so that structure.js,
// the form and tests/schemas.test.mjs all use the same words.

export const viewType = 'view';

export const viewKeys = ['general', 'prime', 'nova', 'family'];

// The words of the sidebar and the picker. The two team views take their names from the Team
// documents on the screen; these are the names the Studio shows.
export const viewTitles = { general: 'General', prime: 'Prime', nova: 'Nova', family: 'Family' };

// The minutes each view stays on the screen, to start with
export const viewMinutes = { general: 6, prime: 6, nova: 6, family: 2 };

export const minutesLimits = { min: 1, max: 30 };

// The two arrangements. standard is the banner, main panel, countdown and small panels. bar is the
// banner across the top, a column at one side and one main panel.
export const viewLayouts = [
  { title: 'Standard', value: 'standard' },
  { title: 'Bar', value: 'bar' },
];

export function viewIdOf(key) {
  return 'view-' + key;
}

// The key of a View from its document id, with or without the drafts. in front. A document that is
// not one of the four gives nothing.
export function keyOfViewId(id) {
  const plain = typeof id === 'string' ? id.replace(/^drafts\./, '') : '';
  return viewKeys.filter(key => viewIdOf(key) === plain)[0] || '';
}
