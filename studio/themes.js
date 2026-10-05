// The themes and holiday overlays the Theme page offers. This is a copy of
// dashboard/themes/registry.js and dashboard/themes/overlays/registry.js. The
// Studio is built on its own and cannot read files from the dashboard folder,
// so the lists are written out here too. check-schemas.mjs fails if the ids,
// names or descriptions differ, so change both when you add a theme or an
// overlay (docs/adding-a-theme.md).

export const themes = [
  {
    id: 'hawktimus',
    name: 'Hawktimus',
    description: 'The purple and gold look the screen has always had.',
  },
  {
    id: 'alternate',
    name: 'Alternate (placeholder)',
    description: 'Placeholder. A dark blue look that shows how a second theme is written.',
  },
];

export const overlays = [
  {
    id: 'example',
    name: 'Example overlay (placeholder)',
    description: 'Placeholder. A paler yellow and quiet text, to show how an overlay is written.',
  },
];
