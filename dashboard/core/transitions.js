// Chooses how the next page change looks. Two things are chosen, for each
// frame, every time its page changes:
//
//   the style   'slat' (the slats turn over and the frame halves lift) or
//               'mechanical' (the frame breaks into plates and bars and
//               rebuilds)
//   the finish  'gold' or 'silver', the metal of the frame after the change
//
// These are plain functions with no page in them, so tools/test-effects.mjs can
// test them. frame.js calls them and keeps the memory they need: the style and
// the finish the frame had last.
//
// To add a third style, see docs/page-transitions.md.

import { defaultSettings } from '../config.js';

// setting is the Page change style from Dashboard Settings, and last is the
// style this frame used last time, or null if it has had no change yet.
// Alternate takes turns. The first change is the mechanical one, so a new
// screen shows the new look early.
export function chooseStyle(setting, last) {
  if (setting === 'slat' || setting === 'mechanical') return setting;
  return last === 'mechanical' ? 'slat' : 'mechanical';
}

// mode is the Frame finish from Dashboard Settings, chance is Silver chance
// (percent) and last is the finish this frame has now, or null for a frame that
// has none yet. random is where the luck comes from: it is a function that gives
// a number from 0 up to but not including 1, like Math.random. Passing it in is
// what lets a test pick the number.
//
//   gold, silver   that finish every time
//   alternate      gold first, then silver, then gold ...
//   mostly-gold    silver when the number falls in the first chance percent of the
//                  way from 0 to 1, otherwise gold. With 10, that is one change in ten.
export function chooseFinish(mode, chance, last, random) {
  if (mode === 'gold' || mode === 'silver') return mode;
  if (mode === 'alternate') return last === 'gold' ? 'silver' : 'gold';

  // mostly-gold, and anything unknown is treated as it, because it is the default
  const percent = typeof chance === 'number' && isFinite(chance) ? chance : defaultSettings.silverChance;
  return random() * 100 < percent ? 'silver' : 'gold';
}
