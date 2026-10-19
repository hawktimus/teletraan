// The list of tabs. A tab file calls registerTab once and needs no change anywhere else:
//   registerTab({ id: 'status', title: 'Status', order: 10, render(element, section) { ... } })
// section is the part of the address after a slash (#settings/keys), or ''. render may return a function that is called when the tab is left.

export const tabs = [];

export function registerTab(tab) {
  if (tabs.some(other => other.id === tab.id)) return;
  tabs.push(tab);
  tabs.sort((a, b) => (a.order || 100) - (b.order || 100));
}

// The old addresses still work: #now and #status open Status, #update, #keys and #log open that section of Settings
const oldAddresses = { now: ['status', ''], update: ['settings', 'update'], keys: ['settings', 'keys'], log: ['settings', 'log'] };

export function resolveAddress(address) {
  const parts = String(address || '').split('/');
  const old = oldAddresses[parts[0]];
  return { id: old ? old[0] : parts[0], section: old ? old[1] : parts[1] || '' };
}
