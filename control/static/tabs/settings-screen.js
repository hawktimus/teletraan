// The Screen section of Settings: how the picture sits in the window of the TV computer. One button reads the window the
// wall reports and the screen the computer reports, sets the fit that fills it and publishes it. Below it the same four
// settings by hand, with a preset box, a little picture and a Reset to Auto. The Studio stays the source of truth: the
// settings are the Screen fit fields of Dashboard Settings (Advanced), saved to the draft and published through the same
// routes as All settings. The write key is never in the browser.

import { api, showResult, useStyles } from './api.js';
import { esc } from './render.js';
import { autoSettings, displayWords, fillPlan, fitWords, presets, previewSvg, readManual, screenWords } from './screen-plan.js';

const settingsId = 'dashboardSettings';

export const publishQuestion = 'Publish puts every waiting change of Dashboard Settings on the wall, including edits made in the Studio. The screen changes within a few seconds. Publish now?';

// The settings stored in a document, with the starting value for any that is missing
export function storedFit(document) {
  const source = document || {};
  const out = Object.assign({}, autoSettings);
  if (Object.keys(fitWords).includes(source.screenFit)) out.screenFit = source.screenFit;
  ['screenScale', 'screenOffsetX', 'screenOffsetY'].forEach(name => { if (typeof source[name] === 'number') out[name] = source[name]; });
  return out;
}

export function screenHtml() {
  const presetOptions = presets.map(preset => '<option value="' + esc(preset.id) + '">' + esc(preset.title) + '</option>').join('');
  const fitOptions = Object.keys(fitWords).map(key => '<option value="' + esc(key) + '">' + esc(fitWords[key]) + '</option>').join('');
  return '<div class="tab screen-section" data-root>' +
    '<section class="card"><h2>Fit the dashboard to the screen</h2>' +
    '<p class="note">Use this when the dashboard looks too small, has bars around it or is cut off. It reads the window of the wall and sets the fit so the picture fills it.</p>' +
    '<p data-wall>Reading the wall.</p><p class="note" data-display></p>' +
    '<div class="buttons"><button type="button" class="act" data-fit-now>Fit the dashboard to the screen</button></div>' +
    '</section>' +
    '<section class="card"><h2>By hand</h2>' +
    '<label class="pick"><span>Preset</span><select data-preset>' + presetOptions + '</select></label><p class="note" data-preset-says></p>' +
    '<label class="pick"><span>Fit</span><select data-fit>' + fitOptions + '</select></label>' +
    '<label class="pick"><span>Size (percent, 50 to 200)</span><input type="number" inputmode="numeric" min="50" max="200" step="1" data-scale></label>' +
    '<label class="pick"><span>Move right (pixels, -400 to 400)</span><input type="number" inputmode="numeric" min="-400" max="400" step="1" data-offset-x></label>' +
    '<label class="pick"><span>Move down (pixels, -400 to 400)</span><input type="number" inputmode="numeric" min="-400" max="400" step="1" data-offset-y></label>' +
    '<div data-picture></div>' +
    '<div class="buttons"><button type="button" class="act" data-apply>Save and publish</button>' +
    '<button type="button" class="act quiet" data-reset>Reset to Auto</button></div>' +
    '<p class="note">The Studio shows the same values in Dashboard Settings, Advanced, Screen fit. On a 4K TV that shows the dashboard small, put KIOSK_RESOLUTION=3840x2160 in Keys and restart the screen.</p>' +
    '</section></div>';
}

