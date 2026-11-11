import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LOCAL_DRAFT_REOPEN_MS, restrictPreviewEvidence,
  hasExpiredLocalDraft, eraseLocalReportDrafts, mayPublishApprovedSummary,
} from '../src/app/report-safeguarding.ts';
import {REPORT_DRAFT_KEY} from '../src/app/report-journey-state.ts';
import {DRAFT_STORAGE_KEY,OLD_DRAFT_STORAGE_KEY} from '../src/app/report-conversation.ts';

test('vulnerable and retaliation flags disable unprotected media capture',()=>{
  assert.equal(restrictPreviewEvidence([]),false);
  assert.equal(restrictPreviewEvidence(['vulnerable_person']),true);
  assert.equal(restrictPreviewEvidence(['retaliation']),true);
  assert.equal(restrictPreviewEvidence(['retaliation','vulnerable_person']),true);
});

test('explicitly saved guided drafts cease reopening after 24 hours and are removed on next visit',()=>{
  const now=Date.parse('2026-11-11T04:00:00.000Z');
  const raw=(time)=>JSON.stringify({purpose:'report',savedAt:new Date(time).toISOString()});
  assert.equal(hasExpiredLocalDraft(null,now),false);
  assert.equal(hasExpiredLocalDraft(raw(now-LOCAL_DRAFT_REOPEN_MS),now),false);
  assert.equal(hasExpiredLocalDraft(raw(now-LOCAL_DRAFT_REOPEN_MS-1),now),true);
  assert.equal(hasExpiredLocalDraft(raw(now),now),false);
  assert.equal(hasExpiredLocalDraft('malformed',now),false);
  assert.equal(hasExpiredLocalDraft('{"purpose":"other","savedAt":"2000-01-01"}',now),false);
});

test('local deletion explicitly removes both guided session and older auto-saved text draft keys',()=>{
  const session=new Map([[REPORT_DRAFT_KEY,'private guided text']]);
  const local=new Map([[DRAFT_STORAGE_KEY,'private old text'],[OLD_DRAFT_STORAGE_KEY,'older text']]);
  const eraser=(m)=>({removeItem:(key)=>{m.delete(key);}});
  const status=eraseLocalReportDrafts(eraser(session),eraser(local));
  assert.deepEqual(status,{ok:true,failedStores:[]});
  assert.equal(session.size,0);
  assert.equal(local.size,0);
});

test('local deletion never reports success when browser storage removal is blocked',()=>{
  const blocked={removeItem(){throw new Error('storage denied')}};
  const valid={removeItem(){}};
  const outcome=eraseLocalReportDrafts(blocked,valid);
  assert.equal(outcome.ok,false);
  assert.deepEqual(outcome.failedStores,['session']);
});

test('future public projection guard is default-deny without all trusted human gates',()=>{
  const approved={
    reviewerAuthorized:true,humanDecision:'approve_redacted',
    redactionVerified:true,vulnerablePerson:false,retaliationConcern:false,
    operatorPolicyApproved:true,
  };
  assert.equal(mayPublishApprovedSummary(approved),true);
  for(const field of ['reviewerAuthorized','redactionVerified','operatorPolicyApproved']){
    assert.equal(mayPublishApprovedSummary({...approved,[field]:false}),false);
  }
  for(const decision of ['unreviewed','hold_private','reject']){
    assert.equal(mayPublishApprovedSummary({...approved,humanDecision:decision}),false);
  }
  assert.equal(mayPublishApprovedSummary({...approved,vulnerablePerson:true}),false);
  assert.equal(mayPublishApprovedSummary({...approved,retaliationConcern:true}),false);
});
