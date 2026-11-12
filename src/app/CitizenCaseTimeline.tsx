import * as React from 'react';
import {useCitizenAuth} from './CitizenAuth.tsx';
import {validateCaseTimeline,platformEventCopy,
  type CaseTimeline,type PrivateNoticeChannel} from './case-timeline.ts';

export default function CitizenCaseTimeline({reference}:{reference:string}){
  const auth=useCitizenAuth();
  const [expanded,setExpanded]=React.useState(false);
  const [loading,setLoading]=React.useState(false);
  const [timeline,setTimeline]=React.useState<CaseTimeline|null>(null);
  const [choice,setChoice]=React.useState<PrivateNoticeChannel>('off');
  const [consent,setConsent]=React.useState(false);
  const [busy,setBusy]=React.useState(false);
  const [notice,setNotice]=React.useState('');
  const generation=React.useRef(0);
  React.useEffect(()=>{
    generation.current++;setExpanded(false);setTimeline(null);
    setChoice('off');setConsent(false);setBusy(false);setNotice('');
    return ()=>{generation.current++;};
  },[reference,auth.account?.id,auth.caseTimelineAvailable]);

  async function load(){
    if(!auth.account||!auth.caseTimelineAvailable)return;
    const id=++generation.current;
    setLoading(true);setTimeline(null);setNotice('');
    try{
      // PostgREST returns a JSON array for a RETURNS TABLE function.
      // Zero or >1 rows must fail closed; do not infer missing case ownership.
      const response=await auth.rpc<unknown>('civic_my_case_timeline',{_reference:reference});
      if(id!==generation.current)return;
      if(!Array.isArray(response)||response.length!==1)
        throw new Error('Case unavailable');
      const result=validateCaseTimeline(response[0],reference);
      setTimeline(result);setChoice(result.notification_channel);
    }catch{
      if(id!==generation.current)return;
      setNotice('Private case timeline is unavailable or this account is not authorized to see it.');
    }finally{if(id===generation.current)setLoading(false);}
  }
  async function setPreference(){
    if(busy||!timeline||!auth.caseTimelineAvailable||
      (choice!=='off'&&!consent))return;
    setBusy(true);setNotice('');
    try{
      const accepted=await auth.rpc<boolean>('civic_set_case_notice_preference',{
        _reference:reference,_channel:choice,
      });
      if(accepted!==true)throw Error('Not accepted');
      setConsent(false);
      await load();
      setNotice(choice==='off'?
        'Contact preference turned off for this linked case.':
        'Contact preference recorded for possible future platform updates. No email or SMS has been queued or sent.');
    }catch{
      setNotice('Notification preference was not confirmed. No message has been sent.');
    }finally{setBusy(false);}
  }
  async function askReview(kind:'correction'|'potential_duplicate'){
    if(busy||!timeline||!auth.caseTimelineAvailable)return;
    const prompt=kind==='correction'
      ? 'Request a platform correction review? This does not edit the original report or contact an agency.'
      : 'Flag a possible duplicate for future platform review? This does not merge any cases.';
    if(!window.confirm(prompt))return;
    setBusy(true);setNotice('');
    try{
      const ok=await auth.rpc<boolean>('civic_request_case_review',{
        _reference:reference,_kind:kind,
      });
      if(ok!==true)throw Error('Not accepted');
      await load();
      setNotice('Your request was recorded by the independent platform. No moderator response or action is promised.');
    }catch{
      setNotice('The request could not be confirmed. No case change has been made.');
    }finally{setBusy(false);}
  }

  if(!auth.caseTimelineAvailable)return <p className="note">
    Detailed private case timelines and contact preferences are not active on this deployment.
  </p>;
  return <div className="citizen-timeline-panel">
    <button type="button" className="quiet-action"
      aria-expanded={expanded} disabled={busy}
      onClick={()=>{
        if(expanded){generation.current++;setExpanded(false);setTimeline(null);setNotice('');}
        else {setExpanded(true);void load();}
      }}>
      {expanded?'Hide private platform timeline':'View private platform timeline'}
    </button>
    {expanded&&<section aria-label="Private platform case timeline">
      {loading&&<p role="status">Checking this case securely…</p>}
      {timeline&&<>
        <h3>Platform event history</h3>
        <p className="note">Independent platform events only. No agency was
          contacted or acknowledged solely because one of these appears.
          A closed event is not proof of repair or resolution.</p>
        {timeline.events.length>0?<ol className="citizen-platform-events">
          {timeline.events.map((event,i)=><li key={i}>
            <strong>{platformEventCopy[event.kind].title}</strong>
            <time dateTime={event.at}>{new Date(event.at).toLocaleString('en-NG')}</time>
            <small>{platformEventCopy[event.kind].description}</small>
          </li>)}
        </ol>:<p role="status">No approved platform events are available for this case.</p>}
        <p className="citizen-status-clarity">
          <strong>Government acknowledgement:</strong> Not recorded.
          <strong> Public map:</strong> Not published.
        </p>
        <fieldset className="citizen-timeline-preferences">
          <legend>Optional contact preference for this report</legend>
          <p className="note">This records a preference only. No status message,
            email, SMS or push notification will be sent by this feature.
            The server must verify your existing account contact.</p>
          <label htmlFor={'notice-'+reference}>Preferred contact</label>
          <select id={'notice-'+reference} value={choice} disabled={busy}
            onChange={event=>{
              setChoice(event.target.value as PrivateNoticeChannel);
              setConsent(false);
            }}>
            <option value="off">Off — no contact</option>
            {auth.account?.email&&<option value="email">Account email (must be verified)</option>}
            {auth.account?.phone&&<option value="sms">Account phone (SMS, must be verified)</option>}
          </select>
          {choice!=='off'&&<label className="citizen-report-consent">
            <input type="checkbox" checked={consent} disabled={busy}
              onChange={event=>setConsent(event.target.checked)}/>
            I choose this verified account contact for potential future
            platform-only case updates, subject to separate delivery approval.
          </label>}
          <button type="button" className="quiet-action"
            disabled={busy||(choice!=='off'&&!consent)}
            onClick={()=>void setPreference()}>Save contact preference</button>
        </fieldset>
        <section className="citizen-timeline-review">
          <h3>Ask for a platform review</h3>
          <p className="note">These are review requests only. They do not revise
            the case, merge duplicates, create a new report, or notify officials.</p>
          <button type="button" disabled={busy||timeline.correction_review_requested}
            onClick={()=>void askReview('correction')}>
            {timeline.correction_review_requested?'Correction review requested':'Request correction review'}
          </button>
          <button type="button" disabled={busy||timeline.duplicate_review_requested}
            onClick={()=>void askReview('potential_duplicate')}>
            {timeline.duplicate_review_requested?'Possible duplicate flagged':'Flag possible duplicate'}
          </button>
        </section>
      </>}
      {notice&&<p className="note" role="status">{notice}</p>}
      {!loading&&!timeline&&<button type="button" className="text-link"
        onClick={()=>void load()}>Retry private timeline</button>}
    </section>}
  </div>;
}
