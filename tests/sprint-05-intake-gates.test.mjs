import test from 'node:test';
import assert from 'node:assert/strict';
import {assessIntakeRelease} from '../src/reporting/intake-release.ts';
import {handlePrivateReporting} from '../src/server/private-report-routes.ts';

function ready(overrides={}) {
  return {
    REPORTING_ENABLED:'true',
    REPORTING_BOUND_ORIGIN:'https://ekiti.example',
    REPORTING_OPERATOR_ID:'fixture-only-not-a-verified-operator',
    REPORTING_RELEASE_APPROVAL_ID:'fixture-only-no-legal-signoff',
    REPORTING_RETENTION_JOB_VERIFIED:'true',
    REPORTING_POLICY_VERSION:'test-policy-only',
    REPORTING_RETENTION_DAYS:'30',
    REPORTING_HYPERDRIVE:{connectionString:'postgres://unused-in-test'},
    REPORTING_LIMIT:{limit:async()=>({success:true})},
    REPORTING_TRACK_LIMIT:{limit:async()=>({success:true})},
    ...overrides,
  };
}
function post(path,body={x:1},headers={}){
  return new Request('https://ekiti.example'+path,{method:'POST',headers:{
    'Content-Type':'application/json',Origin:'https://ekiti.example',...headers,
  },body:JSON.stringify(body)});
}
const unavailable=async()=>{throw Error('Must not open database')};

test('private intake disabled remains a 404 without touching db or rate limiter',async()=>{
  const config=ready({REPORTING_ENABLED:undefined,REPORTING_LIMIT:{limit:async()=>{throw Error('Must not rate-limit')}}});
  assert.deepEqual(assessIntakeRelease(config),{ready:false,reason:'disabled'});
  assert.equal((await handlePrivateReporting(post('/api/reports'),config,unavailable)).status,404);
  assert.equal((await handlePrivateReporting(post('/api/tracking'),config,unavailable)).status,404);
});

test('enabled intake fails closed on every independent release prerequisite',async()=>{
  const fields=[
    'REPORTING_BOUND_ORIGIN','REPORTING_OPERATOR_ID','REPORTING_RELEASE_APPROVAL_ID',
    'REPORTING_RETENTION_JOB_VERIFIED','REPORTING_HYPERDRIVE','REPORTING_LIMIT',
    'REPORTING_TRACK_LIMIT','REPORTING_POLICY_VERSION','REPORTING_RETENTION_DAYS',
  ];
  for(const key of fields){
    const config=ready({[key]:undefined});
    assert.equal(assessIntakeRelease(config).ready,false,key);
    assert.equal((await handlePrivateReporting(post('/api/reports'),config,unavailable)).status,503,key);
  }
  for(const value of ['http://ekiti.example','https://ekiti.example/path',
    'https://person@ekiti.example','https://ekiti.example/?query=x','https://ekiti.example/']){
    assert.equal(assessIntakeRelease(ready({REPORTING_BOUND_ORIGIN:value})).ready,false,value);
  }
  for(const value of ['TRUE','1','yes','false','']){
    assert.equal(assessIntakeRelease(ready({REPORTING_RETENTION_JOB_VERIFIED:value})).ready,false,value);
  }
  const common={limit:async()=>({success:true})};
  assert.equal(assessIntakeRelease(ready({REPORTING_LIMIT:common,REPORTING_TRACK_LIMIT:common})).ready,false);
  assert.equal(assessIntakeRelease(ready({REPORTING_RETENTION_DAYS:'1'})).ready,true);
  assert.equal(assessIntakeRelease(ready({REPORTING_RETENTION_DAYS:'365'})).ready,true);
  assert.equal(assessIntakeRelease(ready({REPORTING_RETENTION_DAYS:'366'})).ready,false);
  assert.equal(assessIntakeRelease(ready({REPORTING_RETENTION_DAYS:'0'})).ready,false);
});

test('only requests matching pinned HTTPS origin can reach the private rate limiter',async()=>{
  let calls=0;
  const config=ready({REPORTING_LIMIT:{limit:async()=>{calls++;return {success:false}}}});
  const valid=await handlePrivateReporting(post('/api/reports'),config,unavailable);
  assert.equal(valid.status,429);
  assert.equal(calls,1);
  const violations=[
    post('/api/reports',{}, {Origin:''}),
    post('/api/reports',{}, {Origin:'https://hostile.example'}),
    post('/api/reports',{}, {'Sec-Fetch-Site':'same-site'}),
    post('/api/reports',{}, {'Sec-Fetch-Site':'cross-site'}),
    new Request('https://other.example/api/reports',{method:'POST',
      headers:{Origin:'https://ekiti.example','Content-Type':'application/json'},body:'{}'}),
  ];
  for(const request of violations)
    assert.equal((await handlePrivateReporting(request,config,unavailable)).status,403);
  assert.equal(calls,1,'cross-origin requests never consume limiter or open database');
});

test('intake and tracking use distinct quota bindings with no secret or query in keys',async()=>{
  const intakeKeys=[],trackingKeys=[];
  const config=ready({
    REPORTING_LIMIT:{limit:async({key})=>{intakeKeys.push(key);return {success:false}}},
    REPORTING_TRACK_LIMIT:{limit:async({key})=>{trackingKeys.push(key);return {success:false}}},
  });
  const input=post('/api/reports',{private:'narrative'});
  const tracking=post('/api/tracking',{reference:'private-reference',secret:'never-to-log'});
  assert.equal((await handlePrivateReporting(input,config,unavailable)).status,429);
  assert.equal((await handlePrivateReporting(tracking,config,unavailable)).status,429);
  assert.deepEqual(intakeKeys,['intake:local']);
  assert.deepEqual(trackingKeys,['tracking:local']);
  for(const key of [...intakeKeys,...trackingKeys]){
    assert.equal(key.includes('narrative'),false);
    assert.equal(key.includes('secret'),false);
    assert.equal(key.includes('private-reference'),false);
  }
});
