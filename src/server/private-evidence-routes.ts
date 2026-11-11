/**
 * Proposed private, receipt-authorized streaming evidence gateway.
 * The normal Worker is 404 unless both the report and evidence releases
 * are independently approved. No R2 bucket, DB grants or secrets are live.
 */
import pg from 'pg';
import {assessIntakeRelease,type IntakeReleaseConfig,type RateLimitBinding} from '../reporting/intake-release.ts';
import {secretDigestHex} from '../reporting/receipt-crypto.ts';
import {
  MAX_EVIDENCE_CHUNK_BYTES,MAX_EVIDENCE_TOTAL_BYTES,MAX_EVIDENCE_CHUNKS,
  parseEvidenceBearer,parseEvidenceChunkIndex,parseEvidenceCreate,
  parseEvidenceSessionId,parseChunkHash,hexBytes,hex,sha256Bytes,
  type EvidenceKind,type EvidenceMime,type EvidenceStatus,type EvidenceChunkAcknowledgement,
  EvidenceProtocolError,
} from '../evidence/evidence-protocol.ts';

export interface PrivateObjectBucket {
  put(key:string,value:ArrayBuffer,options:{
    httpMetadata:{contentType:string};
    customMetadata:Record<string,string>;
  }):Promise<{etag:string}|null>;
  delete(key:string):Promise<void>;
}
export interface EvidenceEnvironment extends IntakeReleaseConfig {
  EVIDENCE_ENABLED?:string;
  EVIDENCE_RELEASE_APPROVAL_ID?:string;
  EVIDENCE_RETENTION_JOB_VERIFIED?:string;
  EVIDENCE_POLICY_VERSION?:string;
  EVIDENCE_KEY_HEX?:string;
  EVIDENCE_R2?:PrivateObjectBucket;
  EVIDENCE_HYPERDRIVE?:{connectionString:string};
  EVIDENCE_LIMIT?:RateLimitBinding;
}

export interface EvidenceDbSession {
  kind:EvidenceKind;
  mime_type:EvidenceMime;
  finished:boolean;
  total_bytes:number;
}
export interface EvidenceDbChunk { index:number;sha256:string;bytes:number; }
export interface EvidenceDatabase {
  start(reference:string,digest:string,kind:EvidenceKind,mime:EvidenceMime,policy:string):Promise<string|null>;
  session(id:string,digest:string):Promise<EvidenceDbSession|null>;
  chunks(id:string,digest:string):Promise<EvidenceDbChunk[]>;
  ack(id:string,digest:string,index:number,sha256:string,bytes:number,objectKey:string):Promise<boolean>;
  complete(id:string,digest:string,count:number):Promise<boolean>;
  close():Promise<void>;
}
export type EvidenceDbFactory=(connectionString:string)=>Promise<EvidenceDatabase>;

export async function openEvidenceDatabase(connectionString:string):Promise<EvidenceDatabase> {
  const client=new pg.Client({connectionString,
    connectionTimeoutMillis:5000,query_timeout:5000,statement_timeout:5000});
  await client.connect();
  return {
    async start(reference,digest,kind,mime,policy) {
      const r=await client.query<{session_id:string}>(
        "SELECT civic_private.start_evidence_session($1::uuid,decode($2,'hex'),$3,$4,$5) AS session_id",
        [reference,digest,kind,mime,policy]);
      return r.rows[0]?.session_id??null;
    },
    async session(id,digest) {
      const r=await client.query<EvidenceDbSession>(
        "SELECT * FROM civic_private.evidence_session_status($1::uuid,decode($2,'hex'))",
        [id,digest]);
      return r.rows[0]??null;
    },
    async chunks(id,digest) {
      const r=await client.query<EvidenceDbChunk>(
        "SELECT index, encode(sha256,'hex') AS sha256, bytes FROM civic_private.evidence_chunk_list($1::uuid,decode($2,'hex'))",
        [id,digest]);
      return r.rows;
    },
    async ack(id,digest,index,sha256,bytes,objectKey) {
      const r=await client.query<{stored:boolean}>(
        "SELECT civic_private.ack_evidence_chunk($1::uuid,decode($2,'hex'),$3::integer,decode($4,'hex'),$5::integer,$6) AS stored",
        [id,digest,index,sha256,bytes,objectKey]);
      return r.rows[0]?.stored===true;
    },
    async complete(id,digest,count) {
      const r=await client.query<{finished:boolean}>(
        "SELECT civic_private.finish_evidence_session($1::uuid,decode($2,'hex'),$3::integer) AS finished",
        [id,digest,count]);
      return r.rows[0]?.finished===true;
    },
    close:()=>client.end(),
  };
}

