import * as React from 'react';
import { Link, useParams } from 'react-router';
import { demoPlaces, lgas } from './fixtures.ts';
import { DirectoryIcon, categoryForGroup } from './DirectoryCategories.tsx';
import { useApp } from './state.tsx';
import { readReviewDrafts, saveReviewDraft, deleteReviewDraft } from './citizen-local.ts';
import InfoDialog from './InfoDialog.tsx';

interface ReviewedPlace {
  id: string;
  name: string;
  category: string;
  lga_id: string;
  description: string;
  address_text: string;
  contact_phone: string | null;
  website_url: string | null;
  photo_url: string | null;
  latitude: number | null;
  longitude: number | null;
  owner_claim_state: string;
  source_url: string;
  publisher: string;
  reviewed_at: string;
}
type DetailState = { status: 'loading' | 'ready' | 'not-found'; item?: ReviewedPlace };
type Tab = 'overview' | 'reviews' | 'services' | 'photos';

function validHttpUrl(url: string | null): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? parsed.href : undefined;
  } catch { return undefined; }
}
function validPhone(phone: string | null): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/[^+0-9]/g, '');
  return /^\+?[0-9]{7,15}$/.test(digits) ? 'tel:' + digits : undefined;
}
function Star({ filled }: { filled: boolean }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="26" height="26"
    stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"
    fill={filled ? 'currentColor' : 'none'}>
    <path d="m12 2.8 2.85 5.83 6.45.94-4.66 4.54 1.1 6.42L12 17.5l-5.74 3.03 1.1-6.42L2.7 9.57l6.45-.94z"/>
  </svg>;
}
function ReviewComposer({ placeId }: { placeId: string }) {
  const initial = React.useMemo(() => readReviewDrafts()[placeId], [placeId]);
  const [stars, setStars] = React.useState(initial?.stars || 0);
  const [body, setBody] = React.useState(initial?.text || '');
  const [status, setStatus] = React.useState('');
  const [savedDraft, setSavedDraft] = React.useState(Boolean(initial));
  const [authOpen, setAuthOpen] = React.useState(false);
  const write = () => {
    if (stars < 1) { setStatus('Choose a rating from 1 to 5 stars first.'); return; }
    if (body.trim().length < 15) { setStatus('Describe your experience in at least 15 characters.'); return; }
    if (saveReviewDraft(placeId, stars, body.trim())) {
      setSavedDraft(true);
      setStatus('Saved on this browser only · Not posted or counted in ratings.');
    }
    else setStatus('Could not save to this browser. Copy your text before leaving.');
  };
  return <div className="directory-review-editor">
    <h3>Your experience</h3>
    <p className="note">A private review draft, not a published business rating. Sign-in and moderation are required before public reviews can launch.</p>
    <div className="directory-star-select" role="group" aria-label="Choose rating">
      {[1, 2, 3, 4, 5].map(value =>
        <button key={value} type="button" aria-label={value + (value === 1 ? ' star' : ' stars')}
          aria-pressed={stars === value} onClick={() => { setStars(value); setStatus(''); }}
          className={stars >= value ? 'selected' : ''}><Star filled={stars >= value}/></button>)}
    </div>
    <label htmlFor="directory-review-text">Share your experience <span className="field-optional">Local draft only</span></label>
    <textarea id="directory-review-text" maxLength={1000} rows={4}
      placeholder="What went well? What should other customers know?"
      value={body} onChange={event => setBody(event.target.value)} />
    <div className="field-bottom"><span>Only you can see this draft</span><span>{body.length} / 1000</span></div>
    <div className="directory-review-actions">
      <button type="button" className="primary-action" onClick={write}>Save private review draft</button>
      <button type="button" className="quiet-action" onClick={() => setAuthOpen(true)}>Sign in to publish</button>
      {savedDraft && <button type="button" className="text-link" onClick={() => {
        if (deleteReviewDraft(placeId)) { setStars(0); setBody(''); setSavedDraft(false); setStatus('Local draft deleted.'); }
      }}>Delete saved draft</button>}
    </div>
    {status && <p className="note" role="status">{status}</p>}
    {authOpen && <InfoDialog title="Public reviews aren't active yet" onClose={() => setAuthOpen(false)}>
      <p>Secure sign-in, moderation and genuine review publishing are still being prepared. No rating has been posted or counted.</p>
      <p className="note">You can save a private draft locally and return when the system is ready.</p>
    </InfoDialog>}
  </div>;
}

