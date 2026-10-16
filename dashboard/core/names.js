// The words for the same thing, old word to new word. New code, class names, ids and Studio titles use the
// new word. Stored values, field names and document types keep the old word so nothing saved is lost.
//
//   screen, pass, look rotation   view     (documents screen*, setting screenSchedule, data-screen)
//   style, look                   theme    (setting style, data-style, styles/<id>/)
//   Minimal (as a style)          bar layout in the Original theme
//   mondayStyle                   Monday theme of a view
//
// The stored names stay: the documents of type screen, the settings style, look, screenSchedule and
// lookSwap, and the data-style and data-look attributes. themeIds in config.js are the theme ids.

export const words = {
  screen: 'view',
  pass: 'view',
  style: 'theme',
  look: 'theme',
};

// The new word for an old one, or the word itself when it is not in the map
export function wordFor(word) {
  return Object.prototype.hasOwnProperty.call(words, word) ? words[word] : word;
}
