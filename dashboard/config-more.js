// The demo, the hidden transitions, people, talks, filters and the built-in team (part of config.js).

// The Demo page in the Studio (core/demo.js, core/demo-screens.js and core/demo-runner.js).
// "Run demo" writes the time into requestedAt and publishes. The screen plays the steps once when
// it sees a request that is no more than demoWindowSeconds old and is not the one it handled last,
// so a computer that restarts never plays an old request again. A request up to demoSkewSeconds in
// the future still counts, because the Studio's clock may be a little ahead of the Teletraan computer's.
//   steps            the screens to show, one after the other. screen is an id from
//                    demoScreens in core/demo-screens.js. seconds is how long it stays, in
//                    the range limits.demoSeconds. At most demoMaxSteps steps.
//   announcementText the words of the announcement step. Empty means the first announcement in
//                    Dashboard Settings, or demoPlaceholderText when there is none.
export const demoWindowSeconds = 60;
export const demoSkewSeconds = 5;
export const demoMaxSteps = 10;
export const demoDefaultSeconds = 30;
export const demoPlaceholderText = '[DEMO ANNOUNCEMENT]';

// A hidden transition pushed from the Studio waits for the next page change of the large panel. When
// that is more than this many seconds away the screen asks for the page change at once instead.
// A push is only played while it is less than demoWindowSeconds old and is not the one handled
// before, the same guard as the demo (shouldRunDemo in core/demo.js).
export const hiddenAdvanceSeconds = 20;

// After a hidden transition has played, none comes about by chance for this many hours. A push from the Studio
// and the ?hidden= switch ignore it. core/hidden.js keeps the time of the last one.
export const hiddenGapHours = 4;

// How long a preview from the Studio holds a team, a style or a seasonal pack on the screen, in seconds. After that the
// screen goes back to the saved settings.
export const previewSeconds = 120;

export const defaultDemo = {
  requestedAt: '',
  steps: [
    { screen: 'announcement', seconds: demoDefaultSeconds },
    { screen: 'night-mode', seconds: demoDefaultSeconds },
  ],
  announcementText: '',
};

// Used for a person, or a team lead, whose "Show photo on screen" switch is
// missing from the saved content, such as one added before the switch existed.
// The Studio fields start at the same value.
export const defaultPerson = {
  showPhoto: true,
};

// Used for a booked talk that has no length or no status in the saved content. The
// Studio fields start at the same values (studio/schemas/presentation.js), and so
// does the list of statuses. Only a scheduled talk runs on the screen.
export const talkStatuses = ['scheduled', 'cancelled', 'done', 'skipped'];
export const defaultTalk = {
  minutes: 15,
  status: 'scheduled',
};

// A calendar filter rule that has no action, or one that is not in the list,
// hides: the Studio field starts on Hide too (studio/schemas/calendarFilter.js).
export const filterActions = ['hide', 'show'];
export const defaultFilter = {
  action: 'hide',
};

// The kind of a calendar in Dashboard Settings (Calendars tab): what sort of events it holds. The Events
// panel writes it as a small chip before each title (core/event-pages.js). A calendar has no kind until a
// coach picks one, and its events have no chip. A calendar with no kind, one whose kind is not in this list
// and one that was saved as other all count as having no kind: other was the starting value once, so a
// calendar that still says it was never picked. noCalendarKind is the name the code gives to that, and
// when the events are grouped by kind they go with the Meetings and the Deadlines. The Studio copies this list.
export const calendarKinds = ['meetings', 'competitions', 'outreach', 'deadlines', 'other'];
export const noCalendarKind = 'other';

// The trim of a team (Studio: Teams, Trim): eight choices that make a team look like itself beyond its colors and
// the mirror. Each name is a field of the team document. Under it is each value the field can have, and the class
// that core/teams.js puts on the html element while a team that has the value is on the screen, which trim.css
// and the style sheets read. The first value of each is the one Prime has, and the one a team document with no
// value, or one that is not in the list, falls back to, so a team that was made before the trim existed looks
// as it did. It has no class (''), because the screen is drawn for it without one. The Studio copies the values
// (studio/schemas/team.js).
//   bolts        the joint bolts are hex nuts, or round rivets with a slot
//   cornerCut    the corners every panel chamfers: top left and bottom right, or top right and bottom left
//   headerNotch  the header tab ends in the usual notch, or in one slant at 60 degrees
//   grid         the grid on the page behind Cybertron and Minimal is lines or dots
//   logoPose     not used any more: the icon is always the usual mark. A team that still stores flight reads as auto,
//                and flight has no class
//   nameStyle    the team name in the banner is solid letters, or outlined letters over a solid accent line
//   tickerLabel  the label of the ticker is the cut plate, or a thin bar with an accent block before it
//   countAccent  the red parts of the countdown are red, or the team's neon
export const teamTrim = {
  bolts: { hex: '', round: 'bolts-round' },
  cornerCut: { 'tl-br': '', 'tr-bl': 'corner-cut-tr' },
  headerNotch: { step: '', slant: 'header-slant' },
  grid: { lines: '', dots: 'grid-dots' },
  logoPose: { auto: '', flight: '' },
  nameStyle: { solid: '', outline: 'name-outline' },
  tickerLabel: { plate: '', bar: 'ticker-bar' },
  countAccent: { red: '', neon: 'accent-neon' },
};

