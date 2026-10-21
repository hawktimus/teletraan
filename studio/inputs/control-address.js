// Where the control page of the Teletraan computer is (computer/, docs/control-page.md). The Studio links to it from Start
// here and from the Monday check notes. It is on port 3229 and asks for a PIN. If the page is reachable at another
// address, change it here and nowhere else.
export const controlAddress = 'http://teletraan.local:3229/control/';

// The tabs and sections of the control page that other pages link to. control/static/tabs.js keeps the older addresses working.
export const controlSections = {
  status: controlAddress + '#status',
  display: controlAddress + '#display',
  content: controlAddress + '#content',
  announcements: controlAddress + '#content/announcements',
  photos: controlAddress + '#content/photos',
  keys: controlAddress + '#settings/keys',
  monday: controlAddress + '#settings/monday',
  sync: controlAddress + '#settings/sync',
};
