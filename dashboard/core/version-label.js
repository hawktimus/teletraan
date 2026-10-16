// The text for a build wherever one is shown: "v14 · a1b2c3d". The number and the short hash come from
// dashboard/build.js, which the control service writes for every release. Either part may be missing: a laptop with
// no build.js has neither, and a copy made without git has no hash.

export function versionLabel(version, commit) {
  const number = Number(version);
  const text = Number.isInteger(number) && number > 0 ? 'v' + number : '';
  const hash = String(commit === undefined || commit === null ? '' : commit).trim().toLowerCase();
  const short = /^[0-9a-f]{4,40}$/.test(hash) ? hash.slice(0, 7) : '';
  return [text, short].filter(Boolean).join(' · ');
}
