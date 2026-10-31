// The sticky action bar of a phone: the primary action of the area stays in reach at the bottom of the screen, just above the
// navigation bar, once the real button has scrolled out of view. It is a second button that presses the real one, so there is
// one action, one result line and one place that remembers the last result. It never shows from 900 px up, where the
// navigation is a sidebar and the buttons are already in view (the CSS decides).

import { el, esc } from '../dom.js';
import { icon } from '../icons.js';

// action is what actionButton gave. The bar is added to box and a function that takes it away is returned.
export function stickyBar(box, action, label, iconName) {
  const bar = el('div', 'sticky-action');
  bar.hidden = true;
  const button = el('button', 'btn btn-primary');
  button.type = 'button';
  button.innerHTML = icon(iconName || 'sync') + '<span class="btn-label">' + esc(label) + '</span><span class="spinner" hidden aria-hidden="true"></span>';
  bar.append(button);
  box.append(bar);

  button.addEventListener('click', () => action.start());
  const mirror = () => {
    button.disabled = action.button.disabled;
    button.querySelector('.spinner').hidden = !action.button.disabled;
  };
  const watcher = new MutationObserver(mirror);
  watcher.observe(action.button, { attributes: true, attributeFilter: ['disabled'] });

  let seen = null;
  if (typeof IntersectionObserver === 'function') {
    seen = new IntersectionObserver(entries => { bar.hidden = entries[0].isIntersecting; }, { threshold: 0.1 });
    seen.observe(action.button);
  }
  return () => {
    watcher.disconnect();
    if (seen) seen.disconnect();
    bar.remove();
  };
}
