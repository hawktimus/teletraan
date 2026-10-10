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

// The Speed setting in Dashboard Settings. Each name is how much longer
// (more than 1) or shorter (less than 1) everything takes: how long a move
// lasts, and how long a panel stays on screen.
export const speeds = { 'very-slow': 2, 'slow': 1.5, 'normal': 1, 'fast': 0.75 };

// The Frame metal setting in Dashboard Settings: the metal on the permanent
// edges (the banner, the countdown, the logo). Each page frame has a finish of
// its own that is chosen at every page change, see frameFinishes below.
export const metals = ['gold', 'silver'];

// The Polish setting in Dashboard Settings: how much polish the frames have.
// core/look.js turns it into the page switches the stylesheets read
// (data-finish, data-glint and data-look). The Studio copies this list.
//   polished  the normal look: worn metal edges, screws with shading, the glint
//             that runs round the frames, and the // in the panel headers
//   flat      plain colour edges and plain screws, and no glint. The // stays
//   plain     flat, and no screws on the frames and no // in the panel headers
export const looks = ['polished', 'flat', 'plain'];

// The Style setting in Dashboard Settings: which look the whole screen has.
// core/style.js turns it into data-style on the page and into a layout. The Studio copies this list.
//   original   the screen as it has always been. It keeps the layout its theme names
//   cybertron  the sharp style: the layout of Original, drawn in gunmetal plates with a steel edge and neon
//   minimal    the industrial style, in the bar layout whatever the theme says
export const styles = ['original', 'cybertron', 'minimal'];

// The team settings in Dashboard Settings (Look tab): which team the screen shows. The Studio copies this list.
//   prime      the Prime team all the time
//   nova       the Nova team all the time
//   alternate  the two teams take turns, alternateMinutes each
export const teamModes = ['prime', 'nova', 'alternate'];

// The look rotation in Dashboard Settings (Look tab) (core/look-rotation.js): how the screen changes from
// one look to the next. The Studio copies this list.
//   assemble  everything leaves and comes in again, the way the screen starts
//   slats     the page change of the large panel with the slats turning, and the frames stay
//   cut       at once, at the next page change of the large panel
export const lookSwaps = ['assemble', 'slats', 'cut'];

// The competition cards setting in Dashboard Settings (Competition tab): when the cards of core/competition.js
// are in the rotation. The Studio copies this list.
//   auto    each card comes in its own window: the cards about an event from two days before its first day to its last,
//           with the next match first, the season timeline all season, the look back before the first event, and the
//           district points once the first event has started
//   always  every card that is switched on, whatever the date
//   off     no card
export const competitionModes = ['auto', 'always', 'off'];

// The switches of the cards, one for each card in core/competition.js, in the order of the Studio. All start on.
export const competitionSwitches = [
  'competitionTimeline',
  'competitionLastSeason',
  'competitionRank',
  'competitionNextMatch',
  'competitionResults',
  'competitionAlliance',
  'competitionDistrict',
];

// Auto brings the cards about an event this many days before its first day
export const competitionLeadDays = 2;

// The Preview competition button holds the cards on the screen for this many seconds, each card for an equal share
export const competitionPreviewSeconds = 120;

// The page change settings in Dashboard Settings (Look tab) (core/transitions.js chooses from them)
//   pageChangeStyles  alternate: the slat change and the mechanical change take turns.
//                     slat: the old change only. mechanical: the new one only.
//   frameFinishes     mostly-gold: gold, and silver now and then (silverChance percent of
//                     the changes, picked at random). alternate: gold, silver, gold ...
//                     gold, silver: that one every time.
export const pageChangeStyles = ['alternate', 'slat', 'mechanical'];
export const frameFinishes = ['mostly-gold', 'alternate', 'gold', 'silver'];

// The photo settings in Dashboard Settings (Screen tab) (core/photos.js chooses from them)
//   random        any visible photo, never the same one twice in a row
//   newest-first  from the newest photo to the oldest, then over again
export const photoOrders = ['random', 'newest-first'];

