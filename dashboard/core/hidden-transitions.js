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
// scene is made by core/hidden-run.js. It has five steps:
//   scene.glitch(seconds)             red glitches over the screen: the old television jumps
//                                     and a flat red layer flickers
//   scene.breakApart(backdrop)        the banner, the countdown, the two panels and the ticker
//                                     fly apart in 3D. backdrop is what shows behind them:
//                                     'wallpaper' or 'black'
//   scene.wait(seconds)               nothing moves
//   scene.show(look, seconds)         changes what the backdrop shows and waits: 'eyes' (two
//                                     red eyes in the dark), 'face' (the face round them) or
//                                     'gone' (all of it fades out)
//   scene.rebuild()                   swaps the pages while the blocks are apart, and the blocks
//                                     fly back together showing the next screen
// A show must always end with rebuild(), or the screen would stay apart. The
// runner puts the screen back by itself if a show fails.
//
// This file imports nothing from the page, so the tests and check-schemas.mjs
// can read it. Seconds are at normal speed: the Speed setting stretches them.

export const hiddenTransitions = {
  // The whole screen comes apart like a transformer and shows a plain wallpaper
  // for a moment, then comes back together showing the next screen
  desktop: {
    name: 'Desktop reveal',
    chanceField: 'desktopChance',
    async run(scene) {
      await scene.breakApart('wallpaper');
      await scene.wait(1.5);
      await scene.rebuild();
    },
  },

  // Red glitches, everything breaks apart to black, two red eyes open in the
  // dark and a robot face shows round them for 2 seconds, then it all fades
  // and the screen comes back together
  redEyes: {
    name: 'Red eyes',
    chanceField: 'redEyesChance',
    async run(scene) {
      await scene.glitch(1.5);
      await scene.breakApart('black');
      await scene.show('eyes', 0.9);
      await scene.show('face', 2);
      await scene.show('gone', 0.6);
      await scene.rebuild();
    },
  },
};
