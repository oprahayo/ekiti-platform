/**
 * Sprint 10 delivery executor — NOT connected to a Worker route, cron, or any
 * live provider. A future restricted worker may call this only after
 * independent operator, privacy, retention and sender approval.
 *
 * SQL outbox holds a token SHA-256 digest. The one-time raw 256-bit ticket
 * exists only transiently between this function and the approved provider.
 */
import {newReceiptSecret,SECRET_HEX} from './receipt-crypto.ts';
import type {Queryable} from './private-case-store.ts';

type Channel='email'|'sms';
export interface DeliveryItem {
  delivery_id:string;channel:Channel;destination:string;attempt:number;
}
export interface MessageProvider {
  /** true = provider accepted submission; not proof of delivery */
  submit(message:{channel:Channel;to:string;text:string}):Promise<boolean>;
}
export type DispatchOutcome='empty'|'provider_accepted'|'retry_scheduled'|'unconfirmed';

export function claimFragmentUrl(siteOrigin:string,token:string):string {
  if(!SECRET_HEX.test(token))throw new Error('Invalid one-time claim ticket');
  const url=new URL(siteOrigin);
  if(url.protocol!=='https:'||url.username||url.password||
    url.pathname!=='/'||url.search||url.hash||url.origin!==siteOrigin)
    throw new Error('A reviewed HTTPS origin is required');
  return url.origin+'/case-link#ticket='+token;
}
export function privateCaseMessage(channel:Channel,link:string):string {
  // No report ID, location, personal allegation, operator or government
  // acknowledgement claim is ever included in the email/SMS body.
  return channel==='sms'
    ? 'Ekiti Civic: You requested a private case link. Expires in 10 minutes. Sign in with the same verified account. '+link
    : 'You requested a private Ekiti Civic case link. Open it within 10 minutes and sign in with the same verified account. This is not a government or emergency acknowledgement. '+link;
}
export async function dispatchOneCaseLink(
  db:Queryable,provider:MessageProvider,siteOrigin:string,
):Promise<DispatchOutcome>{
  const ticket=await newReceiptSecret();
  // No ticket string is ever written into SQL, logs, URL query or response.
  const leased=await db.query<DeliveryItem>(
    "SELECT * FROM civic_private.case_link_delivery_lease(decode($1,'hex'))",
    [ticket.digestHex],
  );
  if(leased.rows.length===0)return 'empty';
  if(leased.rows.length!==1)throw new Error('Invalid delivery lease response');
  const item=leased.rows[0];
  let accepted=false;
  try{
    if((item.channel==='email'||item.channel==='sms')&&
      typeof item.destination==='string'&&item.destination.length>3&&
      Number.isInteger(item.attempt)&&item.attempt>=1&&item.attempt<=3){
      const link=claimFragmentUrl(siteOrigin,ticket.secret);
      accepted=await provider.submit({channel:item.channel,to:item.destination,
        text:privateCaseMessage(item.channel,link)});
    }
  }catch{accepted=false;}
  const settled=await db.query<{settled:boolean}>(
    'SELECT civic_private.case_link_delivery_settle($1::uuid,$2::integer,$3::boolean) AS settled',
    [item.delivery_id,item.attempt,accepted],
  );
  if(settled.rows.length!==1||settled.rows[0].settled!==true)
    return 'unconfirmed';
  return accepted?'provider_accepted':'retry_scheduled';
}
