// The backgrounds of the Original theme, as the Studio lists them (backgrounds in dashboard/config.js). The
// words are stored in Dashboard Settings, so never rename one. tests/schemas.test.mjs and
// tests/themes-part5.test.mjs fail when the list differs from the dashboard's.

export const backgroundChoices = [
  { id: 'sweep', title: 'Sweep', description: 'The light band that crosses each frame, as the screen has always been.' },
  { id: 'blueprint', title: 'Blueprint', description: 'Two grids drift across the screen at different speeds.' },
  { id: 'rays', title: 'Rays', description: 'Three faint bands of light drift slowly across the screen.' },
  { id: 'spotlight', title: 'Spotlight', description: 'One pool of the team color wanders behind the panels.' },
  { id: 'embers', title: 'Embers', description: 'A dozen gold sparks rise from the bottom of the screen.' },
];

export const backgroundIds = backgroundChoices.map(choice => choice.id);

// The weekdays of the schedule, and the Original theme on any of them. The field is hidden when no day plays Original.
export function playsOriginal(document) {
  const days = document && document.themeByWeekday && typeof document.themeByWeekday === 'object' ? document.themeByWeekday : null;
  if (!days) return true;
  const names = Object.keys(days).filter(name => name.charAt(0) !== '_');
  if (names.length === 0) return true;
  return names.some(name => days[name] === 'original' || days[name] === undefined || days[name] === null);
}
