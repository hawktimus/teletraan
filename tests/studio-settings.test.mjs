// Tests for the cleaned Dashboard Settings, the Competition page and the Kept data page (studio/schemas/dashboardSettings.js,
// studio/inputs/competition-view.js, kept-data-view.js): five tabs at most, plain sections with a one line description, every field the
// pages took over hidden but kept, nothing renamed, and the Competition page writing only the field it shows.
//
//   node tests/studio-settings.test.mjs

import assert from 'node:assert/strict';
import { openStudio, nodesWhere, wordsIn, fakeClient } from './helpers/studio-world.mjs';

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

const studio = await openStudio();
const settings = (await studio.load('schemas/dashboardSettings.js')).default;
const view = await studio.load('inputs/competition-view.js');
const parts = await studio.load('inputs/competition-parts.js');
const structure = await studio.load('structure.js');
const kept = await studio.load('inputs/kept-data-view.js');
const keptParts = await studio.load('inputs/kept-data-parts.js');

// The 102 names Dashboard Settings had before it was cleaned up. None may be renamed or removed.
const storedNames = ['miniStatus', 'team', 'lookNote', 'cycleNote', 'generalViewName', 'generalViewTitle', 'viewOrder', 'themeByWeekday', 'background', 'screenSchedule', 'dailyStyles', 'mondayStyle', 'teamOrder', 'lookSwap', 'style', 'motion', 'speed', 'frameMetal', 'glint', 'look', 'crt', 'previewRequest', 'nextLookRequest', 'competitionPreviewRequest', 'holdPanel', 'showView', 'previewTheme', 'pauseRotation', 'teamMode', 'alternateMinutes', 'logoAnimations', 'logoEntrance', 'logoSpin', 'logoSpinEvery', 'logoSpinDuration', 'logoHawk', 'logoHawkEvery', 'logoHawkDuration', 'nameTransform', 'nameEvery', 'nameDuration', 'pageChangeStyle', 'breakSeconds', 'frameFinish', 'silverChance', 'rotationRows', 'transitionSeconds', 'countdown', 'alert', 'pageSeconds', 'partsRequestUrl', 'rotation', 'doneDays', 'safetyDaysSince', 'photoOrder', 'photoSeconds', 'portraitScale', 'photoScale', 'photoFit', 'leadershipPortrait', 'rosterPortrait', 'portraitShape', 'portraitFrame', 'announcements', 'announceRequest', 'nightEnabled', 'nightStyle', 'nightStart', 'nightEnd', 'nightLogoWidth', 'nightSpeed', 'nightPreview', 'hiddenEnabled', 'desktopEveryHours', 'desktopChance', 'redEyesEveryHours', 'redEyesChance', 'hiddenRequest', 'presentationsEnabled', 'noShowMinutes', 'graceMinutes', 'presentationTestRequest', 'calendars', 'groupEventsByKind', 'mondayConnection', 'mondayTokenTest', 'mondayEveryMinutes', 'mondayTaskBoard', 'mondayMilestoneBoard', 'mondayShowOwners', 'mondayBoards', 'frcConnection', 'competitionMode', 'competitionTimeline', 'competitionLastSeason', 'competitionRank', 'competitionNextMatch', 'competitionResults', 'competitionAlliance', 'competitionDistrict', 'competitionForecast', 'competitionQualify', 'contentSource', 'showConnectionStatus'];

// What the old Screens runtime and the retired settings left behind. Each is hidden and says Not used any more.
const neverUsed = ['screenSchedule', 'dailyStyles', 'mondayStyle', 'teamOrder', 'lookSwap', 'style', 'teamMode', 'alternateMinutes', 'viewOrder', 'generalViewName', 'logoHawkEvery', 'nameEvery', 'photoSeconds', 'portraitScale', 'photoScale', 'nightStart', 'nightEnd', 'noShowMinutes', 'graceMinutes', 'contentSource'];

const fieldNamed = name => settings.fields.filter(field => field.name === name)[0];

