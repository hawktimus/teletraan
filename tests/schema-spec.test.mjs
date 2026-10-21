// Tests for the form spec that the Control page draws its All settings forms from (studio/tools/schema-spec.js, the plan in
// studio/tools/schema-plan.js, the loader control/support/schema-load.js). The spec is made from the real Studio schemas, so these
// tests also stop a schema change from slipping past the Control page: a field that is neither drawn nor listed as left out fails
// with a plain message, and every field that is left out is printed with its reason.
//
//   node tests/schema-spec.test.mjs

import assert from 'node:assert/strict';
import { buildSpec } from '../studio/tools/schema-spec.js';
import { leftOut, plan } from '../studio/tools/schema-plan.js';
import { loadSchemaTypes } from '../control/support/schema-load.js';
import { repo } from './helpers/control-world.mjs';

let passed = 0;
async function check(name, test) {
  await test();
  passed += 1;
  console.log('PASS  ' + name);
}

const { types } = await loadSchemaTypes(repo.replace(/\/$/, ''));
const spec = buildSpec(types, plan);
const byName = new Map(types.map(type => [type.name, type]));
const documentOf = type => spec.documents.filter(doc => doc.type === type)[0];

// Every field of a spec document, nested ones with their dotted path (a list item field is path[].name)
function allFields(fields, trail = '') {
  const out = [];
  fields.forEach(field => {
    const path = trail + field.name;
    out.push({ path: path, field: field });
    if (field.fields) out.push(...allFields(field.fields, path + '.'));
    (field.members || []).forEach(member => out.push(...allFields(member.fields, path + '[].')));
  });
  return out;
}

const fieldOf = (type, path) => allFields(documentOf(type).fields).filter(item => item.path === path)[0].field;

