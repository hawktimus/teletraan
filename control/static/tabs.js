// The list of areas, in one place. The page has five: Now, Show, Update, Computer and Details. A file called tab-<name>.js in this
// folder calls registerTab once:
//   registerTab({ id: 'now', title: 'Now', icon: 'pulse', order: tabOrder.now, render(element, section) { ... } })
// section is the part of the address after a slash (#show/photos), or ''. render may return a function that is called when the
// area is left. An area that has sections lists them in `sections` and draws them with areas/sections.js.
//
// One address for each area and each section, and every address that ever worked still lands somewhere (resolveAddress).

export const tabs = [];

export const tabOrder = { now: 10, show: 20, update: 30, computer: 40, details: 50 };

export const areaIds = ['now', 'show', 'update', 'computer', 'details'];

export function registerTab(tab) {
  if (tabs.some(other => other.id === tab.id)) return;
  tabs.push(tab);
  tabs.sort((a, b) => (a.order || 100) - (b.order || 100));
}

// The old four tabs (Status, Display, Content, Settings) and their sections, and where each one went: [area, section]
const oldAddresses = {
  status: ['now', ''],
  health: ['details', 'health'],
  display: ['show', ''],
  playlist: ['show', ''],
  hold: ['show', ''],
  messages: ['show', ''],
  theme: ['show', ''],
  update: ['update', 'publish'],
  keys: ['update', 'keys'],
  monday: ['update', 'monday'],
  sync: ['update', 'sync'],
  competition: ['update', 'competition'],
  restart: ['computer', 'restart'],
  reboot: ['computer', 'schedule'],
  screen: ['computer', 'screen'],
  cleanup: ['computer', 'cleanup'],
  log: ['details', 'log'],
  settings: ['update', 'sync'],
};

// The sections of the old Settings tab, by the word after the slash
const oldSettingsSections = {
  update: ['update', 'publish'],
  keys: ['update', 'keys'],
  monday: ['update', 'monday'],
  sync: ['update', 'sync'],
  competition: ['update', 'competition'],
  screen: ['computer', 'screen'],
  reboot: ['computer', 'schedule'],
  cleanup: ['computer', 'cleanup'],
  log: ['details', 'log'],
  all: ['details', 'settings'],
};

// The blocks of the old Content tab. Before it existed they sat at the foot of Display, so #display/ticker and the plain names of a
// block go to the block.
const contentBlocks = { ticker: 'ticker', news: 'ticker', tips: 'ticker', calendar: 'calendar', events: 'calendar', roster: 'roster', people: 'roster', announcements: 'announcements', announcement: 'announcements', photos: 'photos', photo: 'photos' };

export function resolveAddress(address) {
  const parts = String(address || '').split('/');
  if (areaIds.includes(parts[0])) return { id: parts[0], section: parts[1] || '' };
  if (parts[0] === 'content' || (parts[0] === 'display' && (parts[1] === 'content' || contentBlocks[parts[1]]))) {
    const named = parts[0] === 'content' ? parts[1] : parts[1] === 'content' ? parts[2] : parts[1];
    return { id: 'show', section: contentBlocks[named] || '' };
  }
  if (contentBlocks[parts[0]]) return { id: 'show', section: contentBlocks[parts[0]] };
  if (parts[0] === 'settings' && oldSettingsSections[parts[1]]) {
    const found = oldSettingsSections[parts[1]];
    return { id: found[0], section: found[1] };
  }
  const old = oldAddresses[parts[0]];
  if (old) return { id: old[0], section: old[1] };
  return { id: parts[0], section: parts[1] || '' };
}
