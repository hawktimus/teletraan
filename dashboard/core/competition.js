// The competition cards: which of them are in the rotation right now, and where. These are
// the plain functions. They know nothing about the page, so tests/competition.test.mjs can
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
//   around  Before and after: the cards play only in two phases of an event, and not while it is on. The preview is
//           from 14 days before its first day to the day before it, and the recap is from the day after its last
//           day for 7 days. The three newer cards (competition-preview, competition-matches and
//           competition-recap) come in this mode and in Always only. The cards that follow the match by match
//           course of an event (next match, rank, results, alliance) are marked during and never play in this mode.
//
// A card with nothing to show is not due, so a screen with no key on the Teletraan computer shows no
// competition card at all. The cards still say so in one plain sentence when they are asked
// to draw with nothing to show (the ?show= address, and Preview competition).
//
// shell.js hands the playlist of the large panel to withCompetition(), which puts the due
// cards in it each time the next page is chosen (core/schedule.js asks for the playlist
// again every time).

import { competitionLeadDays, competitionModes, competitionPreviewDays, competitionPreviewSeconds, competitionRecapDays, defaultSettings } from '../config.js';
import { addDays, daysFromTo, eventName, teamEntry } from './frc.js';
import { hasForecast, hasQualify, setMatch13Preview } from './match13.js';
import { dateIn, timeZoneOf } from './theme.js';
import { parseLocalDateTime } from './time.js';

// The most dates the season timeline draws as dots, not counting today. The card says how many more there are.
export const timelineDates = 6;

// What a card needs to be due. window says whether its time has come, and data whether it has
// something to show. They are given the facts of the team on the screen (competitionPlan below).
// The list is in the order of priority, so the next match comes first.
export const cards = [
  { id: 'competition-next-match', setting: 'competitionNextMatch', during: true, window: facts => facts.near, data: facts => facts.entry.nextMatch !== null },
  { id: 'competition-rank', setting: 'competitionRank', during: true, window: facts => facts.near, data: facts => facts.entry.ranking !== null },
  { id: 'competition-results', setting: 'competitionResults', during: true, window: facts => facts.near, data: facts => facts.entry.results.length > 0 },
  { id: 'competition-alliance', setting: 'competitionAlliance', during: true, window: facts => facts.near, data: facts => facts.entry.alliance !== null },
  { id: 'competition-timeline', setting: 'competitionTimeline', window: () => true, data: facts => facts.markers.length > 0 },
  { id: 'competition-district', setting: 'competitionDistrict', window: facts => facts.started, data: facts => facts.entry.districtPoints !== null },
  { id: 'competition-last-season', setting: 'competitionLastSeason', window: facts => !facts.started, data: facts => facts.entry.lastSeason !== null },
  // The newer cards, for Before and after and Always. Their windows are the phases (eventPhases below).
  { id: 'competition-preview', setting: 'competitionPreview', phased: true, window: facts => facts.phases.preview !== null, data: facts => previewEventOf(facts.entry, facts.today) !== null },
  { id: 'competition-matches', setting: 'competitionMatches', phased: true, window: facts => facts.phases.preview !== null && (scheduleIsFor(facts.entry, facts.phases.preview) || daysToFirstDay(facts.phases.preview, facts.today) <= competitionLeadDays), data: facts => scheduleIsLive(facts.entry, facts.today) || (facts.mode === 'around' && facts.phases.preview !== null) },
  { id: 'competition-recap', setting: 'competitionRecap', phased: true, window: facts => facts.phases.recap !== null, data: facts => recapHasData(facts.entry, recapEventOf(facts.entry, facts.today)) },
  // The two Match13 cards take their numbers from core/match13.js and not from frc-status
  { id: 'competition-forecast', setting: 'competitionForecast', window: facts => facts.near, around: () => true, data: () => hasForecast() },
  { id: 'competition-qualify', setting: 'competitionQualify', window: facts => facts.started, around: () => true, data: () => hasQualify() },
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
  setMatch13Preview(previewed !== null);
}

export function previewIsOn(now = new Date()) {
  return previewed !== null && now.getTime() < previewed.until;
}

// The data the cards draw: the preview's while one is on, otherwise the frc-status document
export function frcOf(content, now = new Date()) {
  if (previewIsOn(now)) return previewed.frc;
  return content && content.frc ? content.frc : null;
}

// The phases of an event

function startOrder(first, second) {
  return first.startDate < second.startDate ? -1 : first.startDate > second.startDate ? 1 : 0;
}

// What today is for the events of the team, as { during, preview, recap }, each an event or null. during is an
// event that is on (its first day to its last). While one is on, the other two are null, because nothing
// plays in Before and after on the days of an event. preview is the event that starts in the next 14 days, the
// nearest one, and recap is the event that ended in the last 7 days, the latest one. Two events close together
// can give a preview and a recap on the same day. Dates are plain dates (core/frc.js).
export function eventPhases(events, today) {
  const none = { during: null, preview: null, recap: null };
  const dated = events.filter(event => event.startDate !== '');

  const during = dated.filter(event => event.startDate <= today && today <= endOf(event))[0] || null;
  if (during) return Object.assign(none, { during: during });

  const preview = dated.filter(event => addDays(event.startDate, -competitionPreviewDays) <= today && today < event.startDate).sort(startOrder)[0] || null;
  const recap = dated
    .filter(event => endOf(event) < today && today <= addDays(endOf(event), competitionRecapDays))
    .sort((first, second) => (endOf(first) < endOf(second) ? 1 : -1))[0] || null;
  return { during: null, preview: preview, recap: recap };
}

