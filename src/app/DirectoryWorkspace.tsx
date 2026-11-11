import * as React from 'react';
import {Link} from 'react-router';
import {useCitizenAuth} from './CitizenAuth.tsx';
import {readListingDrafts,removeListingDraft,type ListingDraft} from './directory-drafts.ts';
import {lgas} from './fixtures.ts';

interface Submission{
  id:string;name:string;category:string;lga_id:string;description:string;
  status:'pending'|'under_review'|'approved'|'rejected'|'withdrawn';
  submitted_at:string;updated_at:string;
}
const statuses:Record<Submission['status'],string>={
  pending:'Awaiting review',under_review:'Under independent review',
  approved:'Approved (publication independently verified)',rejected:'Rejected',
  withdrawn:'Withdrawn',
};

export default function DirectoryWorkspace(){
  const auth=useCitizenAuth();
  const [drafts,setDrafts]=React.useState<ListingDraft[]>(readListingDrafts);
  const [submissions,setSubmissions]=React.useState<Submission[]>([]);
  const [loading,setLoading]=React.useState(false);
  const [notice,setNotice]=React.useState('');
  const [refresh,setRefresh]=React.useState(0);
  React.useEffect(()=>{
    setDrafts(readListingDrafts());
    if(!auth.listingSubmissionsAvailable||!auth.account){
      setSubmissions([]);
      return;
    }
    let active=true;
    setLoading(true);setNotice('');
    void auth.rpc<Submission[]>('civic_my_directory_submissions',{}).then(rows=>{
      if(!active)return;
      if(!Array.isArray(rows))throw new Error('Unexpected listing response.');
      setSubmissions(rows.filter(row=>typeof row.id==='string'&&typeof row.name==='string'));
    }).catch(()=>{
      if(active)setNotice('Could not load private submissions. Try refreshing.');
    }).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[auth.account?.id,auth.listingSubmissionsAvailable,refresh]);
  const removeDraft=(id:string)=>{
    if(!removeListingDraft(id)){setNotice('Could not delete that draft.');return;}
    setDrafts(readListingDrafts());setNotice('Local draft deleted.');
  };
  const withdraw=async(id:string)=>{
    if(!auth.account||!auth.listingSubmissionsAvailable)return;
    if(!window.confirm('Withdraw this listing submission from review?'))return;
    try{
      const success=await auth.rpc<boolean>('civic_withdraw_directory_submission',{_submission_id:id});
      if(!success)throw new Error('The submission could not be withdrawn.');
      setNotice('Submission withdrawn.');setRefresh(n=>n+1);
    }catch(e){setNotice(e instanceof Error?e.message:'Withdrawal was unsuccessful.');}
  };

  return <section className="directory-workspace" aria-label="My directory workspace">
    <header className="directory-workspace-head">
      <div><p className="eyebrow">Business and service directory</p>
        <h2>My listings</h2>
        <p className="note">Manage your draft submissions and see the status of reviewed requests.</p></div>
      <Link className="primary-action" to="/listings/new">Add a business</Link>
    </header>
    <div className="directory-workspace-stats" aria-label="Listing status">
      <div><strong>{drafts.length}</strong><span>Private tab drafts</span></div>
      <div><strong>{submissions.filter(s=>s.status==='pending'||s.status==='under_review').length}</strong>
        <span>Awaiting moderation</span></div>
      <div><strong>{submissions.filter(s=>s.status==='approved').length}</strong><span>Approved submissions</span></div>
    </div>
    {!auth.account&&<p className="privacy-notice">You are browsing as a guest. Use Account Details above
      for a verified email-code account once sign-in is activated. Drafts are stored in this tab only.</p>}
    {auth.account&&!auth.listingSubmissionsAvailable&&<p className="privacy-notice">
      Your account is signed in, but the directory submission service has not passed its release checks.
      Private drafts remain available; no submission is sent to a moderator.</p>}
    <div className="directory-workspace-section">
      <h3>Private drafts</h3>
      {drafts.length===0?<p className="note">No saved drafts in this tab.</p>:drafts.map(draft=>
        <div key={draft.id} className="directory-workspace-row">
          <div><strong>{draft.name}</strong><small>{draft.category} · {
            lgas.find(a=>a.id===draft.lgaId)?.name||draft.lgaId}</small></div>
          <span>Not submitted</span>
          <button type="button" onClick={()=>removeDraft(draft.id)}>Delete</button>
        </div>)}
      {drafts.length>0&&<p className="note">Open <Link to="/listings/new">Post a listing</Link> to review and submit a saved draft.</p>}
    </div>
    <div className="directory-workspace-section">
      <div className="directory-workspace-head"><h3>Submitted listings</h3>
        {auth.listingSubmissionsAvailable&&auth.account&&
          <button type="button" onClick={()=>setRefresh(n=>n+1)} disabled={loading}>Refresh</button>}
      </div>
      {loading&&<p role="status">Checking your private submissions…</p>}
      {!loading&&submissions.length===0&&<p className="note">No server-confirmed submissions to show.</p>}
      {submissions.map(item=><div key={item.id} className="directory-workspace-row">
        <div><strong>{item.name}</strong><small>{item.category} · {
          lgas.find(a=>a.id===item.lga_id)?.name||item.lga_id}</small></div>
        <span>{statuses[item.status]||'Status unavailable'}</span>
        {(item.status==='pending'||item.status==='under_review')&&
          <button type="button" onClick={()=>void withdraw(item.id)}>Withdraw</button>}
      </div>)}
    </div>
    {notice&&<p role="status" className="note">{notice}</p>}
    <p className="metadata">Only verified and separately published directory entries appear in public search.
      inEkiti Official operates independently of government ministries.</p>
  </section>;
}
