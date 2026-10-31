// The Update area: reading the outside sources and putting a new version on the wall. Sync (a card for each source and Sync
// everything), Publish (a four step flow with rollback), Keys (the secret keys and calendar links), the Monday check and the
// competition data. Only Publish and Roll back ask first.

import { mountSections } from './sections.js';
import { mountSync } from './update-sync.js';
import { mountPublish } from './update-publish.js';
import { mountKeys } from '../tabs/settings-keys.js';
import { mountMonday } from '../tabs/settings-monday.js';
import { mountCompetition } from '../tabs/settings-competition.js';
import { sentences } from '../guide.js';

export const sections = [
  { id: 'sync', title: 'Sync', mount: mountSync },
  { id: 'publish', title: 'Publish', lead: sentences['settings.update'], mount: mountPublish },
  { id: 'keys', title: 'Keys', lead: sentences['settings.keys'], mount: mountKeys },
  { id: 'monday', title: 'Monday check', lead: sentences['settings.monday'], mount: mountMonday },
  { id: 'competition', title: 'Competition data', lead: sentences['settings.competition'], mount: mountCompetition },
];

export function mountUpdateArea(box, section) {
  return mountSections(box, { area: 'update', title: 'Update', sections: sections }, section === 'sync' ? '' : section);
}