// The night mode settings in Dashboard Settings (Advanced tab) (core/night.js and core/night-screen.js)
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
  // The logo settings. The hawk lasts from 6 seconds (quick but clear) to 30.
  logoSpinEvery: { min: 0, shortest: 10, max: 3600 },
  logoSpinDuration: { min: 0.5, max: 10 },
  logoHawkEvery: { min: 0, shortest: 10, max: 3600 },
  logoHawkDuration: { min: 6, max: 30 },
  // The page change settings. The frame breaks apart in this many seconds and
  // rebuilds in the same again: below 0.3 the pieces cannot be followed, above 2
  // the screen spends more time apart than together.
  breakSeconds: { min: 0.3, max: 2 },
  silverChance: { min: 0, max: 100 },
  // The photo settings. Below 6 seconds a photo is gone before it can be looked at.
  photoSeconds: { min: 6, max: 120 },
  // The two size settings of the photo settings, in percent. 100 is the full size, the largest that
  // fits the frames. At 60 a picture is still easy to see from across the room.
  portraitScale: { min: 60, max: 100 },
  photoScale: { min: 60, max: 100 },
  // The night mode settings. At 120 pixels the logo is still clear from across the room, and at 800 it
  // still fits the 1080 pixel height with the number under it.
  nightLogoWidth: { min: 120, max: 800 },
  // The Demo page. A step shorter than 5 seconds is gone before it can be seen, and 5 minutes
  // is longer than anyone shows a demo.
  demoSeconds: { min: 5, max: 300 },
  // The hidden transition settings. A chance is a percent of the page changes, and 0 is never.
  // Hours are how often a transition comes about, in hours of screen time.
  desktopChance: { min: 0, max: 100 },
  redEyesChance: { min: 0, max: 100 },
  desktopEveryHours: { min: 1, max: 1000 },
  redEyesEveryHours: { min: 1, max: 1000 },
  // The length of one booked talk, in minutes (the Presentations list in the Studio)
  talkMinutes: { min: 5, max: 30 },
  // The team settings, in minutes: how long each team stays on the screen in Alternate mode
  alternateMinutes: { min: 1, max: 30 },
};

