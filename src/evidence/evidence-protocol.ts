/**
 * Sprint 06 private evidence protocol. No public upload is active.
 * Only verified, already-committed private reports may create sessions.
 */
import {parseTrackRequest, type TrackRequest} from '../reporting/receipt-crypto.ts';

export const MAX_EVIDENCE_CHUNK_BYTES=1_048_576; // each response must be durable before ACK
export const MAX_EVIDENCE_CHUNKS=1024;
export const MAX_EVIDENCE_TOTAL_BYTES={Audio:15_000_000,Video:25_000_000} as const;
export type EvidenceKind=keyof typeof MAX_EVIDENCE_TOTAL_BYTES;
export type EvidenceMime='audio/webm'|'audio/mp4'|'video/webm'|'video/mp4';
export const EVIDENCE_SESSION_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
export const EVIDENCE_SHA256=/^[a-f0-9]{64}$/u;

export interface EvidenceCreateRequest extends TrackRequest {
  kind:EvidenceKind;
  mimeType:EvidenceMime;
  evidenceConsent:true;
  evidencePolicyVersion:string;
}
export interface EvidenceChunkAcknowledgement {
  sessionId:string;
  index:number;
  sha256:string;
  bytes:number;
  stored:true;
}
export interface EvidenceStatus {
  sessionId:string;
  kind:EvidenceKind;
  mimeType:EvidenceMime;
  finished:boolean;
  acknowledged:readonly {index:number;sha256:string;bytes:number}[];
  storedBytes:number;
}

export class EvidenceProtocolError extends Error {
  readonly status:number;
  constructor(code:string,status:number) {
    super(code);this.status=status;this.name='EvidenceProtocolError';
  }
}

export function parseEvidenceCreate(raw:string,expectedPolicy:string):EvidenceCreateRequest {
  if(new TextEncoder().encode(raw).byteLength>500)
    throw new EvidenceProtocolError('Invalid evidence request',400);
  let data:unknown;
  try {data=JSON.parse(raw);}catch{throw new EvidenceProtocolError('Invalid evidence request',400);}
  if(!data||typeof data!=='object'||Array.isArray(data))
    throw new EvidenceProtocolError('Invalid evidence request',400);
  const item=data as Record<string,unknown>;
  if(Object.keys(item).length!==6 ||
    Object.keys(item).some(key=>!['reference','secret','kind','mimeType','evidenceConsent','evidencePolicyVersion'].includes(key)) ||
    (item.kind!=='Audio'&&item.kind!=='Video') ||
    (item.kind==='Audio'&&!['audio/webm','audio/mp4'].includes(String(item.mimeType))) ||
    (item.kind==='Video'&&!['video/webm','video/mp4'].includes(String(item.mimeType))) ||
    item.evidenceConsent!==true ||
    !expectedPolicy || item.evidencePolicyVersion!==expectedPolicy)
    throw new EvidenceProtocolError('Evidence consent or format is unavailable',400);
  let access:TrackRequest;
  try { access=parseTrackRequest(JSON.stringify({reference:item.reference,secret:item.secret})); }
  catch {throw new EvidenceProtocolError('Invalid evidence credentials',404);}
  return {...access,kind:item.kind,mimeType:item.mimeType as EvidenceMime,
    evidenceConsent:true,evidencePolicyVersion:expectedPolicy};
}

export function parseEvidenceSessionId(raw:string):string {
  if(!EVIDENCE_SESSION_ID.test(raw))
    throw new EvidenceProtocolError('Evidence session not found',404);
  return raw.toLowerCase();
}
export function parseEvidenceChunkIndex(raw:string):number {
  if(!/^(0|[1-9][0-9]{0,3})$/u.test(raw))
    throw new EvidenceProtocolError('Invalid chunk index',400);
  const index=Number(raw);
  if(!Number.isSafeInteger(index)||index>=MAX_EVIDENCE_CHUNKS)
    throw new EvidenceProtocolError('Invalid chunk index',400);
  return index;
}
export function parseEvidenceBearer(header:string|null):string {
  const match=/^Bearer ([0-9a-f]{64})$/u.exec(header||'');
  if(!match) throw new EvidenceProtocolError('Evidence session not found',404);
  return match[1];
}
export function parseChunkHash(header:string|null):string {
  if(!header||!EVIDENCE_SHA256.test(header))
    throw new EvidenceProtocolError('Invalid chunk digest',400);
  return header;
}
export function hexBytes(value:string):Uint8Array {
  if(!EVIDENCE_SHA256.test(value))
    throw new EvidenceProtocolError('Encryption key unavailable',503);
  return Uint8Array.from(value.match(/.{2}/gu)??[],part=>parseInt(part,16));
}
export function hex(value:Uint8Array):string {
  return Array.from(value,byte=>byte.toString(16).padStart(2,'0')).join('');
}
export async function sha256Bytes(bytes:Uint8Array):Promise<string> {
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return hex(new Uint8Array(digest));
}
