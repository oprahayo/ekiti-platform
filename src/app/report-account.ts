import {REFERENCE_UUID,SECRET_HEX} from '../reporting/receipt-crypto.ts';

/**
 * Read-only private case metadata; the report narrative, contact, media and
 * exact incident location NEVER belong in this account response.
 */
export interface LinkedReport {
  public_reference:string;
  kind:'Issue'|'Complaint'|'Commendation';
  received_at:string;
  last_platform_event:'intake_accepted'|'under_review'|'needs_information'|'closed';
  government_acknowledged:false;
  public_map_status:'not_published';
}
const kinds=['Issue','Complaint','Commendation'];
const events=['intake_accepted','under_review','needs_information','closed'];
export function validateLinkedReports(raw:unknown):LinkedReport[]{
  if(!Array.isArray(raw)||raw.length>30)throw new Error('Invalid private case response.');
  const seen=new Set<string>();
  return raw.map(value=>{
    if(!value||typeof value!=='object'||Array.isArray(value))
      throw new Error('Invalid private case response.');
    const x=value as Record<string,unknown>;
    if(Object.keys(x).sort().join('|')!==
      ['public_reference','kind','received_at','last_platform_event',
        'government_acknowledged','public_map_status'].sort().join('|')||
      typeof x.public_reference!=='string'||!REFERENCE_UUID.test(x.public_reference)||
      seen.has(x.public_reference)||
      !kinds.includes(String(x.kind))||
      !events.includes(String(x.last_platform_event))||
      x.government_acknowledged!==false||x.public_map_status!=='not_published'||
      typeof x.received_at!=='string'||!Number.isFinite(Date.parse(x.received_at)))
      throw new Error('Invalid private case response.');
    seen.add(x.public_reference);
    return x as unknown as LinkedReport;
  });
}
export function validateReceiptLink(reference:string,secret:string):
  {reference:string;secret:string}|null{
  const ref=reference.trim().toLowerCase();
  const pass=secret.trim();
  if(!REFERENCE_UUID.test(ref)||!SECRET_HEX.test(pass))return null;
  return {reference:ref,secret:pass};
}
