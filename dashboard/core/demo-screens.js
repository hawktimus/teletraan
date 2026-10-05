// The screens a demo can show. One entry for each, so adding a screen is one
// entry here and the same id and name in studio/demo-screens.js (docs/demo.md).
//
// The key is the id the Studio stores. name is the words the editors pick it
// by. run(context) puts the screen up. It does one of two things:
//   - It returns a promise that is done when the screen is over (an async
//     function). Use context.waitSeconds() inside it to wait out the step.
//   - It returns a function that takes the screen away. The runner waits the
//     step's seconds and then calls that function.
//
// context is:
//   seconds        how long the step lasts
//   getContent()   the newest content
//   cancelled()    true once the demo has been stopped, or a real alert has the screen
//   waitSeconds(n) waits n seconds, and ends early when cancelled() turns true
//
// This file imports nothing from the page, so the tests and check-schemas.mjs
// can read it. The code that needs the page is loaded inside run().

import { demoPlaceholderText } from '../config.js';

// What the announcement step shows, as the { title, followUp, titleSeconds,
// followUpSeconds } that runAnnouncement in takeover.js plays. The words are the
// Demo announcement text, as one line. With none, they are the first
// announcement of Dashboard Settings (its lines already leave out the ones that
// are switched off), or a marked placeholder when there is none. The seconds are
// the step's, shared between the two lines the way the announcement shares its own.
export function demoAnnouncement(content, seconds) {
  const typed = String(content.demo.announcementText || '').trim();
  const first = (content.settings.announcements || [])[0];

  if (typed) return { title: typed, followUp: '', titleSeconds: seconds, followUpSeconds: 0 };
  if (!first) return { title: demoPlaceholderText, followUp: '', titleSeconds: seconds, followUpSeconds: 0 };

  const title = first.title || demoPlaceholderText;
  const followUp = String(first.followUp || '').trim();
  if (!followUp) return { title: title, followUp: '', titleSeconds: seconds, followUpSeconds: 0 };

  const share = first.titleSeconds / (first.titleSeconds + first.followUpSeconds);
  const titleSeconds = Math.max(1, Math.round(seconds * share));
  return { title: title, followUp: followUp, titleSeconds: titleSeconds, followUpSeconds: Math.max(1, seconds - titleSeconds) };
}

export const demoScreens = {
  announcement: {
    name: 'Announcement',
    async run(context) {
      const takeover = await import('./takeover.js');
      const config = demoAnnouncement(context.getContent(), context.seconds);
      await takeover.runAnnouncement(config, context.getContent, context.cancelled);
    },
  },

  // The bouncing logo, whatever the time and whatever Night style says
  'night-mode': {
    name: 'Night mode',
    async run() {
      const night = await import('./night-screen.js');
      night.showNightNow('bounce');
      return night.endNightNow;
    },
  },
};
