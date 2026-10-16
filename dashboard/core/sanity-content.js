// The whole content, from Sanity or from the sample (part of sanity.js).

import { withDefaults } from './content.js';
import { fromBoardOnly } from './task-source.js';
import { tidyFrc } from './frc.js';
import { tidyMondayStatus } from './monday.js';
import { tidyScreens } from './screens.js';
import { tidyViews } from './views.js';
import { tidySubthemes } from './subthemes.js';
import { tidyNotices } from './notice.js';
import { tidyMini } from './dots.js';
import { isRecord } from './text.js';
import { customPanelsFrom, normalizeSettings, normalizeTeam, teamsFrom } from './sanity-settings.js';
import { cleanObject, itemsFrom, milestonesFrom, normalizeTask, showingPlans, withRows, withTeamCode } from './sanity-tasks.js';
import { filtersFrom, normalizePerson, normalizeSubteam, photosFrom, presentationsFrom } from './sanity-people.js';

// Turns a query result into content. Hidden and expired items stay in the
// lists; the panels leave them out with visibleItems(), which leaves out the
// items of the other team as well. The one exception is plan, which is cut down
// to the plans that are showing and are for today. plans has all of them, and
// plan is the first, for the code that wants one. The Daily Agenda panel takes the
// first of plans that is for the team on the screen.
export function normalizeContent(result, now = new Date()) {
  const data = result || {};
  const settings = normalizeSettings(data.settings);
  const team = normalizeTeam(settings.team);
  delete settings.team;
  const plans = showingPlans(data.plans, now);

  return withDefaults({
    team: team,
    teams: teamsFrom(data.teams),
    settings: settings,
    theme: data.theme,
    demo: data.demo,
    tasks: fromBoardOnly(itemsFrom(data.tasks).map(normalizeTask)),
    milestones: milestonesFrom(data.milestones),
    plan: plans[0] || null,
    plans: plans,
    sponsors: itemsFrom(data.sponsors),
    tipsAndNews: itemsFrom(data.tipsAndNews),
    notices: tidyNotices(data.notices),
    subteams: itemsFrom(data.subteams).map(normalizeSubteam),
    people: itemsFrom(data.people).map(normalizePerson),
    photos: photosFrom(data.photos),
    presentations: presentationsFrom(data.presentations),
    calendarFilters: filtersFrom(data.calendarFilters),
    customPanels: customPanelsFrom(data.customPanels),
    frc: tidyFrc(data.frc),
    monday: tidyMondayStatus(data.monday),
    mini: tidyMini(data.mini),
    screens: tidyScreens(data.screens, settings.mondayStyle),
    views: tidyViews(data.views),
    subthemes: tidySubthemes(data.subthemes),
  });
}

// The sample file is already in the content shape. It gets the same cleaning
// as content from Sanity, so a typing slip in either one is handled alike.
export function normalizeSample(raw) {
  const data = isRecord(raw) ? raw : {};
  const plans = itemsFrom(data.plans).map(withRows);
  const content = Object.assign({}, data, {
    team: normalizeTeam(data.team),
    teams: teamsFrom(data.teams),
    settings: normalizeSettings(data.settings),
    plan: isRecord(data.plan) ? withRows(withTeamCode(cleanObject(data.plan))) : plans[0] || null,
  });
  content.plans = plans.length > 0 ? plans : (content.plan ? [content.plan] : []);

  ['tasks', 'sponsors', 'tipsAndNews', 'subteams', 'people', 'customPanels'].forEach(name => {
    content[name] = itemsFrom(data[name]);
  });
  content.notices = tidyNotices(data.notices);
  content.tasks = fromBoardOnly(content.tasks.map(normalizeTask));
  content.milestones = milestonesFrom(data.milestones);
  content.subteams = content.subteams.map(normalizeSubteam);
  content.people = content.people.map(normalizePerson);
  content.photos = itemsFrom(data.photos).filter(photo => typeof photo.address === 'string');
  content.presentations = presentationsFrom(data.presentations);
  content.calendarFilters = filtersFrom(data.calendarFilters);
  content.frc = tidyFrc(data.frc);
  content.monday = tidyMondayStatus(data.monday);
  content.screens = tidyScreens(data.screens, content.settings.mondayStyle);
  content.views = tidyViews(data.views);
  content.subthemes = tidySubthemes(data.subthemes);
  return withDefaults(content);
}
