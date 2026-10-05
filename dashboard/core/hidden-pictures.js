// The four pictures of the hidden transitions, and which one plays next. These are
// plain functions with nothing from the page in them, so tools/test-effects.mjs can
// run them. core/hidden-run.js loads the pictures and puts them on the screen, and
// core/hidden-transitions.js says when.
//
// The pictures are in dashboard/assets/hidden/, in two sets:
//   redEyes      two dark pictures with two glowing red eyes (the red eyes transition)
//   blueScreen   two blue error screens (the desktop reveal)
//
// A set alternates. Each play shows the picture after the one shown last, and
// the first again at the end of the list. The one shown last is kept in
// localStorage, so a Mini that restarts carries on with the other picture and
// does not start from the first every time. If the storage cannot be used the
// screen still alternates, from its own memory, until the page is reloaded.
//
// To swap a picture for another, give the new file the same name and the same
// kind of size (docs/hidden-transitions.md). To add one, put the file in the
// folder and add a line to its set below.
//
//   file     the name of the file in the folder
//   width    its size in pixels. Nothing draws from these two: they say what the
//   height   file is, and tools/test-effects.mjs checks that they are right
//   fit      how it fills the 1920 x 1080 screen without stretching:
//              cover    fills the whole screen, and cuts off at most a sliver
//                       when the proportions are a little different
//              contain  shows the whole picture as big as it can be, and fills
//                       the rest of the screen with fill
//   fill     the picture's own background colour, written as the picture has it
//   crisp    true keeps hard pixel edges when a small picture is enlarged,
//            which is right for the old text-mode screen and not for a smooth one

export const pictureFolder = 'assets/hidden/';

export const hiddenPictures = {
  redEyes: [
    { file: 'red-eyes-1.webp', width: 1672, height: 941, fit: 'cover', fill: '#000000', crisp: false },
    { file: 'red-eyes-2.webp', width: 1920, height: 1080, fit: 'cover', fill: '#000000', crisp: false },
  ],
  blueScreen: [
    { file: 'blue-screen-1.png', width: 700, height: 394, fit: 'cover', fill: '#0177d7', crisp: false },
    { file: 'blue-screen-2.png', width: 640, height: 400, fit: 'contain', fill: '#0000aa', crisp: true },
  ],
};

// The start of the localStorage name for a set: the name of the set follows it
export const lastPictureKey = 'teletraan-hidden-picture-';

// Every picture of every set, as { set, file, ... }, in the order of the lists above
export function allPictures() {
  const pictures = [];
  Object.keys(hiddenPictures).forEach(set => {
    hiddenPictures[set].forEach(picture => pictures.push(Object.assign({ set: set }, picture)));
  });
  return pictures;
}

// The address of a picture, as the page asks for it (from the folder of index.html)
export function pictureAddress(picture) {
  return pictureFolder + picture.file;
}

// The picture that comes after the one with this file name, and the first again
// after the last. A name that is not in the list (nothing was shown yet, or the
// picture was swapped for another name) gives the first.
export function pictureAfter(list, lastFile) {
  const at = list.findIndex(picture => picture.file === lastFile);
  return list[(at + 1) % list.length];
}

// What localStorage kept as the last picture of a set, or '' when there is
// nothing, or the storage cannot be read
function readLastFile(storage, set) {
  try {
    return storage.getItem(lastPictureKey + set) || '';
  } catch (error) {
    return '';
  }
}

function rememberLastFile(storage, set, file) {
  try {
    storage.setItem(lastPictureKey + set, file);
  } catch (error) {
    // The chooser's own memory carries on, so the next play still alternates
  }
}

// Chooses the picture for each play. storage is localStorage, or null when the
// browser has none.
//   next(set, canUse)   the next picture of the set, as { file, ... }, or null
//                       when there is none to show. canUse(file) says whether a
//                       picture can be shown now: one that did not load cannot,
//                       and the one after it is tried. The picture that is
//                       returned counts as shown, so it is remembered.
export function makePictureChooser(storage) {
  const shownBefore = {}; // set -> file, what this run showed last. It wins over the storage, which may not be writable

  return {
    next(set, canUse) {
      const list = hiddenPictures[set];
      if (!list || list.length === 0) return null;

      let last = shownBefore[set] !== undefined ? shownBefore[set] : readLastFile(storage, set);
      for (let tried = 0; tried < list.length; tried++) {
        const picture = pictureAfter(list, last);
        if (canUse(picture.file)) {
          shownBefore[set] = picture.file;
          rememberLastFile(storage, set, picture.file);
          return picture;
        }
        last = picture.file;
      }
      return null;
    },
  };
}