// Whole days from today to the first day of an event
export function daysToFirstDay(event, today) {
  return daysFromTo(today, event.startDate);
}

// The event the preview card is about: the one in its 14 days, and otherwise the first that is not over. The card
// can be asked for by hand on any day, and it still has an event to write about.
export function previewEventOf(entry, today) {
  const coming = entry.events.filter(event => event.startDate !== '' && endOf(event) >= today).sort(startOrder);
  const near = coming.filter(event => addDays(event.startDate, -competitionPreviewDays) <= today && today < event.startDate)[0];
  return near || coming[0] || null;
}

// The event the recap card is about: the one that ended in the last 7 days, and otherwise the latest that is over, and
// for sample data the last that has a rank
export function recapEventOf(entry, today) {
  const over = entry.events.filter(event => event.startDate !== '' && endOf(event) < today).sort((first, second) => (endOf(first) < endOf(second) ? 1 : -1));
  const near = over.filter(event => today <= addDays(endOf(event), competitionRecapDays))[0];
  return near || over.filter(event => recapHasData(entry, event))[0] || entry.events.filter(event => event.rank !== null).slice(-1)[0] || null;
}

// The recap has something to say when the event has a rank, a record or an award
export function recapHasData(entry, event) {
  if (!event) return false;
  return event.rank !== null || event.record !== null || entry.awards.some(award => award.event === event.key);
}

// The schedule is posted when the Teletraan computer found qualification matches still to play
export function scheduleIsPosted(entry) {
  return entry.schedule !== null && entry.schedule.matches.length > 0;
}

// The schedule belongs to an event: it says which one, and a schedule that does not say is taken as belonging to any
export function scheduleIsFor(entry, event) {
  return scheduleIsPosted(entry) && (entry.schedule.event === '' || entry.schedule.event === event.key);
}

// The schedule is for an event that is not over. A schedule whose event is unknown is taken as live.
export function scheduleIsLive(entry, today) {
  if (!scheduleIsPosted(entry)) return false;

  const event = entry.events.filter(item => item.key === entry.schedule.event)[0];
  return !event || endOf(event) >= today;
}

// The clock

// The date today in the time zone of the Look page, written 2027-03-12
export function todayOf(content, now = new Date()) {
  return dateIn(timeZoneOf(content), now);
}

function endOf(event) {
  return event.endDate || event.startDate;
}

// What the days of the team's events say about today. near is true from two days before the
// first day of an event to its last day, onNow on those days of the event, and started once
// the first event of the season has begun. Dates are plain dates (core/frc.js).
function eventFacts(entry, today, leadDays = competitionLeadDays) {
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

// The next date of the countdown, Kickoff and then Rollout, as a plain date in the zone, or null.
// The Monday progress card draws its target line to the same date.
export function countdownMarker(settings, zone, today) {
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
// limit of them, timelineDates to start with. A marker has the kind, the label the old line wrote (the
// city of an event), the name and the city for the legend of the card, the date, the days left and whether
// it is on now.
export function timelineMarkers(content, entry, now = new Date(), limit = timelineDates) {
  const frc = frcOf(content, now);
  const settings = content && content.settings ? content.settings : defaultSettings;
  const zone = timeZoneOf(content);
  const today = dateIn(zone, now);
  const markers = [];

  const countdown = countdownMarker(settings.countdown || {}, zone, today);
  if (countdown) markers.push(Object.assign({ name: countdown.label, city: '' }, countdown));

  entry.events.filter(event => endOf(event) >= today).forEach(event => {
    markers.push({ kind: 'event', label: event.city || event.name, name: eventName(event), city: event.city, date: event.startDate, days: Math.max(0, daysFromTo(today, event.startDate)), now: event.startDate <= today, key: event.key });
  });

  // The state championship, unless it is one of the team's own events
  const championship = (frc && Array.isArray(frc.districtEvents) ? frc.districtEvents : [])
    .filter(event => event.championship && endOf(event) >= today && !markers.some(marker => marker.key !== '' && marker.key === event.key))[0];
  if (championship) {
    markers.push({ kind: 'state', label: 'STATE', name: eventName(championship) || 'STATE CHAMPIONSHIP', city: championship.city, date: championship.startDate, days: Math.max(0, daysFromTo(today, championship.startDate)), now: championship.startDate <= today, key: championship.key });
  }

  return markers.sort((first, second) => (first.date < second.date ? -1 : first.date > second.date ? 1 : 0)).slice(0, limit);
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

  const today = todayOf(content, now);
  const phases = eventPhases(entry.events, today);
  const facts = Object.assign({ entry: entry, markers: timelineMarkers(content, entry, now), mode: mode, today: today, phases: phases }, eventFacts(entry, today));
  const inPhase = phases.preview !== null || phases.recap !== null;

  const due = cards.filter(card => {
    if (settings[card.setting] === false || !card.data(facts)) return false;
    if (mode === 'always') return true;
    if (mode === 'around') return inPhase && !card.during && (card.around || card.window)(facts);
    return !card.phased && card.window(facts);
  });

  return { cards: due.map(card => card.id), priority: mode !== 'around' && due.length > 0 && facts.onNow };
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
