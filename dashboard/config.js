// Settings that rarely change and are not secret. Secret things, like the
// calendar feed addresses, never go in this file.

// Where the weather is taken from
export const location = {
  name: 'Holly Springs, NC',
  latitude: 35.6513,
  longitude: -78.8336,
};

// The content editor (Sanity). The project ID is public, since it is part of
// every address the screen asks for, so it is fine to keep it in the repository.
export const sanity = {
  projectId: 'ybfqe345',
  dataset: 'production',
  apiVersion: '2025-02-19',
};

// Which content the screen shows, sample or production, is chosen by Content
// source in Dashboard Settings (the Studio has two buttons for it). This flag
// is only the fallback: it is used when Dashboard Settings cannot be read,
// for example the very first start with no internet, and no copy of them was
// saved on this computer. true shows the sample content in data/sample, false
// shows what the editors published. If the project ID above is empty there is
// nothing to read, so the screen always shows the sample.
export const useSampleContent = false;

// Calendar files and sample content live in one of these folders. The sample
// folder is kept in git. The live folder is filled in
// by the Mini and is never committed.
export const sampleFolder = 'data/sample/';
export const liveFolder = 'data/live/';

// The countdown looks more serious as the date gets closer
export const threat = {
  tenseDays: 30,
  criticalDays: 7,
};

// The Content source setting in Dashboard Settings
export const contentSources = ['production', 'sample'];

// The Speed setting in Dashboard Settings. Each name is how much longer
// (more than 1) or shorter (less than 1) everything takes: how long a move
// lasts, and how long a panel stays on screen.
export const speeds = { 'very-slow': 2, 'slow': 1.5, 'normal': 1, 'fast': 0.75 };

// The Frame metal setting in Dashboard Settings: the metal on the permanent
// edges (the banner, the countdown, the logo). Each page frame has a finish of
// its own that is chosen at every page change, see frameFinishes below.
export const metals = ['gold', 'silver'];

// The Look setting in Dashboard Settings: how much polish the frames have.
// core/look.js turns it into the page switches the stylesheets read
// (data-finish, data-glint and data-look). The Studio copies this list.
//   polished  the normal look: worn metal edges, screws with shading, the glint
//             that runs round the frames, and the // in the panel headers
//   flat      plain colour edges and plain screws, and no glint. The // stays
//   plain     flat, and no screws on the frames and no // in the panel headers
export const looks = ['polished', 'flat', 'plain'];

// The Transitions tab in Dashboard Settings (core/transitions.js chooses from them)
//   pageChangeStyles  alternate: the slat change and the mechanical change take turns.
//                     slat: the old change only. mechanical: the new one only.
//   frameFinishes     mostly-gold: gold, and silver now and then (silverChance percent of
//                     the changes, picked at random). alternate: gold, silver, gold ...
//                     gold, silver: that one every time.
export const pageChangeStyles = ['alternate', 'slat', 'mechanical'];
export const frameFinishes = ['mostly-gold', 'alternate', 'gold', 'silver'];

// The Photos tab in Dashboard Settings (core/photos.js chooses from them)
//   random        any visible photo, never the same one twice in a row
//   newest-first  from the newest photo to the oldest, then over again
export const photoOrders = ['random', 'newest-first'];

// The Night mode tab in Dashboard Settings (core/night.js and core/night-screen.js)
//   nightStyles  bounce: the logo drifts round the black screen. black: only black.
//   nightSpeeds  the seconds the logo takes to cross the screen sideways (across) and
//                top to bottom (down), one crossing each way. Both are whole seconds and
//                have no common factor (they are different prime numbers), so the two
//                movements only meet at a corner once in across x down seconds. The
//                arithmetic is in docs/night-mode.md. A corner hit comes about every
//                713 seconds (slow), 391 (normal) or 221 (fast). Change one of these
//                numbers and the docs and tools/test-night.mjs need the new figures.
//   nightFirstHit  the first corner hit comes this many seconds after night mode starts,
//                a whole number picked at random from the range
export const nightStyles = ['bounce', 'black'];
export const nightSpeeds = {
  slow: { across: 31, down: 23 },
  normal: { across: 23, down: 17 },
  fast: { across: 17, down: 13 },
};
export const nightFirstHit = { min: 120, max: 300 };

