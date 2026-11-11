import test from 'node:test';
import assert from 'node:assert/strict';
import {EvidenceUploadQueue,EvidenceUploadError} from '../src/app/evidence-upload-queue.ts';
import {sha256Bytes} from '../src/evidence/evidence-protocol.ts';

const sessionId='90e541b2-b6e2-4438-85dd-d5c3dc34f981';
const secret='b'.repeat(64);
const reference='ed3b7b7c-1f31-4a15-a768-39703dfccbac';
function transport(){
  const server={acknowledged:[],storedBytes:0,finished:false,urls:[],failNext:false,loseAck:false};
  const fetcher=async(url,options)=>{
    server.urls.push(url);
    const init=options||{};
    if(url==='/api/evidence/sessions'){
      const body=JSON.parse(init.body);
      assert.deepEqual(body,{reference,secret,kind:'Audio',mimeType:'audio/webm',
        evidenceConsent:true,evidencePolicyVersion:'test-only'});
      return Response.json({sessionId},{status:201});
    }
    assert.equal(init.headers.Authorization,'Bearer '+secret);
    assert.equal(init.credentials,'omit');
    if(url.endsWith('/status')){
      return Response.json({sessionId,kind:'Audio',mimeType:'audio/webm',
        finished:server.finished,acknowledged:server.acknowledged,storedBytes:server.storedBytes});
    }
    if(url.includes('/chunks/')){
      if(server.failNext){server.failNext=false;throw Error('Offline before R2 write');}
      const index=Number(url.split('/').at(-1)),sha=init.headers['X-Evidence-SHA256'];
      const body=new Uint8Array(init.body),digest=await sha256Bytes(body);
      assert.equal(sha,digest);
      if(!server.acknowledged.some(part=>part.index===index)){
        assert.equal(index,server.acknowledged.length);
        server.acknowledged.push({index,sha256:sha,bytes:body.length});
        server.storedBytes+=body.length;
      }
      if(server.loseAck){server.loseAck=false;throw Error('Response lost AFTER remote persisted');}
      return Response.json({sessionId,index,sha256:sha,bytes:body.length,stored:true});
    }
    if(url.endsWith('/complete')){
      assert.equal(JSON.parse(init.body).expectedChunks,server.acknowledged.length);
      server.finished=true;
      return Response.json({sessionId,finished:true,storedBytes:server.storedBytes});
    }
    throw Error('Unexpected URL '+url);
  };
  return {server,fetcher};
}
const open=fetcher=>EvidenceUploadQueue.start({reference,secret,kind:'Audio',
  mimeType:'audio/webm',evidencePolicyVersion:'test-only',fetcher});

test('each MediaRecorder blob is acknowledged before savedBytes increments',async()=>{
  const {server,fetcher}=transport();const queue=await open(fetcher);
  assert.equal(queue.snapshot().savedBytes,0);
  await queue.enqueue(new Blob([Uint8Array.from([11,22,33])]));
  assert.deepEqual(queue.snapshot(),{sessionId,phase:'ready',ackedChunks:1,
    savedBytes:3,unsavedChunks:0,unsavedBytes:0,warning:null});
  await queue.enqueue(new Blob([Uint8Array.from([40,50])]));
  await queue.finish();
  assert.equal(queue.snapshot().phase,'complete');
  assert.equal(queue.snapshot().savedBytes,5);
  assert.equal(server.acknowledged.length,2);
  assert.equal(server.finished,true);
  assert.ok(server.urls.every(url=>!url.includes(secret)&&!url.includes(reference)));
  await assert.rejects(queue.enqueue(new Blob(['closed'])),{code:'recording_not_available'});
  queue.dispose();
});

test('lost network ACK is an UNSAVED warning until verified against server state',async()=>{
  const {server,fetcher}=transport();const queue=await open(fetcher);
  server.loseAck=true;
  await queue.enqueue(new Blob([Uint8Array.from([91,92,93])]));
  assert.equal(queue.snapshot().phase,'offline');
  assert.equal(queue.snapshot().savedBytes,0,'no receipt means not saved in local UI');
  assert.equal(queue.snapshot().unsavedChunks,1);
  await assert.rejects(queue.finish(),{code:'unacknowledged_segments'});
  await queue.retry();
  assert.equal(queue.snapshot().ackedChunks,1);
  assert.equal(queue.snapshot().unsavedChunks,0);
  assert.equal(queue.snapshot().savedBytes,3);
  assert.equal(queue.snapshot().warning,null);
  await queue.finish();
  assert.equal(server.acknowledged.length,1,'reconciliation does not insert duplicate data');
});

test('offline before R2 write queues unsaved bytes and retries same indexed content',async()=>{
  const {server,fetcher}=transport();const queue=await open(fetcher);
  server.failNext=true;
  await queue.enqueue(new Blob([Uint8Array.from([1,1,2,3,5,8])]));
  assert.equal(queue.snapshot().phase,'offline');
  assert.equal(queue.snapshot().unsavedBytes,6);
  assert.equal(queue.snapshot().ackedChunks,0);
  await queue.retry();
  assert.equal(queue.snapshot().savedBytes,6);
  assert.equal(queue.snapshot().unsavedChunks,0);
  await queue.finish();
});

test('recovering after tab crash never claims unacknowledged segments can be restored',async()=>{
  const {server,fetcher}=transport();server.acknowledged=[{
    index:0,sha256:'d'.repeat(64),bytes:12}];server.storedBytes=12;
  const recovered=await EvidenceUploadQueue.recover({sessionId,secret,fetcher});
  assert.equal(recovered.snapshot().savedBytes,12);
  assert.equal(recovered.snapshot().ackedChunks,1);
  assert.match(recovered.snapshot().warning,/Unacknowledged recording segments/);
  assert.equal(recovered.snapshot().phase,'offline');
  await assert.rejects(recovered.enqueue(new Blob(['new chunk'])),
    error=>error instanceof EvidenceUploadError&&error.code==='recording_not_available');
  await assert.rejects(recovered.retry(),{code:'resume_status_only'});
});
