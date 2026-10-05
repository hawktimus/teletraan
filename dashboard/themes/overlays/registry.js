// Every holiday overlay the screen can lay over a theme. Adding one is one CSS
// file in this folder, named after the id, and one line here
// (docs/adding-a-holiday-overlay.md).
//
// The Studio keeps its own copy of this list in studio/themes.js.
// check-schemas.mjs fails when the two lists differ, so change both.

export const overlays = [
  {
    id: 'example',
    name: 'Example overlay (placeholder)',
    description: 'Placeholder. A paler yellow and quiet text, to show how an overlay is written.',
  },
];
