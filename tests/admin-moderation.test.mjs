import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makeModerationExamples, moderationActions, moderateDemoItem,
  InvalidModerationDecision,
} from '../admin/src/moderation-model.ts';
import { assessDemoRoute } from '../admin/src/routing-model.ts';
import { makeDemoCases } from '../admin/src/demo-cases.ts';

const at = '2026-11-10T16:00:00Z';

test('moderation queues are fictional and cover listings, reviews, claims, knowledge and corrections', () => {
  const items = makeModerationExamples();
  assert.equal(items.length, 6);
  assert.deepEqual(new Set(items.map(item => item.kind)),
    new Set(['listing','review','claim','knowledge','correction']));
  assert.ok(items.every(item => item.id.startsWith('DEMO-MOD-') && item.status === 'pending'));
});

test('reviewer can record a demo decision only after the sample evidence gate', () => {
  const [reviewed, unreviewed] = makeModerationExamples();
  assert.ok(moderationActions(reviewed).includes('approve'));
  assert.ok(!moderationActions(unreviewed).includes('approve'));
  const approved = moderateDemoItem(reviewed, 'approve', 'Reviewed fictional source and description', at);
  assert.equal(approved.status, 'demo_approved');
  assert.equal(reviewed.status, 'pending');
  assert.equal(approved.history.length, reviewed.history.length + 1);
  assert.throws(() => moderateDemoItem(unreviewed, 'approve', 'No verification evidence available', at),
    InvalidModerationDecision);
});

test('ownership claims cannot be verified or approved through email alone', () => {
  const claim = makeModerationExamples().find(item => item.kind === 'claim');
  assert.deepEqual(moderationActions(claim), ['request_evidence', 'reject']);
  assert.throws(() => moderateDemoItem(claim, 'approve', 'Owner declared business ownership', at),
    InvalidModerationDecision);
  const pending = moderateDemoItem(claim, 'request_evidence', 'Confirm legal authority outside this demo', at);
  assert.equal(pending.status, 'needs_evidence');
  assert.ok(!moderationActions(pending).includes('approve'));
});

test('every decision requires a safe internal rationale', () => {
  const reviewed = makeModerationExamples()[0];
  assert.throws(() => moderateDemoItem(reviewed,'approve','tiny',at),InvalidModerationDecision);
  assert.throws(() => moderateDemoItem(reviewed,'approve','Contains\ncontrol characters',at),InvalidModerationDecision);
  assert.throws(() => moderateDemoItem(reviewed,'approve','A'.repeat(501),at),InvalidModerationDecision);
  const rejected = moderateDemoItem(reviewed,'reject','Evidence conflicts with record details',at);
  assert.deepEqual(moderationActions(rejected), ['reopen']);
  assert.equal(moderateDemoItem(rejected,'reopen','Reopen for further manual review',at).status,'pending');
});

test('routing distinguishes LGA suggestions from confirmed office identity and delivery', () => {
  for (const item of makeDemoCases()) {
    const assessment = assessDemoRoute(item);
    assert.equal(assessment.caseId, item.id);
    assert.equal(assessment.proposedOffice, null);
    assert.equal(assessment.governmentDelivery, 'not_attempted');
    assert.equal(assessment.humanApprovalRequired, true);
    assert.equal(assessment.wardEvidence, 'unmapped');
    assert.equal(assessment.areaEvidence, 'demo_label_only');
  }
  assert.equal(assessDemoRoute(makeDemoCases()[0]).scope,'state_or_lga_review');
});