const headers={'Cache-Control':'no-store','Pragma':'no-cache',
  'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
  'X-Robots-Tag':'noindex, nofollow'};
function json(data:unknown,status:number):Response {
  return Response.json(data,{status,headers});
}
async function readSmall(request:Request,max:number):Promise<string> {
  const size=request.headers.get('Content-Length');
  if(size!==null&&(!/^\d+$/.test(size)||Number(size)>max))
    throw new EvidenceProtocolError('Invalid request size',413);
  if(!request.body)throw new EvidenceProtocolError('Invalid request size',400);
  const reader=request.body.getReader();const chunks:Uint8Array[]=[];let count=0;
  try {
    while(true) {
      const {done,value}=await reader.read();
      if(done)break;
      count+=value.length;
      if(count>max){await reader.cancel();throw new EvidenceProtocolError('Invalid request size',413);}
      chunks.push(value);
    }
  } finally {reader.releaseLock();}
  const bytes=new Uint8Array(count);let at=0;
  for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}
  return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
}
async function readChunk(request:Request):Promise<Uint8Array> {
  const size=request.headers.get('Content-Length');
  if(size!==null&&(!/^\d+$/.test(size)||Number(size)>MAX_EVIDENCE_CHUNK_BYTES))
    throw new EvidenceProtocolError('Evidence chunk too large',413);
  if(!request.body)throw new EvidenceProtocolError('Empty evidence chunk',400);
  const reader=request.body.getReader();const parts:Uint8Array[]=[];let bytes=0;
  try {
    while(true) {
      const {done,value}=await reader.read();if(done)break;
      bytes+=value.length;
      if(bytes>MAX_EVIDENCE_CHUNK_BYTES){await reader.cancel();throw new EvidenceProtocolError('Evidence chunk too large',413);}
      parts.push(value);
    }
  } finally {reader.releaseLock();}
  if(!bytes)throw new EvidenceProtocolError('Empty evidence chunk',400);
  const combined=new Uint8Array(bytes);let position=0;
  for(const part of parts){combined.set(part,position);position+=part.length;}
  return combined;
}
function sameRecord(a:EvidenceDbChunk, index:number,sha:string,bytes:number):boolean {
  return Number(a.index)===index&&a.sha256===sha&&Number(a.bytes)===bytes;
}
function ensureEvidenceRelease(env:EvidenceEnvironment):ReturnType<typeof assessIntakeRelease> {
  return assessIntakeRelease(env);
}