// The smallest and largest values the Studio accepts. A number outside them
// is brought back to the nearest end, so one slip cannot break the screen.
//
// For the seconds between plays, 0 means never. Any other number must be at
// least `shortest`, so a smaller one is brought up to it.
export const limits = {
  pageSeconds: { min: 8, max: 120 },
  nameEvery: { min: 0, shortest: 30, max: 900 },
  nameDuration: { min: 0.5, max: 10 },
  crtEvery: { min: 0, shortest: 30, max: 3600 },
  crtDuration: { min: 0.5, max: 10 },
  // The Logo tab. The hawk lasts from 6 seconds (quick but clear) to 30.
  logoSpinEvery: { min: 0, shortest: 10, max: 3600 },
  logoSpinDuration: { min: 0.5, max: 10 },
  logoHawkEvery: { min: 0, shortest: 10, max: 3600 },
  logoHawkDuration: { min: 6, max: 30 },
  // The Transitions tab. The frame breaks apart in this many seconds and
  // rebuilds in the same again: below 0.3 the pieces cannot be followed, above 2
  // the screen spends more time apart than together.
  breakSeconds: { min: 0.3, max: 2 },
  silverChance: { min: 0, max: 100 },
  // The Photos tab. Below 6 seconds a photo is gone before it can be looked at.
  photoSeconds: { min: 6, max: 120 },
  // The two size settings in the Photos tab, in percent. 100 is the full size, the largest that
  // fits the frames. At 60 a picture is still easy to see from across the room.
  portraitScale: { min: 60, max: 100 },
  photoScale: { min: 60, max: 100 },
  // The Night mode tab. At 120 pixels the logo is still clear from across the room, and at 800 it
  // still fits the 1080 pixel height with the number under it.
  nightLogoWidth: { min: 120, max: 800 },
  // The Demo page. A step shorter than 5 seconds is gone before it can be seen, and 5 minutes
  // is longer than anyone shows a demo.
  demoSeconds: { min: 5, max: 300 },
  // The Hidden tab. A chance is a percent of the page changes, and 0 is never.
  desktopChance: { min: 0, max: 100 },
  redEyesChance: { min: 0, max: 100 },
  // The Presentations tab, in minutes. Waiting over 15 minutes for a speaker holds up the next talk, and 10 minutes
  // over is the most a talk may run past its slot. A grace of 0 ends it when the slot ends.
  noShowMinutes: { min: 1, max: 15 },
  graceMinutes: { min: 0, max: 10 },
  // The length of one booked talk, in minutes (the Presentations list in the Studio)
  talkMinutes: { min: 5, max: 30 },
};

