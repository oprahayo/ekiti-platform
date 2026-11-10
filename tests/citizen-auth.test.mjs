import test from 'node:test';
import assert from 'node:assert/strict';
import {
  requestEmailCode, verifyEmailCode, authenticateSession, authorizedRpc,
} from '../src/app/auth-api.ts';
import { parsePublicReviews } from '../src/server/reviews.ts';
import worker from '../src/server/worker.ts';

const auth = { url:'https://tmifxomfsbatgshgwjpb.supabase.co',key:'sb_publishable_public_test_key_123456789' };
const user = { id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',email:'citizen@testing.example' };
const response = {
  access_token:'a'.repeat(60),
  refresh_token:'b'.repeat(60),
  expires_in:3600,
  user,
};
test('email OTP sign-in never collects passwords, government ID or service role key',async () => {
  const calls = [];
  const fake = async (url,options) => {
    calls.push({url,options});
    return Response.json({});
  };
  await requestEmailCode(auth,user.email,fake);
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,auth.url+'/auth/v1/otp');
  assert.deepEqual(JSON.parse(calls[0].options.body),{email:user.email,create_user:true});
  assert.ok(!calls[0].options.headers.Authorization);
  await assert.rejects(requestEmailCode(auth,'not-email',fake),/valid email/);
});
test('OTP verification demands numeric code and returns a time-bounded identity',async () => {
  const calls = [];
  const fake = async (url,options) => {
    calls.push({url,options});
    return Response.json(response);
  };
  const result = await verifyEmailCode(auth,user.email,'123456',fake);
  assert.equal(result.identity.email,user.email);
  assert.equal(result.identity.id,user.id);
  assert.ok(result.expires_at > Date.now()/1000 + 3500);
  assert.deepEqual(JSON.parse(calls[0].options.body),{
    email:user.email,token:'123456',type:'email',
  });
  await assert.rejects(verifyEmailCode(auth,user.email,'abc',fake),/six-digit/);
});
test('RPC requires verified identity and routes only to allowed moderation procedures',async () => {
  const calls = [];
  const fake = async (url,options) => {
    calls.push({url,options});
    if (url.endsWith('/auth/v1/user')) return Response.json(user);
    if (url.endsWith('/rest/v1/rpc/civic_submit_review'))
      return Response.json('11111111-1111-4111-8111-111111111111');
    throw new Error('Unexpected URL '+url);
  };
  const session = {
    identity:user,access_token:'a'.repeat(60),refresh_token:'b'.repeat(60),
    expires_at:Math.floor(Date.now()/1000)+3600,
  };
  const result = await authorizedRpc(auth,session,'civic_submit_review',{
    _place_id:'11111111-1111-4111-8111-111111111111',_stars:4,_body:'A useful visit',
  },fake);
  assert.equal(result,'11111111-1111-4111-8111-111111111111');
  assert.ok(calls.every(call => call.options.headers.Authorization==='Bearer '+session.access_token));
  assert.ok(!calls.some(call => call.url.includes('/api/')));
  assert.equal(calls[1].options.headers.apikey,auth.key);
});
test('public review URL parsing rejects arbitrary routes, query keys and unlimited result sets',() => {
  const id='12345678-1234-4234-a234-123456789abc';
  assert.deepEqual(parsePublicReviews('/api/places/'+id+'/reviews',new URLSearchParams()),
    {placeId:id,limit:10});
  assert.equal(parsePublicReviews('/api/places/'+id+'/reviews',new URLSearchParams('limit=20')).limit,20);
  for (const path of ['/api/places/demo-hotel-1/reviews','/api/places/not-real/reviews',
    '/api/places/'+id+'/reviews/extra']) {
    assert.throws(() => parsePublicReviews(path,new URLSearchParams()));
  }
  for (const q of ['limit=99','limit=0','limit=-1','limit=10&limit=2','foo=bar'])
    assert.throws(() => parsePublicReviews('/api/places/'+id+'/reviews',new URLSearchParams(q)));
});
test('review endpoint blocks malformed, cross-site and unsupported methods before connecting',async () => {
  const id='12345678-1234-4234-a234-123456789abc';
  const url='https://civic.example/api/places/'+id+'/reviews';
  const env={ LOCATION_LIMIT:{limit:async () => ({success:true})} };
  const wrong=await worker.fetch(new Request(url,{method:'POST'}),env);
  assert.equal(wrong.status,405);
  const bad=await worker.fetch(new Request(url+'?limit=999'),env);
  assert.equal(bad.status,400);
  const cross=await worker.fetch(new Request(url,{headers:{Origin:'https://bad.example'}}),env);
  assert.equal(cross.status,403);
  const notActive=await worker.fetch(new Request(url),env);
  assert.equal(notActive.status,503);
  assert.equal(notActive.headers.get('Cache-Control'),'no-store');
});
