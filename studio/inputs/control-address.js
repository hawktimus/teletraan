// Where the control page of the Mini is (mini/, docs/control-page.md). The Studio calls its helper
// endpoint for the buttons that need the Mini, such as Test the token on the Monday tab, and links to
// the page from Start here. If the page is reachable at another address, change it here and nowhere else.
export const controlAddress = 'http://teletraan.local/control/';

// The helper endpoint: a POST of { word, args } that runs one word of the Mini's helper and answers with
// { ok, output, error }
export const helperAddress = controlAddress + 'api/helper';
