import test from 'node:test';
import assert from 'node:assert/strict';
import {
  claimFragmentUrl,privateCaseMessage,dispatchOneCaseLink,
} from '../src/reporting/case-link-dispatch.ts';
import {caseLinkEnabled} from '../src/app/auth-api.ts';
import {SECRET_HEX,secretDigestHex} from '../src/reporting/receipt-crypto.ts';

const token='a'.repeat(64);
const delivery_id='12345678-1234-4234-a234-123456789abc';

test('claim link uses HTTPS origin and fragment, never a server-visible query or case reference',()=>{
  const link=claimFragmentUrl('https://ekiti.example',token);
  const parsed=new URL(link);
  assert.equal(parsed.pathname,'/case-link');
  assert.equal(parsed.search,'');
  assert.equal(parsed.hash,'#ticket='+token);
  assert.equal(parsed.href.includes('reference'),false);
  for(const origin of ['http://ekiti.example','https://ekiti.example/path',
    'https://ekiti.example?ref=1','https://user:password@ekiti.example',
    'https://ekiti.example#old','/relative','https://ekiti.example/'])
    assert.throws(()=>claimFragmentUrl(origin,token));
  for(const bad of ['',token.toUpperCase(),'9'.repeat(63),'g'.repeat(64)])
    assert.equal(SECRET_HEX.test(bad),false);
  const message=privateCaseMessage('email',link);
  assert.ok(message.includes('10 minutes'));
  assert.ok(message.includes('not a government'));
  assert.ok(!message.includes('Complaint'));
  assert.ok(!message.includes(delivery_id));
  assert.match(privateCaseMessage('sms',link),/same verified account/);
});

test('case-link UI gate is off by default, independently of historic sign-in',()=>{
  assert.equal(caseLinkEnabled(),false);
});

test('no ready delivery never calls the provider, returns nothing sensitive',async()=>{
  let sent=0;const sql=[];
  const db={query:async(q,v)=>{sql.push({q,v});return {rows:[]}}};
  const provider={submit:async()=>{sent++;return true;}};
  const result=await dispatchOneCaseLink(db,provider,'https://ekiti.example');
  assert.equal(result,'empty');assert.equal(sent,0);
  assert.equal(sql.length,1);
  assert.ok(sql[0].q.includes('case_link_delivery_lease'));
  assert.equal(sql[0].v[0].length,64);
  assert.notEqual(sql[0].v[0],token,'not an arbitrary test token');
});

test('provider acceptance is NOT proof of delivery; dispatcher never stores or returns ticket',async()=>{
  let digest='',sent=[],settle=null;
  const db={query:async(q,v)=>{
    if(q.includes('lease')){digest=v[0];return {rows:[{
      delivery_id,channel:'email',destination:'verified@testing.example',attempt:1,
    }]};}
    if(q.includes('settle')){settle=v;return {rows:[{settled:true}]};}
    throw Error('Unexpected DB access');
  }};
  const provider={submit:async msg=>{sent.push(msg);return true;}};
  const result=await dispatchOneCaseLink(db,provider,'https://ekiti.example');
  assert.equal(result,'provider_accepted');
  assert.deepEqual(settle,[delivery_id,1,true]);
  assert.equal(sent.length,1);
  const url=new URL(sent[0].text.match(/https:\/\/[^\s]+/u)[0]);
  assert.equal(url.search,'');
  assert.equal(url.pathname,'/case-link');
  const issued=url.hash.slice(8);
  assert.equal(await secretDigestHex(issued),digest);
  assert.equal(sent[0].to,'verified@testing.example');
  assert.equal(sent[0].text.includes(delivery_id),false);
  assert.equal(JSON.stringify({result,settle}).includes(issued),false);
});

test('provider failure, throwing transport or stale ACK never claims message delivered',async()=>{
  let settles=[],modes=[false,'throw',true];
  for(const mode of modes){
    const db={query:async(q,v)=>{
      if(q.includes('lease'))return {rows:[{
        delivery_id,channel:'sms',destination:'+2348012345678',attempt:3,
      }]};
      if(q.includes('settle')){settles.push(v);return {rows:[{settled:mode!==true}]};}
      throw Error('Unexpected');
    }};
    const provider={submit:async()=>{if(mode==='throw')throw Error('network down');return mode===true;}};
    const status=await dispatchOneCaseLink(db,provider,'https://ekiti.example');
    assert.equal(status,mode===true?'unconfirmed':'retry_scheduled');
  }
  assert.deepEqual(settles.map(v=>v[2]),[false,false,true]);
});
