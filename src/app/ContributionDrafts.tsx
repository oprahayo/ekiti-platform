import * as React from 'react';
import { Link, useSearchParams } from 'react-router';
import { directoryCategories } from './DirectoryCategories.tsx';
import { lgas } from './fixtures.ts';

export default function ListingDraft() {
  const [name,setName] = React.useState('');
  const [category,setCategory] = React.useState('');
  const [lga,setLga] = React.useState('');
  const [description,setDescription] = React.useState('');
  const [saved,setSaved] = React.useState(false);
  return <main id="main" className="page citizen-draft-page">
    <p className="eyebrow">Ekiti Yellow Pages</p>
    <h1>Post a listing</h1>
    <p className="help-text">Suggest a business or service in Ekiti. This is a private preview, not a published listing.</p>
    {!saved ? <form className="citizen-draft-form" onSubmit={event => { event.preventDefault(); if (name.trim().length >= 3 && category && lga && description.trim().length >= 15) setSaved(true); }}>
      <label htmlFor="listing-name">Business or place name</label>
      <input id="listing-name" required minLength={3} maxLength={110} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. My repair workshop"/>
      <label htmlFor="listing-category">Service category</label>
      <select id="listing-category" required value={category} onChange={e=>setCategory(e.target.value)}>
        <option value="">Choose category</option>
        {directoryCategories.map(item => <option key={item.id} value={item.label}>{item.label}</option>)}
      </select>
      <label htmlFor="listing-lga">Local government area</label>
      <select id="listing-lga" required value={lga} onChange={e=>setLga(e.target.value)}>
        <option value="">Choose LGA</option>
        {lgas.map(area => <option key={area.id} value={area.name}>{area.name}</option>)}
      </select>
      <label htmlFor="listing-description">Describe this business or service</label>
      <textarea id="listing-description" rows={4} required minLength={15} maxLength={1000}
        placeholder="What does this business offer?" value={description} onChange={e=>setDescription(e.target.value)}/>
      <button type="submit" className="primary-action">Review listing draft</button>
      <p className="privacy-notice">No phone number, street address or identity document is required for this demonstration. Verification and moderated publication must come first.</p>
    </form> : <div className="citizen-draft-confirmation" role="status">
      <h2>Listing preview prepared</h2>
      <dl className="review-list">
        <dt>Business</dt><dd>{name}</dd>
        <dt>Category</dt><dd>{category}</dd>
        <dt>LGA</dt><dd>{lga}</dd>
        <dt>Description</dt><dd>{description}</dd>
      </dl>
      <p className="privacy-notice">Not published or submitted. This preview exists only in this tab. Verified Yellow Pages submissions require a secure review process.</p>
      <button className="quiet-action" type="button" onClick={()=>setSaved(false)}>Edit draft</button>
      <Link to="/explore">Browse Ekiti Yellow Pages</Link>
    </div>}
  </main>;
}

export function CommunityPostDraft() {
  const [params] = useSearchParams();
  const [title,setTitle] = React.useState('');
  const [body,setBody] = React.useState('');
  const [category,setCategory] = React.useState('Community notice');
  const [prepared,setPrepared] = React.useState(false);
  return <main id="main" className="page citizen-draft-page">
    <p className="eyebrow">Community contributions</p>
    <h1>Prepare a community post</h1>
    <p className="help-text">Write a community notice or a local story. Public posting requires moderation; it is not live on this staging site.</p>
    {!prepared ? <form className="citizen-draft-form" onSubmit={event => { event.preventDefault(); if(title.trim().length>=5&&body.trim().length>=20)setPrepared(true); }}>
      <label htmlFor="post-type">Type of post</label>
      <select id="post-type" value={category} onChange={e=>setCategory(e.target.value)}>
        <option>Community notice</option><option>Local event</option><option>Suggestion</option><option>Positive development</option>
      </select>
      <label htmlFor="post-title">Title</label>
      <input id="post-title" required minLength={5} maxLength={110} value={title} onChange={e=>setTitle(e.target.value)} placeholder="What is happening?"/>
      <label htmlFor="post-body">Your post</label>
      <textarea id="post-body" required minLength={20} maxLength={2000} rows={5} value={body}
        onChange={e=>setBody(e.target.value)} placeholder="Share a clear summary without private contact details or accusations."/>
      <button type="submit" className="primary-action">Review community post</button>
    </form> : <section className="citizen-draft-confirmation" role="status">
      <p className="eyebrow">{category}</p>
      <h2>{title}</h2><p>{body}</p>
      <p className="privacy-notice">Prepared locally, not posted or shared. A real community feed must include moderation and appeals.</p>
      <button type="button" className="quiet-action" onClick={()=>setPrepared(false)}>Edit post</button>
    </section>}
    <p className="metadata"><Link to="/explore">Browse Ekiti directory</Link></p>
  </main>;
}
