// Where the Monday check is. The Studio cannot press the buttons of the Teletraan computer itself: the control page
// is behind a PIN and on another address, and its helper answers only to that page. So the Monday tab of Dashboard
// Settings and the Monday page show a note and a link to Settings, Monitor Monday on the control page, where Check the token
// and Monday debug are. Nothing here sends a request and nothing here holds a key.
//
// Plain data only, so that tests/schemas.test.mjs can read it with node.

import { controlAddress } from '../inputs/control-address.js';

// Settings, Monitor Monday on the control page (control/static/tabs/settings-monday.js)
export const checkAddress = controlAddress + '#settings/monday';

export const words = {
  note: 'The check runs on the control page, which asks for the PIN. Open Settings, Monitor Monday there and press Check the token. Press Monday debug on the same page if the Monday page lists no tasks. Send the answer to a coach.',
  link: 'Open the Monday check on the control page',
  wifi: 'It works on the WiFi of the shop.',
};
