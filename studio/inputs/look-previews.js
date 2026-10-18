// The theme and view previews of the menu beside Publish on Dashboard Settings (tools/actions.js). They are the
// same four themes and four views as the control page's Now showing tab and the dashboard (themeIds and viewKeys
// in dashboard/config.js, themeIds and viewKeys in control/support/requests.js). The Studio is built on its own and
// cannot read those files, so the lists are written out here too. tests/schemas.test.mjs fails if they differ.
//
// A view is stored under its key: Robotics is general, and Condensed is family.

export const previewMinutes = 10;

export const themePreviews = [
  { id: 'original', name: 'Original' },
  { id: 'cybertron', name: 'Cybertron' },
  { id: 'retro', name: 'Retro' },
  { id: 'foundry', name: 'Foundry' },
];

export const viewPreviews = [
  { key: 'general', name: 'Robotics' },
  { key: 'prime', name: 'Prime' },
  { key: 'nova', name: 'Nova' },
  { key: 'family', name: 'Condensed' },
];
