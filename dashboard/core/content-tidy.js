// The tidy functions of the content: defaults, ranges and settings (part of content.js).

import { competitionModes, competitionSwitches, defaultSettings, defaultThemeByWeekday, scheduledThemeIds, viewKeys, defaultTeam, frameFinishes, limits, looks, lookSwaps, metals, nightSpeeds, nightStyles, pageChangeStyles, photoFits, photoOrders, portraitFrames, portraitShapes, speeds, styles, teamModes } from '../config.js';
import { parseLocalDateTime } from './time.js';
import { tidyTheme } from './theme.js';
import { tidyDemo } from './demo.js';
import { chanceFields, hoursFields, tidyHiddenRequest, tidyHours } from './hidden.js';
import { tidyAnnounceRequest } from './announce.js';
import { tidyTestRequest } from './presentation-test.js';
import { tidyPreviewRequest } from './preview.js';
import { tidyNextLookRequest, tidySchedule } from './screens.js';
import { showsForTeam } from './teams.js';
import { tidyScreenRequests } from './screen-requests.js';

// An item is shown unless it is switched off or its expiry time has passed. Only a task
// has Show on TV, and every panel that draws tasks comes through here, so it is read here.
export function isVisible(item, now = new Date()) {
  if (item.show === false || item.showOnTv === false) return false;

  const expires = parseLocalDateTime(item.expires);
  return !expires || expires > now;
}

// The items a panel may draw: the ones that are visible and are for the team on the screen
// (core/teams.js). Every panel takes its items through here, so the team is judged in this one place.
// The Screens ask about a team that is not on the screen yet, and give its code.
export function visibleItems(list, now = new Date(), teamCode) {
  return (list || []).filter(item => isVisible(item, now) && showsForTeam(item, teamCode));
}

// Puts the defaults under whatever the editors have set. Anything they have
// not filled in comes from config.js, so the panels never have to check
// whether settings exist.
export function withDefaults(raw) {
  const source = raw || {};
  const content = Object.assign({ tasks: [], plan: null, plans: [], teams: [], sponsors: [], tipsAndNews: [], notices: [], subteams: [], people: [], photos: [], presentations: [], customPanels: [], calendarFilters: [], milestones: [], frc: null, monday: null, mini: { lastCalendarSyncAt: '', calendarErrors: 0 }, screens: [], views: [], subthemes: [] }, source);
  content.team = Object.assign({}, defaultTeam, source.team);
  content.settings = Object.assign({}, defaultSettings, source.settings);
  // The Mini reads the two Monday blocks and the screen has no use for them
  ['mondayTaskBoard', 'mondayMilestoneBoard'].forEach(name => delete content.settings[name]);
  content.settings.countdown = Object.assign({}, defaultSettings.countdown, content.settings.countdown);
  content.settings.alert = Object.assign({}, defaultSettings.alert, content.settings.alert);
  content.settings.rotation = Object.assign({}, defaultSettings.rotation, content.settings.rotation);

  // The Look document is its own thing, not part of Dashboard Settings. A
  // missing or unusable value becomes the default (see core/theme.js).
  content.theme = tidyTheme(source.theme);

  // The Demo document is its own thing too. A missing one is no request and
  // the default steps (see core/demo.js).
  content.demo = tidyDemo(source.demo);

  // normalizeSettings in sanity.js already does this for the editors' content.
  // This covers content that did not come through it. The settings as they were saved, before the
  // defaults went under them, say whether the two portrait sizes were ever set.
  fixSettingValues(content.settings, source.settings || {});
  return content;
}

// The view settings, always complete: a name and a title for the General view, the views in an order, and a theme for each
// weekday. A view left out of the order is not played; an empty or unusable order is the starting one.
export function tidyViewSettings(settings) {
  ['generalViewName', 'generalViewTitle'].forEach(name => {
    if (typeof settings[name] !== 'string' || settings[name].trim() === '') settings[name] = defaultSettings[name];
  });
  const listed = Array.isArray(settings.viewOrder) ? settings.viewOrder.filter((key, index, all) => viewKeys.includes(key) && all.indexOf(key) === index) : [];
  settings.viewOrder = listed.length > 0 ? listed : viewKeys.slice();
  const saved = settings.themeByWeekday && typeof settings.themeByWeekday === 'object' ? settings.themeByWeekday : {};
  settings.themeByWeekday = {};
  Object.keys(defaultThemeByWeekday).forEach(day => {
    settings.themeByWeekday[day] = scheduledThemeIds.includes(saved[day]) ? saved[day] : defaultThemeByWeekday[day];
  });
}