// The metal of a team's frames (Studio: Teams, Colors, Metal) and the class that core/teams.js puts on the html
// element while a team with that metal is on the screen, which tokens.css reads. Gold is the metal Prime has and
// the one a team document with no metal falls back to, so it has no class. The Studio copies the two names.
export const teamMetals = { gold: '', steel: 'metal-steel', purple: 'metal-purple' };

// The palette of a team (Studio: Teams, hidden) and the class core/teams.js puts on the html element. Standard has no class.
// Inverted is the Nova palette: gold as the main color and purple as the accent, and the chips are purple with white text
// (teams.css, tokens.css). The blue and steel palette stays in the code behind the old values and is not seeded.
export const teamPalettes = { standard: '', inverted: 'palette-inverted' };

// The class for a team with Glow on (Studio: Teams, Colors, Glow): the neon lines of its frames and header lines get two
// wider and fainter lines of the same color outside them (base.css). They are strokes, never a filter.
export const glowClass = 'neon-glow';

export const defaultTeam = {
  name: 'HAWKTIMUS PRIME',
  number: '3229',
  school: 'HOLLY SPRINGS HIGH SCHOOL',
};

// The header text color of a team with the inverted palette (Nova) that has none typed in the Studio yet
export const invertedHeaderInk = '#1A1200';

// The colors a team with the inverted palette falls back to for a color its document does not hold, so a Team that was only
// partly updated is gold and purple all through and not gold with Prime's purple plates and body. They are the Nova values of
// studio/tools/team-standard.js.
export const invertedColors = {
  primary: '#D4A017',
  plate: '#6B4C08',
  accent: '#C86BFF',
  neon: '#B23CFF',
  pink: '#D4A017',
  background: '#17110A',
  text: '#FFFFFF',
  body: '#241A04',
  label: '#D9A6FF',
  headerInk: invertedHeaderInk,
  dark: '#3D2A05',
  retro: '#E0A400',
};

// The team the screen shows when the Studio has no Teams, and the colors that a team
// document with a missing or mistyped color falls back to (core/sanity.js). It is Prime
// with the colors the screen has always had in Original: teams.css starts at the same nine.
// The name and number are the ones in defaultTeam, and the Team box in Dashboard Settings
// changes them. The logo is empty, which means the shared hawk.
//   neon, pink   the lines and the conduit of Cybertron and Minimal. Original draws neither
//   background   the same as the theme Hawktimus has for the page (themes/hawktimus.css), because Original
//                takes it from the team, and Prime in Original has to look as it always has
//   body         the inside of the panels in Cybertron and Minimal
//   label        the department names in the rows of the Monday cards and the people panels
//   headerInk    the text that sits on the main color: panel titles, the team plate, the ticker label
//   dark, retro  the darkest shade of the main color, and the main color of the Retro theme
//   metal        see teamMetals above
//   glow         see glowClass above
export const primeTeam = {
  code: 'prime',
  name: defaultTeam.name,
  shortName: 'PRIME',
  number: defaultTeam.number,
  logo: '',
  colors: {
    primary: '#6C18B6',
    plate: '#3B2A7A',
    accent: '#FACA2A',
    neon: '#FACA2A',
    pink: '#B23CFF',
    background: '#0B0714',
    text: '#FFFFFF',
    body: '#1A0F2E',
    label: '#FACA2A',
    headerInk: '#FFFFFF',
    dark: '#29054A',
    retro: '#FACA2A',
  },
  metal: 'gold',
  palette: 'standard',
  glow: false,
  mirror: false,
  bolts: 'hex',
  cornerCut: 'tl-br',
  headerNotch: 'step',
  grid: 'lines',
  logoPose: 'auto',
  nameStyle: 'solid',
  tickerLabel: 'plate',
  countAccent: 'red',
  active: true,
  order: 10,
  builtIn: true,
};
