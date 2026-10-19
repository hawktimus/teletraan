// The Match13 forecasts: the plain functions that clean match13.json and read it, and the reader that asks for the
// file every 10 minutes. computer/scripts/match13-sync.sh writes the file into the data folder of the Teletraan computer
// (docs/match13.md). It is not in Sanity, because Match13 marks its answers private and the dataset is public.
//
// Nothing here breaks the screen. A file that is missing, old or broken gives no forecast, and the two cards
// (panels/competition-forecast, panels/competition-qualify) are then not due. tidyMatch13() always gives
// the whole shape, with null or an empty list for what the file did not have, and never makes a number up.
//
// Other cards take their numbers through two functions:
//   matchForecastFor(matchKey)   the forecast of one match of an event, or null
//   fieldStrengthFor(eventKey)   how strong the teams of an event are, or null

import { liveFolder, sampleFolder } from '../config.js';
import { isRecord } from './text.js';

export const match13File = 'match13.json';

// The data is called stale after this many hours. The timer asks Match13 every 30 minutes on event days and
// every 6 hours otherwise, so a quiet day is nowhere near this.
export const staleHours = 12;
const refreshMinutes = 10;

const most = { teams: 6, events: 4, matches: 40, simTeams: 14, fieldTeams: 16, history: 12, ours: 3 };

function number(value) {
  return typeof value === 'number' && isFinite(value) ? value : null;
}

function text(value, longest) {
  return typeof value === 'string' ? value.trim().slice(0, longest) : '';
}

