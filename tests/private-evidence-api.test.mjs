import test from 'node:test';
import assert from 'node:assert/strict';
import {handlePrivateEvidence} from '../src/server/private-evidence-routes.ts';
import {secretDigestHex} from '../src/reporting/receipt-crypto.ts';
import {sha256Bytes,hexBytes} from '../src/evidence/evidence-protocol.ts';
import worker from '../src/server/worker.ts';

const reference='ed3b7b7c-1f31-4a15-a768-39703dfccbac';
const sessionId='90e541b2-b6e2-4438-85dd-d5c3dc34f981';
const secret='a'.repeat(64);
const policy='explicit-test-only-media-notice';
const key='7f'.repeat(32);

function bucket(){
  const objects=new Map();let fail=false;
  return {
    objects,
    put:async (k,v,opts)=>{if(fail)throw Error('storage down');objects.set(k,{data:v,opts});return {etag:'stored'};},
    delete:async k=>{objects.delete(k);},
    setFail:v=>{fail=v;},
  };
}
class FakeLedger {
  constructor(objects){this.objects=objects;this.digest=null;this.sessionData=null;
    this.records=[];this.ackFails=false;this.closed=0;this.didStart=0;}
  async start(ref,dig,kind,mime,policyValue){
    if(ref!==reference||dig!==await secretDigestHex(secret)||policyValue!==policy)return null;
    this.didStart++;
    this.digest=dig;this.sessionData={kind,mime_type:mime,finished:false,total_bytes:0};
    return sessionId;
  }
  valid(id,dig){return id===sessionId&&dig===this.digest&&this.sessionData;}
  async session(id,dig){return this.valid(id,dig)?{...this.sessionData}:null;}
  async chunks(id,dig){return this.valid(id,dig)?this.records.map(x=>({index:x.index,sha256:x.sha256,bytes:x.bytes})):[];}
  async ack(id,dig,index,hash,bytes,objectKey){
    if(this.ackFails)throw Error('transaction failed');
    if(!this.valid(id,dig))throw Error('unauthorized');
    assert.ok(this.objects.has(objectKey),'R2 ciphertext is already durable before database ACK');
    const prior=this.records.find(r=>r.index===index);
    if(prior)return prior.sha256===hash&&prior.bytes===bytes?false:Promise.reject(Error('conflict'));
    if(index!==this.records.length)throw Error('out-of-order');
    this.records.push({index,sha256:hash,bytes,objectKey});
    this.sessionData.total_bytes+=bytes;
    return true;
  }
  async complete(id,dig,count){
    if(!this.valid(id,dig)||this.records.length!==count)return false;
    this.sessionData.finished=true;return true;
  }
  async close(){this.closed++;}
}
function env(overrides={}){
  const limit=()=>({limit:async()=>({success:true})});
  return {
    REPORTING_ENABLED:'true',REPORTING_BOUND_ORIGIN:'https://ekiti.example',
    REPORTING_OPERATOR_ID:'test-operator',REPORTING_RELEASE_APPROVAL_ID:'test-approval',
    REPORTING_RETENTION_JOB_VERIFIED:'true',
    REPORTING_POLICY_VERSION:'test-report',REPORTING_RETENTION_DAYS:'30',
    REPORTING_HYPERDRIVE:{connectionString:'postgres://report-test'},
    REPORTING_LIMIT:limit(),REPORTING_TRACK_LIMIT:limit(),
    EVIDENCE_ENABLED:'true',EVIDENCE_RELEASE_APPROVAL_ID:'test-evidence-approval',
    EVIDENCE_RETENTION_JOB_VERIFIED:'true',
    EVIDENCE_POLICY_VERSION:policy,EVIDENCE_KEY_HEX:key,
    EVIDENCE_HYPERDRIVE:{connectionString:'postgres://evidence-test'},
    EVIDENCE_R2:bucket(),EVIDENCE_LIMIT:limit(),
    ...overrides,
  };
}
function createRequest(body={reference,secret,kind:'Audio',mimeType:'audio/webm',
  evidenceConsent:true,evidencePolicyVersion:policy}){
  return new Request('https://ekiti.example/api/evidence/sessions',{
    method:'POST',headers:{Origin:'https://ekiti.example','Content-Type':'application/json'},
    body:JSON.stringify(body),
  });
}
function pathRequest(suffix,method='POST',body,otherHeaders={}){
  return new Request('https://ekiti.example/api/evidence/sessions/'+sessionId+suffix,{
    method,headers:{Origin:'https://ekiti.example',
      Authorization:'Bearer '+secret,
      ...(body?{'Content-Type':method==='PUT'?'application/octet-stream':'application/json'}:{}),
      ...otherHeaders},...(body?{body}:{}),
  });
}
const factory=db=>async c=>{assert.equal(c,'postgres://evidence-test');return db;};

