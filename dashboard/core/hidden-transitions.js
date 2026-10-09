// The hidden transitions: rare surprises that replace a normal page change of
// the large panel. One entry for each, so adding another is one entry here, the
// same id and name in studio/hidden-transitions.js, and a chance field in
// Dashboard Settings (docs/hidden-transitions.md).
//
// The key is the id the Studio stores in hiddenRequest.kind. name is the words
// the editors see on the Play button. chanceField is the setting that holds the
// percent of page changes that play it. run(scene) is the whole show, one
// line for each step, and the screen waits for each step before the next.
//
// scene is made by core/hidden-run.js. It has these steps:
//   scene.glitch(seconds, tint)       glitches over the screen. tint is 'red' (the default): the old
//                                     television jumps and a flat red layer flickers. Or 'blue': a
//                                     far rougher glitch with torn pieces of screen and flat blue
//                                     layers that flicker, one of them almost solid for a moment
//   scene.breakApart(backdrop)        the banner, the countdown, the two panels and the ticker
//                                     fly apart in 3D. backdrop is what shows behind them:
//                                     'black' or 'blue' (a deep blue)
//   scene.wait(seconds)               nothing moves
//   scene.pictureIn(set, seconds)     the next picture of the set fades in over these seconds
//   scene.pictureCut(set, seconds)    the next picture of the set shows at once, with no fade,
//                                     and stays for these seconds
//   scene.pictureOut(seconds)         the picture fades out over these seconds
//   scene.rebuild()                   the screen comes back whole, showing the next screen, and its
//                                     frames fall into a pile, a cube rises out of it and the frames
//                                     fly back to their places. At most 5 seconds, and then the
//                                     content comes in (docs/hidden-transitions.md)
// A set is a name in core/hidden-pictures.js, 'redEyes' or 'blueScreen'. Each play
// takes the picture after the one used last, so the two pictures of a set take
// turns. A picture that did not load is skipped, and with none to show the step still
// takes its seconds, so the transition finishes and the screen comes back.
// A show must always end with rebuild(), or the screen would stay apart. The
// runner puts the screen back by itself if a show fails.
//
// This file imports nothing from the page, so the tests and check-schemas.mjs
// can read it. Seconds are at normal speed: the Speed setting stretches them.

export const hiddenTransitions = {
  // The screen glitches blue like a failing computer, the whole screen comes apart
  // over a deep blue, glitches once more and cuts to a blue error screen for 3
  // seconds, then comes back whole, falls into a pile and is put back by the cube
  desktop: {
    name: 'Desktop reveal',
    chanceField: 'desktopChance',
    async run(scene) {
      await scene.glitch(2, 'blue');
      await scene.breakApart('blue');
      await scene.glitch(1, 'blue');
      await scene.pictureCut('blueScreen', 3);
      await scene.rebuild();
    },
  },

  // Red glitches, everything breaks apart to black, a picture of two red eyes
  // fades in, stays for 2.5 seconds and fades out, and the screen comes back
  // whole, falls into a pile and is put back by the cube
  redEyes: {
    name: 'Red eyes',
    chanceField: 'redEyesChance',
    async run(scene) {
      await scene.glitch(1.5);
      await scene.breakApart('black');
      await scene.pictureIn('redEyes', 0.6);
      await scene.wait(2.5);
      await scene.pictureOut(0.6);
      await scene.rebuild();
    },
  },
};
