import * as React from 'react';
import { Link } from 'react-router';
import { directoryCategories } from './DirectoryCategories.tsx';
import { lgas } from './fixtures.ts';
import { useCitizenAuth } from './CitizenAuth.tsx';
import { readListingDrafts, removeListingDraft, saveListingDraft,
  validateListingInput, type ListingInput, type ListingDraft } from './directory-drafts.ts';

const empty:ListingInput={name:'',category:'',lgaId:'',description:''};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

export default function ListingDraft() {
  const auth=useCitizenAuth();
  const [fields,setFields]=React.useState<ListingInput>(empty);
  const [preview,setPreview]=React.useState<ListingInput|null>(null);
  const [draft,setDraft]=React.useState<ListingDraft|null>(null);
  const [busy,setBusy]=React.useState(false);
  const [message,setMessage]=React.useState('');
  const [submissionId,setSubmissionId]=React.useState('');

  const update=(key:keyof ListingInput,value:string)=>{
    setFields(old=>({...old,[key]:value}));
    setPreview(null);setMessage('');
  };
  const prepare=(event:React.FormEvent)=>{
    event.preventDefault();
    try{setPreview(validateListingInput(fields));setMessage('');}
    catch(error){setMessage(error instanceof Error?error.message:'Please check the fields.');}
  };
  const save=()=>{
    if(!preview)return;
    try{
      const saved=saveListingDraft(preview);
      setDraft(saved);
      setMessage('Draft saved in this browser tab, not submitted or published.');
    }catch(error){
      setMessage(error instanceof Error?error.message:'Could not save this draft.');
    }
  };
  const submit=async()=>{
    if(!preview||busy||!auth.account||!auth.listingSubmissionsAvailable)return;
    setBusy(true);setMessage('');
    try{
      const id=await auth.rpc<string>('civic_submit_directory_listing',{
        _name:preview.name,_category:preview.category,
        _lga_id:preview.lgaId,_description:preview.description,
      });
      if(typeof id!=='string'||!uuid.test(id))throw new Error('The service did not confirm a saved submission.');
      setSubmissionId(id);
      if(draft)removeListingDraft(draft.id);
      setDraft(null);
      setMessage('Submission received by inEkiti Official for independent review. It is not yet public.');
    }catch(error){
      setMessage(error instanceof Error?error.message:'Submission failed. Your draft remains on this page.');
    }finally{setBusy(false);}
  };
  const loadSaved=(item:ListingDraft)=>{
    setFields({name:item.name,category:item.category,lgaId:item.lgaId,description:item.description});
    setPreview(validateListingInput(item));setDraft(item);setSubmissionId('');
    setMessage('Loaded your browser-tab draft. It has not been submitted.');
  };
  return <main id="main" className="page citizen-draft-page directory-submission-page">
    <p className="eyebrow">Ekiti business directory</p>
    <h1>List your business or service</h1>
    <p className="help-text">Make it easier for people to discover your business in Ekiti.
      Listings are reviewed before publication; individual product catalogues are not included.</p>
    {submissionId?<section role="status" className="citizen-draft-confirmation">
      <h2>Listing submitted for review</h2>
      <p>Your submission is stored in the private review queue. Publishing is not automatic.</p>
      <p>Confirmation: <code>{submissionId}</code></p>
      <Link to="/profile?view=listings">Track my submissions</Link>
      <button type="button" className="quiet-action" onClick={()=>{
        setFields(empty);setPreview(null);setDraft(null);setSubmissionId('');
      }}>Add another business</button>
    </section>:<>
      <form className="citizen-draft-form" onSubmit={prepare}>
        <label htmlFor="listing-name">Business or place name</label>
        <input id="listing-name" required minLength={3} maxLength={110}
          value={fields.name} onChange={e=>update('name',e.target.value)}
          placeholder="e.g. My repair workshop"/>
        <label htmlFor="listing-category">Service category</label>
        <select id="listing-category" required value={fields.category}
          onChange={e=>update('category',e.target.value)}>
          <option value="">Choose category</option>
          {directoryCategories.map(item=><option key={item.id} value={item.label}>{item.label}</option>)}
        </select>
        <label htmlFor="listing-lga">Business location (LGA)</label>
        <select id="listing-lga" required value={fields.lgaId}
          onChange={e=>update('lgaId',e.target.value)}>
          <option value="">Choose LGA</option>
          {lgas.map(area=><option key={area.id} value={area.id}>{area.name}</option>)}
        </select>
        <label htmlFor="listing-description">Describe the business or service</label>
        <textarea id="listing-description" rows={4} required minLength={15} maxLength={1000}
          placeholder="What can people come to you for?" value={fields.description}
          onChange={e=>update('description',e.target.value)}/>
        <button type="submit" className="primary-action">Review listing draft</button>
        <p className="privacy-notice">Do not enter private identity documents, passwords, or private contact details.
          Business ownership and content must be independently reviewed.</p>
      </form>
      {preview&&<section className="citizen-draft-confirmation" aria-label="Listing preview">
        <h2>Review your listing</h2>
        <dl className="review-list">
          <dt>Business</dt><dd>{preview.name}</dd>
          <dt>Category</dt><dd>{preview.category}</dd>
          <dt>Local government</dt><dd>{lgas.find(x=>x.id===preview.lgaId)?.name||preview.lgaId}</dd>
          <dt>Description</dt><dd>{preview.description}</dd>
        </dl>
        {message&&<p role="status" className="privacy-notice">{message}</p>}
        <div className="listing-submission-actions">
          <button type="button" className="quiet-action" onClick={save}>Save private draft in this tab</button>
          {auth.listingSubmissionsAvailable&&auth.account?<button type="button"
            className="primary-action" disabled={busy} onClick={()=>void submit()}>
              {busy?'Submitting…':'Submit for independent review'}
            </button>:<p className="note">Online listing submission is not yet activated.
              You can save a private draft and return when verified accounts and moderation are connected.</p>}
          <button type="button" className="text-link" onClick={()=>setPreview(null)}>Edit details</button>
        </div>
      </section>}
      {!preview&&message&&<p role="status" className="note">{message}</p>}
      {readListingDrafts().length>0&&<section className="listing-saved-panel" aria-label="Saved listing drafts">
        <h2>Drafts saved in this tab</h2>
        <p className="note">These are not publicly searchable or sent to anyone.</p>
        {readListingDrafts().map(item=><div className="listing-draft-row" key={item.id}>
          <strong>{item.name}</strong><span>{item.category}</span>
          <button type="button" onClick={()=>loadSaved(item)}>Open draft</button>
          <button type="button" onClick={()=>{removeListingDraft(item.id);setDraft(null);setMessage('Draft deleted.');}}>Delete</button>
        </div>)}
      </section>}
    </>}
    <p className="note"><Link to="/profile?view=listings">My directory workspace</Link>
      {' · '}<Link to="/explore">Explore existing reviewed listings</Link></p>
  </main>;
}