test('no stored name of Dashboard Settings changed: all of them are still fields', () => {
  const now = settings.fields.map(field => field.name);
  assert.deepEqual(storedNames.filter(name => now.indexOf(name) === -1), []);
  assert.equal(settings.name, 'dashboardSettings');
  // The Motion setting added motionOnKiosk (hidden now, nothing reads it). The Photos page added the next two, the Scheduled reboot section the next six (seen in Advanced), the Clean up expired items section the next three, the Screen fit section the next four (both in Advanced), the Before and after cards the five switches after them and the FRC news section the last four. The rest are hidden here
  assert.deepEqual(now.filter(name => storedNames.indexOf(name) === -1), ['motionOnKiosk', 'photoSource', 'photoDriveFolder', 'rebootStatus', 'rebootEnabled', 'rebootTime', 'rebootDays', 'rebootSkipBusy', 'rebootWaitMinutes', 'cleanupEnabled', 'cleanupDeleteAfterDays', 'cleanupMode', 'screenFit', 'screenScale', 'screenOffsetX', 'screenOffsetY', 'competitionPreview', 'competitionMatches', 'competitionRecap', 'competitionTeamMetrics', 'competitionCompare', 'newsEnabled', 'newsCategories', 'newsInTicker', 'newsHiddenLinks'], 'no other field was added: ' + now.filter(name => storedNames.indexOf(name) === -1).join());
});

test('there are five tabs at most, in the order of the content map, and Timing opens first', () => {
  assert.ok(settings.groups.length <= 5);
  assert.deepEqual(settings.groups.map(group => group.title), ['Timing', 'Countdown', 'Monday', 'Calendars', 'Advanced']);
  assert.deepEqual(settings.groups.filter(group => group.default).map(group => group.name), ['screen']);
  settings.fields.forEach(field => assert.ok(settings.groups.some(group => group.name === field.group), field.name + ' is in a tab that exists (' + field.group + ')'));
});

test('what a coach can still see is short and has no field the pages took over', () => {
  const visible = settings.fields.filter(field => field.hidden !== true).map(field => field.name).sort();
  assert.deepEqual(visible, [
    'miniStatus', 'generalViewTitle', 'countdown', 'pageSeconds', 'partsRequestUrl', 'rotation', 'doneDays', 'safetyDaysSince', 'photoOrder', 'photoFit', 'leadershipPortrait', 'rosterPortrait', 'portraitShape', 'portraitFrame',
    'nightEnabled', 'nightStyle', 'nightLogoWidth', 'nightSpeed', 'nightPreview', 'rebootStatus', 'rebootEnabled', 'rebootTime', 'rebootDays', 'rebootSkipBusy', 'rebootWaitMinutes', 'cleanupEnabled', 'cleanupDeleteAfterDays', 'cleanupMode', 'hiddenEnabled', 'desktopEveryHours', 'redEyesEveryHours', 'hiddenRequest', 'presentationsEnabled', 'screenFit', 'screenScale', 'screenOffsetX', 'screenOffsetY',
    'calendars', 'groupEventsByKind', 'mondayConnection', 'mondayEveryMinutes', 'showConnectionStatus',
  ].sort());
});

test('each section has a title and a one line description, and every field in it exists', () => {
  const names = settings.fields.map(field => field.name);
  ['timing', 'banner', 'portraits', 'presentations', 'night', 'reboot', 'cleanup', 'hiddenTransitions', 'screenFit', 'other'].forEach(name => {
    const set = settings.fieldsets.filter(item => item.name === name)[0];
    assert.ok(set, name + ' should be a section');
    assert.ok(set.title && set.description && set.description.length <= 160 && set.description.indexOf('\n') === -1, name + ' needs a title and a one line description');
    assert.ok(settings.fields.some(field => field.fieldset === name), name + ' should hold fields');
    assert.ok(!/[—–!]/.test(set.description), name + ' description has a dash or an exclamation mark');
  });
  settings.fields.filter(field => field.fieldset).forEach(field => assert.ok(settings.fieldsets.some(set => set.name === field.fieldset), field.name + ' names a section that exists'));
  assert.ok(names.length > 0);
});