test('evidence routes remain 404 in the deployed-style unconfigured Worker',async()=>{
  const req=createRequest();
  assert.equal((await handlePrivateEvidence(req,{},async()=>{throw Error('DB must not open');})).status,404);
  assert.equal((await worker.fetch(req,{})).status,404);
  assert.equal((await worker.fetch(pathRequest('/chunks/0','PUT',new Uint8Array([1])) ,{})).status,404);
});

test('release flags cannot be bypassed with one accidental ENABLED toggle',async()=>{
  const base=env();
  const fields=['REPORTING_ENABLED','REPORTING_BOUND_ORIGIN','REPORTING_OPERATOR_ID',
    'REPORTING_RETENTION_JOB_VERIFIED','REPORTING_RELEASE_APPROVAL_ID',
    'REPORTING_POLICY_VERSION','REPORTING_HYPERDRIVE','REPORTING_LIMIT',
    'REPORTING_TRACK_LIMIT','EVIDENCE_RELEASE_APPROVAL_ID','EVIDENCE_RETENTION_JOB_VERIFIED',
    'EVIDENCE_POLICY_VERSION','EVIDENCE_KEY_HEX','EVIDENCE_HYPERDRIVE','EVIDENCE_R2','EVIDENCE_LIMIT'];
  for(const key of fields){
    let opened=0;
    const res=await handlePrivateEvidence(createRequest(),env({[key]:undefined}),async()=>{
      opened++;throw Error('must not open');
    });
    assert.equal(res.status,key==='REPORTING_ENABLED'?503:503,key);
    assert.equal(opened,0,key);
  }
  const disabled=await handlePrivateEvidence(createRequest(),env({EVIDENCE_ENABLED:'false'}));
  assert.equal(disabled.status,404);
  const invalid=await handlePrivateEvidence(createRequest(),env({EVIDENCE_KEY_HEX:'bad'}));
  assert.equal(invalid.status,503);
  assert.ok(base.EVIDENCE_LIMIT!==base.REPORTING_LIMIT);
});

