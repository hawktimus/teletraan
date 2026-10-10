// The competition cards: which of them are in the rotation right now, and where. These are
// the plain functions. They know nothing about the page, so tools/test-competition.mjs can
// run them. The cards themselves are the panels whose id starts with competition- in
// registry.js, and core/competition-draw.js has what they share. docs/frc-feed.md says what
// each card shows.
//
// Which cards are due is one function, competitionPlan(), and it reads three things: the
// frc-status document (core/frc.js), the clock, and the Competition cards setting in
// Dashboard Settings.
//
//   off     no card
//   auto    each card comes in the window of its own (cards below). The cards about an event
//           come from two days before its first day until its last day, and on the days of
//           the event they take priority: the rotation alternates a card and an ordinary panel
//   always  every card that is switched on and has something to show, whatever the date
//
// A card with nothing to show is not due, so a screen with no key on the Mini shows no
// competition card at all. The cards still say so in one plain sentence when they are asked
// to draw with nothing to show (the ?show= address, and Preview competition).
//
// shell.js hands the playlist of the large panel to withCompetition(), which puts the due
// cards in it each time the next page is chosen (core/schedule.js asks for the playlist
// again every time).

import { competitionLeadDays, competitionModes, competitionPreviewSeconds, defaultSettings, defaultThemeSettings } from '../config.js';
import { addDays, daysFromTo, teamEntry } from './frc.js';
import { dateIn, isTimeZone } from './theme.js';
import { parseLocalDateTime } from './time.js';

// The most dates the season timeline draws, not counting today. They are 120 px apart at least.
export const timelineDates = 7;

// What a card needs to be due. window says whether its time has come, and data whether it has
// something to show. They are given the facts of the team on the screen (competitionPlan below).
// The list is in the order of priority, so the next match comes first.
export const cards = [
  { id: 'competition-next-match', setting: 'competitionNextMatch', window: facts => facts.near, data: facts => facts.entry.nextMatch !== null },
  { id: 'competition-rank', setting: 'competitionRank', window: facts => facts.near, data: facts => facts.entry.ranking !== null },
  { id: 'competition-results', setting: 'competitionResults', window: facts => facts.near, data: facts => facts.entry.results.length > 0 },
  { id: 'competition-alliance', setting: 'competitionAlliance', window: facts => facts.near, data: facts => facts.entry.alliance !== null },
  { id: 'competition-timeline', setting: 'competitionTimeline', window: () => true, data: facts => facts.markers.length > 0 },
  { id: 'competition-district', setting: 'competitionDistrict', window: facts => facts.started, data: facts => facts.entry.districtPoints !== null },
  { id: 'competition-last-season', setting: 'competitionLastSeason', window: facts => !facts.started, data: facts => facts.entry.lastSeason !== null },
];

export function isCard(id) {
  return cards.some(card => card.id === id);
}

// Preview competition holds sample data on the cards for a while

let previewed = null; // { frc, until }: a preview (core/competition-preview.js) shows this data until a time

// Shows frc on the cards until a time in milliseconds, whatever frc-status holds. A call with
// no data, or no time, ends it.
export function previewCompetition(frc, until) {
  previewed = frc && typeof until === 'number' && isFinite(until) ? { frc: frc, until: until } : null;
}

export function previewIsOn(now = new Date()) {
  return previewed !== null && now.getTime() < previewed.until;
}

// The data the cards draw: the preview's while one is on, otherwise the frc-status document
export function frcOf(content, now = new Date()) {
  if (previewIsOn(now)) return previewed.frc;
  return content && content.frc ? content.frc : null;
}

// The clock

export function zoneOf(content) {
  const zone = content && content.theme && content.theme.timeZone;
  return isTimeZone(zone) ? zone : defaultThemeSettings.timeZone;
}

// The date today in the time zone of the Look page, written 2027-03-12
export function todayOf(content, now = new Date()) {
  return dateIn(zoneOf(content), now);
}

function endOf(event) {
  return event.endDate || event.startDate;
}

// What the days of the team's events say about today. near is true from two days before the
// first day of an event to its last day, onNow on those days of the event, and started once
// the first event of the season has begun. Dates are plain dates (core/frc.js).
export function eventFacts(entry, today, leadDays = competitionLeadDays) {
  const events = entry.events;

  return {
    near: events.some(event => addDays(event.startDate, -leadDays) <= today && today <= endOf(event)),
    onNow: events.some(event => event.startDate <= today && today <= endOf(event)),
    started: events.some(event => event.startDate <= today),
  };
}

// The season timeline's dates

// The label of the countdown without its closing IN, as the countdown writes it
function countdownName(text, fallback) {
  const label = typeof text === 'string' && text.trim() !== '' ? text.trim().toUpperCase().replace(/\s+IN$/, '') : '';
  return label || fallback;
}

