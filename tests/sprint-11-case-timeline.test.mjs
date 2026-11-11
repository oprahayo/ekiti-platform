import test from 'node:test';
import assert from 'node:assert/strict';
import {caseTimelineEnabled,validateCaseTimeline,platformEventCopy}
  from '../src/app/case-timeline.ts';

const uuid='12345678-1234-4234-a234-123456789abc';
const base={
  public_reference:uuid,kind:'Issue',received_at:'2026-11-11T07:00:00+00:00',
  events:[
    {kind:'intake_accepted',at:'2026-11-11T07:00:00+00:00',origin:'independent_platform'},
    {kind:'under_review',at:'2026-11-11T07:20:00+00:00',origin:'independent_platform'},
  ],
  notification_channel:'off',correction_review_requested:false,
  duplicate_review_requested:false,government_acknowledged:false,
  public_map_status:'not_published',
};

test('Sprint 11 private timeline remains unavailable without an explicit deployment flag',()=>{
  assert.equal(caseTimelineEnabled(),false);
});

test('timeline only accepts exact receipt-linked reference and chronological platform events',()=>{
  assert.deepEqual(validateCaseTimeline(base,uuid),base);
  assert.deepEqual(validateCaseTimeline({...base,events:[]},uuid).events,[]);
  assert.match(platformEventCopy.closed.description,/not independent proof/);
  const invalid=[
    {...base,public_reference:'22222222-2222-4222-a222-222222222222'},
    {...base,government_acknowledged:true},
    {...base,public_map_status:'published'},
    {...base,description:'Private details'},
    {...base,contact:'+2348012345678'},
    {...base,notifications_sent:true},
    {...base,events:[{...base.events[0],office:'Ministry'}]},
    {...base,events:[{...base.events[0],origin:'official_government'}]},
    {...base,events:[{...base.events[0],kind:'delivered_to_government'}]},
    {...base,events:[{...base.events[0],at:'not-a-date'}]},
    {...base,events:[base.events[1],base.events[0]]},
    {...base,events:Array.from({length:51},()=>base.events[0])},
    {...base,notification_channel:'push'},
    {...base,correction_review_requested:'true'},
    {...base,duplicate_review_requested:null},
    {...base,received_at:'unknown'},
    null,[],{status:'under_review'},
  ];
  for(const value of invalid)
    assert.throws(()=>validateCaseTimeline(value,uuid),
      /Invalid case timeline/,JSON.stringify(value).slice(0,130));
});

test('platform copy never implies real dispatch, case resolution or emergency response',()=>{
  for(const event of Object.values(platformEventCopy)){
    assert.ok(event.title.length>3);
    assert.ok(event.description.includes('platform')||
      /proof/.test(event.description));
    assert.ok(!/government (has|confirmed|accepted)/i.test(event.description));
  }
});