export async function handlePrivateEvidence(
  request:Request,env:EvidenceEnvironment,openDb:EvidenceDbFactory=openEvidenceDatabase,
):Promise<Response> {
  // Critical: no body reads, storage touches or DB opens while disabled.
  if(env.EVIDENCE_ENABLED!=='true')return json({error:'Unknown route'},404);
  const url=new URL(request.url);
  if(url.search||url.hash)return json({error:'Unknown route'},404);
  const isCreate=url.pathname==='/api/evidence/sessions';
  const match=/^\/api\/evidence\/sessions\/([a-f0-9-]{36})(?:\/(chunks\/([0-9]+)|status|complete))?$/iu.exec(url.pathname);
  if(!isCreate&&!match)return json({error:'Unknown route'},404);
  const action=isCreate?'create':match?.[2]==='status'?'status':match?.[2]==='complete'?'complete':
    match?.[3]!==undefined?'chunk':'unknown';
  if(action==='unknown')return json({error:'Unknown route'},404);
  const requiredMethod=action==='chunk'?'PUT':'POST';
  if(request.method!==requiredMethod)return json({error:'Unsupported method'},405);

  const readiness=ensureEvidenceRelease(env);
  if(!readiness.ready || !env.EVIDENCE_R2 || !env.EVIDENCE_HYPERDRIVE?.connectionString?.trim() ||
    !env.EVIDENCE_LIMIT ||
    env.EVIDENCE_LIMIT===env.REPORTING_LIMIT || env.EVIDENCE_LIMIT===env.REPORTING_TRACK_LIMIT ||
    !env.EVIDENCE_RELEASE_APPROVAL_ID?.trim() ||
    env.EVIDENCE_RETENTION_JOB_VERIFIED!=='true' ||
    !env.EVIDENCE_POLICY_VERSION?.trim() ||
    !/^[a-f0-9]{64}$/u.test(env.EVIDENCE_KEY_HEX||'')) {
    return json({error:'Secure evidence unavailable'},503);
  }
  const site=request.headers.get('Sec-Fetch-Site');
  if(url.origin!==readiness.origin ||
     request.headers.get('Origin')!==readiness.origin ||
     (site!==null&&site!=='same-origin'))
    return json({error:'Cross-site request denied'},403);
  try {
    const ip=request.headers.get('CF-Connecting-IP')||'local';
    if(!(await env.EVIDENCE_LIMIT.limit({key:'evidence:'+ip})).success)
      return json({error:'Try again later'},429);
  } catch {return json({error:'Secure evidence unavailable'},503);}

  let db:EvidenceDatabase|undefined;
  try {
    const sessionId=isCreate?null:parseEvidenceSessionId(match![1]);
    const index=action==='chunk'?parseEvidenceChunkIndex(match![3]):null;
    const auth=isCreate?null:parseEvidenceBearer(request.headers.get('Authorization'));
    if(action==='chunk'&&request.headers.get('Content-Type')!=='application/octet-stream')
      throw new EvidenceProtocolError('Expected binary evidence chunk',415);
    if((action==='create'||action==='complete')&&
       request.headers.get('Content-Type')?.split(';')[0]?.trim()!=='application/json')
      throw new EvidenceProtocolError('Expected JSON',415);

    // Parse and validate BEFORE database access. No values enter logs.
    const create=action==='create'?
      parseEvidenceCreate(await readSmall(request,500),env.EVIDENCE_POLICY_VERSION):null;
    const binary=action==='chunk'?await readChunk(request):null;
    const claimedHash=binary?parseChunkHash(request.headers.get('X-Evidence-SHA256')):null;
    const actualHash=binary?await sha256Bytes(binary):null;
    if(binary&&claimedHash!==actualHash)
      throw new EvidenceProtocolError('Evidence chunk digest mismatch',422);
    let expectedChunks:number|null=null;
    if(action==='complete') {
      const raw=await readSmall(request,80);
      let value:unknown;
      try{value=JSON.parse(raw);}catch{throw new EvidenceProtocolError('Invalid completion request',400);}
      if(!value||typeof value!=='object'||Array.isArray(value)||
        Object.keys(value).length!==1||
        !Number.isInteger((value as {expectedChunks?:unknown}).expectedChunks)||
        Number((value as {expectedChunks:number}).expectedChunks)<1||
        Number((value as {expectedChunks:number}).expectedChunks)>MAX_EVIDENCE_CHUNKS)
        throw new EvidenceProtocolError('Invalid completion request',400);
      expectedChunks=(value as {expectedChunks:number}).expectedChunks;
    }
    db=await openDb(env.EVIDENCE_HYPERDRIVE!.connectionString);
    const digest=await secretDigestHex(create?create.secret:auth!);
    if(create){
      const id=await db.start(create.reference,digest,create.kind,create.mimeType,
        create.evidencePolicyVersion);
      if(!id)throw new EvidenceProtocolError('Evidence session not found',404);
      return json({sessionId:parseEvidenceSessionId(id),storedBytes:0,acknowledged:[]},201);
    }
    const session=await db.session(sessionId!,digest);
    if(!session)throw new EvidenceProtocolError('Evidence session not found',404);
    const chunks=await db.chunks(sessionId!,digest);
    if(action==='status'){
      const status:EvidenceStatus={sessionId:sessionId!,kind:session.kind,mimeType:session.mime_type,
        finished:session.finished,storedBytes:Number(session.total_bytes),
        acknowledged:chunks.map(c=>({index:Number(c.index),sha256:c.sha256,bytes:Number(c.bytes)}))};
      return json(status,200);
    }
    if(action==='complete'){
      if(session.finished)return json({sessionId,finished:true,storedBytes:Number(session.total_bytes)},200);
      if(chunks.length!==expectedChunks||
        chunks.some((chunk,i)=>Number(chunk.index)!==i))
        throw new EvidenceProtocolError('Some evidence chunks are not acknowledged',409);
      if(!await db.complete(sessionId!,digest,expectedChunks!))
        throw new EvidenceProtocolError('Some evidence chunks are not acknowledged',409);
      return json({sessionId,finished:true,storedBytes:Number(session.total_bytes)},200);
    }
    if(!binary||claimedHash===null||index===null)
      throw new EvidenceProtocolError('Invalid evidence chunk',400);
    const prior=chunks.find(c=>Number(c.index)===index);
    if(prior){
      if(!sameRecord(prior,index,claimedHash,binary.length))
        throw new EvidenceProtocolError('Chunk index already used',409);
      const ack:EvidenceChunkAcknowledgement={sessionId:sessionId!,index,sha256:claimedHash,
        bytes:binary.length,stored:true};
      return json(ack,200);
    }
    if(session.finished)throw new EvidenceProtocolError('Recording already completed',409);
    if(index!==chunks.length||chunks.some((chunk,i)=>Number(chunk.index)!==i))
      throw new EvidenceProtocolError('Evidence chunks must be sequential',409);
    if(binary.length>MAX_EVIDENCE_CHUNK_BYTES ||
       Number(session.total_bytes)+binary.length>MAX_EVIDENCE_TOTAL_BYTES[session.kind])
      throw new EvidenceProtocolError('Evidence recording size exceeded',413);

    // AES-256-GCM with a fresh random nonce PER chunk. Use a private R2
    // binding only; no public links or GET evidence routes exist here.
    const keyBytes=hexBytes(env.EVIDENCE_KEY_HEX!);
    const key=await crypto.subtle.importKey('raw',keyBytes.buffer as ArrayBuffer,
      {name:'AES-GCM'},false,['encrypt']);
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const additionalData=new TextEncoder().encode(
      sessionId+':'+index+':'+claimedHash);
    const ciphertext=await crypto.subtle.encrypt({
      name:'AES-GCM',iv:iv.buffer as ArrayBuffer,
      additionalData:additionalData.buffer as ArrayBuffer,
    },key,binary.buffer as ArrayBuffer);
    const objectKey='private-evidence/v1/'+crypto.randomUUID()+'/'+crypto.randomUUID();
    let written=false;
    try {
      const stored=await env.EVIDENCE_R2.put(objectKey,ciphertext,{
        httpMetadata:{contentType:'application/octet-stream'},
        customMetadata:{algorithm:'AES-256-GCM',iv:hex(iv),sha256:claimedHash,
          sessionId:sessionId!,index:String(index)},
      });
      if(!stored?.etag)throw new EvidenceProtocolError('Secure evidence unavailable',503);
      written=true;
      const inserted=await db.ack(sessionId!,digest,index,claimedHash,binary.length,objectKey);
      if(!inserted){
        // A concurrent retry may have been committed. Never leave an
        // unreferenced ciphertext object behind if it is not our winner.
        await env.EVIDENCE_R2.delete(objectKey).catch(()=>{});
        const current=await db.chunks(sessionId!,digest);
        if(!current.some(c=>sameRecord(c,index,claimedHash,binary.length)))
          throw new EvidenceProtocolError('Chunk index already used',409);
      }
      const ack:EvidenceChunkAcknowledgement={sessionId:sessionId!,index,sha256:claimedHash,
        bytes:binary.length,stored:true};
      return json(ack,200);
    } catch(error) {
      if(written)await env.EVIDENCE_R2.delete(objectKey).catch(()=>{});
      throw error;
    }
  } catch(error) {
    if(error instanceof EvidenceProtocolError)
      return json({error:error.message},error.status);
    // No media bytes, receipt secret, SQL, origin or object key in responses.
    return json({error:'Secure evidence unavailable'},503);
  } finally {
    if(db)await db.close().catch(()=>{});
  }
}