test('encrypted chunks are stored BEFORE 200 ACK and recovered by authenticated status',async()=>{
  const storage=bucket(),ledger=new FakeLedger(storage.objects),config=env({EVIDENCE_R2:storage});
  const created=await handlePrivateEvidence(createRequest(),config,factory(ledger));
  assert.equal(created.status,201);
  assert.equal((await created.json()).sessionId,sessionId);
  const bytes=new Uint8Array([17,23,34,96,200,71,1]);
  const sha=await sha256Bytes(bytes);
  const request=()=>pathRequest('/chunks/0','PUT',bytes,{
    'X-Evidence-SHA256':sha,
  });
  const uploaded=await handlePrivateEvidence(request(),config,factory(ledger));
  assert.equal(uploaded.status,200);
  assert.deepEqual(await uploaded.json(),{sessionId,index:0,sha256:sha,bytes:7,stored:true});
  assert.equal(storage.objects.size,1);
  const {data,opts}=storage.objects.values().next().value;
  assert.notDeepEqual(new Uint8Array(data),bytes);
  assert.equal(opts.customMetadata.algorithm,'AES-256-GCM');
  assert.ok(!JSON.stringify(opts.customMetadata).includes(secret));
  const imported=await crypto.subtle.importKey('raw',hexBytes(key).buffer,'AES-GCM',false,['decrypt']);
  const aad=new TextEncoder().encode(sessionId+':0:'+sha);
  const iv=Uint8Array.from(opts.customMetadata.iv.match(/.{2}/g),x=>parseInt(x,16));
  const opened=await crypto.subtle.decrypt({
    name:'AES-GCM',iv:iv.buffer,additionalData:aad.buffer,
  },imported,data);
  assert.deepEqual(new Uint8Array(opened),bytes);

  const status=await handlePrivateEvidence(pathRequest('/status'),config,factory(ledger));
  assert.equal(status.status,200);
  const state=await status.json();
  assert.equal(state.storedBytes,bytes.length);
  assert.equal(state.acknowledged.length,1);
  assert.equal(JSON.stringify(state).includes(secret),false);
  const retry=await handlePrivateEvidence(request(),config,factory(ledger));
  assert.equal(retry.status,200);
  assert.equal(storage.objects.size,1,'idempotent retry does not make another ciphertext copy');

  const finished=await handlePrivateEvidence(pathRequest('/complete','POST',
    JSON.stringify({expectedChunks:1})),config,factory(ledger));
  assert.equal(finished.status,200);
  assert.equal((await finished.json()).finished,true);
  assert.equal(ledger.closed,5);
});

test('wrong secret, invalid digest, skipped index, missing origin and conflict fail closed',async()=>{
  const storage=bucket(),ledger=new FakeLedger(storage.objects),config=env({EVIDENCE_R2:storage});
  await handlePrivateEvidence(createRequest(),config,factory(ledger));
  const payload=new Uint8Array([1,2,3]);
  const hash=await sha256Bytes(payload);
  const wrongSecret=pathRequest('/status','POST',undefined,{Authorization:'Bearer '+'e'.repeat(64)});
  assert.equal((await handlePrivateEvidence(wrongSecret,config,factory(ledger))).status,404);
  assert.equal((await handlePrivateEvidence(pathRequest('/chunks/1','PUT',payload,{'X-Evidence-SHA256':hash}),
    config,factory(ledger))).status,409);
  assert.equal((await handlePrivateEvidence(pathRequest('/chunks/0','PUT',payload,
    {'X-Evidence-SHA256':'f'.repeat(64)}),config,factory(ledger))).status,422);
  assert.equal((await handlePrivateEvidence(pathRequest('/chunks/0','PUT',payload,
    {'X-Evidence-SHA256':hash,Origin:''}),config,factory(ledger))).status,403);
  assert.equal((await handlePrivateEvidence(pathRequest('/chunks/0','PUT',payload,
    {'X-Evidence-SHA256':hash,Authorization:''}),config,factory(ledger))).status,404);
  assert.equal(storage.objects.size,0);
  assert.equal((await handlePrivateEvidence(pathRequest('/complete','POST',
    JSON.stringify({expectedChunks:1})),config,factory(ledger))).status,409);
});

test('failed object write and failed database acknowledgement never return durable ACK',async()=>{
  const storage=bucket(),ledger=new FakeLedger(storage.objects),config=env({EVIDENCE_R2:storage});
  await handlePrivateEvidence(createRequest(),config,factory(ledger));
  const payload=new Uint8Array([11,12,13]),sha=await sha256Bytes(payload);
  storage.setFail(true);
  assert.equal((await handlePrivateEvidence(pathRequest('/chunks/0','PUT',payload,
    {'X-Evidence-SHA256':sha}),config,factory(ledger))).status,503);
  assert.equal(ledger.records.length,0);
  storage.setFail(false);ledger.ackFails=true;
  assert.equal((await handlePrivateEvidence(pathRequest('/chunks/0','PUT',payload,
    {'X-Evidence-SHA256':sha}),config,factory(ledger))).status,503);
  assert.equal(ledger.records.length,0);
  assert.equal(storage.objects.size,0,'failed ledger ack cleans up uncommitted object');
});
