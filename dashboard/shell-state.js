// What the parts of shell.js share: the address, the screen element and the state of the page (part of shell.js).

import { readStill, useStillSwitches } from './core/still.js';
import { readCompetitionAsk } from './core/competition-address.js';
import { rotateLayout } from './core/style.js';
import { applyView } from './core/view-apply.js';

export const params = new URLSearchParams(window.location.search);
export const stillAsk = readStill(params); // ?panel= draws that one panel and holds it (core/still.js)
if (stillAsk) {
  useStillSwitches(params, stillAsk);
  // Only a still address (the control page's copy of the TV) asks for these two
  if (stillAsk.layout === 'bar') rotateLayout('bar');
  if (stillAsk.view) applyView(stillAsk.view);
}
export const competitionAsk = readCompetitionAsk(params); // ?competition=1&event= puts the competition cards on (core/competition-address.js)
export const stress = params.has('stress');
export const onlyTasks = params.get('only') === 'tasks';

export const screen = document.getElementById('screen');

export const extras = {}; // events and weather: things that do not come from the editors. Each may be missing. extras.events are the BAND events only.

export const shellState = {
  base: null, // the content from the editors, or the sample
  status: null,
  content: null, // base and extras together, always the newest
  rereadEvents: null, // set once the calendar reader is running
  calendarsKey: null, // the calendar list the events were last read for
  showingSample: false, // true while the page shows the sample content (?sample=1)
  extrasStarted: false, // the events are being read, so a change of source has to redo them
  calendarsReadAt: null, // when every calendar file was last read well, for the connection status text
  deviceText: [], // the Teletraan computer's name and ssh line, read only while Sanity cannot be reached
  decorationsUsed: false, // core/season.js has been asked for a pack, so it has to be asked again when the pack goes
  choosingTeam: false, // rebuild() is choosing the team, so a change of team that it finds does not start another rebuild
  stayStarted: false, // startWhatStays() has drawn the panels that stay, so a style with other frames has to draw them again
  swapIsPlaying: () => false, // core/swap-run.js gives the real one when it has loaded
};
