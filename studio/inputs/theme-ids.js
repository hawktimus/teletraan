// The themes the weekday schedule can pick, and the days of the week. A theme is a style: frames,
// textures, type treatment and transitions. The ids are the folders of dashboard/styles/ and are stored
// in themeByWeekday of Dashboard Settings, so never rename one. tests/schemas.test.mjs fails when a
// list differs from the dashboard's.
//
// placeholder is true for a theme that is a copy of another until it is designed. Remove it from the
// line, and the dashboard/styles/<id>/PLACEHOLDER marker, together.

export const themeChoices = [
  { id: 'original', title: 'Original', description: 'The screen as it has always looked.' },
  { id: 'cybertron', title: 'Cybertron', description: 'The same arrangement in gunmetal plates.' },
  { id: 'retro', title: 'Retro', description: 'Retro is not designed yet; it looks like Original.', placeholder: true },
];

export const themeIds = themeChoices.map(theme => theme.id);

// The days of the week, Monday first, with the theme each plays to start with. Retro is not scheduled.
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

export function themeTitleOf(id) {
  const found = themeChoices.filter(theme => theme.id === id)[0];
  return found ? found.title : '';
}
