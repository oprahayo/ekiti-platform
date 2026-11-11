import test from 'node:test';
import assert from 'node:assert/strict';
import {
  journeyPrompt, journeyWelcome, readJourneyDraft,
  REPORT_CATEGORIES, REPORT_STEPS, REPORT_DRAFT_KEY, CHAT_SOUND_KEY,
} from '../src/app/report-journey-state.ts';

const validLgas=['ado-ekiti','ikere'];
const now=Date.parse('2026-11-11T00:00:00.000Z');
const saved={
  purpose:'report', method:'Text', category:'Roads',
  description:'The road by the market is badly damaged and dangerous.',
  lgaId:'ado-ekiti',community:'Near the main market',savedAt:new Date(now-10000).toISOString(),
};

test('guided conversation has unique steps and bilingual non-empty prompts',()=>{
  assert.equal(REPORT_STEPS.length,8);
  assert.equal(new Set(REPORT_STEPS).size,8);
  assert.ok(REPORT_CATEGORIES.includes('Emergency'));
  for(const step of [...REPORT_STEPS,'saved']){
    assert.ok(journeyPrompt(step,'en').length>10);
    assert.ok(journeyPrompt(step,'yo').length>10);
  }
  assert.match(journeyWelcome(false,'en'),/one question at a time/);
  assert.match(journeyWelcome(true,'en'),/feedback/);
  assert.match(journeyWelcome(false,'yo'),/Káàbọ̀/);
  assert.notEqual(REPORT_DRAFT_KEY,CHAT_SOUND_KEY);
});

test('only explicit, same-purpose, recent session text drafts can be restored',()=>{
  assert.equal(readJourneyDraft(null,'report',validLgas,now),null);
  assert.equal(readJourneyDraft('not json','report',validLgas,now),null);
  assert.equal(readJourneyDraft(JSON.stringify(saved),'feedback',validLgas,now),null);
  assert.equal(readJourneyDraft(JSON.stringify(saved),'report',validLgas,now)?.description,saved.description);
  assert.equal(readJourneyDraft(JSON.stringify({...saved,savedAt:new Date(now-90000000).toISOString()}),'report',validLgas,now),null);
  assert.equal(readJourneyDraft(JSON.stringify({...saved,savedAt:new Date(now+90000000).toISOString()}),'report',validLgas,now),null);
  assert.equal(readJourneyDraft(JSON.stringify({...saved,lgaId:'unknown'}),'report',validLgas,now),null);
  assert.equal(readJourneyDraft(JSON.stringify({...saved,category:'unverified'}),'report',validLgas,now),null);
  assert.equal(readJourneyDraft(JSON.stringify({...saved,description:'short'}),'report',validLgas,now),null);
});

test('a saved text draft never restores secrets or contact fields',()=>{
  const extended={...saved,email:'resident@example.test',contact:'08012345678',
    rawGps:{lat:7.7,lon:5.2},mediaData:'data:image/jpeg;base64,abc',secret:'private'};
  const safe=readJourneyDraft(JSON.stringify(extended),'report',validLgas,now);
  assert.ok(safe);
  assert.deepEqual(Object.keys(safe).sort(),
    ['purpose','method','category','description','lgaId','community','savedAt'].sort());
  for(const forbidden of ['email','contact','rawGps','mediaData','secret'])
    assert.equal(JSON.stringify(safe).includes(forbidden),false);
});
