// The previews the Dashboard Settings page can show now. This is a copy of the ids and
// names in previewKinds in dashboard/core/preview.js. The Studio is built on its own and
// cannot read files from the dashboard folder, so the list is written out here too.
// check-schemas.mjs fails if the ids or names differ, so change both when you add one
// (docs/hidden-transitions.md).
//
// id      what is stored in previewRequest.kind
// name    the words after Preview on the button
// shows   what the screen holds for 2 minutes, in the words of the button's hover text

export const previews = [
  { id: 'prime', name: 'Prime', shows: 'the Prime team' },
  { id: 'nova', name: 'Nova', shows: 'the Nova team' },
  { id: 'cybertron', name: 'Cybertron', shows: 'the Cybertron style' },
  { id: 'minimal', name: 'Minimal', shows: 'the Minimal style' },
  { id: 'next-pack', name: 'next pack', shows: 'the next seasonal pack in the list' },
];
