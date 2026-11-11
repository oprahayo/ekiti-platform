import * as React from 'react';
import {useCitizenAuth} from './CitizenAuth.tsx';
import {validateReceiptLink} from './report-account.ts';

/** Opt-in private message request: never inferred from a stored email. */
export default function CitizenCaseLinkRequest(){
  const auth=useCitizenAuth();
  const [reference,setReference]=React.useState('');
  const [secret,setSecret]=React.useState('');
  const [channel,setChannel]=React.useState<'email'|'sms'>('email');
  const [confirmed,setConfirmed]=React.useState(false);
  const [busy,setBusy]=React.useState(false);
  const [notice,setNotice]=React.useState('');
  const supportsEmail=Boolean(auth.account?.email);
  const supportsSms=Boolean(auth.account?.phone);
  React.useEffect(()=>{
    setReference('');setSecret('');setConfirmed(false);setNotice('');
    setChannel(auth.account?.email?'email':'sms');
  },[auth.account?.id]);
  if(!auth.account||!auth.caseLinksAvailable)return null;
  const available=supportsEmail||supportsSms;
  async function request(event:React.FormEvent){
    event.preventDefault();
    if(busy||!available||!confirmed)return;
    const proof=validateReceiptLink(reference,secret);
    if(!proof){setNotice('Enter the report UUID and its original 64-character receipt secret.');return;}
    setBusy(true);setNotice('');
    try{
      await auth.rpc<unknown>('civic_request_case_link',{
        _reference:proof.reference,_receipt_secret:proof.secret,_channel:channel,
      });
      // Same message for invalid receipt/nonexistent report and queued request.
      // No indication a provider delivered anything, nor whether the report exists.
      setNotice('If the receipt and verified contact are eligible, a one-time link has been queued. This does not confirm delivery. No government office has been contacted.');
    }catch{
      setNotice('Private message links are unavailable. No delivery has been confirmed.');
    }finally{
      setSecret('');setConfirmed(false);setBusy(false);
    }
  }
  return <section className="citizen-report-delivery" aria-label="Request a private case link">
    <h3>Request a private case link</h3>
    <p className="note">This optional feature sends a 10-minute, single-use link
      to an account contact whose verification is checked by the server. It never uses a new
      phone number or email typed into the request. You still must sign in
      to the same account to redeem it. This is not a case submission
      or a government acknowledgement.</p>
    {!available?<p role="status">No verified contact is available for a private case link.</p>:
    <form onSubmit={event=>void request(event)} className="citizen-report-link-form">
      <fieldset className="citizen-channel-fieldset">
        <legend>Send through verified account contact</legend>
        {supportsEmail&&<label>
          <input type="radio" name="private-delivery-channel" checked={channel==='email'}
            onChange={()=>setChannel('email')} disabled={busy}/> Account email (confirmation required)
        </label>}
        {supportsSms&&<label>
          <input type="radio" name="private-delivery-channel" checked={channel==='sms'}
            onChange={()=>setChannel('sms')} disabled={busy}/> Account phone (SMS; confirmation required)
        </label>}
      </fieldset>
      <label htmlFor="citizen-delivery-reference">Submitted report reference</label>
      <input id="citizen-delivery-reference" maxLength={36} required
        type="text" spellCheck={false} autoComplete="off" value={reference}
        disabled={busy} onChange={event=>setReference(event.target.value)}
        placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"/>
      <label htmlFor="citizen-delivery-secret">Original private receipt secret</label>
      <input id="citizen-delivery-secret" type="password" required
        maxLength={64} minLength={64} autoComplete="off" spellCheck={false}
        value={secret} disabled={busy}
        onChange={event=>setSecret(event.target.value)}/>
      <label className="citizen-report-consent">
        <input type="checkbox" checked={confirmed} disabled={busy}
          onChange={event=>setConfirmed(event.target.checked)}/>
        I request one private case link for this receipt to be sent
        to my {channel==='sms'?'confirmed phone':'confirmed email'} on this account.
      </label>
      <button type="submit" className="quiet-action"
        disabled={!confirmed||busy}>{busy?'Requesting…':'Request one-time case link'}</button>
    </form>}
    {notice&&<p role="status" className="note">{notice}</p>}
  </section>;
}
