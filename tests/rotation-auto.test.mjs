// Tests for the Automatic panels section of the Rotation board (docs/rotation-board.md): the cards the wall adds by itself, the
// mode and the status line of the competition cards, and what the section draws.
//
//   node tests/rotation-auto.test.mjs

import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { test, finish } from './helpers/runner.mjs';
import { nodesWhere, root, rotationWorld, textOf } from './helpers/rotation-world.mjs';

const world = await rotationWorld();
const { auto, autoParts } = world;
const dashboardLists = await import(pathToFileURL(path.join(root, 'dashboard', 'config-lists.js')).href);
const registry = await import(pathToFileURL(path.join(root, 'dashboard', 'registry.js')).href);

const frc = { events: [{ name: '2027 NC District Wake Event', shortName: 'Wake', startDate: '2027-03-12', endDate: '2027-03-14' }, { name: 'Earlier', startDate: '2027-02-01', endDate: '2027-02-02' }] };

test('the lead days and the modes are the ones of the dashboard', () => {
  assert.equal(auto.leadDays, dashboardLists.competitionLeadDays);
  assert.deepEqual(auto.competitionModes, dashboardLists.competitionModes);
});

test('there is a card for each competition card of the registry, and only competition-rank and competition-team-metrics can also be a row', () => {
  const registered = registry.panels.filter(panel => panel.competition).map(panel => panel.id).sort();
  assert.deepEqual(auto.autoCards.map(card => card.id).sort(), registered);
  assert.deepEqual(auto.allAutoCards.filter(auto.canBeRow).map(card => card.id), ['competition-rank', 'competition-team-metrics']);
  auto.autoCards.forEach(card => {
    assert.ok(card.shows && card.when, card.id + ' says what it shows and when it appears');
    assert.ok(/2 days|season|started|Before|Once/.test(card.when), card.id + ' says when in words');
  });
  assert.match(auto.autoCards.filter(card => card.id === 'competition-results')[0].title, /Match Statistics/, 'the strip is named the way the team calls it');
});

test('the mode is read from the draft first and is Auto when it is not set', () => {
  assert.equal(auto.competitionModeFrom([{ _id: 'dashboardSettings', competitionMode: 'always' }, { _id: 'drafts.dashboardSettings', competitionMode: 'off' }]), 'off');
  assert.equal(auto.competitionModeFrom([{ _id: 'dashboardSettings', competitionMode: 'always' }]), 'always');
  assert.equal(auto.competitionModeFrom([{ _id: 'dashboardSettings', competitionMode: 'other' }]), 'auto');
  assert.equal(auto.competitionModeFrom([]), 'auto');
  assert.equal(auto.competitionModeFrom(undefined), 'auto');
});

test('the status line names the next event and the day its cards start', () => {
  assert.equal(auto.competitionStatus(frc, 'auto', '2027-02-10'), 'Next event: Wake on 12 March 2027: the cards start on 10 March 2027.');
  assert.equal(auto.competitionStatus(frc, 'auto', '2027-03-10'), 'Next event: Wake on 12 March 2027: the cards are on now.');
  assert.equal(auto.competitionStatus(frc, 'auto', '2027-03-13'), 'Next event: Wake on 12 March 2027: the cards are on now.');
  assert.equal(auto.competitionStatus(frc, 'auto', '2027-04-01'), 'No event is coming up: the cards are off.');
  assert.equal(auto.competitionStatus({ events: [] }, 'auto', '2027-04-01'), 'No event is coming up: the cards are off.');
  assert.match(auto.competitionStatus(frc, 'always', '2027-02-10'), /The mode is Always/);
  assert.match(auto.competitionStatus(frc, 'off', '2027-02-10'), /Off/);
  assert.match(auto.competitionStatus(null, 'auto', '2027-02-10'), /No competition data/);
  assert.match(auto.competitionStatus(null, 'auto', '2027-02-10', true), /could not be read/);
  assert.equal(auto.shiftDate('2027-03-01', -2), '2027-02-27');
  assert.equal(auto.todayText(new Date(2027, 0, 9)), '2027-01-09');
});

test('the section draws a card for each thing, the mode with a link to the Competition page, and the status line', () => {
  const page = autoParts.autoSection({ mode: 'auto', frc: { read: true, doc: frc, unreadable: false } }, new Date(2027, 1, 10));
  const cards = nodesWhere(page, node => node.props['data-auto'] !== undefined).map(node => node.props['data-auto']);
  assert.deepEqual(cards, auto.allAutoCards.map(card => card.id));
  assert.match(textOf(page), /Competition cards mode: Auto\./);
  assert.match(textOf(page), /Next event: Wake on 12 March 2027: the cards start on 10 March 2027\./);
  const link = nodesWhere(page, node => node.type === 'Link')[0];
  assert.equal(link.props.href, '/structure/competition');
  assert.equal(textOf(page).split('Added by the wall, not a row.').length - 1, auto.allAutoCards.length, 'every card says so');
  assert.equal(textOf(page).split('Can also be a row: yes').length - 1, 2);
  assert.match(textOf(page), /sit on top of everything/);
  assert.match(textOf(page), /Not panels/);
  assert.equal(nodesWhere(page, node => node.type === 'details').length, 1, 'it can be closed, and a phone opens it closed');
  assert.match(textOf(autoParts.autoSection({ mode: 'auto' })), /Reading the competition data/);
});

test('the words are plain', () => {
  const all = textOf(autoParts.autoSection({ mode: 'always', frc: { read: true, doc: frc, unreadable: false } }, new Date(2027, 1, 10)));
  assert.ok(!/[—–!]/.test(all), 'no dash or exclamation mark');
  assert.ok(!/\b(simply|just|basically|really|very|actually|easily)\b/i.test(all), 'no filler words');
});

await finish();
