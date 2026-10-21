// The list of tabs, in one place. The page has three: Status, Display, Settings. A tab file calls registerTab once:
//   registerTab({ id: 'status', title: 'Status', order: tabOrder.status, render(element, section) { ... } })
// section is the part of the address after a slash (#settings/keys), or ''. render may return a function that is called
// when the tab is left.
//
// Another file can add a block to a tab, or to a place inside one, without editing it:
//   extendTab('display', { place: 'before', mount(element) { ... } })
// The place is a tab id, or a name a tab offers (settings-all). mount may return a function that is called on leaving.

export const tabs = [];

export const tabOrder = { status: 10, display: 20, settings: 30 };

export function registerTab(tab) {
  if (tabs.some(other => other.id === tab.id)) return;
  tabs.push(tab);
  tabs.sort((a, b) => (a.order || 100) - (b.order || 100));
}

const extensions = [];

export function extendTab(where, extension) {
  extensions.push({ where: where, place: extension.place === 'before' ? 'before' : 'after', mount: extension.mount });
}

export function extensionsFor(where, place) {
  return extensions.filter(item => item.where === where && (!place || item.place === place));
}

// Every address that ever worked, and where it goes now: [tab, section]. A section the tab does not know is ignored by
// the tab, which then opens its first one.
const oldAddresses = {
  now: ['status', ''],
  health: ['status', ''],
  update: ['settings', 'update'],
  keys: ['settings', 'keys'],
  monday: ['settings', 'monday'],
  sync: ['settings', 'sync'],
  restart: ['settings', 'sync'],
  reboot: ['settings', 'reboot'],
  log: ['settings', 'log'],
  playlist: ['display', ''],
  hold: ['display', ''],
  messages: ['display', ''],
  theme: ['display', ''],
};

// Old sections of Settings that moved: the health and restart buttons were on Status
const oldSections = { restart: 'sync', health: 'sync', dots: 'sync', reads: 'sync' };

export function resolveAddress(address) {
  const parts = String(address || '').split('/');
  const old = oldAddresses[parts[0]];
  const section = old ? old[1] : parts[1] || '';
  return { id: old ? old[0] : parts[0], section: oldSections[section] || section };
}
