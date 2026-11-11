import * as React from 'react';
import { Link } from 'react-router';
import { directoryCategories } from './DirectoryCategories.tsx';
import { lgas } from './fixtures.ts';

export default function ListingDraft() {
  const [name,setName] = React.useState('');
  const [category,setCategory] = React.useState('');
  const [lga,setLga] = React.useState('');
  const [description,setDescription] = React.useState('');
  const [saved,setSaved] = React.useState(false);
  return <main id="main" className="page citizen-draft-page">
    <p className="eyebrow">Ekiti directory</p>
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
      <Link to="/explore">Browse Ekiti</Link>
    </div>}
  </main>;
}