test('Presentations, Night mode, Scheduled reboot, Clean up expired items, Hidden transitions and Screen fit are sections of Advanced, in that order', () => {
  const order = [];
  settings.fields.filter(field => field.group === 'advanced' && field.fieldset).forEach(field => { if (order.indexOf(field.fieldset) === -1) order.push(field.fieldset); });
  assert.deepEqual(order.slice(0, 6), ['presentations', 'night', 'reboot', 'cleanup', 'hiddenTransitions', 'screenFit']);
  assert.equal(order[order.length - 1], 'other');
});

test('every field the old Screens runtime and the retired settings left behind is hidden and says Not used any more', () => {
  neverUsed.forEach(name => {
    assert.equal(fieldNamed(name).hidden, true, name + ' should be hidden');
    assert.match(fieldNamed(name).description, /^Not used any more\./, name + ' should say Not used any more');
  });
  assert.equal(fieldNamed('rotationRows').hidden, true, 'the full form of the rotation list has one door, the Rotation page');
});

test('the fields the Today, Look, Competition and team pages took over are hidden, with their stored names', () => {
  ['alert', 'announcements', 'team', 'competitionMode', 'competitionRank', 'frcConnection', 'motion', 'speed', 'frameMetal', 'glint', 'look', 'crt', 'logoSpin', 'pageChangeStyle', 'transitionSeconds', 'themeByWeekday', 'background'].forEach(name => assert.equal(fieldNamed(name).hidden, true, name + ' should be hidden'));
  ['pageSeconds', 'doneDays', 'countdown', 'calendars', 'mondayEveryMinutes', 'nightEnabled'].forEach(name => assert.notEqual(fieldNamed(name).hidden, true, name + ' stays'));
});

test('the Competition page shows the connection, the Match13 block, the modes and fourteen switches, and writes only the field changed', async () => {
  globalThis.studioClient = fakeClient([{ _id: 'dashboardSettings', _type: 'dashboardSettings', competitionMode: 'auto', motion: 'calm' }]);
  const page = studio.mount(view.CompetitionView);
  await page.settle();

  assert.match(wordsIn(page.tree()), /Competition data/);
  assert.ok(nodesWhere(page.tree(), node => node.props && node.props['data-block'] === 'connection').length === 1);
  const rows = nodesWhere(page.tree(), node => node.props && node.props['data-field']).map(node => node.props['data-field']);
  assert.deepEqual(rows, parts.fieldNames);
  assert.equal(parts.cardNames.length, 14);
  assert.ok(nodesWhere(page.tree(), node => node.props && node.props['data-block'] === 'match13').length === 1, 'the Match13 block');
  assert.ok(nodesWhere(page.tree(), node => node.props && node.props['data-block'] === 'modes').length === 1, 'the modes are described in plain words');
  assert.match(wordsIn(page.tree()), /Before and after \(recommended\)/);

  const radio = nodesWhere(page.tree(), node => node.type === 'input' && node.props.value === 'always')[0];
  radio.props.onChange();
  await page.settle();
  const client = globalThis.studioClient;
  const patch = client.calls.filter(call => call.patch).pop();
  assert.equal(patch.patch, 'drafts.dashboardSettings');
  assert.deepEqual(patch.set, { competitionMode: 'always' });
  assert.equal(client.stored['drafts.dashboardSettings'].motion, 'calm', 'the draft keeps every other value');

  const row = nodesWhere(page.tree(), node => node.props && node.props['data-field'] === 'competitionRank')[0];
  nodesWhere(row, node => node.type === 'input')[0].props.onChange({ target: { checked: false } });
  await page.settle();
  assert.deepEqual(client.calls.filter(call => call.patch).pop().set, { competitionRank: false });
  assert.equal(client.calls.filter(call => call.publish).length, 0);
});

test('the Competition page says when Dashboard Settings was never published', async () => {
  globalThis.studioClient = fakeClient([]);
  const page = studio.mount(view.CompetitionView);
  await page.settle();
  assert.match(wordsIn(page.tree()), /Open it, click Publish once, and come back\./);
});