// Used for anything the editors have not filled in yet
export const defaultSettings = {
  // production shows the editors' content. sample shows the content in
  // data/sample until switchBackAt, a time like 2027-01-09T12:00 (or empty).
  contentSource: 'production',
  switchBackAt: '',
  motion: 'full',
  speed: 'normal',
  frameMetal: 'gold',
  glint: true,
  // see looks above. Flat and Plain also switch the glint off, whatever glint says
  look: 'polished',
  // Puts the connection status text on the screen all the time, with the last
  // read from Sanity, how much of each kind of content there is, and when the
  // calendars were read. It comes up by itself, whatever this says, when Sanity
  // has been out of reach for over two minutes (core/connection.js).
  showConnectionStatus: false,
  // How long a large panel stays. A small panel stays max(6, round(pageSeconds
  // x 0.75)) and a ticker line max(8, round(pageSeconds x 1.5)). A row with
  // seconds of its own, or a ticker with its own, uses those instead. The
  // rows below have none, so they follow this.
  pageSeconds: 20,
  // The Logo tab in the Studio. logoAnimations is the master switch: off, and
  // nothing in the logo moves (the entrance, the spin, the flying hawk and the
  // name effect), whatever the switches below say. Every animation that plays
  // now and then has a switch, the seconds between plays (0 is never) and the
  // seconds one play lasts at normal speed. The starting values are what the
  // logo did before it had settings:
  //   logoEntrance  the plates fly in once, when the screen starts. No timing.
  //   logoSpin      the flat full turn. It played every third pass of the old
  //                 24 second show, so every 72 seconds, and took 1.6 s.
  //   logoHawk      the robot pose, the change into the hawk, the flight and
  //                 the change back. It played every pass, so every 24 seconds,
  //                 and took 3 + 2 + 4 + 2 = 11 s (hawkActs in frame.js).
  //   name          the team name effect. The stored names are nameTransform,
  //                 nameEvery and nameDuration. nameDuration is the length of
  //                 the effect on HAWKTIMUS PRIME today: .8 s for a letter plus
  //                 45 ms for each of the 14 letters after the first.
  logoAnimations: true,
  logoEntrance: true,
  logoSpin: true,
  logoSpinEvery: 72,
  logoSpinDuration: 1.6,
  logoHawk: true,
  logoHawkEvery: 24,
  logoHawkDuration: 11,
  nameTransform: true,
  nameEvery: 300,
  nameDuration: 1.43,
  // The Transitions tab in the Studio: how a page change looks.
  //   pageChangeStyle  see pageChangeStyles above. The first change is the mechanical one.
  //   breakSeconds     how long the frame takes to break apart in the mechanical change, and the
  //                    same again to rebuild, at normal speed
  //   frameFinish      the metal of the page frames, see frameFinishes above. frameMetal is
  //                    the metal of everything that stays on the screen, and not this.
  //   silverChance     with mostly-gold, the percent of page changes that bring silver
  pageChangeStyle: 'alternate',
  breakSeconds: 0.6,
  frameFinish: 'mostly-gold',
  silverChance: 10,
  // The Photos tab in the Studio. The photos themselves are Photo documents
  // (core/photos.js shows the visible ones).
  //   photoOrder    see photoOrders above
  //   photoSeconds  how long the Photo panel stays, when its row in the Panels
  //                 list has no seconds of its own. It is used instead of pageSeconds.
  //   portraitScale how big the portraits are, as a percent of the full size: the Leadership and
  //                 Team Leads portraits and the team lead portrait of the Roster. 100 is the
  //                 full size (core/portrait.js). The names and roles keep their size.
  //   photoScale    how big the picture in the Photo panel is, as a percent of the full size
  //                 (core/photos.js). 100 fills the panel. The caption keeps its size.
  photoOrder: 'random',
  photoSeconds: 16,
  portraitScale: 100,
  photoScale: 100,
  // The Night mode tab in the Studio: the screensaver. The signal is never turned off. From
  // nightStart to nightEnd (24 hour time, in the time zone of the Theme page, and it may run past
  // midnight) the screen is black with the team logo and the team number under it.
  //   nightEnabled    on, because a wall display left on all night needs it
  //   nightStyle      see nightStyles above
  //   nightLogoWidth  how wide the logo is, in pixels. The number under it is a fixed size.
  //   nightSpeed      see nightSpeeds above
  //   nightPreview    shows night mode now, whatever the time and the switch above say
  nightEnabled: true,
  nightStyle: 'bounce',
  nightStart: '23:30',
  nightEnd: '11:30',
  nightLogoWidth: 300,
  nightSpeed: 'normal',
  nightPreview: false,
  // The Hidden tab in the Studio: two rare transitions that replace a normal page change of the large
  // panel (core/hidden.js, core/hidden-transitions.js and core/hidden-run.js, docs/hidden-transitions.md).
  //   hiddenEnabled  the master switch. Off, neither plays, not even when it is pushed from the Studio.
  //   desktopChance  the percent of page changes that play the desktop reveal. 0 is never.
  //   redEyesChance  the percent of page changes that play red eyes. 0 is never.
  //   hiddenRequest  the last "Play desktop reveal" or "Play red eyes" pushed from the Studio:
  //                  kind is an id from the registry in core/hidden-transitions.js, and requestedAt is
  //                  the time it was pushed. Both are empty until something has been pushed. The screen
  //                  plays a request once, only while it is less than demoWindowSeconds old (see below).
  hiddenEnabled: true,
  desktopChance: 1,
  redEyesChance: 1,
  hiddenRequest: { kind: '', requestedAt: '' },
  // The Presentations tab in the Studio: talks that the screen shows full screen from the clicker.
  //   presentationsEnabled  the switch. Off, the screen never starts a talk.
  //   noShowMinutes         how long the title card waits for the first key press before the talk is skipped
  //   graceMinutes          how long a talk may run past its slot before it is ended
  //   presentationTestRequest  the last click of the "Run presentation test" button (core/presentation-test.js). requestedAt
  //                            is the time it was clicked and is empty until it has been. The screen plays the sample talk
  //                            once, for a request that is less than demoWindowSeconds old and is not the one it handled before.
  presentationsEnabled: true,
  noShowMinutes: 5,
  graceMinutes: 5,
  presentationTestRequest: { requestedAt: '' },
  // The "Play announcements" button in the Studio (core/announce.js, core/announce-run.js, docs/hidden-transitions.md).
  //   announceRequest  the last click of the button. requestedAt is the time it was clicked and is empty until
  //                    it has been. The screen plays every announcement that is switched on, once, for a request
  //                    that is less than demoWindowSeconds old and is not the one it handled before (see below).
  announceRequest: { requestedAt: '' },
  countdown: {
    kickoffLabel: 'KICKOFF IN',
    kickoff: '2027-01-09T12:00',
    rolloutLabel: 'ROLLOUT IN',
    rollout: '',
  },
  alert: { on: false, headline: '', message: '', until: '' },
  rotation: {
    grid1: [
      { panel: 'tasks', show: true },
      { panel: 'events', show: true },
      { panel: 'tonight', show: true },
      { panel: 'spotlight', show: true },
      { panel: 'sponsor-feature', show: true },
      { panel: 'photo', show: true },
      { panel: 'leadership', show: true },
      { panel: 'team-leads', show: true },
      { panel: 'roster', show: true },
      { panel: 'custom', show: true },
    ],
    grid2: [
      { panel: 'task-counts', show: true },
      { panel: 'next-event', show: true },
      { panel: 'forecast', show: true },
      { panel: 'safety-days', show: true },
      { panel: 'sponsor-logo', show: true },
    ],
  },
  doneDays: 7,
  safetyDaysSince: '',
  // The screen glitch (the Screen tab in the Studio), the old television
  // effect. 2.7 s is how long frame.js keeps it going today.
  crt: { on: true, everySeconds: 240, durationSeconds: 2.7 },
  announcements: [
    {
      show: true,
      time: '14:30',
      title: 'WHAT TIME IS IT?',
      followUp: 'PRIMETIME',
      titleSeconds: 12,
      followUpSeconds: 10,
      days: [0, 1, 2, 3, 4, 5, 6],
    },
    {
      show: true,
      time: '17:00',
      title: 'WHAT TIME IS IT?',
      followUp: 'PRIMETIME',
      titleSeconds: 12,
      followUpSeconds: 10,
      days: [0, 1, 2, 3, 4, 5, 6],
    },
  ],
  calendars: [{ id: 'team', name: 'Team calendar', show: true }],
};

