import {REFERENCE_UUID} from '../reporting/receipt-crypto.ts';

export const privateEventKinds=[
  'intake_accepted','under_review','needs_information','closed',
] as const;
export type PlatformEventKind=typeof privateEventKinds[number];
export type PrivateNoticeChannel='off'|'email'|'sms';
export interface PrivateEvent {
  kind:PlatformEventKind;
  at:string;
  origin:'independent_platform';
}
export interface CaseTimeline {
  public_reference:string;
  kind:'Complaint'|'Issue'|'Commendation';
  received_at:string;
  events:PrivateEvent[];
  notification_channel:PrivateNoticeChannel;
  correction_review_requested:boolean;
  duplicate_review_requested:boolean;
  government_acknowledged:false;
  public_map_status:'not_published';
}
export function caseTimelineEnabled():boolean{
  const env=(import.meta as ImportMeta&{env?:Record<string,string|undefined>}).env;
  // Never show a production account timeline merely because the UI was built.
  return env?.VITE_CITIZEN_TIMELINE_ENABLED==='true';
}
const keys=['public_reference','kind','received_at','events',
  'notification_channel','correction_review_requested','duplicate_review_requested',
  'government_acknowledged','public_map_status'].sort().join('|');
const eventKeys=['kind','at','origin'].sort().join('|');
function validDate(input:unknown):input is string {
  return typeof input==='string'&&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(input)&&
    Number.isFinite(Date.parse(input));
}

/** No hidden notes, private contact or fabricated official acknowledgements. */
export function validateCaseTimeline(raw:unknown,expectedReference:string):CaseTimeline{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))
    throw new Error('Invalid case timeline response');
  const v=raw as Record<string,unknown>;
  if(Object.keys(v).sort().join('|')!==keys||
    typeof v.public_reference!=='string'||!REFERENCE_UUID.test(v.public_reference)||
    v.public_reference!==expectedReference||
    !['Complaint','Issue','Commendation'].includes(String(v.kind))||
    !validDate(v.received_at)||
    !['off','email','sms'].includes(String(v.notification_channel))||
    typeof v.correction_review_requested!=='boolean'||
    typeof v.duplicate_review_requested!=='boolean'||
    v.government_acknowledged!==false||v.public_map_status!=='not_published'||
    !Array.isArray(v.events)||v.events.length>50)
    throw new Error('Invalid case timeline response');
  let before=0;
  const events=v.events.map(rawEvent=>{
    if(!rawEvent||typeof rawEvent!=='object'||Array.isArray(rawEvent))
      throw new Error('Invalid case timeline event');
    const e=rawEvent as Record<string,unknown>;
    if(Object.keys(e).sort().join('|')!==eventKeys||
      !privateEventKinds.includes(e.kind as PlatformEventKind)||
      !validDate(e.at)||e.origin!=='independent_platform')
      throw new Error('Invalid case timeline event');
    const time=Date.parse(e.at);
    if(time<before)throw new Error('Invalid case timeline event order');
    before=time;
    return {kind:e.kind as PlatformEventKind,at:e.at,
      origin:'independent_platform' as const};
  });
  return {...v,events} as CaseTimeline;
}

export const platformEventCopy:Record<PlatformEventKind,{
  title:string;description:string
}>={
  intake_accepted:{
    title:'Received by the independent platform',
    description:'The platform stored this case. This does not establish delivery to an official.',
  },
  under_review:{
    title:'Under platform review',
    description:'A platform moderator event was recorded. No government office is implied.',
  },
  needs_information:{
    title:'More information requested by platform',
    description:'This is a platform status. Do not send sensitive details without a reviewed secure channel.',
  },
  closed:{
    title:'Closed in platform records',
    description:'Closure is a platform event, not independent proof of repair or resolution.',
  },
};
