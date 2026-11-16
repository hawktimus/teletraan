// The ROBOT STATUS placeholder: its title and a dashed inner frame, until the panel is designed (core/placeholder.js).

import { placeholderMarkup } from '../../core/placeholder.js';

// A panel that has not been designed has nothing to show: the rotation passes it over until it is (core/placeholder.js)
export function hasContent() {
  return false;
}

export function mount(host) {
  host.innerHTML = placeholderMarkup('robotStatus', 'ROBOT STATUS');
}
