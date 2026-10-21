// The All settings section of Settings. The settings from the Studio fields are drawn here by another file, which calls
//   extendTab('settings-all', { mount(element) { ... } })
// (tabs.js). The element is also the body of the section, which has the id settings-all. Until a file does, the section
// says what is coming.

import { extensionsFor } from '../tabs.js';

export const placeholderWords = 'Coming: every setting of the Studio, edited here. Until then, use Dashboard Settings in the Studio.';

export function mountAll(body) {
  const extensions = extensionsFor('settings-all');
  if (extensions.length === 0) {
    const line = document.createElement('p');
    line.className = 'note';
    line.textContent = placeholderWords;
    body.append(line);
    return undefined;
  }
  const stops = extensions.map(item => item.mount(body));
  return () => stops.forEach(stop => Promise.resolve(stop).then(done => { if (typeof done === 'function') done(); }));
}
