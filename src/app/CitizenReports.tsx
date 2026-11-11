import * as React from 'react';
import {Link} from 'react-router';
import {useCitizenAuth} from './CitizenAuth.tsx';
import {validateLinkedReports,validateReceiptLink,type LinkedReport} from './report-account.ts';

const statusLabels:Record<LinkedReport['last_platform_event'],string>={
  intake_accepted:'Received by independent platform',
  under_review:'Under platform review',
  needs_information:'Platform requested more information',
  closed:'Closed in platform records',
};

/** Optional identity-bound report index. Never silently links by email. */
export default function CitizenReports(){
  const auth=useCitizenAuth();
  const [records,setRecords]=React.useState<LinkedReport[]>([]);
  const [loading,setLoading]=React.useState(false);
  const [notice,setNotice]=React.useState('');
  const [reference,setReference]=React.useState('');
  const [secret,setSecret]=React.useState('');
  const [consent,setConsent]=React.useState(false);
  const [busy,setBusy]=React.useState(false);
  const counter=React.useRef(0);

  React.useEffect(()=>{
    const id=++counter.current;
    setRecords([]);setNotice('');setSecret('');setReference('');setConsent(false);
    if(!auth.account||!auth.reportHistoryAvailable){setLoading(false);return;}
    setLoading(true);
    void auth.rpc<unknown>('civic_my_private_reports',{}).then(value=>{
      if(id!==counter.current)return;
      setRecords(validateLinkedReports(value));
      setLoading(false);
    }).catch(()=>{
      if(id!==counter.current)return;
      setRecords([]);setLoading(false);
      setNotice('Private report history is unavailable. No case information has been loaded.');
    });
    return ()=>{counter.current++;};
  },[auth.account?.id,auth.reportHistoryAvailable]);

  async function reload(){
    if(!auth.account||!auth.reportHistoryAvailable)return;
    const id=++counter.current;setLoading(true);setRecords([]);
    try{
      const found=validateLinkedReports(await auth.rpc<unknown>('civic_my_private_reports',{}));
      if(id!==counter.current)return;
      setRecords(found);setNotice('');
    }catch{
      if(id!==counter.current)return;
      setRecords([]);setNotice('Private report history is unavailable. Nothing was loaded.');
    }finally{if(id===counter.current)setLoading(false);}
  }
  async function link(event:React.FormEvent){
    event.preventDefault();
    if(busy||!auth.account||!auth.reportHistoryAvailable||!consent)return;
    const pair=validateReceiptLink(reference,secret);
    if(!pair){setNotice('Enter a report UUID and its 64-character private receipt secret.');return;}
    setBusy(true);setNotice('');
    try{
      // Always send the secret through authenticated HTTPS POST RPC only:
      // never a URL, HTML link, analytics, storage or console.
      const accepted=await auth.rpc<boolean>('civic_link_private_report',{
        _reference:pair.reference,_secret:pair.secret,
      });
      setSecret('');setConsent(false);
      if(accepted!==true){
        setNotice('The receipt could not be linked to this account. Check the reference and secret.');
      }else{
        setReference('');
        setNotice('Receipt accepted by the private account service. Your report is not public or government-acknowledged.');
        await reload();
      }
    }catch{
      setSecret('');setConsent(false);
      setNotice('Account linking is unavailable. No report has been confirmed or linked.');
    }finally{setBusy(false);}
  }
  async function unlink(referenceToUnlink:string){
    if(busy||!auth.account||!auth.reportHistoryAvailable)return;
    if(!window.confirm('Remove this report from your account history? The report itself will not be deleted.'))return;
    setBusy(true);setNotice('');
    try{
      const removed=await auth.rpc<boolean>('civic_unlink_private_report',{
        _reference:referenceToUnlink,
      });
      if(removed!==true)throw Error('Unavailable');
      setNotice('Removed the report link from this account. The report still has its original retention rules.');
      await reload();
    }catch{setNotice('Could not remove this account link. Try again later.');}
    finally{setBusy(false);}
  }

  return <section className="profile-subview citizen-linked-reports" aria-label="Private linked reports">
    <h2>My private reports</h2>
    <p className="note">Browsing and preparing a private report draft never requires an account.
      A verified email or phone does not establish ownership of any case.
      Only a real report reference and its private receipt secret can link a submitted case.</p>
    {!auth.account?<div>
      <p role="status">You are browsing as a guest. No personal reports are retrieved.</p>
      <p>Sign in using the Profile account button to see previously linked cases when this service is launched.</p>
      <Link to="/report">Continue a private report draft</Link>
    </div>:!auth.reportHistoryAvailable?<div>
      <p role="status">Private account report history and linking are not active on this deployment.</p>
      <p>No real cases can be recovered, linked or shown here yet.
        Your guest reports and saved drafts are not automatically associated with an account.</p>
      <Link to="/track">View the fictional tracking demonstration</Link>
    </div>:<>
      {loading&&<p role="status">Checking private account links…</p>}
      {!loading&&records.length===0&&<p role="status">
        No reports have been explicitly linked to this account. This does not mean you never submitted a report.
      </p>}
      {!loading&&records.length>0&&<ul className="plain-list citizen-linked-list">
        {records.map(record=><li key={record.public_reference}>
          <strong>{record.kind} · {statusLabels[record.last_platform_event]}</strong>
          <small>Received {new Date(record.received_at).toLocaleDateString('en-NG')}</small>
          <small>Reference: <code>{record.public_reference}</code></small>
          <small>No government acknowledgement recorded · Not on the public map</small>
          <button type="button" disabled={busy||loading}
            onClick={()=>void unlink(record.public_reference)}>Unlink from account</button>
        </li>)}
      </ul>}
      <form className="citizen-report-link-form" onSubmit={event=>void link(event)}>
        <h3>Link a report you already submitted</h3>
        <p className="note">Enter the reference and one-time private receipt secret issued after a successful server submission.
          Never share the secret or paste it in an ordinary chat, URL or public post.</p>
        <label htmlFor="citizen-link-reference">Private report reference</label>
        <input id="citizen-link-reference" type="text" maxLength={36}
          autoComplete="off" spellCheck={false} value={reference}
          disabled={busy} onChange={event=>setReference(event.target.value)}
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" required/>
        <label htmlFor="citizen-link-secret">Private receipt secret</label>
        <input id="citizen-link-secret" type="password" maxLength={64} minLength={64}
          autoComplete="off" spellCheck={false} value={secret}
          disabled={busy} onChange={event=>setSecret(event.target.value)} required/>
        <label className="citizen-report-consent">
          <input type="checkbox" checked={consent} disabled={busy}
            onChange={event=>setConsent(event.target.checked)}/>
          I authorize linking this specific private report to my verified account for cross-device history.
        </label>
        <button type="submit" className="quiet-action" disabled={busy||loading||!consent}>
          Link with private receipt
        </button>
      </form>
      <button type="button" className="text-link" disabled={busy||loading}
        onClick={()=>void reload()}>Refresh linked reports</button>
    </>}
    {notice&&<p role="status" className="note">{notice}</p>}
  </section>;
}
