// Presentation mode: the plain functions. They know nothing about the page, so
// a node test can run them. The code that draws the screen asks them what to
// show, and does the showing.
//
// How a talk goes (docs/presentations.md):
//
//   idle -> title -> presenting -> thanks -> idle
//             |
//             +-- no key for noShowMinutes (constants.js) -> skipped -> idle
//
//   idle        nothing shows. A scheduled talk is due from its start until its end,
//               and waits while an alert or an announcement has the screen.
//   title       the card with the speaker, the subteam and the title. The first
//               forward key or left click starts the talk. The wait for it runs from
//               the moment the card appeared, and the card is a copy of the talk, so
//               an edit in Studio does not change it. On the card that says the slides
//               are not ready, any click ends the talk at once.
//   presenting  one slide at a time. The talk ends at its start plus its minutes
//               plus graceMinutes (constants.js), whatever slide it is on.
//   thanks      the card after the last slide, for a few seconds.
//   skipped     the talk will not run. It lasts one look, then it is idle.
//
// Switching Run presentations off ends whatever is on the screen at once.
//
// The screen keeps one state and calls, in this order:
//   once a second  state = nextState(state, { now, talks, settings, skipped, announcing, slides })
//   on a key       state = pressKey(state, event.key, new Date())
//   on a click     state = pressMouse(state, mouseButton(event.button), new Date())
//   after each     rememberEnded(storage, skipped, state), so a talk that is skipped or over
//                  does not start again
// It holds the screen (frame.pause) for as long as holdsScreen(state) is true.
//
// A state is a plain object with a name and, except for idle, the talk. Times in a
// state are milliseconds. The rest of this file takes and gives Dates.

export {
  states, thanksSeconds, notReadySeconds, chipSeconds, preloadAhead, keyActions, keyAction, clickActions,
  doubleClickMs, mouseButton, clickAction, talkEnd, skipKey,
} from './presentation-input.js';
export {
  canRun, dueTalk, slidePages, slidesFolder, slideAddress, idleState, holdsScreen, pictureOf, cardLines, nextState,
  escapeTwice, pressKey, secondOfDoubleClick, pressMouse, restartsRotation, blocksContextMenu, chipShown,
  slideNumberText, progressOf, preloadIndexes, skippedStorageKey, readSkipped, rememberEnded,
} from './presentation-state.js';
