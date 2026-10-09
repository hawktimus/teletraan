// The themes and seasonal packs the Look page offers. This is a copy of
// dashboard/themes/registry.js and dashboard/themes/overlays/registry.js. The
// Studio is built on its own and cannot read files from the dashboard folder,
// so the lists are written out here too. check-schemas.mjs fails if the ids,
// names, descriptions or decorations flags differ, so change both when you add
// a theme or a pack (docs/adding-a-theme.md, docs/seasonal-packs.md). A theme
// that has a layout other than the standard one says so, as the registry does.
//
// A seasonal pack is stored as an overlay: the accent colours of a holiday and,
// when decorations is true, the decorations that go with it. The ids are stored
// in the Look schedule, so never rename one.

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
  {
    id: 'neon-prime',
    name: 'Neon Prime',
    description: 'Dark purple, gunmetal, cyan and magenta neon. Name on top, sidebar, one big pane, full width ticker. No small frame.',
    layout: 'sidebar',
  },
];

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

// The corner art a rule for a seasonal pack can ask for: the four ornaments in
// dashboard/core/corner-art.js, in the same order, and None for a rule that wants
// no corner art whatever the pack's own is. check-schemas.mjs fails when the ids differ.
export const cornerArts = [
  { id: 'leaves', name: 'Leaves' },
  { id: 'snowflakes', name: 'Snowflakes' },
  { id: 'gears', name: 'Gears' },
  { id: 'fireworks', name: 'Fireworks' },
  { id: 'none', name: 'None' },
];
