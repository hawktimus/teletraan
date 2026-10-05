// Every theme the screen can show. Adding a theme is one CSS file in this
// folder, named after the id, and one line here (docs/adding-a-theme.md).
//
// The Studio keeps its own copy of this list in studio/themes.js, because the
// Studio cannot read files from the dashboard folder. check-schemas.mjs fails
// when the two lists differ, so change both.
//
// defaultThemeSettings.defaultTheme in config.js must be one of these ids. It
// is the theme the screen uses when the Theme document says nothing else.

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
