// Addresses for pictures stored in Sanity, built by hand with no library.
//
// Sanity's image address takes a few settings after a question mark:
//   rect=left,top,width,height   the part of the original to keep, in pixels
//   w and h                      the size to send back
//   fit=crop                     cut to exactly w by h
//   auto=format                  send WebP or another small format when the
//                                browser can use it
// The screen asks for a photo at the size it is shown, so no more is
// downloaded than is drawn.

// What Sanity stores for a photo, cleaned. Gives back null when it cannot be
// used, and the panel then shows the silhouette. The crop is how much the
// editor cut from each side (0 to 1). The hotspot is the circle the editor
// put on the face. Its centre (x, y) is a fraction of the whole picture.
export function tidyPhoto(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const width = raw.width;
  const height = raw.height;
  if (typeof raw.url !== 'string' || !/^https:\/\//.test(raw.url)) return null;
  if (!isPositive(width) || !isPositive(height)) return null;

  return {
    url: raw.url,
    width: width,
    height: height,
    crop: tidyCrop(raw.crop),
    hotspot: tidyHotspot(raw.hotspot),
  };
}

function isPositive(number) {
  return typeof number === 'number' && isFinite(number) && number > 0;
}

function isFraction(number) {
  return typeof number === 'number' && isFinite(number) && number >= 0 && number <= 1;
}

const mostThatCanBeCut = 0.99;

// No crop, or a crop that makes no sense (an edge outside 0 to 1, or two
// edges that leave almost nothing), means the whole picture
function tidyCrop(crop) {
  const whole = { left: 0, right: 0, top: 0, bottom: 0 };
  if (!crop || typeof crop !== 'object') return whole;

  const edges = ['left', 'right', 'top', 'bottom'];
  if (!edges.every(edge => isFraction(crop[edge]))) return whole;
  if (crop.left + crop.right > mostThatCanBeCut || crop.top + crop.bottom > mostThatCanBeCut) return whole;

  return { left: crop.left, right: crop.right, top: crop.top, bottom: crop.bottom };
}

// No hotspot means the middle of the picture. Only its centre is used.
function tidyHotspot(hotspot) {
  const middle = { x: 0.5, y: 0.5 };
  if (!hotspot || typeof hotspot !== 'object') return middle;

  return isFraction(hotspot.x) && isFraction(hotspot.y) ? { x: hotspot.x, y: hotspot.y } : middle;
}

function keepBetween(number, smallest, largest) {
  return Math.min(largest, Math.max(smallest, number));
}

// The part of the original to send, in pixels: as big as the editor's crop
// allows, in the shape of the box it is shown in, and as close to centred on
// the hotspot as the crop lets it be. Cutting here, and not leaving it to
// Sanity, is what keeps a face in the picture.
function partToShow(photo, boxWidth, boxHeight) {
  const aspect = boxWidth / boxHeight;
  const cropLeft = Math.round(photo.crop.left * photo.width);
  const cropTop = Math.round(photo.crop.top * photo.height);
  const cropWidth = Math.round(photo.width - photo.crop.right * photo.width - cropLeft);
  const cropHeight = Math.round(photo.height - photo.crop.bottom * photo.height - cropTop);

  let width;
  let height;
  if (cropWidth / cropHeight > aspect) {
    // the crop is wider than the box, so it is cut at the sides
    height = cropHeight;
    width = Math.max(1, Math.min(cropWidth, Math.round(height * aspect)));
  } else {
    // the crop is taller than the box, so it is cut at the top and bottom
    width = cropWidth;
    height = Math.max(1, Math.min(cropHeight, Math.round(width / aspect)));
  }

  const centerX = photo.hotspot.x * photo.width;
  const centerY = photo.hotspot.y * photo.height;
  return {
    left: keepBetween(Math.round(centerX - width / 2), cropLeft, cropLeft + cropWidth - width),
    top: keepBetween(Math.round(centerY - height / 2), cropTop, cropTop + cropHeight - height),
    width: width,
    height: height,
  };
}

// The address to ask for, for a photo shown width by height pixels on a 1920 x
// 1080 screen. scale is how many screen pixels each of those is. It is 1 for
// the TV. Gives back an empty text when there is no usable photo.
export function photoUrl(photo, width, height, scale = 1) {
  const clean = tidyPhoto(photo);
  if (!clean || !isPositive(width) || !isPositive(height) || !isPositive(scale)) return '';

  const wide = Math.round(width * scale);
  const high = Math.round(height * scale);
  const part = partToShow(clean, wide, high);

  return clean.url +
    '?rect=' + [part.left, part.top, part.width, part.height].join(',') +
    '&w=' + wide +
    '&h=' + high +
    '&fit=crop' +
    '&auto=format';
}

// Starts downloading pictures nobody is looking at yet, so the browser has
// them ready when the page that shows them comes round
export function preloadImages(addresses) {
  addresses.filter(address => address).forEach(address => {
    const image = new Image();
    image.src = address;
  });
}
