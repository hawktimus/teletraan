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
// The ids are stored in Studio, in the Look schedule, so never rename one.
// The order here is the order of the Studio's list.

export const overlays = [
  {
    id: 'halloween',
    name: 'Halloween',
    description: 'Orange accents, a pumpkin on every header, bats and candy corn drifting over the panels, a graveyard scene.',
    decorations: true,
  },
  {
    id: 'thanksgiving',
    name: 'Thanksgiving',
    description: 'Amber accents, a turkey on every header, autumn leaves falling over the panels, vines and a harvest scene.',
    decorations: true,
  },
  {
    id: 'christmas',
    name: 'Christmas',
    description: 'Green and rose accents, a fir tree on every header, snow falling over the panels, lights and a snowy scene.',
    decorations: true,
  },
  {
    id: 'new-years',
    name: 'New Year\'s',
    description: 'Gold and silver accents, a firework burst on every header, confetti and balloons over the panels, and a night skyline.',
    decorations: true,
  },
  {
    id: 'valentines-day',
    name: 'Valentine\'s Day',
    description: 'Pink accents, a heart with an arrow on every header, hearts and love letters rising over the panels, and a ribbon.',
    decorations: true,
  },
  {
    id: 'competition-day',
    name: 'Competition Day',
    description: 'Gold accents, a chequered flag on every header, gears and confetti over the panels, and a pit lane along the edge.',
    decorations: true,
  },
  {
    id: 'summer-break',
    name: 'Summer Break',
    description: 'Aqua accents, a sun over waves on every header, bubbles and gulls over the panels, and a beach along the edge.',
    decorations: true,
  },
  {
    id: 'example',
    name: 'Example overlay (placeholder)',
    description: 'Placeholder. A paler yellow and quiet text, to show how an overlay is written.',
    decorations: false,
  },
];