// Settings that are one of a few words, an on/off switch, or a number in a
// range. Anything that does not fit becomes the default, so the panels never
// have to check. A number outside its range is moved to the nearest end. saved is the settings as
// the editors saved them, which is the same object unless defaults were put under it first.
export function fixSettingValues(settings, saved = settings) {
  if (!Object.keys(speeds).includes(settings.speed)) settings.speed = defaultSettings.speed;
  if (!metals.includes(settings.frameMetal)) settings.frameMetal = defaultSettings.frameMetal;
  if (!looks.includes(settings.look)) settings.look = defaultSettings.look;
  if (!styles.includes(settings.style)) settings.style = defaultSettings.style;
  // The page change settings
  if (!pageChangeStyles.includes(settings.pageChangeStyle)) settings.pageChangeStyle = defaultSettings.pageChangeStyle;
  if (!frameFinishes.includes(settings.frameFinish)) settings.frameFinish = defaultSettings.frameFinish;
  // The photo settings
  if (!photoOrders.includes(settings.photoOrder)) settings.photoOrder = defaultSettings.photoOrder;
  if (!photoFits.includes(settings.photoFit)) settings.photoFit = defaultSettings.photoFit;
  if (!portraitShapes.includes(settings.portraitShape)) settings.portraitShape = defaultSettings.portraitShape;
  if (!portraitFrames.includes(settings.portraitFrame)) settings.portraitFrame = defaultSettings.portraitFrame;
  // The team settings
  if (!teamModes.includes(settings.teamMode)) settings.teamMode = defaultSettings.teamMode;
  // The Screens: the Screen of each weekday, and the Monday style a Screen has when it has not set its own. The swap is
  // not a setting any more (lookSwaps in config.js) and the stored value is only kept tidy
  settings.screenSchedule = tidySchedule(settings.screenSchedule);
  if (!styles.includes(settings.mondayStyle)) settings.mondayStyle = defaultSettings.mondayStyle;
  if (!lookSwaps.includes(settings.lookSwap)) settings.lookSwap = defaultSettings.lookSwap;
  // The Views: names kept as text, the order a list of the four views each once, the theme of each weekday complete
  tidyViewSettings(settings);
  // The competition cards: the mode here, and a switch for each card in the list of booleans below
  if (!competitionModes.includes(settings.competitionMode)) settings.competitionMode = defaultSettings.competitionMode;
  // The night mode settings: two choices, a switch each way and the logo width. The times are fixed (constants.js)
  if (!nightStyles.includes(settings.nightStyle)) settings.nightStyle = defaultSettings.nightStyle;
  if (!Object.keys(nightSpeeds).includes(settings.nightSpeed)) settings.nightSpeed = defaultSettings.nightSpeed;

  // The logo and name switches and numbers are the logo settings in the Studio
  const logoSwitches = ['logoAnimations', 'logoEntrance', 'logoSpin', 'logoHawk', 'nameTransform'];
  const logoNumbers = ['logoSpinEvery', 'logoSpinDuration', 'logoHawkEvery', 'logoHawkDuration', 'nameEvery', 'nameDuration'];
  const transitionNumbers = ['breakSeconds', 'silverChance'];

  ['glint', 'showConnectionStatus', 'nightEnabled', 'nightPreview', 'hiddenEnabled', 'presentationsEnabled'].concat(logoSwitches, competitionSwitches).forEach(name => {
    if (typeof settings[name] !== 'boolean') settings[name] = defaultSettings[name];
  });
  // The hidden transition settings: each chance is a percent, and the last push from the Studio is a kind and a time
  const hiddenNumbers = chanceFields();
  // The team settings: minutes each team stays in Alternate mode
  const teamNumbers = ['alternateMinutes'];
  ['pageSeconds', 'photoSeconds', 'nightLogoWidth'].concat(logoNumbers, transitionNumbers, hiddenNumbers, teamNumbers).forEach(name => {
    settings[name] = keepInRange(settings[name], limits[name], defaultSettings[name]);
  });
  ['portraitScale', 'photoScale'].forEach(name => {
    settings[name] = tidyScale(name, settings[name]);
  });
  // Both are worked out before either is set, because setting one would make the other look saved
  const portraitSizes = portraitNames.map(name => portraitPercentOf(saved, name));
  portraitNames.forEach((name, index) => {
    settings[name] = portraitSizes[index];
  });
  // The hours between hidden transitions: 1 to 1000, or 0 when not set, and then the percent is used
  hoursFields().forEach(name => {
    settings[name] = tidyHours(settings[name], name);
  });
  settings.hiddenRequest = tidyHiddenRequest(settings.hiddenRequest);
  // The last click of Play announcements (Screen tab, hidden from editors): a time, or empty
  settings.announceRequest = tidyAnnounceRequest(settings.announceRequest);
  // The last click of Run presentation test (Presentations tab, hidden from editors): a time, or empty
  settings.presentationTestRequest = tidyTestRequest(settings.presentationTestRequest);
  // The last click of a Preview button (hidden from editors): a kind and a time, or empty
  settings.previewRequest = tidyPreviewRequest(settings.previewRequest);
  // The last click of Next look now and of Preview competition (Start here page, hidden from editors): a time, or empty
  settings.nextLookRequest = tidyNextLookRequest(settings.nextLookRequest);
  settings.competitionPreviewRequest = tidyRequestTime(settings.competitionPreviewRequest);
  // The requests of the control page: a panel, a view, a theme or a pause, each with an until time
  Object.assign(settings, tidyScreenRequests(settings));
  settings.crt = tidyGlitch(settings.crt);
  // The Events panel: Group events by kind (Calendars tab) is a switch that starts off
  if (typeof settings.groupEventsByKind !== 'boolean') settings.groupEventsByKind = defaultSettings.groupEventsByKind;
  // The Monday tab: the boards are a list and the owner names a switch. The Mini reads both, and the screen has no use for them
  if (!Array.isArray(settings.mondayBoards)) settings.mondayBoards = defaultSettings.mondayBoards.slice();
  if (typeof settings.mondayShowOwners !== 'boolean') settings.mondayShowOwners = defaultSettings.mondayShowOwners;
}

