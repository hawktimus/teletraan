// The themes and seasonal packs the Theme page offers. This is a copy of
// dashboard/themes/registry.js and dashboard/themes/overlays/registry.js. The
// Studio is built on its own and cannot read files from the dashboard folder,
// so the lists are written out here too. check-schemas.mjs fails if the ids,
// names, descriptions or decorations flags differ, so change both when you add
// a theme or a pack (docs/adding-a-theme.md, docs/seasonal-packs.md).
//
// A seasonal pack is stored as an overlay: the accent colours of a holiday and,
// when decorations is true, the decorations that go with it. The ids are stored
// in the Theme schedule, so never rename one.

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
    id: 'halloween',
    name: 'Halloween',
    description: 'Orange accents and Halloween decorations along the edges of the screen.',
    decorations: true,
  },
  {
    id: 'thanksgiving',
    name: 'Thanksgiving',
    description: 'Warm harvest accents and Thanksgiving decorations along the edges of the screen.',
    decorations: true,
  },
  {
    id: 'christmas',
    name: 'Christmas',
    description: 'Green and rose accents, falling snow, a lit string and a snowy scene along the edges.',
    decorations: true,
  },
  {
    id: 'new-years',
    name: 'New Year\'s',
    description: 'Champagne accents and New Year decorations along the edges of the screen.',
    decorations: true,
  },
  {
    id: 'valentines-day',
    name: 'Valentine\'s Day',
    description: 'Pink accents and Valentine\'s Day decorations along the edges of the screen.',
    decorations: true,
  },
  {
    id: 'competition-day',
    name: 'Competition Day',
    description: 'Bright accents and competition decorations along the edges of the screen.',
    decorations: true,
  },
  {
    id: 'summer-break',
    name: 'Summer Break',
    description: 'Sunny accents and summer decorations along the edges of the screen.',
    decorations: true,
  },
  {
    id: 'example',
    name: 'Example overlay (placeholder)',
    description: 'Placeholder. A paler yellow and quiet text, to show how an overlay is written.',
    decorations: false,
  },
];
