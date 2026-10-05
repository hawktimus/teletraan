// The screens a demo can show. This is a copy of the ids and names in
// dashboard/core/demo-screens.js. The Studio is built on its own and cannot
// read files from the dashboard folder, so the list is written out here too.
// check-schemas.mjs fails if the ids or names differ, so change both when you
// add a screen (docs/demo.md).

export const demoScreens = [
  { id: 'announcement', name: 'Announcement' },
  { id: 'night-mode', name: 'Night mode' },
];