await check('the spec is plain JSON: no function or Studio object gets into it', () => {
  const text = JSON.stringify(spec);
  assert.ok(text.length > 20000);
  assert.deepEqual(JSON.parse(text), JSON.parse(JSON.stringify(spec)));
  assert.ok(!/\[Function|undefined/.test(text));
  assert.ok(allFields(documentOf('dashboardSettings').fields).length > 80);
});

await check('every field of every covered document is drawn or listed as left out with a reason', () => {
  const lost = [];
  const drawn = type => new Set(allFields(documentOf(type).fields).map(item => item.path.split('.')[0]));
  const skippedTop = type => new Set(spec.skipped.filter(item => item.document === (documentOf(type).id || type)).map(item => item.field.split('.')[0].replace('[]', '')));
  plan.documents.forEach(entry => {
    const here = drawn(entry.type);
    const skipped = skippedTop(entry.type);
    byName.get(entry.type).fields.forEach(field => {
      if (!here.has(field.name) && !skipped.has(field.name)) lost.push(entry.type + '.' + field.name);
    });
  });
  assert.deepEqual(lost, [], 'The Studio has a field that the Control page neither draws nor lists as left out: ' + lost.join(', ') + '. Add it to the plan in studio/tools/schema-plan.js, or let the spec draw it.');
  spec.skipped.forEach(item => assert.ok(item.reason.length > 10, item.document + '.' + item.field + ' has no reason'));
});

await check('every schema type is edited by the Control page or listed as left out, so a new type is noticed', () => {
  const edited = plan.documents.map(entry => entry.type);
  const blocks = types.filter(type => type.type === 'object').map(type => type.name);
  const unknown = types.map(type => type.name).filter(name => !edited.includes(name) && !(name in leftOut) && !blocks.includes(name));
  assert.deepEqual(unknown, [], 'The Studio has a new type: ' + unknown.join(', ') + '. Edit it in studio/tools/schema-plan.js (plan) or give the reason in leftOut.');
  Object.keys(leftOut).forEach(name => assert.ok(byName.has(name), 'leftOut names ' + name + ', which is not a schema type any more'));
});

await check('no stored name is invented or changed: every name in the spec is a name in the schema', () => {
  plan.documents.forEach(entry => {
    const raw = new Set();
    const walk = (fields, trail) => fields.forEach(field => {
      raw.add(trail + field.name);
      const source = byName.get(field.type) && byName.get(field.type).type === 'object' ? byName.get(field.type) : field;
      if (source.fields) walk(source.fields, trail + field.name + '.');
      (field.of || []).forEach(member => {
        const named = byName.get(member.type) || member;
        if (named.fields) walk(named.fields, trail + field.name + '[].');
      });
    });
    walk(byName.get(entry.type).fields, '');
    allFields(documentOf(entry.type).fields).forEach(item => assert.ok(raw.has(item.path), entry.type + ': ' + item.path + ' is not a field of the schema'));
  });
});

await check('what the Display tab and the other cards own is left out, and the reason names the owner', () => {
  const left = name => spec.skipped.filter(item => item.document === 'dashboardSettings' && item.field === name)[0];
  ['rotationRows', 'themeByWeekday'].forEach(name => assert.match(left(name).reason, /Display tab/));
  ['rebootEnabled', 'rebootTime', 'rebootDays'].forEach(name => assert.match(left(name).reason, /Scheduled reboot/));
  ['motion', 'motionOnKiosk'].forEach(name => assert.match(left(name).reason, /Motion card/));
  ['holdPanel', 'showView', 'pauseRotation', 'nextLookRequest'].forEach(name => assert.match(left(name).reason, /one-time request/));
  const drawn = new Set(documentOf('dashboardSettings').fields.map(field => field.name));
  ['rotationRows', 'themeByWeekday', 'rebootTime', 'motion', 'holdPanel'].forEach(name => assert.ok(!drawn.has(name), name));
});

await check('uploads and links to anything but a team are left out; a link to a team is a Team select', () => {
  assert.match(spec.skipped.filter(item => item.document === 'team' && item.field === 'logo')[0].reason, /upload/);
  assert.match(spec.skipped.filter(item => item.document === 'subtheme' && item.field === 'assets')[0].reason, /uploaded|Pictures/);
  const small = buildSpec([{
    name: 'thing',
    type: 'document',
    fields: [
      { name: 'lead', title: 'Lead', type: 'reference', to: [{ type: 'subteam' }], description: 'A lead.' },
      { name: 'picture', title: 'Picture', type: 'image', description: 'A picture.' },
      { name: 'owner', title: 'Owner', type: 'reference', to: [{ type: 'team' }], description: 'A team.' },
      { name: 'odd', title: 'Odd', type: 'string', description: 'Own page.', components: { input: function OddInput() {} } },
    ],
  }], { documents: [{ id: 'thing', type: 'thing', mode: 'singleton' }] });
  assert.deepEqual(small.documents[0].fields.map(field => field.name), ['owner']);
  assert.match(small.skipped.filter(item => item.field === 'lead')[0].reason, /other than a team/);
  assert.match(small.skipped.filter(item => item.field === 'picture')[0].reason, /upload/);
  assert.match(small.skipped.filter(item => item.field === 'odd')[0].reason, /OddInput/);
  const team = fieldOf('customPanel', 'team');
  assert.equal(team.widget, 'team');
  assert.equal(team.type, 'reference');
});

await check('limits are read from the validation rules', () => {
  const seconds = fieldOf('dashboardSettings', 'pageSeconds').validation;
  assert.deepEqual([seconds.required, seconds.integer, seconds.min, seconds.max], [true, true, 8, 120]);
  assert.equal(seconds.messages.min, 'Use a whole number from 8 to 120.');

  const label = fieldOf('dashboardSettings', 'countdown.kickoffLabel').validation;
  assert.equal(label.max, 40);
  assert.equal(label.warn.max, 28);

  const color = fieldOf('team', 'colors.primary');
  assert.equal(color.widget, 'color');
  assert.equal(color.validation.required, true);
  assert.equal(color.validation.regex[0].source, '^#[0-9A-Fa-f]{6}$');
  assert.equal(fieldOf('team', 'colors.headerInk').validation.required, false);

  assert.equal(fieldOf('team', 'name').validation.max, 20);
  assert.equal(fieldOf('dashboardSettings', 'nightLogoWidth').validation.min, 120);
  assert.equal(fieldOf('dashboardSettings', 'crt.everySeconds').validation.custom, 1, 'a custom rule is counted for the page and run on the server');
  assert.equal(fieldOf('dashboardSettings', 'crt.everySeconds').validation.customs.length, 1);
  assert.ok(!JSON.stringify(spec).includes('"customs"'), 'the custom functions never reach the page');
});

await check('radio and select lists match the schema, value for value', () => {
  let counted = 0;
  const walk = (fields, source) => fields.forEach(field => {
    const raw = source.filter(item => item.name === field.name)[0];
    if (field.options && raw && raw.options && raw.options.list) {
      counted += 1;
      const want = raw.options.list.map(item => (typeof item === 'object' ? item.value : item));
      assert.deepEqual(field.options.list.map(item => item.value), want, field.name);
    }
  });
  plan.documents.forEach(entry => walk(documentOf(entry.type).fields, byName.get(entry.type).fields));
  assert.ok(counted > 25, 'only ' + counted + ' lists were compared');
  assert.deepEqual(fieldOf('dashboardSettings', 'speed').options.list.map(item => item.value), ['very-slow', 'slow', 'normal', 'fast']);
  assert.equal(fieldOf('dashboardSettings', 'speed').widget, 'radio');
  assert.deepEqual(fieldOf('team', 'metal').options.list.map(item => item.value), ['gold', 'steel', 'purple']);
});

await check('starting values, switches, dates and the Look settings are there', () => {
  assert.equal(fieldOf('dashboardSettings', 'glint').widget, 'switch');
  assert.equal(fieldOf('dashboardSettings', 'glint').initialValue, true);
  assert.equal(fieldOf('dashboardSettings', 'countdown.kickoff').widget, 'datetime');
  assert.equal(fieldOf('dashboardSettings', 'safetyDaysSince').widget, 'date');
  assert.equal(fieldOf('dashboardSettings', 'announcements').members[0].fields.filter(field => field.name === 'days')[0].widget, 'checks');
  const look = documentOf('dashboardSettings').fields.filter(field => field.tab === 'look').map(field => field.name);
  ['speed', 'frameMetal', 'glint', 'look', 'frameFinish', 'logoSpin', 'logoSpinEvery', 'nameTransform', 'pageChangeStyle', 'breakSeconds', 'silverChance', 'crt', 'background'].forEach(name => assert.ok(look.includes(name), name));
});

await check('a hidden that reads one field becomes a rule the form can follow', () => {
  const theme = documentOf('theme').fields.filter(field => field.name === 'schedule')[0].members[0].fields;
  const color = theme.filter(field => field.name === 'theme')[0];
  const pack = theme.filter(field => field.name === 'overlay')[0];
  const prefix = theme.filter(field => field.name === 'tickerPrefix')[0];
  assert.deepEqual(color.showWhen, { field: 'kind', values: ['theme'] });
  assert.deepEqual(pack.showWhen, { field: 'kind', values: ['overlay'] });
  assert.deepEqual(prefix.showWhen, { field: 'kind', values: ['overlay'] });
  assert.equal(fieldOf('view', 'team').conditional, true);
  assert.deepEqual(fieldOf('view', 'team').onlyFor, ['view-prime', 'view-nova']);
});

await check('the documents and tabs are in a plain order, and every field has a tab that exists', () => {
  assert.deepEqual(spec.documents.map(doc => doc.type), ['dashboardSettings', 'theme', 'view', 'team', 'customPanel', 'subtheme', 'tipOrNews', 'rosterPerson', 'announcement', 'photo']);
  assert.deepEqual(documentOf('dashboardSettings').tabs.map(tab => tab.title), ['Timing', 'Look', 'Photos', 'Countdown', 'Calendars', 'Monday', 'Competition', 'Today', 'Advanced']);
  spec.documents.forEach(doc => doc.fields.forEach(field => assert.ok(doc.tabs.some(tab => tab.id === field.tab), doc.type + '.' + field.name)));
  assert.deepEqual(documentOf('view').ids, ['view-general', 'view-prime', 'view-nova', 'view-family']);
  assert.equal(documentOf('view').mode, 'fixed');
});

await check('the extra panel blocks are a list of kinds, and a kind that needs a picture upload cannot be added', () => {
  const blocks = fieldOf('customPanel', 'blocks');
  assert.deepEqual(blocks.members.map(member => member.type), ['headingBlock', 'textBlock', 'statBlock', 'listBlock', 'imageBlock', 'progressBlock', 'countdownBlock']);
  assert.ok(blocks.members.every(member => member.addable === true));

  const made = buildSpec([
    { name: 'card', type: 'object', title: 'Card', fields: [{ name: 'photo', type: 'image', title: 'Photo', description: 'A photo.' }, { name: 'words', type: 'string', title: 'Words', description: 'Words.' }] },
    { name: 'deck', type: 'document', fields: [{ name: 'cards', title: 'Cards', type: 'array', description: 'Cards.', of: [{ type: 'card' }] }] },
  ], { documents: [{ id: 'deck', type: 'deck', mode: 'singleton' }] });
  const member = made.documents[0].fields[0].members[0];
  assert.equal(member.addable, false);
  assert.deepEqual(member.fields.map(field => field.name), ['words']);
});

console.log('');
console.log('Left out of the Control page (' + spec.skipped.length + '), each with its reason:');
spec.skipped.forEach(item => console.log('  ' + item.document + '.' + item.field + ': ' + item.reason));
console.log('');
console.log(passed + ' of ' + passed + ' passed');