// Used for anything the editors have not filled in yet
export const defaultSettings = {
  motion: 'full',
  speed: 'normal',
  frameMetal: 'gold',
  glint: true,
  // see looks above. Flat and Plain also switch the glint off, whatever glint says
  look: 'polished',
  // see styles above. Original is the screen as it was before there was a Style
  style: 'original',
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
  // The logo settings in the Studio (Look tab). logoAnimations is the master switch: off, and
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
  // The page change settings in the Studio (Look tab): how a page change looks.
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
  // The photo settings in the Studio (Screen tab). The photos themselves are Photo documents
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
  // The night mode settings in the Studio (Advanced tab): the screensaver. The signal is never turned off. From
  // 23:30 to 11:30 (the fixed times in core/constants.js, in the time zone of the Look page) the screen is
  // black with the team logo and the team number under it.
  //   nightEnabled    on, because a wall display left on all night needs it
  //   nightStyle      see nightStyles above
  //   nightLogoWidth  how wide the logo is, in pixels. The number under it is a fixed size.
  //   nightSpeed      see nightSpeeds above
  //   nightPreview    shows night mode now, whatever the time and the switch above say
  nightEnabled: true,
  nightStyle: 'bounce',
  nightLogoWidth: 300,
  nightSpeed: 'normal',
  nightPreview: false,
  // The hidden transition settings in the Studio (Advanced tab): two rare transitions that replace a normal page change of the large
  // panel (core/hidden.js, core/hidden-transitions.js and core/hidden-run.js, docs/hidden-transitions.md).
  //   hiddenEnabled  the master switch. Off, neither plays, not even when it is pushed from the Studio.
  //   desktopEveryHours  about once every this many hours of screen time, the desktop reveal plays.
  //   redEyesEveryHours  the same for red eyes. The Studio starts both at 60. Here they start at 0, which means
  //                      not set: a settings page saved before the hours existed has none, and keeps rolling
  //                      by the two percents below (core/hidden.js).
  //   desktopChance  the percent of page changes that play the desktop reveal. 0 is never. The Studio hides it.
  //   redEyesChance  the percent of page changes that play red eyes. 0 is never. The Studio hides it.
  //   hiddenRequest  the last "Play desktop reveal" or "Play red eyes" pushed from the Studio:
  //                  kind is an id from the registry in core/hidden-transitions.js, and requestedAt is
  //                  the time it was pushed. Both are empty until something has been pushed. The screen
  //                  plays a request once, only while it is less than demoWindowSeconds old (see below).
  hiddenEnabled: true,
  desktopEveryHours: 0,
  redEyesEveryHours: 0,
  desktopChance: 1,
  redEyesChance: 1,
  hiddenRequest: { kind: '', requestedAt: '' },
  // The Presentations tab in the Studio: talks that the screen shows full screen from the clicker.
  //   presentationsEnabled  the switch. Off, the screen never starts a talk. How long the title card waits for the
  //                         speaker and how long a talk may run past its slot are fixed (core/constants.js).
  //   presentationTestRequest  the last click of the "Run presentation test" button (core/presentation-test.js). requestedAt
  //                            is the time it was clicked and is empty until it has been. The screen plays the sample talk
  //                            once, for a request that is less than demoWindowSeconds old and is not the one it handled before.
  presentationsEnabled: true,
  presentationTestRequest: { requestedAt: '' },
  // The team settings in the Studio (Look tab): which team the screen shows.
  //   teamMode          see teamModes above. Prime only to start with, so a screen with no team
  //                     documents looks as it always has.
  //   alternateMinutes  with alternate, how long each team stays before the screen swaps to the other
  teamMode: 'prime',
  alternateMinutes: 5,
  // The look rotation in the Studio (Look tab) (core/look-rotation.js, docs/layouts.md, "The look rotation").
  //   dailyStyles  the styles the screen goes through, one for each calendar day, in this order and then over
  //                again (see styles above). Empty means the hidden style above decides
  //   mondayStyle  the style while the Monday cards of a team are on the screen (see styles above)
  //   teamOrder    the codes of the teams, in the order of their passes. Only teams that are switched on count.
  //                Empty means the hidden teamMode above decides
  //   lookSwap     see lookSwaps above
  dailyStyles: ['original', 'cybertron'],
  mondayStyle: 'minimal',
  teamOrder: ['prime', 'nova'],
  lookSwap: 'assemble',
  // The "Play announcements" button in the Studio (core/announce.js, core/announce-run.js, docs/hidden-transitions.md).
  //   announceRequest  the last click of the button. requestedAt is the time it was clicked and is empty until
  //                    it has been. The screen plays every announcement that is switched on, once, for a request
  //                    that is less than demoWindowSeconds old and is not the one it handled before (see below).
  announceRequest: { requestedAt: '' },
  // The "Preview Prime", "Preview Nova", "Preview Cybertron", "Preview Minimal" and "Preview next pack" buttons in the
  // Studio (core/preview.js, core/preview-run.js, docs/hidden-transitions.md).
  //   previewRequest  the last click of one of them. kind is an id from previewKinds in core/preview.js and requestedAt is the
  //                   time it was clicked. Both are empty until a button has been clicked. The screen holds that look for
  //                   previewSeconds, once, for a request that is less than demoWindowSeconds old and is not the one it
  //                   handled before (see below). Nothing is written to the settings.
  previewRequest: { kind: '', requestedAt: '' },
  // The "Next look now" and "Preview competition" buttons on the Start here page in the Studio.
  //   nextLookRequest            the last click of Next look now. requestedAt is the time it was clicked and is empty until it has been.
  //   competitionPreviewRequest  the last click of Preview competition, the same shape.
  nextLookRequest: { requestedAt: '' },
  competitionPreviewRequest: { requestedAt: '' },
  countdown: {
    kickoffLabel: 'KICKOFF IN',
    kickoff: '2027-01-09T12:00',
    rolloutLabel: 'ROLLOUT IN',
    rollout: '',
  },
  alert: { on: false, headline: '', message: '', until: '' },
  // The panels that come and go. Dashboard Settings keeps their order as one list, rotation.order, which
  // starts empty. When it is empty the screen builds it from these two lists, the large panels and the
  // small panels (core/panel-order.js). A row with no seconds follows pageSeconds.
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
  // The calendars (Calendars tab): a code, a name, the show switch and the kind (see calendarKinds below).
  // groupEventsByKind off keeps both pages of the Events panel in date order. On, page one has the next
  // four Meetings, Deadlines and Other events, and page two the next four Competitions and Outreach events.
  calendars: [{ id: 'team', name: 'Team calendar', show: true, kind: 'other' }],
  groupEventsByKind: false,
  // The competition cards (the Competition tab in the Studio, core/competition.js, docs/frc-feed.md).
  //   competitionMode  see competitionModes above
  //   the switches     one for each card, see competitionSwitches above
  competitionMode: 'auto',
  competitionTimeline: true,
  competitionLastSeason: true,
  competitionRank: true,
  competitionNextMatch: true,
  competitionResults: true,
  competitionAlliance: true,
  competitionDistrict: true,
  // The Monday tab in the Studio (docs/monday.md). The Mini reads these (deploy/scripts/monday-sync.sh) and writes the
  // tasks, which carry what the cards need, so the screen only keeps them tidy.
  //   mondayBoards      the boards the Mini reads, one entry for each: the board, its team, the status column with
  //                     the In progress and Done labels (any other status is Backlog), and the optional priority,
  //                     due date, owner and team columns. None to start with
  //   mondayShowOwners  keeps the first name of the owner of an item. Off to start with
  mondayBoards: [],
  mondayShowOwners: false,
};