export default function PlaceDetails() {
  const { id } = useParams();
  const { savedPlaceIds, toggleSavedPlace } = useApp();
  const [tab, setTab] = React.useState<Tab>('overview');
  const [editing, setEditing] = React.useState(false);
  const [claimOpen, setClaimOpen] = React.useState(false);
  const preview = demoPlaces.find(item => item.id === id);
  const [result, setResult] = React.useState<DetailState>({ status: 'loading' });
  const isRecordId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || '');

  React.useEffect(() => {
    setTab('overview');
    setEditing(false);
    if (preview || !isRecordId) { setResult({ status: 'not-found' }); return; }
    const controller = new AbortController();
    setResult({ status: 'loading' });
    fetch('/api/places/' + id, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Not found');
        return response.json() as Promise<{ item?: ReviewedPlace; reviewedOnly?: boolean }>;
      }).then(data => {
        if (!data.reviewedOnly || !data.item || data.item.id !== id)
          throw new Error('Not reviewed');
        setResult({ status: 'ready', item: data.item });
      }).catch(() => { if (!controller.signal.aborted) setResult({ status: 'not-found' }); });
    return () => controller.abort();
  }, [id, isRecordId, preview]);

  if (preview) return <main className="page directory-place-page" id="main">
    <Link to="/explore" className="directory-back-link">← Back to directory</Link>
    <p className="eyebrow">Illustrative listing · not verified</p>
    <h1>{preview.name}</h1>
    <p className="directory-data-note">This is a fictional directory example. No real address, reviews, rating, contacts, directions, or verified availability exists for it.</p>
    <dl className="detail-list">
      <dt>Category</dt><dd>{preview.category}</dd>
      <dt>Local government area</dt><dd>{lgas.find(area => area.id === preview.lgaId)?.name}</dd>
      <dt>Description</dt><dd>{preview.description}</dd>
    </dl>
    <Link to="/explore" className="text-link">Explore verified categories</Link>
  </main>;

  if (result.status !== 'ready' || !result.item) return <main className="page directory-place-page" id="main">
    <Link to="/explore" className="directory-back-link">← Back to directory</Link>
    {result.status === 'loading' ? <p role="status">Checking the reviewed directory…</p> :
      <><h1>Listing not available</h1><p className="note">This listing isn't published or the reviewed directory isn't available yet.</p>
      <Link to="/explore" className="text-link">Browse categories</Link></>}
  </main>;

  const place = result.item;
  const categoryIcon = categoryForGroup(place.category as 'Hotels' | 'Schools' | 'Health' | 'Offices');
  const photo = validHttpUrl(place.photo_url);
  const website = validHttpUrl(place.website_url);
  const source = validHttpUrl(place.source_url);
  const telephone = validPhone(place.contact_phone);
  const coordinatesVerified = typeof place.latitude === 'number' &&
    typeof place.longitude === 'number' && Number.isFinite(place.latitude) &&
    Number.isFinite(place.longitude) && Math.abs(place.latitude) <= 90 &&
    Math.abs(place.longitude) <= 180;
  const directions = coordinatesVerified
    ? 'https://www.google.com/maps/dir/?api=1&destination=' +
      encodeURIComponent(place.latitude + ',' + place.longitude) : undefined;
  const saved = savedPlaceIds.includes(place.id);

  return <main className="page directory-place-page" id="main">
    <div className="directory-detail-top">
      <Link to="/explore" className="directory-back-link">← Directory</Link>
      <button type="button" className="directory-save" onClick={() => toggleSavedPlace(place.id)}
        aria-label={saved ? 'Remove saved listing' : 'Save this listing'} aria-pressed={saved}>
        {saved ? '★ Saved' : '☆ Save'}
      </button>
    </div>
    <div className="directory-storefront">
      {photo ? <img src={photo} alt={'Published storefront image for ' + place.name} loading="lazy" /> :
        <div className="directory-storefront-empty" role="img" aria-label="No reviewed storefront photo available">
          {categoryIcon && <DirectoryIcon name={categoryIcon.id}/>}
          <span>No reviewed storefront photo</span>
        </div>}
    </div>
    <div className="directory-place-heading">
      {categoryIcon && <DirectoryIcon name={categoryIcon.id} />}
      <div>
        <p className="eyebrow">Source-reviewed directory listing</p>
        <h1>{place.name}</h1>
        <p className="note">{place.category} · {lgas.find(area => area.id === place.lga_id)?.name || 'Ekiti State'}</p>
        <p className="metadata">Owner {place.owner_claim_state === 'claimed' ? 'claim recorded' : 'not yet claimed'} · Published information only</p>
      </div>
    </div>
    <div className="directory-contact-actions" aria-label="Business contact and directions">
      {telephone && <a href={telephone}>Call</a>}
      {website && <a href={website} target="_blank" rel="noopener noreferrer">Website</a>}
      {directions && <a href={directions} target="_blank" rel="noopener noreferrer">Open directions in Google Maps</a>}
      {!telephone && !website && !directions && <p className="note">Verified phone, website and directions aren't available for this listing yet.</p>}
    </div>
    {!directions && <p className="note">Map directions are unavailable until exact coordinates are reviewed.</p>}

    <div className="directory-detail-tabs" role="tablist" aria-label="Listing information">
      {(['overview', 'reviews', 'services', 'photos'] as Tab[]).map(option =>
        <button key={option} type="button" role="tab" id={'directory-tab-' + option}
          aria-selected={tab === option} aria-controls="directory-tabpanel"
          onClick={() => setTab(option)}>{option[0].toUpperCase() + option.slice(1)}</button>)}
    </div>
    <section id="directory-tabpanel" className="directory-tabpanel" role="tabpanel"
      aria-labelledby={'directory-tab-' + tab}>
      {tab === 'overview' && <>
        <p>{place.description || 'No reviewed description has been added yet.'}</p>
        <dl className="detail-list">
          <dt>Address</dt><dd>{place.address_text || 'Not independently provided'}</dd>
          <dt>Business ownership</dt><dd>{place.owner_claim_state === 'claimed' ? 'Owner claim recorded by the platform' : 'Not claimed by a verified owner'}</dd>
          <dt>Publisher</dt><dd>{source
            ? <a href={source} target="_blank" rel="noopener noreferrer">{place.publisher} · View source</a> : place.publisher}</dd>
        </dl>
        <p className="directory-data-note">Contact details are published from a reviewed source; opening hours and current availability are not independently verified.</p>
        {place.owner_claim_state !== 'claimed' && <button type="button" className="quiet-action" onClick={() => setClaimOpen(true)}>Claim this listing</button>}
      </>}
      {tab === 'reviews' && <>
        <h2>Customer ratings & reviews</h2>
        <p className="directory-data-note">No public review feed or aggregate rating is connected yet. We will not invent stars, review counts, or customer experiences.</p>
        <button type="button" className="directory-review-cta" onClick={() => setEditing(value => !value)}>
          {editing ? 'Close review editor' : '★ Write a review'}
        </button>
        {editing && <ReviewComposer key={place.id} placeId={place.id}/>}
      </>}
      {tab === 'services' && <>
        <h2>Services</h2>
        <p className="note">Category: {place.category}. A business-managed services list has not been verified yet.</p>
      </>}
      {tab === 'photos' && <>
        <h2>Storefront photographs</h2>
        {photo ? <img className="directory-reviewed-photo" src={photo} alt={'Published photograph for ' + place.name} loading="lazy" /> :
          <p className="note">No licensed, reviewed storefront images are available.</p>}
        <p className="note">Additional photo uploads will be available after owner verification and moderation.</p>
      </>}
    </section>
    {claimOpen && <InfoDialog title="Claim this listing" onClose={() => setClaimOpen(false)}>
      <p>Owner verification is being prepared. This record may have been sourced publicly, but that does not mean the business has registered with Ekiti Civic.</p>
      <p className="privacy-notice">No ownership documents or personal details are being collected in the preview.</p>
    </InfoDialog>}
  </main>;
}