// The next date of the countdown, Kickoff and then Rollout, as a plain date in the zone, or null
function countdownMarker(settings, zone, today) {
  const dates = [
    { label: countdownName(settings.kickoffLabel, 'KICKOFF'), moment: parseLocalDateTime(settings.kickoff) },
    { label: countdownName(settings.rolloutLabel, 'ROLLOUT'), moment: parseLocalDateTime(settings.rollout) },
  ];

  for (const item of dates) {
    if (!item.moment) continue;

    const date = dateIn(zone, item.moment);
    if (date >= today) return { kind: 'countdown', label: item.label, date: date, days: daysFromTo(today, date), now: date === today };
  }
  return null;
}

// The dates the timeline draws, earliest first: the countdown date, each of the team's events that
// is not over, and the state championship. An event that is on has days of 0 and now true. At most
// timelineDates of them.
export function timelineMarkers(content, entry, now = new Date()) {
  const frc = frcOf(content, now);
  const settings = content && content.settings ? content.settings : defaultSettings;
  const zone = zoneOf(content);
  const today = dateIn(zone, now);
  const markers = [];

  const countdown = countdownMarker(settings.countdown || {}, zone, today);
  if (countdown) markers.push(countdown);

  entry.events.filter(event => endOf(event) >= today).forEach(event => {
    markers.push({ kind: 'event', label: event.city || event.name, date: event.startDate, days: Math.max(0, daysFromTo(today, event.startDate)), now: event.startDate <= today, key: event.key });
  });

  // The state championship, unless it is one of the team's own events
  const championship = (frc && Array.isArray(frc.districtEvents) ? frc.districtEvents : [])
    .filter(event => event.championship && endOf(event) >= today && !markers.some(marker => marker.key !== '' && marker.key === event.key))[0];
  if (championship) {
    markers.push({ kind: 'state', label: 'STATE', date: championship.startDate, days: Math.max(0, daysFromTo(today, championship.startDate)), now: championship.startDate <= today, key: championship.key });
  }

  return markers.sort((first, second) => (first.date < second.date ? -1 : first.date > second.date ? 1 : 0)).slice(0, timelineDates);
}

// The plan

function modeOf(settings) {
  return competitionModes.includes(settings.competitionMode) ? settings.competitionMode : defaultSettings.competitionMode;
}

// The cards that are due now for the team on the screen, as { cards, priority }. cards is a list of
// card ids in the order of priority, and priority is true on the days of an event, when the cards
// take turns with the ordinary panels.
export function competitionPlan(content, now = new Date()) {
  const none = { cards: [], priority: false };
  const settings = content && content.settings ? content.settings : defaultSettings;
  const mode = modeOf(settings);
  if (mode === 'off') return none;

  const entry = teamEntry(frcOf(content, now));
  if (!entry) return none;

  const facts = Object.assign({ entry: entry, markers: timelineMarkers(content, entry, now) }, eventFacts(entry, todayOf(content, now)));
  const due = cards.filter(card => settings[card.setting] !== false && card.data(facts) && (mode === 'always' || card.window(facts)));

  return { cards: due.map(card => card.id), priority: due.length > 0 && facts.onNow };
}

// The ids of the cards that are due
export function dueCards(content, now) {
  return competitionPlan(content, now).cards;
}

// The rotation

// The ordinary panels with the cards among them. On the days of an event (priority) a card and a
// panel take turns, starting with a card, and what is left of either list follows. Otherwise the
// cards are spread evenly through the panels, so they come once in each time round.
export function mixIn(playlist, steps, priority) {
  if (steps.length === 0) return playlist;

  const mixed = [];
  if (priority) {
    for (let index = 0; index < Math.max(playlist.length, steps.length); index++) {
      if (index < steps.length) mixed.push(steps[index]);
      if (index < playlist.length) mixed.push(playlist[index]);
    }
    return mixed;
  }

  let placed = 0;
  playlist.forEach((step, index) => {
    mixed.push(step);
    while (placed < steps.length && Math.round((placed + 1) * playlist.length / (steps.length + 1)) <= index + 1) {
      mixed.push(steps[placed]);
      placed += 1;
    }
  });
  return mixed.concat(steps.slice(placed));
}

let complained = false; // a problem is written in the console once, not at every page

// The playlist of the large panel with the due cards in it. While Preview competition is on it is
// every card, in order of priority, and nothing else, each for an equal share of the time. A problem
// with the data leaves the playlist as it is, because the rotation of the large panel asks for it
// each time and must never be stopped by it.
export function withCompetition(playlist, content, now = new Date()) {
  try {
    if (previewIsOn(now)) {
      const seconds = Math.max(6, Math.floor(competitionPreviewSeconds / cards.length));
      return cards.map(card => ({ panel: card.id, show: true, seconds: seconds }));
    }

    const plan = competitionPlan(content, now);
    return mixIn(playlist, plan.cards.map(id => ({ panel: id, show: true })), plan.priority);
  } catch (error) {
    if (!complained) console.error('The competition cards could not be planned, so the panels run without them', error);
    complained = true;
    return playlist;
  }
}
