// The releases folder: /opt/teletraan/releases/<n>/ holds a full copy of the repository for each version, and
// /opt/teletraan/current is a link to the live one. The counter in releases/COUNTER only goes up, so a number is
// never used twice. The last 5 releases are kept.

import fs from 'node:fs';
import path from 'node:path';

const keepReleases = 5;

// A name that is a release number, not a release being built
function isNumber(name) {
  return /^[1-9][0-9]{0,8}$/.test(name);
}

export function createReleases(releasesDir) {
  const root = path.dirname(releasesDir);
  const currentLink = path.join(root, 'current');
  const counterFile = path.join(releasesDir, 'COUNTER');

  function numbers() {
    if (!fs.existsSync(releasesDir)) return [];
    return fs.readdirSync(releasesDir).filter(isNumber).map(Number).sort((a, b) => b - a);
  }

  function readCounter() {
    let counter = 0;
    try {
      counter = parseInt(fs.readFileSync(counterFile, 'utf8').trim(), 10) || 0;
    } catch (error) {
      counter = 0;
    }
    // A folder above the counter means the counter was lost or lowered by hand: believe the folder
    const top = numbers()[0] || 0;
    return Math.max(counter, top);
  }

  // Takes the next number and writes it down before anything is built, so a failed install still uses it up
  function takeNumber() {
    const next = readCounter() + 1;
    fs.mkdirSync(releasesDir, { recursive: true });
    fs.writeFileSync(counterFile + '.new', next + '\n');
    fs.renameSync(counterFile + '.new', counterFile);
    return next;
  }

  function readRelease(n) {
    try {
      const info = JSON.parse(fs.readFileSync(path.join(releasesDir, String(n), 'RELEASE.json'), 'utf8'));
      return Object.assign({}, info, { version: Number(info.version) || n });
    } catch (error) {
      return { version: n, commit: '', date: '', from: '', note: '', treeHash: '' };
    }
  }

  // The number the current link points at, or 0
  function currentNumber() {
    try {
      const target = fs.readlinkSync(currentLink);
      const name = path.basename(target);
      return isNumber(name) ? Number(name) : 0;
    } catch (error) {
      return 0;
    }
  }

  // The kept releases, newest first, each with its RELEASE.json and whether it is the live one
  function list() {
    const live = currentNumber();
    return numbers().map(n => Object.assign(readRelease(n), { current: n === live, legacy: isLegacy(n) }));
  }

  // A tree from before the folder move (deploy/ or mini/) cannot run under the new units, so it is kept as a record only
  function isLegacy(n) {
    const folder = path.join(releasesDir, String(n));
    return fs.existsSync(path.join(folder, 'deploy', 'scripts')) || fs.existsSync(path.join(folder, 'mini', 'scripts'));
  }

  // Points current at release n. The link is made beside the old one and renamed over it, so there is no moment without one.
  function flip(n) {
    if (!fs.existsSync(path.join(releasesDir, String(n)))) throw new Error('There is no release ' + n + '.');
    const temporary = currentLink + '.new';
    fs.rmSync(temporary, { force: true });
    fs.symlinkSync(path.join('releases', String(n)), temporary);
    fs.renameSync(temporary, currentLink);
    linkTopLevel();
  }

  // The scripts, units and compose file name /opt/teletraan/computer, /opt/teletraan/dashboard and so on. These links
  // keep those names working: each one goes through current, so a flip moves them all.
  function linkTopLevel() {
    const live = path.join(currentLink);
    let names = [];
    try {
      names = fs.readdirSync(live, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name);
    } catch (error) {
      return;
    }
    for (const name of names) {
      if (name === 'releases' || name === 'current' || name.startsWith('.')) continue;
      const link = path.join(root, name);
      let kind = null;
      try {
        kind = fs.lstatSync(link);
      } catch (error) {
        kind = null;
      }
      if (kind && !kind.isSymbolicLink()) continue;
      if (kind) fs.rmSync(link, { force: true });
      fs.symlinkSync(path.join('current', name), link);
    }
    // The old name of the computer/ folder: a link left from before the rename points at nothing
    if (!names.includes('mini')) {
      try {
        if (fs.lstatSync(path.join(root, 'mini')).isSymbolicLink()) fs.rmSync(path.join(root, 'mini'), { force: true });
      } catch (error) {
        // no old link
      }
    }
  }

  // Rolls to release n. A release from before the move is refused with the same words as everything else.
  function activate(n) {
    if (!isNumber(String(n)) || !fs.existsSync(path.join(releasesDir, String(n)))) {
      const error = new Error('There is no release ' + n + '.');
      error.status = 404;
      throw error;
    }
    if (isLegacy(n)) {
      const error = new Error('This copy is older than round 6; update it.');
      error.status = 409;
      throw error;
    }
    flip(n);
    return readRelease(n);
  }

  // Removes the oldest releases beyond the last 5. The live one and the newest 5 are never removed.
  function prune(keep = keepReleases) {
    const live = currentNumber();
    const removed = [];
    numbers().slice(keep).forEach(n => {
      if (n === live) return;
      fs.rmSync(path.join(releasesDir, String(n)), { recursive: true, force: true });
      removed.push(n);
    });
    return removed;
  }

  return { root: root, currentLink: currentLink, numbers: numbers, readCounter: readCounter, takeNumber: takeNumber, readRelease: readRelease, currentNumber: currentNumber, list: list, flip: flip, linkTopLevel: linkTopLevel, activate: activate, prune: prune, isLegacy: isLegacy };
}

// The first 7 characters of a hash, or '' when it is not one
export function shortCommit(commit) {
  const text = String(commit || '').trim().toLowerCase();
  return /^[0-9a-f]{4,40}$/.test(text) ? text.slice(0, 7) : '';
}

// The build the page asks its files for: the number and the short hash, so a new release always has a new one
export function buildName(version, commit) {
  const short = shortCommit(commit);
  return short ? version + '-' + short : String(version);
}

// What dashboard/build.js holds for a release
export function buildJsText(info) {
  const short = shortCommit(info.commit);
  return 'export const build = ' + JSON.stringify(buildName(info.version, info.commit)) + ';\n' +
    'export const version = ' + Number(info.version) + ';\n' +
    'export const commit = ' + JSON.stringify(short) + ';\n' +
    'export const date = ' + JSON.stringify(String(info.date || '')) + ';\n';
}

// RELEASE.json and dashboard/build.js, each written in one step
export function writeReleaseFiles(dir, info) {
  const release = {
    version: info.version,
    commit: shortCommit(info.commit),
    date: info.date,
    from: info.from === 'git' || info.from === 'github' ? info.from : 'upload',
    note: String(info.note || ''),
    treeHash: info.treeHash || '',
  };
  fs.writeFileSync(path.join(dir, 'RELEASE.json'), JSON.stringify(release, null, 2) + '\n');
  fs.mkdirSync(path.join(dir, 'dashboard'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'dashboard', 'build.js.new'), buildJsText(release));
  fs.renameSync(path.join(dir, 'dashboard', 'build.js.new'), path.join(dir, 'dashboard', 'build.js'));
  return release;
}
