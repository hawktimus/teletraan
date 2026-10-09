// The three extras a seasonal pack can add to the screen besides its pictures: a
// ticker prefix (shown before each ticker line), a banner line (one line under
// the date) and a corner art (line art in the cut corners, core/corner-art.js).
// They are typed on a rule of the Look schedule, and a pack file may carry a
// value of its own in `defaults` for a rule that leaves the field empty. A value
// typed on the rule wins. theme.js reads the rules (ruleExtras, packExtras) and
// core/season.js reads the pack files. docs/seasonal-packs.md explains all three.
//
// Everything here is plain functions with no page in sight, so the tests can run them.

import { cornerArtChoices, cornerArtNone } from './corner-art.js';

// How many characters Studio allows in these two fields (studio/schemas/theme.js)
export const tickerPrefixLimit = 12;
export const bannerLineLimit = 40;

// The most characters on one ticker line. The Studio asks for 52 at the most in a tip,
// a news line or a reminder (studio/schemas/tipOrNews.js), and that is what fits.
export const tickerLineLimit = 52;

const defaultKeys = ['tickerPrefix', 'bannerLine', 'cornerArt'];

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

// Text on one line: spaces at the ends and doubled spaces go, and what is past the
// limit is cut off. Anything that is not text is empty.
export function tidyText(raw, limit) {
  return typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim().slice(0, limit).trim() : '';
}

// A corner art id a rule or a pack may name, or '' for anything else
export function tidyArt(raw) {
  return cornerArtChoices.indexOf(raw) !== -1 ? raw : '';
}

// What is wrong with the defaults of a pack, in plain words. An empty list means they can be used.
export function defaultsProblems(defaults) {
  if (!isRecord(defaults)) return ['should be { cornerArt, tickerPrefix, bannerLine }'];

  const problems = [];
  Object.keys(defaults).filter(key => defaultKeys.indexOf(key) === -1)
    .forEach(key => problems.push('has "' + key + '", which defaults do not use. The names are ' + defaultKeys.join(', ')));

  if (defaults.cornerArt !== undefined && tidyArt(defaults.cornerArt) === '') {
    problems.push('has the corner art "' + defaults.cornerArt + '", which is not one of: ' + cornerArtChoices.join(', '));
  }
  [['tickerPrefix', tickerPrefixLimit], ['bannerLine', bannerLineLimit]].forEach(item => {
    const value = defaults[item[0]];
    if (value !== undefined && (typeof value !== 'string' || value.length > item[1])) problems.push(item[0] + ' should be text of ' + item[1] + ' characters or fewer');
  });
  return problems;
}

// The extras of one pack: the value typed on its rule where there is one, else the
// pack's own, else nothing (corner art 'none'). typed and defaults may be missing.
export function mergeExtras(typed, defaults) {
  const own = isRecord(typed) ? typed : {};
  const pack = isRecord(defaults) ? defaults : {};

  return {
    tickerPrefix: tidyText(own.tickerPrefix, tickerPrefixLimit) || tidyText(pack.tickerPrefix, tickerPrefixLimit),
    bannerLine: tidyText(own.bannerLine, bannerLineLimit) || tidyText(pack.bannerLine, bannerLineLimit),
    cornerArt: tidyArt(own.cornerArt) || tidyArt(pack.cornerArt) || cornerArtNone,
  };
}

// The defaults of the packs that have been loaded, by overlay id. core/season.js adds
// a pack's when it reads the pack file, and the panels ask for them through theme.js.
const known = {};

export function rememberDefaults(overlayId, defaults) {
  known[overlayId] = isRecord(defaults) && defaultsProblems(defaults).length === 0 ? defaults : {};
}

export function defaultsOf(overlayId) {
  return known[overlayId] || {};
}

// The prefix to show before a ticker line, or '' for none. The prefix is part of the
// line, so when prefix, space and text together are more than tickerLineLimit
// characters the prefix is dropped and the text is shown as it is. The text is never
// cut for the prefix.
export function prefixFor(prefix, text) {
  const start = tidyText(prefix, tickerPrefixLimit);
  return start !== '' && (start + ' ' + text).length <= tickerLineLimit ? start : '';
}
