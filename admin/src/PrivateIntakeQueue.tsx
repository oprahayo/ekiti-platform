import * as React from 'react';
import {
  StaffRequestError,createStaffAuthClient,
  type StaffIdentity,type PrivateIntakeCase,type PrivateIntakeFilters,
  type PrivateIntakeKind,
} from './staff-auth.ts';

/**
 * No case/narrative lookup occurs on mount: opening the intake tab and
 * explicitly pressing Load is required. SQL independently verifies the real
 * membership, approved LGA and audited access on every call.
 */
export default function PrivateIntakeQueue({client,token,identity,onSessionExpired}:{
  client:ReturnType<typeof createStaffAuthClient>;
  token:string;identity:StaffIdentity;onSessionExpired:()=>void;
}){
  const canRead=['platform_admin','case_manager','moderator'].includes(identity.role);
  const canAssign=['platform_admin','case_manager'].includes(identity.role);
  const [filters,setFilters]=React.useState<PrivateIntakeFilters>({
    lgaId:null,kind:null,state:null,
  });
  const [rows,setRows]=React.useState<readonly PrivateIntakeCase[]>([]);
  const [seen,setSeen]=React.useState(false);
  const [busy,setBusy]=React.useState(false);
  const [error,setError]=React.useState('');
  const [notice,setNotice]=React.useState('');
  const [intent,setIntent]=React.useState<Record<string,PrivateIntakeKind|''>>({});
  const [target,setTarget]=React.useState<Record<string,string>>({});
  const epoch=React.useRef(0);
  React.useEffect(()=>()=>{
    epoch.current++;
  },[]);

  async function load(){
    if(!canRead||busy)return;
    const run=++epoch.current;
    setBusy(true);setSeen(false);setRows([]);setError('');setNotice('');
    try{
      const result=await client.listIntake(token,filters);
      if(run!==epoch.current)return;
      // Additional browser-side scope check, independent of SQL and gateway.
      if(identity.role!=='platform_admin'&&
        result.some(item=>!identity.allowedLgaIds.includes(item.lgaId)))
        throw new StaffRequestError(403);
      setRows(result);setSeen(true);
    }catch(cause){
      if(run!==epoch.current)return;
      if(cause instanceof StaffRequestError&&cause.status===401)onSessionExpired();
      else setError(cause instanceof StaffRequestError&&cause.status===404
        ?'Private intake is not activated. No case records were loaded.'
        :'Intake data is unavailable or outside your approved LGA scope. No case data was loaded.');
    }finally{if(run===epoch.current)setBusy(false);}
  }
  async function propose(row:PrivateIntakeCase){
    const kind=intent[row.id]||'';
    if(!canRead||busy||!kind||!['safeguarding_review','possible_duplicate','assignment_review'].includes(kind))
      return;
    if(kind==='assignment_review'&&!canAssign)return;
    const targetLgaId=kind==='assignment_review'?(target[row.id]||''):null;
    if(kind==='assignment_review'&&(!targetLgaId||
       !proposedLgaValid(targetLgaId)||
       (identity.role!=='platform_admin'&&!identity.allowedLgaIds.includes(targetLgaId)))){
      setError('Select an authorized verified LGA.');return;
    }
    if(!window.confirm('Record this as a platform review proposal only? This will not change case status, reassign a case, inspect evidence, publish it or contact any government office.'))return;
    const run=++epoch.current;
    setBusy(true);setError('');setNotice('');
    try{
      const result=await client.proposeIntake(token,row.id,kind,
        targetLgaId||null,row.revision);
      if(run!==epoch.current)return;
      setNotice(result.result==='replayed'
        ?'This review proposal was already recorded. No case status changed.'
        :'Review proposal recorded for independent platform review. No assignment, office notification or case status change occurred.');
    }catch(cause){
      if(run!==epoch.current)return;
      if(cause instanceof StaffRequestError&&cause.status===401)onSessionExpired();
      else if(cause instanceof StaffRequestError&&cause.status===409)
        setError('Case revision or proposal changed. Reload the authorized queue.');
      else setError('Review proposal was not confirmed. No case or office change was made.');
    }finally{if(run===epoch.current)setBusy(false);}
  }

  if(!canRead)return <section className="staff-content" aria-label="Private intake">
    <h1>Admin intake</h1>
    <p role="status">This staff role has no private intake or case-review permission.</p>
  </section>;
  // Platform administrators have statewide read scope but normally carry
  // an empty LGA array. Let them type a prospective LGA ID; the SERVER
  // and verified geo.areas registry still reject any unreviewed slug.
  const lgOptions=identity.allowedLgaIds;
  const proposedLgaValid=(id:string)=>/^[a-z0-9][a-z0-9-]{1,63}$/.test(id);
  return <section className="staff-content staff-intake" aria-label="Admin intake">
    <div className="staff-section-head"><div>
      <h1>Private intake</h1>
      <p>Only approved platform cases in your authorized geography.
        Queue filters are enforced again inside the private database.</p>
    </div><span>{seen?rows.length+' on this page':'Not loaded'}</span></div>
    <div className="staff-intake-warning" role="note">
      Sensitive allegations, photos, recordings and exact locations remain locked.
      Viewing a metadata row does not acknowledge, assign or deliver a case.
      This independent platform is not a government office.
    </div>
    <form className="staff-intake-filters" onSubmit={event=>{event.preventDefault();void load();}}>
      <label htmlFor="intake-lga">Local government</label>
      <select id="intake-lga" value={filters.lgaId??''} disabled={busy}
        onChange={event=>{setFilters({...filters,lgaId:event.target.value||null});setRows([]);setSeen(false);}}>
        <option value="">All authorized LGAs</option>
        {lgOptions.map(id=><option key={id} value={id}>{id}</option>)}
      </select>
      <label htmlFor="intake-type">Report type</label>
      <select id="intake-type" value={filters.kind??''} disabled={busy}
        onChange={event=>{setFilters({...filters,kind:event.target.value as PrivateIntakeFilters['kind']||null});setRows([]);setSeen(false);}}>
        <option value="">Any type</option>
        <option value="Issue">Issue</option>
        <option value="Complaint">Complaint</option>
        <option value="Commendation">Commendation</option>
      </select>
      <label htmlFor="intake-state">Platform status</label>
      <select id="intake-state" value={filters.state??''} disabled={busy}
        onChange={event=>{setFilters({...filters,state:event.target.value as PrivateIntakeFilters['state']||null});setRows([]);setSeen(false);}}>
        <option value="">Any platform status</option>
        <option value="intake_accepted">Accepted by platform</option>
        <option value="under_review">Under platform review</option>
        <option value="needs_information">Needs information</option>
        <option value="closed">Platform closed</option>
      </select>
      <button type="submit" disabled={busy}>{busy?'Checking…':'Load authorized intake'}</button>
    </form>
    {error&&<p role="alert" className="staff-error">{error}</p>}
    {notice&&<p role="status" className="staff-intake-notice">{notice}</p>}
    {seen&&rows.length===0&&<p role="status" className="staff-empty">
      No approved case metadata is available in this filter and access scope.
    </p>}
    {seen&&rows.length>0&&<ol className="staff-intake-results" aria-label="Scoped intake cases">
      {rows.map(item=><li key={item.id}>
        <h2>{item.kind} · {item.lgaId}</h2>
        <p><strong>{item.publicReference}</strong></p>
        <p>Platform status: {item.currentState.replaceAll('_',' ')} · revision {item.revision}</p>
        <p className="staff-intake-locked">Evidence inspection: blocked pending safeguarding and authorization.
          No media files, thumbnails or sensitive descriptions are available here.</p>
        <div className="staff-intake-proposal">
          <label htmlFor={'intake-proposal-'+item.id}>Request independent review</label>
          <select id={'intake-proposal-'+item.id} value={intent[item.id]||''} disabled={busy}
            onChange={event=>setIntent({...intent,[item.id]:event.target.value as PrivateIntakeKind|''})}>
            <option value="">Choose a proposal (does not change case)</option>
            <option value="safeguarding_review">Sensitive/safeguarding review</option>
            <option value="possible_duplicate">Possible duplicate review</option>
            {canAssign&&<option value="assignment_review">LGA assignment review</option>}
          </select>
          {intent[item.id]==='assignment_review'&&canAssign&&<>
            <label htmlFor={'intake-target-'+item.id}>Proposed LGA (not a transfer)</label>
            {identity.role==='platform_admin'?<>
              <input id={'intake-target-'+item.id} type="text"
                maxLength={64} pattern="[a-z0-9][a-z0-9-]{1,63}"
                placeholder="Verified LGA slug (e.g. ado-ekiti)"
                spellCheck={false} autoComplete="off" disabled={busy}
                value={target[item.id]||''}
                onChange={event=>setTarget({...target,[item.id]:event.target.value})}/>
              <small>The database independently verifies this LGA before
                accepting any proposed assignment review.</small>
            </>:lgOptions.length>0?<select id={'intake-target-'+item.id}
              value={target[item.id]||''} disabled={busy}
              onChange={event=>setTarget({...target,[item.id]:event.target.value})}>
              <option value="">Select reviewed LGA</option>
              {lgOptions.map(id=><option key={id} value={id}>{id}</option>)}
            </select>:<p>No reviewed LGA target is configured in your staff profile.</p>}
          </>}
          <button type="button" disabled={busy||!intent[item.id]||
            (intent[item.id]==='assignment_review'&&(!canAssign||
              !proposedLgaValid(target[item.id]||'')))}
            onClick={()=>void propose(item)}>Record proposal only</button>
        </div>
      </li>)}
    </ol>}
    <p className="staff-intake-footer">Results are limited to one authorized page (20 items), not a statewide total.
      This workflow cannot forward cases to government offices or confirm repairs.</p>
  </section>;
}
