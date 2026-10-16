// The list of tabs. A tab file calls registerTab once and needs no change anywhere else:
//   registerTab({ id: 'update', title: 'Update', order: 10, render(element) { ... } })
// render may return a function that is called when the tab is left.

export const tabs = [];

export function registerTab(tab) {
  if (tabs.some(other => other.id === tab.id)) return;
  tabs.push(tab);
  tabs.sort((a, b) => (a.order || 100) - (b.order || 100));
}
