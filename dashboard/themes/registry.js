// Every theme the screen can show. Adding a theme is one CSS file in this
// folder, named after the id, and one line here (docs/adding-a-theme.md).
//
// The Studio keeps its own copy of this list in studio/themes.js, because the
// Studio cannot read files from the dashboard folder. check-schemas.mjs fails
// when the two lists differ, so change both.
//
// defaultThemeSettings.defaultTheme in config.js must be one of these ids. It
// is the theme the screen uses when the Theme document says nothing else.
//
// layout is optional: 'standard' (the banner across the top, two frames and the
// ticker) when it is left out, or 'sidebar' (a column on the left, one big frame
// and the ticker, no small frame). A layout is placed before anything is drawn,
// and changing to a theme with another layout reloads the page once
// (core/layout.js, docs/layouts.md).

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
