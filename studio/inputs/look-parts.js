// The parts of the Look page that need no Studio (look-view.js draws them): the sections in order, their one plain
// sentence about the TV, and the fields each section shows. The names are the stored names of Dashboard Settings and of
// the Look document; the page renames nothing. tests/studio-look.test.mjs reads this with node.

export const settingsId = 'dashboardSettings';
export const lookId = 'theme';

export const words = {
  intro: 'How the screen looks: the theme of each day, the background, the holiday decorations, the motion and the logo. Change it here, then click Publish all in the top bar.',
  schedule: 'There is one schedule. The day of the week picks the theme. Dated rules, under Seasonal decorations, add holiday colors and pictures on certain dates.',
  noSettings: 'Dashboard Settings has not been published yet. Open it, click Publish once, and come back.',
  reading: 'Reading the settings.',
  noLook: 'The Look document has not been published yet, so the dated rules and the decoration switch cannot be shown. Open the dated rules, click Publish once, and come back.',
  rules: 'Dated rules, default theme and time zone',
  rulesSays: 'Rules that switch a theme or a holiday pack on between two dates, the default theme, and the time zone the dates are read in.',
  subthemes: 'Subthemes',
  subthemesSays: 'Small pictures drawn on the frames between two dates.',
};

// Each section: its title, one plain sentence on what it does on the TV, and the fields it shows
export const sections = [
  {
    id: 'theme',
    title: 'Theme by day of the week',
    says: 'A theme is a style: frames, textures, type and transitions, and every view looks the same in every theme.',
  },
  {
    id: 'background',
    title: 'Background',
    says: 'The picture drawn behind the panels when the day plays the Original theme.',
  },
  {
    id: 'seasonal',
    title: 'Seasonal decorations (subthemes and packs)',
    says: 'Holiday colors, corner art and small pieces that drift over the panels between two dates.',
    lookFields: ['seasonOverPanels'],
  },
  {
    id: 'motion',
    title: 'Motion (full, light or calm)',
    says: 'How much the screen moves: light plays one simple change at each panel change, calm only fades panels, and speed sets how long things take.',
    fields: ['motion', 'speed'],
  },
  {
    id: 'polish',
    title: 'Frame polish',
    says: 'The metal and the finish of the frame edges around every panel.',
    fields: ['look', 'frameMetal', 'glint', 'frameFinish'],
  },
  {
    id: 'logo',
    title: 'Logo and name effects',
    says: 'What the logo and the team name do in the banner now and then.',
    fields: ['logoAnimations', 'logoEntrance', 'logoSpin', 'logoSpinEvery', 'logoSpinDuration', 'logoHawk', 'logoHawkDuration', 'nameTransform', 'nameDuration'],
  },
  {
    id: 'advanced',
    title: 'Advanced',
    says: 'Rarely changed: how a page changes, how long a change takes, and the old television glitch.',
    fields: ['pageChangeStyle', 'breakSeconds', 'silverChance', 'transitionSeconds', 'crt.on', 'crt.everySeconds', 'crt.durationSeconds'],
  },
];

// Every field of Dashboard Settings that the page shows. Dashboard Settings hides each of them (dashboardSettings.js).
export const settingsNames = sections
  .reduce((all, section) => all.concat(section.fields || []), [])
  .concat(['themeByWeekday', 'background'])
  .map(name => name.split('.')[0])
  .filter((name, index, all) => all.indexOf(name) === index);

export const links = [
  { id: 'rules', label: words.rules, says: words.rulesSays },
  { id: 'subthemes', label: words.subthemes, says: words.subthemesSays },
];
