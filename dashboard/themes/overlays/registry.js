// Every seasonal pack the screen can lay over a theme. A pack is a set of
// accent colours (one CSS file in this folder, named after the id) and,
// optionally, decorations (one file in dashboard/seasons/, named after the id).
// Adding one is the steps in docs/seasonal-packs.md.
//
// decorations says whether the pack has a file in seasons/. The screen loads
// that file only for a pack that says true, and tools/check-seasons.mjs fails
// when the flag and the file disagree.
//
// The Studio keeps its own copy of this list in studio/themes.js.
// check-schemas.mjs fails when the two lists differ, so change both.
//
// The ids are stored in Studio, in the Theme schedule, so never rename one.
// The order here is the order of the Studio's list.

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