// A request that is only a time, always complete: { requestedAt }. A time that is not a time
// is empty, which is no request.
function tidyRequestTime(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const requestedAt = typeof source.requestedAt === 'string' && !isNaN(Date.parse(source.requestedAt)) ? source.requestedAt : '';

  return { requestedAt: requestedAt };
}

// A number in its range. For a limit with a shortest, 0 stays 0 (never) and
// a number between 0 and the shortest is brought up to the shortest.
export function keepInRange(value, limit, fallback) {
  if (typeof value !== 'number' || !isFinite(value)) return fallback;
  if (limit.shortest && value > limit.min && value < limit.shortest) return limit.shortest;
  return Math.min(limit.max, Math.max(limit.min, value));
}

// A size setting (leadershipPortrait, rosterPortrait, the old portraitScale or photoScale): a whole
// percent inside the limits of the setting (60 to 220 for portraits, 60 to 200 for the old portrait size,
// 60 to 100 for photos), so 79.6 is 80. Anything missing or odd is 100. The portrait and Photo panel
// code calls it too, so a size is never odd there.
export function tidyScale(name, value) {
  return Math.round(keepInRange(value, limits[name], defaultSettings[name]));
}

// The size of the portraits of one panel, a whole percent. leadershipPortrait and rosterPortrait replace
// portraitScale. When neither has been saved, both are the old Portrait size, so a screen that was set up
// before them looks the same. When one has been saved, the other is its starting value. The Roster
// panel and the code that draws the rows call this with their settings, saved or not tidied yet.
const portraitNames = ['leadershipPortrait', 'rosterPortrait'];

export function portraitPercentOf(settings, name) {
  const source = settings || {};
  const saved = portraitNames.some(own => typeof source[own] === 'number');

  return tidyScale(name, saved ? source[name] : source.portraitScale);
}

// The screen glitch setting, always complete: on, everySeconds, durationSeconds.
// Settings saved before the seconds existed have everyMinutes instead, so a
// published value keeps working. everySeconds wins when both are there.
function tidyGlitch(raw) {
  const glitch = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  let everySeconds = glitch.everySeconds;
  if (typeof everySeconds !== 'number' && typeof glitch.everyMinutes === 'number') {
    everySeconds = Math.round(glitch.everyMinutes * 60);
  }

  return {
    on: typeof glitch.on === 'boolean' ? glitch.on : defaultSettings.crt.on,
    everySeconds: keepInRange(everySeconds, limits.crtEvery, defaultSettings.crt.everySeconds),
    durationSeconds: keepInRange(glitch.durationSeconds, limits.crtDuration, defaultSettings.crt.durationSeconds),
  };
}
