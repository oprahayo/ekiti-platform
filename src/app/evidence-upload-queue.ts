/**
 * Browser transport for a future approved secure evidence recorder.
 *
 * No live route is enabled and the current OnDeviceRecorder remains local.
 * Caller owns explicit evidence consent and an already-committed receipt.
 * Pending chunks are bounded in volatile memory; no ID, secret, or media
 * bytes are persisted to browser storage or placed in a URL.
 */
import {
  MAX_EVIDENCE_CHUNK_BYTES,MAX_EVIDENCE_CHUNKS,EVIDENCE_SESSION_ID,sha256Bytes,
  type EvidenceKind,type EvidenceMime,type EvidenceStatus,
  type EvidenceChunkAcknowledgement,
} from '../evidence/evidence-protocol.ts';

export type EvidenceFetch=(input:string,init:RequestInit)=>Promise<Response>;
export type EvidenceUploadPhase='ready'|'uploading'|'offline'|'complete';
export interface EvidenceUploadSnapshot {
  sessionId:string;
  phase:EvidenceUploadPhase;
  ackedChunks:number;
  savedBytes:number;
  unsavedChunks:number;
  unsavedBytes:number;
  warning:string|null;
}
interface PendingSegment {index:number;sha256:string;bytes:Uint8Array;}
export class EvidenceUploadError extends Error {
  readonly code:string;
  constructor(code:string) {super(code);this.code=code;this.name='EvidenceUploadError';}
}
const MAX_PENDING=5;
const createHeaders={'Content-Type':'application/json'};
const safeFetchInit={credentials:'omit' as const,cache:'no-store' as const,
  referrerPolicy:'no-referrer' as const};
function route(id:string,suffix=''):string{
  return '/api/evidence/sessions/'+id+suffix;
}
async function parsed<T>(response:Response):Promise<T>{
  if(!response.ok)throw new EvidenceUploadError(
    response.status===404?'unavailable':response.status===429?'rate_limited':'request_failed');
  return await response.json() as T;
}

/** Use start() only AFTER approved real intake and explicit media consent. */
export class EvidenceUploadQueue {
  private pending:PendingSegment[]=[];
  private inFlight:Promise<void>|null=null;
  private captureChain:Promise<void>=Promise.resolve();
  private queuedCaptures=0;
  private nextIndex=0;
  private acked=0;
  private storedBytes=0;
  private phase:EvidenceUploadPhase='ready';
  private warning:string|null=null;
  private destroyed=false;
  private restored=false;
  private readonly sessionId:string;
  private receiptSecret:string;
  private readonly fetcher:EvidenceFetch;
  private readonly onChange:((status:EvidenceUploadSnapshot)=>void)|undefined;
  private constructor(sessionId:string,receiptSecret:string,fetcher:EvidenceFetch,
    onChange?:(status:EvidenceUploadSnapshot)=>void){
    this.sessionId=sessionId;this.receiptSecret=receiptSecret;
    this.fetcher=fetcher;this.onChange=onChange;
  }

  static async start(args:{reference:string;secret:string;kind:EvidenceKind;
    mimeType:EvidenceMime;evidencePolicyVersion:string;fetcher?:EvidenceFetch;
    onChange?:(status:EvidenceUploadSnapshot)=>void;}):Promise<EvidenceUploadQueue>{
    const fetcher=args.fetcher??fetch;
    const response=await fetcher('/api/evidence/sessions',{
      ...safeFetchInit,method:'POST',headers:createHeaders,
      body:JSON.stringify({reference:args.reference,secret:args.secret,kind:args.kind,
        mimeType:args.mimeType,evidenceConsent:true,evidencePolicyVersion:args.evidencePolicyVersion}),
    });
    const result=await parsed<{sessionId:string}>(response);
    if(!EVIDENCE_SESSION_ID.test(result.sessionId))
      throw new EvidenceUploadError('invalid_session_response');
    const instance=new EvidenceUploadQueue(result.sessionId,args.secret,fetcher,args.onChange);
    instance.publish();
    return instance;
  }

