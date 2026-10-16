// The hidden transitions: rare surprises that replace a normal page change of
// the large panel. One entry for each, so adding another is one entry here, the
// same id and name in studio/inputs/hidden-transitions.js, and an hours field and a
// chance field in Dashboard Settings (docs/hidden-transitions.md).
//
// The key is the id the Studio stores in hiddenRequest.kind. name is the words
// the editors see on the Play button. hoursField is the setting that holds how
// many hours of screen time it comes about once in. chanceField is the older
// setting, a percent of page changes, that a page saved before the hours
// existed still uses. run(scene) is the whole show, one line for each step,
// and the screen waits for each step before the next.
//
// scene is made by core/hidden-run.js. It has these steps:
//   scene.glitch(seconds, tint)       glitches over the screen. tint is 'red' (the default): the old
//                                     television jumps and a flat red layer flickers. Or 'blue': a
//                                     far rougher glitch with torn pieces of screen and flat blue
//                                     layers that flicker, one of them almost solid for a moment
//   scene.collapse(backdrop)          every piece of metal on the screen falls into a loose pile along
//                                     the bottom edge, with a bounce, and stays there. The content fades
//                                     away and the next pages are swapped, unseen. backdrop is what shows
//                                     behind: 'black' or 'blue' (a deep blue)
//   scene.wait(seconds)               nothing moves
//   scene.pictureIn(set, seconds)     the next picture of the set fades in over these seconds
//   scene.pictureCut(set, seconds)    the next picture of the set shows at once, with no fade,
//                                     and stays for these seconds
//   scene.pictureOut(seconds)         the picture fades out over these seconds
//   scene.rebuild()                   the screen comes back: a cube rises, turns, pulses and shrinks to a
//                                     point (2.6 seconds), the pieces rise from the pile to their places
//                                     and the content fades in (1.2 seconds, docs/hidden-transitions.md)
// A set is a name in core/hidden-pictures.js, 'redEyes' or 'blueScreen'. Each play
// takes the picture after the one used last, so the two pictures of a set take
// turns. A picture that did not load is skipped, and with none to show the step still
// takes its seconds, so the transition finishes and the screen comes back.
// A show must always end with rebuild(), or the screen would stay in the pile. The
// runner puts the screen back by itself if a show fails.
//
// This file imports nothing from the page, so the tests and tests/schemas.test.mjs
// can read it. Seconds are at normal speed: the Speed setting stretches them.

export const hiddenTransitions = {
  // The screen glitches blue like a failing computer, its frames collapse into a pile
  // over a deep blue, glitch once more and cut to a blue error screen for 3
  // seconds, and then the cube puts them back
  desktop: {
    name: 'Desktop reveal',
    hoursField: 'desktopEveryHours',
    chanceField: 'desktopChance',
    async run(scene) {
      await scene.glitch(2, 'blue');
      await scene.collapse('blue');
      await scene.glitch(1, 'blue');
      await scene.pictureCut('blueScreen', 3);
      await scene.rebuild();
    },
  },

  // Red glitches, the frames collapse into a pile over black, a picture of two red eyes
  // fades in, stays for 2.5 seconds and fades out, and then the cube puts the frames back
  redEyes: {
    name: 'Red eyes',
    hoursField: 'redEyesEveryHours',
    chanceField: 'redEyesChance',
    async run(scene) {
      await scene.glitch(1.5);
      await scene.collapse('black');
      await scene.pictureIn('redEyes', 0.6);
      await scene.wait(2.5);
      await scene.pictureOut(0.6);
      await scene.rebuild();
    },
  },
};
