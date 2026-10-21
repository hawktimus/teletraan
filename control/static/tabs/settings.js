// The Settings tab: folding sections, one file each (settings-*.js). A section is drawn the first time it is opened. On a
// phone one section is open at a time. A link such as #settings/keys (or the old #keys) opens that section.
//
// Updates, Keys, Monitor Monday, Sync and restart, Screen, Scheduled reboot, Logs, All settings. The ids are the words after
// the slash in the address and do not change when a title does.

import { registerTab, tabOrder } from '../tabs.js';
import { widthWord } from './arrange.js';
import { mountUpdate } from './settings-update.js';
import { mountKeys } from './settings-keys.js';
import { mountMonday } from './settings-monday.js';
import { mountSync } from './settings-sync.js';
import { mountReboot } from './settings-reboot.js';
import { mountScreen } from './settings-screen.js';
import { mountLog } from './settings-log.js';
import { mountAll } from './settings-all.js';

export const sections = [
  { id: 'update', title: 'Updates', mount: mountUpdate, light: true },
  { id: 'keys', title: 'Keys', mount: mountKeys },
  { id: 'monday', title: 'Monitor Monday', mount: mountMonday, light: true },
  { id: 'sync', title: 'Sync and restart', mount: mountSync },
  { id: 'screen', title: 'Screen', mount: mountScreen, light: true },
  { id: 'reboot', title: 'Scheduled reboot', mount: mountReboot },
  { id: 'log', title: 'Logs', mount: mountLog },
  // Other files add to this one (settings-all.js); its body has a fixed id for them
  { id: 'all', title: 'All settings', mount: mountAll, light: true, bodyId: 'settings-all' },
];

registerTab({
  id: 'settings',
  title: 'Settings',
  order: tabOrder.settings,
  render(container, section) {
    const wanted = sections.some(item => item.id === section) ? section : 'update';
    const root = document.createElement('div');
    root.className = 'settings-page';
    const stops = [];
    const folds = [];
    sections.forEach(item => {
      const fold = document.createElement('details');
      fold.className = 'fold';
      fold.dataset.section = item.id;
      const head = document.createElement('summary');
      head.textContent = item.title;
      const body = document.createElement('div');
      body.className = item.light ? 'fold-body' : 'fold-body tab';
      if (item.bodyId) body.id = item.bodyId;
      fold.append(head, body);
      let drawn = false;
      const draw = () => {
        if (drawn || !fold.open) return;
        drawn = true;
        Promise.resolve(item.mount(body)).then(stop => { if (typeof stop === 'function') stops.push(stop); }).catch(error => { body.textContent = error.message; });
      };
      fold.addEventListener('toggle', () => {
        // One section at a time unless the screen is wide
        if (fold.open && widthWord(window.innerWidth) !== 'wide') folds.forEach(other => { if (other !== fold) other.open = false; });
        draw();
      });
      fold.open = item.id === wanted;
      folds.push(fold);
      draw();
      root.append(fold);
    });
    container.append(root);
    return () => stops.forEach(stop => stop());
  },
});
