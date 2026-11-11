import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveDemoAlerts,playDemoChime} from '../admin/src/alert-model.ts';
import {makeDemoCases} from '../admin/src/demo-cases.ts';

test('in-memory alert center filters out resolved samples and never claims live government alerts',()=>{
  const cases=makeDemoCases();
  const alerts=deriveDemoAlerts(cases);
  assert.ok(alerts.length>0&&alerts.length<cases.length);
  assert.ok(alerts.every(x=>x.caseId.startsWith('DEMO-')));
  assert.ok(alerts.every(x=>['attention','update','info'].includes(x.level)));
  assert.ok(alerts.some(x=>x.level==='attention'));
  assert.ok(alerts.every(x=>!/(sent to government|emergency dispatch|officially resolved)/i.test(x.title)));
  assert.ok(!alerts.some(x=>x.caseId==='DEMO-1005'),'platform-resolved samples are not pending alerts');
  assert.deepEqual(deriveDemoAlerts([]),[]);
  assert.deepEqual(deriveDemoAlerts([{
    ...cases[0],id:'REAL-1234',
  }]),[]);
});
test('demo audio cannot play before a user-controlled enabled volume',async()=>{
  assert.equal(await playDemoChime(0),false);
  assert.equal(await playDemoChime(NaN),false);
  assert.equal(await playDemoChime(-1),false);
  assert.equal(await playDemoChime(100),false,'Node has no browser audio context');
});
