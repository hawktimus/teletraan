// The preview address, the plain functions (docs/monday.md, "Preview"). The Studio opens
// /dashboard/?panel=<registry id>&team=<code>&dept=<team lead id>&screen=<original|cybertron|minimal>&still=1
// in a frame, and the screenshot tool opens the same address. core/still-run.js draws it.
//
//   panel   the registry id of the one panel to draw and hold. Without it nothing here applies
//   team    a team code, passed on to the ?team= switch
//   dept    the _id of a Team lead document, for the Monday rows that take a department
//   screen  the Screen or theme whose style the panel is drawn in, passed on to the ?style= switch
//   view    general, prime, nova or family: the view key written on the page, for a copy that follows the TV
//   layout  bar draws the bar layout in any theme, for the same reason
//   still   1 stops the clock and every movement, so the picture holds still
//   photos, each   for the Photos row: how many photos and the seconds of each (the row's starting values without them)

import { trimText } from './text.js';
import { themeIds, viewKeys } from '../config.js';

const stillScreens = ['original', 'cybertron', 'minimal'].concat(themeIds.filter(id => !['original', 'cybertron'].includes(id)));

// What the address asks for, or null when it has no panel. search is the part after the ?
// and may be a URLSearchParams.
export function readStill(search) {
  const params = search instanceof URLSearchParams ? search : new URLSearchParams(search || '');
  const panel = trimText(params.get('panel'));
  if (panel === '') return null;

  const screen = trimText(params.get('screen'));
  const ask = {
    panel: panel,
    team: trimText(params.get('team')),
    department: trimText(params.get('dept')),
    screen: stillScreens.includes(screen) ? screen : '',
    still: params.get('still') === '1',
  };
  // Left out when absent, so an address without them reads as it always did
  const view = trimText(params.get('view'));
  if (viewKeys.includes(view)) ask.view = view;
  if (trimText(params.get('layout')) === 'bar') ask.layout = 'bar';
  if (panel === 'photo') {
    ask.photoCount = Number(trimText(params.get('photos'))) || 0;
    ask.secondsPerPhoto = Number(trimText(params.get('each'))) || 0;
  }
  return ask;
}

// Changes the switches that the rest of the page already reads, so that a panel address needs no
// code of its own in them: show holds the page (no takeovers, no Screens, no hidden transitions),
// style and team are the ones a Screen asks for, and a still picture does not move.
export function useStillSwitches(params, ask) {
  params.set('show', ask.panel);
  if (ask.screen !== '') params.set('style', ask.screen);
  if (ask.team !== '') params.set('team', ask.team);
  if (ask.still && !params.has('motion')) params.set('motion', 'none');
  return params;
}

// The one Monday-style row the address stands for, in the shape of a row of a Screen
export function stillRow(ask) {
  const row = { panel: ask.panel, team: ask.team, seconds: 60 };
  if (ask.department !== '') row.department = ask.department;
  if (ask.panel === 'photo' && ask.photoCount > 0) row.photoCount = ask.photoCount;
  if (ask.panel === 'photo' && ask.secondsPerPhoto > 0) row.secondsPerPhoto = ask.secondsPerPhoto;
  return row;
}
