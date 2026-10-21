// The state the parts of frame.js share. One object, because a module cannot assign to a variable it imports.

import { defaultSettings } from './config.js';

export const frameState = {
  motion: 'full',
  light: false, // full motion, played light: one simple change at each panel and view change (core/motion.js)
  logoAnimationsOn: defaultSettings.logoAnimations, // the master switch
  entranceOn: defaultSettings.logoEntrance,
  playing: null, // the run of the effect that is playing now, { name }, or null
  waiting: [], // effects that want to start, first come first served: { name, byHand }
  nightCovers: false, // the night screen covers the picture, so nothing behind it is worth playing
  effectsPaused: false, // a demo is playing: the effects that come due on their own wait
  showLogo: null, // the logo the effects above move: the one in the banner
};