test('the sidebar has the Competition line and the pages keep the phone rules', () => {
  const line = structure.sidebarEntries.filter(entry => entry.title === 'Competition')[0];
  assert.equal(line.kind, 'component');
  assert.equal(line.component, view.CompetitionView);
  ['competition-view.js', 'competition-parts.js'].forEach(file => {
    const text = studio.source('inputs/' + file);
    (text.match(/minHeight: \d+/g) || []).forEach(found => assert.ok(Number(found.replace(/\D/g, '')) >= 44, file + ' ' + found));
    assert.ok(!/\bwidth: [3-9]\d\d\b/.test(text), file + ' has a fixed width');
  });
});

test('Kept data is the last line of the sidebar and the old Screens and the Condensed view are no lines of their own', () => {
  const entries = structure.sidebarEntries;
  assert.equal(entries[entries.length - 1].title, 'Kept data');
  assert.equal(entries[entries.length - 1].kind, 'component');
  const titles = [];
  const walk = list => list.forEach(entry => { titles.push(entry.title); if (entry.entries) walk(entry.entries); });
  walk(entries);
  ['Old screens (not used)', 'Original', 'Cybertron', 'Minimal', 'Condensed'].forEach(title => assert.ok(titles.indexOf(title) === -1, title + ' should not be a line of the sidebar'));
});

test('the Kept data page says the wall does not use them and not to delete them, and links to each', () => {
  const tree = kept.pageOf('ChildLink');
  const text = wordsIn(tree);
  assert.match(text, /The wall does not use these\./);
  assert.match(text, /Do not delete: some old values are read when a new list is empty\./);
  const links = nodesWhere(tree, node => node.type === 'ChildLink').map(node => node.props.childId);
  assert.deepEqual(links, ['kept-screen-original', 'kept-screen-cybertron', 'kept-screen-minimal', 'kept-view-family', 'kept-extraEvent']);
  ['Old screens', 'The Condensed view', 'The old events calendar type'].forEach(title => assert.ok(text.indexOf(title) !== -1, title));
  assert.ok(!/[\u2014\u2013!]/.test(text));
  assert.equal(nodesWhere(tree, node => node.type === 'button' || node.type === 'input').length, 0, 'the page changes nothing');
});

test('each link opens its document in the next pane, and the old events list has no plus button', () => {
  const line = structure.sidebarEntries.filter(entry => entry.title === 'Kept data')[0];
  const made = {};
  const builder = {
    document: () => { const node = {}; ['title', 'schemaType', 'documentId'].forEach(name => { node[name] = value => { made[name] = value; return node; }; }); return node; },
    documentTypeList: type => { const node = { type: type }; ['title', 'defaultOrdering', 'initialValueTemplates'].forEach(name => { node[name] = value => { node[name + 'Value'] = value; return node; }; }); return node; },
  };
  const open = line.children(builder, { since: '', now: '' });
  open('kept-screen-minimal');
  assert.deepEqual([made.title, made.schemaType, made.documentId], ['Minimal', 'screen', 'screen-minimal']);
  open('kept-view-family');
  assert.deepEqual([made.title, made.schemaType, made.documentId], ['Condensed', 'view', 'view-family']);
  const list = open('kept-extraEvent');
  assert.equal(list.type, 'extraEvent');
  assert.deepEqual(list.initialValueTemplatesValue, []);
  assert.throws(() => open('somewhere'), /not a link of the Kept data page/);
  assert.equal(keptParts.targetOf('somewhere'), null);
});

let failed = 0;
for (const item of tests) {
  try {
    await item.run();
    console.log('PASS  ' + item.name);
  } catch (error) {
    failed += 1;
    console.log('FAIL  ' + item.name + '\n      ' + String(error && error.stack ? error.stack : error).split('\n').slice(0, 6).join('\n      '));
  }
}
studio.close();
console.log(failed === 0 ? tests.length + ' of ' + tests.length + ' checks passed.' : failed + ' of ' + tests.length + ' checks failed.');
process.exit(failed === 0 ? 0 : 1);
