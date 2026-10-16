// The swap: the one move the screen makes for every change of style, team or Monday panel, and for
// entering or leaving the Monday block (docs/layouts.md, "The swap"). These are plain functions with
// no page in them, so tests/swap.test.mjs can run them. core/swap-run.js measures the pieces on the
// page, hands them to the functions here and plays the answer.
//
// The pieces pull apart, the look goes on while they are apart, and they re-form in the new look. It is
// one gesture: a piece leaves its place slowly, gathers speed, comes to rest at the far end of the pull,
// and from rest leaves for its new place the same way. The pull and the travel have the same kind of
// easing, slow at the start and soft at the end, so nothing jumps at the moment between them.
// Every time is in milliseconds at normal speed, from the start of the swap:
//
//      0       the page content starts to fade out (250). Each piece starts after a delay of its own,
//              0 to 180, and moves out from the middle of the screen by 18 percent of its distance
//              from it, tipping back and turning in the plane. No piece leaves the screen
//    450       every piece is out and at rest. The look goes on (style, team, layout, the next pages) and
//              the pieces of the new look take over from the old ones, at the pose they had. For
//              a moment around it the pieces are a little fainter, so that a new shape or color
//              does not jump (swapReform)
//    450 to 1250   each piece, after a delay of its own, 0 to 150, travels to its place in the new look
//              and untips, and is home by 1250. The metal, the neon color and the corners are the new
//              look's from the first moment of this part
//   1000 to 1250   the page content fades in, over the last of the travel
//
// The icon of the logo goes with the pieces, from its old place to the new one, and is a bird for a moment only when a
// team or a style changes (hawkMotionFor and planHawk below).
//
// A piece is { id, kind, region, index, left, top, width, height, parent } on the 1920 x 1080 screen.
// kind is 'plate', 'box' or 'bolt'. region is the id of the part of the screen it is in and index its
// number there, which is how an old piece and a new one are matched.

export {
  swapTimes, swapReform, swapShape, standardEase, standardEaseText, pullEase, pullEaseText, reformEase,
  reformEaseText, restPose, bezierAt, outPose, planPull, pullProgress, poseAt,
} from './swap-plan-pull.js';
export {
  matchPieces, destinationsOf, planReform, reformProgress, reformPoseAt, reformEnd, poseTransform, poseFrames,
} from './swap-plan-reform.js';
export {
  hawkShape, hawkMotionFor, planHawk, hawkTransform, birdFades, flapFrames, contentFade, swapMs,
} from './swap-plan-hawk.js';