// Used for anything missing from the Look document in the Studio. The
// Studio starts at the same values, and check-schemas.mjs fails if they differ.
//   defaultTheme  the id of a theme in themes/registry.js
//   useNow        a theme and an overlay to show now, whatever the schedule says. Each is empty
//                 (follow the schedule), an id, or for the overlay 'none'. until is a time, or empty.
//   schedule      rules: { name, kind: 'theme' | 'overlay', theme or overlay, startDate, endDate, repeatsEveryYear }
//   timeZone      the time zone the dates in the schedule are read in. The events
//                 (core/events.js) use it too, for their dates and for when they are over
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

// After a hidden transition has played, none comes about by chance for this many hours. A push from the Studio
// and the ?hidden= switch ignore it. core/hidden.js keeps the time of the last one.
export const hiddenGapHours = 4;

// How long a preview from the Studio holds a team, a style or a seasonal pack on the screen, in seconds. After that the
// screen goes back to the saved settings.
export const previewSeconds = 120;

// The look rotation (core/look-rotation.js). The screen never ends a pass of a team sooner than
// lookShortestSeconds after it began, so a team with nothing to show cannot make the looks flicker.
// A page that reloads, for a change of layout or a new version, goes on in the same pass if it
// reloads within lookResumeSeconds of the last time the pass was written down.
export const lookShortestSeconds = 15;
export const lookResumeSeconds = 600;

// How long the cut swap keeps the pages of all three areas changing at once, in milliseconds
export const lookCutMilliseconds = 1000;

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

// The kind of a calendar in Dashboard Settings (Calendars tab): what sort of events it holds. The Events
// panel writes it as a small chip before each title (core/event-pages.js). A calendar with no kind, or one
// that is not in this list, is other. The Studio copies this list.
export const calendarKinds = ['meetings', 'competitions', 'outreach', 'deadlines', 'other'];
export const defaultCalendarKind = 'other';

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
//   logoPose     the bird idles in its usual pose (auto), or with its wings up in flight
//   nameStyle    the team name in the banner is solid letters, or outlined letters over a solid accent line
//   tickerLabel  the label of the ticker is the cut plate, or a thin bar with an accent block before it
//   countAccent  the red parts of the countdown are red, or the team's neon
export const teamTrim = {
  bolts: { hex: '', round: 'bolts-round' },
  cornerCut: { 'tl-br': '', 'tr-bl': 'corner-cut-tr' },
  headerNotch: { step: '', slant: 'header-slant' },
  grid: { lines: '', dots: 'grid-dots' },
  logoPose: { auto: '', flight: 'pose-flight' },
  nameStyle: { solid: '', outline: 'name-outline' },
  tickerLabel: { plate: '', bar: 'ticker-bar' },
  countAccent: { red: '', neon: 'accent-neon' },
};

export const defaultTeam = {
  name: 'HAWKTIMUS PRIME',
  number: '3229',
  school: 'HOLLY SPRINGS HIGH SCHOOL',
};

// The team the screen shows when the Studio has no Teams, and the colors that a team
// document with a missing or mistyped color falls back to (core/sanity.js). It is Prime
// with the colors the screen has always had: teams.css starts at the same seven.
// The name and number are the ones in defaultTeam, and the Team box in Dashboard Settings
// changes them. The logo is empty, which means the shared hawk.
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
    neon: '#35F0FF',
    pink: '#FF2E8C',
    background: '#09060F',
    text: '#FFFFFF',
  },
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
