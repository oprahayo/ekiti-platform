import * as React from 'react';
import {Link} from 'react-router';
import {useCitizenAuth} from './CitizenAuth.tsx';
import CitizenSignIn from './CitizenSignIn.tsx';
import {SECRET_HEX} from '../reporting/receipt-crypto.ts';

function fragmentTicket(hash:string):string|null{
  const token=hash.startsWith('#ticket=')?hash.slice(8):'';
  return SECRET_HEX.test(token)?token:null;
}

/**
 * The ticket is in a URL *fragment*, not in a server-visible pathname or
 * query. It is removed before first paint; no fetch occurs on mount.
 * A deliberate button and the original confirmed Supabase account are
 * required before the token is sent in an HTTPS authenticated POST body.
 */
export default function CaseLinkClaim(){
  const auth=useCitizenAuth();
  const [ticket,setTicket]=React.useState<string|null>(()=>
    typeof window!=='undefined'?fragmentTicket(window.location.hash):null);
  const [opened,setOpened]=React.useState(false);
  const [state,setState]=React.useState<'ready'|'busy'|'redeemed'|'unavailable'>('ready');
  const [message,setMessage]=React.useState('');
  React.useLayoutEffect(()=>{
    const clean=window.location.pathname;
    if(window.location.hash||window.location.search)
      window.history.replaceState(window.history.state,'',clean);
  },[]);

  const redeem=async()=>{
    if(state==='busy'||!ticket||!auth.account||!auth.caseLinksAvailable)return;
    setState('busy');setMessage('');
    try{
      const ok=await auth.rpc<boolean>('civic_redeem_case_link',{_token:ticket});
      setTicket(null);
      if(ok===true){
        setState('redeemed');
        setMessage('This one-time link was accepted for your verified account. This does not confirm any government receipt or publication.');
      }else{
        setState('unavailable');
        setMessage('This link is unavailable. It may be expired, already used, or belong to another account.');
      }
    }catch{
      setTicket(null);setState('unavailable');
      setMessage('The private link could not be verified. No account or report update has been confirmed.');
    }
  };
  return <main className="page case-link-page" id="main">
    <header className="page-heading">
      <p className="eyebrow">Private case access</p>
      <h1>Open your private case link</h1>
      <p className="help-text">Independent Ekiti Civic platform · Not a government acknowledgement</p>
    </header>
    <section className="preview-privacy-section">
      {!auth.caseLinksAvailable?<p role="status">
        Private case message links have not been activated on this deployment.
        No receipt or case details can be recovered here.
      </p>:!ticket&&state!=='redeemed'?<p role="status">
        No usable case link is available. It may be missing, expired or already used.
        Request a new link only through your verified account and original receipt.
      </p>:state==='redeemed'?<p role="status">{message}</p>:<>
        <p>A link alone is not permission to view a report.
          Sign in to the same verified account that requested it.
          Redemption is single-use and expires 10 minutes after the
          dispatch attempt. No case details are exposed on this screen.</p>
        {auth.account?<p>Signed in: <strong>{auth.account.email||auth.account.phone}</strong></p>:
          <p>Sign in to verify the requesting account before redeeming this link.
            The ticket will remain only in this open tab until it is used or this page closes.</p>}
        {!auth.account&&<button type="button" className="quiet-action"
          onClick={()=>setOpened(true)}>Sign in to verified account</button>}
        {auth.account&&<button type="button" className="primary-action"
          disabled={state==='busy'} onClick={()=>void redeem()}>
          {state==='busy'?'Checking secure link…':'Redeem one-time link'}
        </button>}
        {state==='unavailable'&&<p role="status">{message}</p>}
      </>}
      <p className="note">The link token is cleared from the visible address
        before any redemption request. Do not forward it, save it as a bookmark,
        share screenshots, or treat a sent message as delivery confirmation.</p>
      <p><Link to="/profile?view=reports">View My Reports</Link></p>
    </section>
    {opened&&<CitizenSignIn onClose={()=>setOpened(false)}/>}
  </main>;
}