  /** Recover ACKED server progress only. Bytes not ACKed before tab loss cannot be recovered. */
  static async recover(args:{sessionId:string;secret:string;fetcher?:EvidenceFetch;
    onChange?:(status:EvidenceUploadSnapshot)=>void;}):Promise<EvidenceUploadQueue>{
    const instance=new EvidenceUploadQueue(args.sessionId,args.secret,args.fetcher??fetch,args.onChange);
    const status=await instance.remoteStatus();
    if(status.sessionId!==args.sessionId||
      status.acknowledged.some((part,i)=>part.index!==i))
      throw new EvidenceUploadError('invalid_resume_state');
    instance.acked=status.acknowledged.length;
    instance.nextIndex=instance.acked;
    instance.storedBytes=status.storedBytes;
    instance.phase=status.finished?'complete':'offline';
    instance.restored=true;
    instance.warning=status.finished?null:
      'Only server-acknowledged chunks can be recovered. Unacknowledged recording segments from the closed tab may be lost; start a separate new recording.';
    instance.publish();
    return instance;
  }

  snapshot():EvidenceUploadSnapshot {
    return {sessionId:this.sessionId,phase:this.phase,ackedChunks:this.acked,
      savedBytes:this.storedBytes,unsavedChunks:this.pending.length,
      unsavedBytes:this.pending.reduce((sum,p)=>sum+p.bytes.byteLength,0),
      warning:this.warning};
  }
  private publish(){this.onChange?.(this.snapshot());}
  private authorize():HeadersInit{
    if(this.destroyed||!this.receiptSecret)throw new EvidenceUploadError('closed');
    return {Authorization:'Bearer '+this.receiptSecret};
  }
  async remoteStatus():Promise<EvidenceStatus>{
    const response=await this.fetcher(route(this.sessionId,'/status'),{
      ...safeFetchInit,method:'POST',headers:this.authorize(),
    });
    return await parsed<EvidenceStatus>(response);
  }
  /**
   * Schedule one MediaRecorder timeslice. Does not block the recorder callback,
   * but never reports data saved until server ACK verifies object+ledger.
   */
  enqueue(blob:Blob):Promise<void>{
    if(this.destroyed||this.restored||this.phase==='complete')
      return Promise.reject(new EvidenceUploadError('recording_not_available'));
    if(!blob.size||blob.size>MAX_EVIDENCE_CHUNK_BYTES)
      return Promise.reject(new EvidenceUploadError('segment_size_unsupported'));
    if(this.nextIndex+this.queuedCaptures>=MAX_EVIDENCE_CHUNKS)
      return Promise.reject(new EvidenceUploadError('recording_limit_reached'));
    // Account for blobs still being converted: no unbounded pending file reads
    // during an outage or under a stalled network connection.
    if(this.pending.length+this.queuedCaptures>=MAX_PENDING){
      this.phase='offline';
      this.warning='The unsaved evidence buffer is full. Stop recording. Do not assume any unacknowledged segment is saved.';
      this.publish();
      return Promise.reject(new EvidenceUploadError('unsaved_buffer_full'));
    }
    this.queuedCaptures++;
    const work=this.captureChain.then(async()=>{
      try {
        const bytes=new Uint8Array(await blob.arrayBuffer());
        const sha256=await sha256Bytes(bytes);
        if(this.destroyed)return;
        this.pending.push({index:this.nextIndex++,bytes,sha256});
        this.publish();
        // Network upload runs independently of the MediaRecorder event
        // to avoid stopping chunk capture while one request is in flight.
        void this.flush();
      }finally{this.queuedCaptures--;}
    });
    this.captureChain=work.catch(()=>{});
    return work;
  }
  /** Wait for current network attempts, then inspect the actual ACK snapshot. */
  async waitForAcks():Promise<EvidenceUploadSnapshot>{
    await this.captureChain;
    if(this.inFlight)await this.inFlight;
    return this.snapshot();
  }
  /** Reconcile an ACK whose response was lost before resending pending bytes. */
  async retry():Promise<void>{
    if(this.restored)throw new EvidenceUploadError('resume_status_only');
    await this.captureChain;
    if(this.inFlight)await this.inFlight;
    const remote=await this.remoteStatus();
    if(remote.finished) {
      if(this.pending.length)throw new EvidenceUploadError('session_finished_with_unsaved_chunks');
      this.phase='complete';this.warning=null;this.publish();return;
    }
    for(const item of this.pending){
      const ack=remote.acknowledged.find(part=>part.index===item.index);
      if(ack &&(ack.sha256!==item.sha256||ack.bytes!==item.bytes.byteLength))
        throw new EvidenceUploadError('remote_integrity_mismatch');
    }
    this.pending=this.pending.filter(item=>!remote.acknowledged.some(part=>part.index===item.index));
    this.acked=remote.acknowledged.length;
    this.storedBytes=remote.storedBytes;
    this.warning=null;this.phase='ready';this.publish();
    await this.flush();
  }
  private flush():Promise<void>{
    if(this.inFlight)return this.inFlight;
    this.inFlight=this.sendPending().finally(()=>{
      this.inFlight=null;
      if(this.pending.length&&this.phase!=='offline'&&!this.destroyed)
        void this.flush();
    });
    return this.inFlight;
  }
  private async sendPending():Promise<void>{
    if(this.phase==='offline')return;
    this.phase='uploading';this.publish();
    while(this.pending.length&&!this.destroyed){
      const part=this.pending[0];
      try {
        const result=await parsed<EvidenceChunkAcknowledgement>(
          await this.fetcher(route(this.sessionId,'/chunks/'+part.index),{
            ...safeFetchInit,method:'PUT',
            headers:{...this.authorize(),'Content-Type':'application/octet-stream',
              'X-Evidence-SHA256':part.sha256},body:part.bytes.buffer as ArrayBuffer,
          }));
        if(!result.stored||result.sessionId!==this.sessionId||result.index!==part.index||
          result.sha256!==part.sha256||result.bytes!==part.bytes.byteLength)
          throw new EvidenceUploadError('invalid_acknowledgement');
        this.pending.shift();this.acked++;this.storedBytes+=part.bytes.byteLength;
        this.publish();
      } catch {
        this.phase='offline';
        this.warning='Network/storage acknowledgement failed. Some recording segments are unsaved. Stop or retry before closing this tab.';
        this.publish();
        return;
      }
    }
    this.phase='ready';this.warning=null;this.publish();
  }
  async finish():Promise<void>{
    if(this.restored)throw new EvidenceUploadError('recovered_session_cannot_be_completed');
    await this.captureChain;
    if(this.inFlight)await this.inFlight;
    if(this.pending.length&&this.phase!=='offline')await this.flush();
    if(this.pending.length||this.phase==='offline')
      throw new EvidenceUploadError('unacknowledged_segments');
    if(this.acked<1)throw new EvidenceUploadError('empty_recording');
    const response=await this.fetcher(route(this.sessionId,'/complete'),{
      ...safeFetchInit,method:'POST',
      headers:{...this.authorize(),'Content-Type':'application/json'},
      body:JSON.stringify({expectedChunks:this.acked}),
    });
    const result=await parsed<{sessionId:string;finished:boolean;storedBytes:number}>(response);
    if(result.sessionId!==this.sessionId||result.finished!==true||
      result.storedBytes!==this.storedBytes)
      throw new EvidenceUploadError('invalid_completion_acknowledgement');
    this.phase='complete';this.warning=null;this.publish();
  }
  /** Drop sensitive receipt and volatile unsaved bytes on explicit disposal. */
  dispose():void {
    this.destroyed=true;this.receiptSecret='';this.pending=[];this.warning=null;this.publish();
  }
}
