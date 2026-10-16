// The 3D VIEW placeholder: its title and a dashed inner frame, until the panel is designed (core/placeholder.js).

import { placeholderMarkup } from '../../core/placeholder.js';

export function mount(host) {
  host.innerHTML = placeholderMarkup('wireframe', '3D VIEW');
}
