// The drawings the screen has of its own, for a picture that names one instead of an address.
// Each is line art in a 100 by 100 box with no fill. Only the star exists so far, as a placeholder.

const drawings = {
  star: ['M50 7L61.2 37.6L93.7 38.8L68.1 58.9L77 90.2L50 72L23 90.2L31.9 58.9L6.3 38.8L38.8 37.6Z'],
};

export function drawingIds() {
  return Object.keys(drawings);
}

// The inside of a symbol for a drawing, or '' for a name the screen does not have
export function drawingMarkup(id) {
  if (!drawings[id]) return '';
  return drawings[id].map(path => '<path d="' + path + '"/>').join('');
}
