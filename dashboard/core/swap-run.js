// Plays the swap (docs/layouts.md, "The swap"). Deciding what each piece does and when is in
// core/swap-plan.js, which has no page in it. This file finds the pieces on the page, measures them,
// hands them to the plan and plays the answer with element.animate(), so the moves are the ones the
// plan gives and nothing else: transform and opacity.
//
// A swap replaces the page change of the large panel (core/areas.js, setSwapOffer) when
//   - the Screens have held a new style or team, or gone into the Monday cards or out of them (queueSwap, called by
//     core/screens-run.js), or
//   - a look is waiting to go on, which is a preview, a team of Alternate mode or a theme from the Look page, or
//   - the page on screen or the page to come is a Monday card, in full motion, which covers going from one
//     card to the next, entering the Monday block and leaving it.
// It never starts while an alert, an announcement, a talk, the demo, the night screen or a hidden
// transition has the screen. The page change is then the usual one, and a look that was held goes on in it.
// Every time of a swap is stretched or shortened by the length the Screen it goes to gives (swapScale), on top of the
// Speed setting.
//
// How it goes in full motion, with the times of swap-plan.js:
//   1. The frames show as their pieces (#world gets data-pieces, which frame.css reads). The pieces
//      pull apart, the content fades out and the logo is copied: the copy stays where the logo was.
//   2. At the moment the pieces are out, one step does it all: the look goes on (the style, the team and
//      the layout), the large panel's page is swapped, and the other areas swap theirs, which they waited to
//      do at the gate of core/areas.js. The pieces are measured again, in the new look, and each takes
//      over from an old piece.
//   3. The pieces travel to their places, the content fades in, and the copy of the logo travels to the new place
//      of the logo with them. A team or a style that changes makes it flutter for a moment as a hawk. A Monday card on
//      either side only carries it, and never makes it a bird (hawkMotionFor in core/swap-plan.js). Then the copy and
//      the logo cross-fade.
// In calm motion the whole stage fades out, the look goes on, and the stage fades in. With motion off the
// look goes on at once. Neither has pieces. A change of layout is the same step in every case: the page does not
// reload for it (core/layout-apply.js, changeLayoutNow).

export { queueSwap, swapRunning, startSwaps } from './swap-run-play.js';