// Used for anything missing from the Theme document in the Studio. The
// Studio starts at the same values, and check-schemas.mjs fails if they differ.
//   defaultTheme  the id of a theme in themes/registry.js
//   useNow        a theme and an overlay to show now, whatever the schedule says. Each is empty
//                 (follow the schedule), an id, or for the overlay 'none'. until is a time, or empty.
//   schedule      rules: { name, kind: 'theme' | 'overlay', theme or overlay, startDate, endDate, repeatsEveryYear }
//   timeZone      the time zone the dates in the schedule are read in. Events Calendar entries
//                 (core/events.js) use it too, for their times and for when they are over
//   seasonOverPanels  true lets a seasonal pack draw small pieces (snow, leaves...) drifting over the
//                 panels (core/season.js). false keeps only its header marks and edge decorations
export const defaultThemeSettings = {
  defaultTheme: 'hawktimus',
  useNow: { theme: '', overlay: '', until: '' },
  schedule: [],
  timeZone: 'America/New_York',
  seasonOverPanels: true,
};

// The Demo page in the Studio (core/demo.js, core/demo-screens.js and core/demo-runner.js).
// "Run demo" writes the time into requestedAt and publishes. The screen plays the steps once when
// it sees a request that is no more than demoWindowSeconds old and is not the one it handled last,
// so a Mini that restarts never plays an old request again. A request up to demoSkewSeconds in
// the future still counts, because the Studio's clock may be a little ahead of the Mini's.
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
export const defaultDemo = {
  requestedAt: '',
  steps: [
    { screen: 'announcement', seconds: demoDefaultSeconds },
    { screen: 'night-mode', seconds: demoDefaultSeconds },
  ],
  announcementText: '',
};

// Used for a person whose "Show photo on screen" switch is missing from the
// saved content, such as a person added before the switch existed. The
// Studio field starts at the same value.
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

export const defaultTeam = {
  name: 'HAWKTIMUS PRIME',
  number: '3229',
  school: 'HOLLY SPRINGS HIGH SCHOOL',
};
