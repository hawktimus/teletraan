// The themes the weekday schedule can pick, and the days of the week. A theme is frames,
// textures, type treatment and transitions. The ids are the folders of dashboard/styles/ and are stored
// in themeByWeekday of Dashboard Settings, so never rename one. tests/schemas.test.mjs fails when a
// list differs from the dashboard's.

export const themeChoices = [
  { id: 'original', title: 'Original', description: 'The screen as it has always looked.' },
  { id: 'cybertron', title: 'Cybertron', description: 'The same arrangement in gunmetal plates.' },
  { id: 'retro', title: 'Retro', description: 'Rounded cel frames with an ink line, on a deep blue sky.' },
  { id: 'foundry', title: 'Foundry', description: 'Blued steel, bolts, hazard strips and gears, on a dark shop floor.' },
];

export const themeIds = themeChoices.map(theme => theme.id);

// The days of the week, Monday first, with the theme each plays to start with. Retro and Foundry are not in the starting schedule.
export const themeWeekdays = [
  { name: 'monday', title: 'Monday', start: 'original' },
  { name: 'tuesday', title: 'Tuesday', start: 'cybertron' },
  { name: 'wednesday', title: 'Wednesday', start: 'original' },
  { name: 'thursday', title: 'Thursday', start: 'cybertron' },
  { name: 'friday', title: 'Friday', start: 'original' },
  { name: 'saturday', title: 'Saturday', start: 'cybertron' },
  { name: 'sunday', title: 'Sunday', start: 'original' },
];

// The theme of each day when Dashboard Settings does not say
export const startingThemeByWeekday = themeWeekdays.reduce((all, day) => Object.assign(all, { [day.name]: day.start }), {});

// The theme schedule always complete: a theme for each day. A day that is missing, or names a theme
// that does not exist, has its starting theme.
export function tidyThemeByWeekday(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const schedule = {};
  themeWeekdays.forEach(day => {
    schedule[day.name] = themeIds.indexOf(source[day.name]) !== -1 ? source[day.name] : day.start;
  });
  return schedule;
}
