// The Settings tab: four folding sections, Update, Keys, Monday and Log. A section is drawn the first time it is opened.
// A link such as #settings/keys (or the old #keys) opens that section.

import { registerTab } from '../tabs.js';
import { mountUpdate } from '../tab-update.js';
import { mountKeys } from './keys.js';
import { mountLog } from './log.js';
import { mountMonday } from './monday.js';

const sections = [
  { id: 'update', title: 'Update', mount: mountUpdate, light: true },
  { id: 'keys', title: 'Keys', mount: mountKeys },
  { id: 'monday', title: 'Monday', mount: mountMonday, light: true },
  { id: 'log', title: 'Log', mount: mountLog },
];

registerTab({
  id: 'settings',
  title: 'Settings',
  order: 20,
  render(container, section) {
    const wanted = sections.some(item => item.id === section) ? section : 'update';
    const root = document.createElement('div');
    root.className = 'settings-page';
    const stops = [];
    sections.forEach(item => {
      const fold = document.createElement('details');
      fold.className = 'fold';
      fold.dataset.section = item.id;
      const head = document.createElement('summary');
      head.textContent = item.title;
      const body = document.createElement('div');
      body.className = item.light ? 'fold-body' : 'fold-body tab';
      fold.append(head, body);
      let drawn = false;
      const draw = () => {
        if (drawn || !fold.open) return;
        drawn = true;
        Promise.resolve(item.mount(body)).then(stop => { if (typeof stop === 'function') stops.push(stop); }).catch(error => { body.textContent = error.message; });
      };
      fold.addEventListener('toggle', draw);
      fold.open = item.id === wanted;
      draw();
      root.append(fold);
    });
    container.append(root);
    return () => stops.forEach(stop => stop());
  },
});
