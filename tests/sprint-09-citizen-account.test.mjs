import test from 'node:test';
import assert from 'node:assert/strict';
import {
  phoneOk,phoneOtpEnabled,privateHistoryEnabled,
  requestSmsCode,requestEmailCode,verifyEmailCode,
  authenticateSession,signOutSession,
} from '../src/app/auth-api.ts';
import {validateReceiptLink,validateLinkedReports} from '../src/app/report-account.ts';

const auth={url:'https://test-account.supabase.co',key:'sb_publishable_test_key_123456789'};
const identity={id:'ab12cd34-ab12-4bcd-9abc-123456789abc',email:'test@account.example'};
const ref='12345678-1234-4234-a234-123456789abc',secret='a'.repeat(64);
const row={public_reference:ref,kind:'Issue',received_at:'2026-11-11T05:00:00Z',
  last_platform_event:'under_review',government_acknowledged:false,
  public_map_status:'not_published'};

test('SMS is opt-in and only well-formed country-code numbers are accepted',async()=>{
  for(const valid of ['+2348012345678','+34600123456','+12025550123'])
    assert.equal(phoneOk(valid),true,valid);
  for(const invalid of ['08012345678','+00','+1','+123-555-0199','+234 801 234','+23480123456789999',''])
    assert.equal(phoneOk(invalid),false,invalid);
  assert.equal(phoneOtpEnabled(),false,'CI default has no real SMS provider flag');
  assert.equal(privateHistoryEnabled(),false,'CI default has no real private account release');
  let invoked=false;
  await assert.rejects(requestSmsCode(auth,'+2348012345678',async()=>{
    invoked=true;return Response.json({});
  }),/not been enabled/i);
  assert.equal(invoked,false,'disabled SMS never sends the phone number to any network service');
});

test('one-time email login recovers only verified identity; logout never exposes receipt',async()=>{
  const calls=[];
  const fetcher=async(url,opts)=>{
    calls.push({url,opts});
    if(url.endsWith('/auth/v1/otp'))return Response.json({});
    if(url.endsWith('/auth/v1/verify'))return Response.json({
      access_token:'a'.repeat(90),refresh_token:'b'.repeat(90),
      expires_in:3600,user:identity,
    });
    if(url.endsWith('/auth/v1/user'))return Response.json(identity);
    if(url.endsWith('/auth/v1/logout'))return new Response(null,{status:204});
    throw Error('Unexpected API '+url);
  };
  await requestEmailCode(auth,identity.email,fetcher);
  const first=await verifyEmailCode(auth,identity.email,'123456',fetcher);
  const after=await authenticateSession(auth,first,fetcher);
  assert.equal(first.identity.id,after.identity.id);
  const second=await verifyEmailCode(auth,identity.email,'654321',fetcher);
  assert.equal(second.identity.id,first.identity.id);
  assert.ok(!Object.keys(second).includes('reports'));
  await signOutSession(auth,first,fetcher);
  assert.equal(calls.at(-1).url,auth.url+'/auth/v1/logout');
  assert.ok(calls.every(call=>!call.url.includes(ref)&&!call.url.includes(secret)));
});

test('private receipt proof shape is required even for a signed-in account',()=>{
  assert.deepEqual(validateReceiptLink(ref.toUpperCase(),secret),{reference:ref,secret});
  for(const [id,pass] of [
    ['DEMO-EKP-2026-00001',secret],[ref,''],
    [ref,'abandon'],[ref,'B'.repeat(64)],
    [ref,'a'.repeat(65)],['../secret',secret],
  ])assert.equal(validateReceiptLink(id,pass),null);
});

test('linked report response rejects private narrative, fake government claims and unreviewed metadata',()=>{
  assert.deepEqual(validateLinkedReports([row]),[row]);
  assert.deepEqual(validateLinkedReports([]),[]);
  for(const bad of [
    [{...row,government_acknowledged:true}],
    [{...row,public_map_status:'published'}],
    [{...row,description:'Sensitive allegation'}],
    [{...row,secret}],
    [{...row,last_platform_event:'government_acknowledged'}],
    [{...row,public_reference:'DEMO-123'}],
    [{...row,received_at:'invalid'}],
    [row,row],
    {items:[row]},
    new Array(31).fill(row),
  ])assert.throws(()=>validateLinkedReports(bad),/Invalid private case response/);
});