export async function mountScreen(container) {
  useStyles();
  container.innerHTML = screenHtml();
  const root = container.querySelector('[data-root]');
  const field = name => root.querySelector(name);
  let doc = null;
  let report = null;

  function fill(settings) {
    field('[data-fit]').value = settings.screenFit;
    field('[data-scale]').value = settings.screenScale;
    field('[data-offset-x]').value = settings.screenOffsetX;
    field('[data-offset-y]').value = settings.screenOffsetY;
    draw();
  }

  function manual() {
    return readManual({ fit: field('[data-fit]').value, scale: field('[data-scale]').value, offsetX: field('[data-offset-x]').value, offsetY: field('[data-offset-y]').value });
  }

  // The picture follows every key press, from the same arithmetic as the wall
  function draw() {
    const now = manual();
    const size = report ? { width: report.windowWidth, height: report.windowHeight } : null;
    field('[data-picture]').innerHTML = now.settings ? previewSvg(size, now.settings) : '<p class="warn">' + esc(now.problem) + '</p>';
    const preset = presets.filter(item => item.id === field('[data-preset]').value)[0];
    field('[data-preset-says]').textContent = preset ? preset.says : '';
  }

  async function readWall() {
    const answer = await api('GET', '/now');
    report = answer.ok && answer.data && answer.data.report && !answer.data.quiet ? answer.data.report.screen : null;
    field('[data-wall]').textContent = report ? 'The wall says: ' + screenWords(report) + '.' : 'The wall has not reported its window yet.';
    return report;
  }

  async function readDisplay() {
    const answer = await api('POST', '/helper/display-info', {});
    field('[data-display]').textContent = answer.ok ? displayWords(answer.data.output).text : 'The screen of the Teletraan computer could not be read: ' + answer.error;
  }

  async function readDocument() {
    const answer = await api('GET', '/doc/' + settingsId);
    if (!answer.ok) return answer.error;
    doc = answer.data;
    return '';
  }

  // Saves the four values to the draft and publishes it, after the person says yes
  async function saveAndPublish(button, settings, words) {
    const problem = await readDocument();
    if (problem) return showResult(button, 'bad', problem);
    if (!doc.canWrite) return showResult(button, 'bad', 'SANITY_WRITE_TOKEN is not set on the Teletraan computer. Add it in Keys.');
    if (!window.confirm(words + '\n\n' + publishQuestion)) return showResult(button, 'wait', 'Nothing was changed.');

    showResult(button, 'working', 'Saving to the draft.');
    const saved = await api('POST', '/doc/' + settingsId + '/save', { set: settings, baseRev: doc.rev });
    if (!saved.ok && saved.data && saved.data.conflict) {
      if (!window.confirm('The Studio has a newer copy of Dashboard Settings. Replace the screen fit values in it with these?')) return showResult(button, 'wait', 'Nothing was saved.');
      const again = await api('POST', '/doc/' + settingsId + '/save', { set: settings, baseRev: doc.rev, force: true });
      if (!again.ok) return showResult(button, 'bad', again.error);
      saved.ok = true;
      saved.data = again.data;
    }
    if (!saved.ok) return showResult(button, 'bad', saved.error);

    showResult(button, 'working', 'Publishing.');
    const published = await api('POST', '/doc/' + settingsId + '/publish', { confirm: true, rev: saved.data.rev });
    if (!published.ok) return showResult(button, 'bad', published.error);

    showResult(button, 'working', 'Published. Waiting for the wall to report the new fit.');
    return waitForWall(button, settings);
  }

  // The wall reports every 10 seconds. A report whose fit matches the published values proves the screen took them.
  async function waitForWall(button, settings) {
    for (let tries = 0; tries < 12; tries += 1) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      const seen = await readWall();
      if (seen && seen.fit === settings.screenFit && seen.percent === settings.screenScale && seen.offsetX === settings.screenOffsetX && seen.offsetY === settings.screenOffsetY) {
        const filled = Math.round((100 - seen.unusedPercent) * 10) / 10;
        showResult(button, 'done', 'The dashboard now fills ' + filled + ' percent of the screen.');
        return;
      }
    }
    showResult(button, 'wait', 'Published, but the wall has not reported the new fit yet. Look again in a minute.');
  }

  field('[data-fit-now]').addEventListener('click', async event => {
    const button = event.currentTarget;
    await readWall();
    const plan = fillPlan(report);
    if (plan.problem) return showResult(button, 'bad', plan.problem);
    fill(plan.settings);
    await saveAndPublish(button, plan.settings, plan.words);
  });

  field('[data-preset]').addEventListener('change', () => {
    const preset = presets.filter(item => item.id === field('[data-preset]').value)[0];
    if (preset) fill(preset.set);
  });
  root.addEventListener('input', event => { if (event.target.closest('[data-fit], [data-scale], [data-offset-x], [data-offset-y]')) draw(); });
  field('[data-apply]').addEventListener('click', event => {
    const button = event.currentTarget;
    const now = manual();
    if (!now.settings) return showResult(button, 'bad', now.problem);
    return saveAndPublish(button, now.settings, 'The screen will use fit ' + fitWords[now.settings.screenFit].toLowerCase() + ', size ' + now.settings.screenScale + ' percent, moved ' + now.settings.screenOffsetX + ' and ' + now.settings.screenOffsetY + ' pixels.');
  });
  field('[data-reset]').addEventListener('click', event => {
    fill(autoSettings);
    field('[data-preset]').value = 'auto';
    return saveAndPublish(event.currentTarget, Object.assign({}, autoSettings), 'The screen goes back to Auto, 100 percent, with no move.');
  });

  await Promise.all([readWall(), readDisplay(), readDocument()]);
  fill(storedFit(doc && doc.document));
  field('[data-preset]').value = 'auto';
  draw();
}