function list(value) {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function numbersIn(raw, names) {
  const found = {};
  names.forEach(name => {
    found[name] = number(isRecord(raw) ? raw[name] : null);
  });
  return found;
}

const teamNames = ['xp', 'xpFast', 'xpSlow', 'normXp', 'percentile', 'rank', 'xAuto', 'xTele', 'xEnd', 'epa', 'opr', 'dpr'];
const simNames = ['teamNumber', 'meanRank', 'meanRps', 'p5', 'p50', 'p95'];
const predNames = ['winProb', 'redScore', 'blueScore', 'redRp1', 'redRp2', 'redRp3', 'blueRp1', 'blueRp2', 'blueRp3'];
const fieldNames = ['teamNumber', 'xp', 'xAuto', 'xTele', 'xEnd', 'epa', 'sos', 'rank'];
const ourNames = ['teamNumber', 'rank', 'total', 'pCmp', 'pDcmp', 'q10', 'q50', 'q90', 'mean'];

function tidyHistory(raw) {
  return list(raw).slice(0, most.history).map(row => Object.assign({ eventKey: text(row.eventKey, 20) }, numbersIn(row, ['xpStart', 'xpEnd', 'xpMean', 'xpMax', 'sos', 'districtPoints'])));
}

function tidySim(raw) {
  if (!isRecord(raw)) return null;
  const teams = list(raw.teams).map(row => numbersIn(row, simNames)).filter(row => row.teamNumber !== null && row.meanRank !== null && row.p50 !== null).slice(0, most.simTeams);
  if (teams.length === 0) return null;
  return { iterations: number(raw.iterations), simmedAt: number(raw.simmedAt), teamCount: number(raw.teamCount), teams: teams };
}

function tidyField(raw) {
  if (!isRecord(raw)) return null;
  const top = list(raw.top).map(row => numbersIn(row, fieldNames)).filter(row => row.teamNumber !== null).slice(0, most.fieldTeams);
  if (top.length === 0) return null;
  return { teamCount: number(raw.teamCount), average: number(raw.average), top: top };
}

function tidyMatch(raw) {
  const key = text(raw.key, 40);
  if (key === '' || !isRecord(raw.pred)) return null;

  const teams = {};
  Object.keys(isRecord(raw.teams) ? raw.teams : {}).slice(0, most.teams).forEach(name => {
    if (/^[1-9][0-9]{0,4}$/.test(name)) teams[name] = number(raw.teams[name]);
  });
  return { key: key, unplayed: raw.unplayed === true, pred: numbersIn(raw.pred, predNames), teams: teams };
}

function tidyEvent(raw) {
  const source = isRecord(raw) ? raw : {};
  return {
    sim: tidySim(source.sim),
    field: tidyField(source.field),
    matches: list(source.matches).map(tidyMatch).filter(match => match !== null).slice(0, most.matches),
    notes: (Array.isArray(source.notes) ? source.notes : []).filter(note => typeof note === 'string').map(note => note.trim().slice(0, 200)).slice(0, 4),
  };
}

function tidyCutline(raw) {
  if (!isRecord(raw)) return null;
  const line = numbersIn(raw, ['q10', 'q50', 'q90']);
  return line.q50 === null ? null : line;
}

const statusPattern = /^[a-z_]{1,20}$/;

function tidyDistrict(raw) {
  const source = isRecord(raw) ? raw : {};
  return {
    code: text(source.code, 6),
    capacity: number(source.capacity),
    cmpSlots: number(source.cmpSlots),
    cmpCutline: tidyCutline(source.cmpCutline),
    pools: list(source.pools).slice(0, 3).map(pool => Object.assign({ name: text(pool.name, 12), cutline: tidyCutline(pool.cutline) }, numbersIn(pool, ['capacity', 'autos', 'seatsByPoints']))),
    teamCount: number(source.teamCount),
    ourTeams: list(source.ourTeams).slice(0, most.ours).map(row => Object.assign(numbersIn(row, ourNames), {
      cmpStatus: statusPattern.test(row.cmpStatus) ? row.cmpStatus : '',
      dcmpStatus: statusPattern.test(row.dcmpStatus) ? row.dcmpStatus : '',
    })).filter(row => row.teamNumber !== null),
    notes: (Array.isArray(source.notes) ? source.notes : []).filter(note => typeof note === 'string').map(note => note.trim().slice(0, 200)).slice(0, 4),
  };
}

// The cleaned file, or null when it is not one. generatedAt is the time the Teletraan computer wrote it.
export function tidyMatch13(raw) {
  if (!isRecord(raw) || typeof raw.generatedAt !== 'string' || isNaN(Date.parse(raw.generatedAt))) return null;

  const teams = {};
  Object.keys(isRecord(raw.teams) ? raw.teams : {}).slice(0, most.ours).forEach(name => {
    if (!/^[1-9][0-9]{0,4}$/.test(name) || !isRecord(raw.teams[name])) return;
    teams[name] = Object.assign(numbersIn(raw.teams[name], teamNames), { history: tidyHistory(raw.teams[name].history) });
  });

  const events = {};
  Object.keys(isRecord(raw.events) ? raw.events : {}).slice(0, most.events).forEach(key => {
    if (/^[0-9]{4}[a-z0-9]{2,12}$/.test(key)) events[key] = tidyEvent(raw.events[key]);
  });

  const data = {
    generatedAt: raw.generatedAt,
    season: number(raw.season),
    ours: list(raw.ours).slice(0, most.ours).map(row => ({ code: text(row.code, 12).toLowerCase(), number: number(row.number) })).filter(row => row.number !== null),
    teams: teams,
    events: events,
    district: tidyDistrict(raw.district),
  };
  if (raw.sample === true) data.sample = true;
  return data;
}

// Whether the file is older than staleHours at the time given
export function match13Stale(data, now = new Date()) {
  if (!data || data.sample === true) return false;
  const written = Date.parse(data.generatedAt);
  return isNaN(written) || now.getTime() - written > staleHours * 60 * 60 * 1000;
}

// The state of the reader. live is the file of the Teletraan computer, sample the made up one for ?sample=1 and Preview competition.
let live = null;
let sample = null;
let previewing = false;
let sampleMode = false;

// Preview competition shows the sample file (core/competition.js previewCompetition calls this)
export function setMatch13Preview(on) {
  previewing = on === true;
}

// The data the cards draw now, or null. The sample file is shown for ?sample=1 and while a preview is on.
export function currentMatch13() {
  return previewing || sampleMode ? sample : live;
}

// Tests give the data directly
export function setMatch13(data, sampleData = null) {
  live = data;
  sample = sampleData;
}

// The event the forecast card is about: the first event with a simulation that holds one of our teams
export function forecastEvent(data = currentMatch13()) {
  if (!data) return null;

  const numbers = data.ours.map(team => team.number);
  const key = Object.keys(data.events).find(name => {
    const sim = data.events[name].sim;
    return sim !== null && sim.teams.some(row => numbers.includes(row.teamNumber));
  });
  return key === undefined ? null : { key: key, sim: data.events[key].sim, event: data.events[key] };
}

export function hasForecast(data = currentMatch13()) {
  return forecastEvent(data) !== null;
}

// Our teams with a chance to show: a number for the World or the District Championship, or a status word
export function qualifyRows(data = currentMatch13()) {
  if (!data) return [];
  return data.district.ourTeams.filter(row => row.pCmp !== null || row.pDcmp !== null || row.cmpStatus !== '' || row.dcmpStatus !== '');
}

export function hasQualify(data = currentMatch13()) {
  return qualifyRows(data).length > 0;
}

// The forecast of one match, as Match13 has it: the chance that red wins, the scores, the chance of each
// ranking point for each alliance, and the rating of each of the six teams going in. null when there is none.
// The file does not say which alliance a team is on, so the card that asks has to know that (the
// match schedule in frc-status does).
export function matchForecastFor(matchKey, data = currentMatch13()) {
  if (!data || typeof matchKey !== 'string') return null;

  for (const key of Object.keys(data.events)) {
    const found = data.events[key].matches.find(match => match.key === matchKey);
    if (found) {
      const pred = found.pred;
      return {
        key: found.key,
        unplayed: found.unplayed,
        redWin: pred.winProb,
        blueWin: pred.winProb === null ? null : Math.round((1 - pred.winProb) * 1000) / 1000,
        redScore: pred.redScore,
        blueScore: pred.blueScore,
        redRp: [pred.redRp1, pred.redRp2, pred.redRp3],
        blueRp: [pred.blueRp1, pred.blueRp2, pred.blueRp3],
        ratings: found.teams,
      };
    }
  }
  return null;
}

// How strong the teams of an event are: how many, the average rating, the strongest 12 and our teams, each
// with the place by rating. null when Match13 has no ratings for the event yet.
export function fieldStrengthFor(eventKey, data = currentMatch13()) {
  if (!data || typeof eventKey !== 'string' || !isRecord(data.events[eventKey]) || data.events[eventKey].field === null) return null;

  const field = data.events[eventKey].field;
  const numbers = data.ours.map(team => team.number);
  return {
    eventKey: eventKey,
    teamCount: field.teamCount,
    average: field.average,
    top: field.top,
    ours: field.top.filter(row => numbers.includes(row.teamNumber)),
  };
}

// Reading the file

// Gives { data } when the file was read (data is null when there is none yet or it is not usable), and null when the
// read failed, so the caller keeps what it had. fetchFunction is fetch.
export async function readMatch13(fetchFunction, folder, seconds = 15) {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), seconds * 1000) : null;

  try {
    const answer = await fetchFunction(folder + match13File, { cache: 'no-store', signal: controller ? controller.signal : undefined });
    if (answer.status === 404) return { data: null };
    if (!answer.ok) return null;
    try {
      return { data: tidyMatch13(await answer.json()) };
    } catch (error) {
      return { data: null };
    }
  } catch (error) {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// Starts the reader: the file of the Teletraan computer every 10 minutes, and the sample file once. A page with
// ?sample=1 shows the sample only. Never throws.
export async function startMatch13(fetchFunction, useSample) {
  sampleMode = useSample === true;

  const sampleRead = await readMatch13(fetchFunction, sampleFolder);
  if (sampleRead && sampleRead.data) sample = sampleRead.data;
  if (sampleMode) return;

  async function again() {
    const result = await readMatch13(fetchFunction, liveFolder);
    if (result) live = result.data;
  }
  await again();
  setInterval(again, refreshMinutes * 60 * 1000);
}
