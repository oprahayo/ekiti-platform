import test from 'node:test';
import assert from 'node:assert/strict';
import {
  agencyEvidence, applyDemoAction, availableActions, caseQueue,
  filterCases, InvalidCaseAction, queueCounts,
} from '../admin/src/case-model.ts';
import { makeDemoCases } from '../admin/src/demo-cases.ts';

const at = '2026-11-10T16:00:00Z';

test('demo cases are explicitly synthetic and never contain identifiable reporters', () => {
  const cases = makeDemoCases();
  assert.equal(cases.length, 6);
  assert.ok(cases.every(item => item.id.startsWith('DEMO-')));
  assert.ok(cases.every(item => !Object.hasOwn(item, 'email') &&
    !Object.hasOwn(item, 'phone') && !Object.hasOwn(item, 'latitude') &&
    !Object.hasOwn(item, 'longitude')));
});

test('queues are derived from append-only event history, not a writable status field', () => {
  const cases = makeDemoCases();
  assert.deepEqual(queueCounts(cases), { inbox: 2, assigned: 1, awaiting: 1, escalated: 1, resolved: 1 });
  assert.equal(caseQueue(cases[2]), 'awaiting');
  const noted = applyDemoAction(cases[2], 'note', 'Checking the available platform information', at);
  assert.equal(caseQueue(noted), 'awaiting');
  assert.equal(cases[2].events.length + 1, noted.events.length);
  assert.equal(cases[2].events.at(-1).kind, 'awaiting_response');
});

test('platform transitions append time-stamped activity and never imply external delivery', () => {
  const initial = makeDemoCases()[0];
  const assigned = applyDemoAction(initial, 'assign', '', at);
  assert.equal(caseQueue(assigned), 'assigned');
  assert.equal(assigned.assignee, 'Demo moderator');
  const awaiting = applyDemoAction(assigned, 'await', 'Waiting for further internal clarification', at);
  assert.equal(caseQueue(awaiting), 'awaiting');
  const resolved = applyDemoAction(awaiting, 'resolve', 'Closed within the demonstration workspace', at);
  assert.equal(caseQueue(resolved), 'resolved');
  const reopened = applyDemoAction(resolved, 'reopen', 'New internal information requires another review', at);
  assert.equal(caseQueue(reopened), 'assigned');
  assert.equal(reopened.events.length, initial.events.length + 4);
  assert.deepEqual(agencyEvidence(), { delivered: false, viewed: false, label: 'Not verified' });
});

test('prevent invalid transitions and undocumented closure', () => {
  const initial = makeDemoCases()[0];
  assert.ok(!availableActions('inbox').includes('resolve'));
  assert.throws(() => applyDemoAction(initial, 'resolve', 'Done and closed', at), InvalidCaseAction);
  assert.throws(() => applyDemoAction(initial, 'escalate', 'short', at), InvalidCaseAction);
  assert.throws(() => applyDemoAction(initial, 'note', 'Contains\ncontrol chars', at), InvalidCaseAction);
  const assigned = applyDemoAction(initial, 'assign', '', at);
  assert.throws(() => applyDemoAction(assigned, 'resolve', '', at), InvalidCaseAction);
  assert.throws(() => applyDemoAction(assigned, 'resolve', 'A'.repeat(501), at), InvalidCaseAction);
});

test('search is bounded to displayed sample metadata and respects selected queues', () => {
  const cases = makeDemoCases();
  assert.equal(filterCases(cases, 'all', 'street lighting').length, 1);
  assert.equal(filterCases(cases, 'all', 'oyE').length, 1);
  assert.equal(filterCases(cases, 'all', 'DEMO-1005').length, 1);
  assert.equal(filterCases(cases, 'inbox', 'signage').length, 0);
  assert.equal(filterCases(cases, 'all', 'missing text').length, 0);
});

test('a case without a real intake event is rejected', () => {
  const invalid = { ...makeDemoCases()[0], events: [] };
  assert.throws(() => caseQueue(invalid), /intake event/);
});
