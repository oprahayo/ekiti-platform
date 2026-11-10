import * as React from 'react';
import { Link, useParams } from 'react-router';
import { demoPlaces, lgas } from './fixtures.ts';
import { DirectoryIcon, categoryForGroup } from './DirectoryCategories.tsx';

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

function validHttpUrl(url: string | null): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}

export default function PlaceDetails() {
  const { id } = useParams();
  const preview = demoPlaces.find(item => item.id === id);
  const [result, setResult] = React.useState<DetailState>({ status: 'loading' });
  const isRecordId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || '');

  React.useEffect(() => {
    if (preview || !isRecordId) {
      setResult({ status: 'not-found' });
      return;
    }
    const controller = new AbortController();
    setResult({ status: 'loading' });
    fetch('/api/places/' + id, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Not found');
        return response.json() as Promise<{ item?: ReviewedPlace; reviewedOnly?: boolean }>;
      })
      .then(data => {
        if (!data.reviewedOnly || !data.item || data.item.id !== id)
          throw new Error('Not verified');
        setResult({ status: 'ready', item: data.item });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ status: 'not-found' });
      });
    return () => controller.abort();
  }, [id, isRecordId, preview]);

  if (preview) {
    return <main className="page directory-place-page" id="main">
      <Link to="/explore" className="directory-back-link">← Back to categories</Link>
      <p className="eyebrow">Illustrative listing · not verified</p>
      <h1>{preview.name}</h1>
      <p className="directory-data-note">This is a fictional directory example. Do not rely on it for real services, reviews or directions.</p>
      <dl className="detail-list">
        <dt>Service</dt><dd>{preview.category}</dd>
        <dt>Local government area</dt><dd>{lgas.find(item => item.id === preview.lgaId)?.name}</dd>
        <dt>Description</dt><dd>{preview.description}</dd>
      </dl>
      <Link to="/explore" className="text-link">Explore more categories</Link>
    </main>;
  }

  return <main className="page directory-place-page" id="main">
    <Link to="/explore" className="directory-back-link">← Back to categories</Link>
    {result.status === 'loading' && <p role="status">Checking the reviewed directory…</p>}
    {result.status === 'not-found' && <>
      <h1>Listing not available</h1>
      <p className="note">This listing isn't in the reviewed public directory, or that directory isn't active here yet.</p>
      <Link to="/explore" className="text-link">Browse categories</Link>
    </>}
    {result.status === 'ready' && result.item && (() => {
      const place = result.item!;
      const categoryIcon = categoryForGroup(place.category as 'Hotels' | 'Schools' | 'Health' | 'Offices');
      const photo = validHttpUrl(place.photo_url);
      const website = validHttpUrl(place.website_url);
      const source = validHttpUrl(place.source_url);
      const coordinatesVerified = typeof place.latitude === 'number' &&
        typeof place.longitude === 'number' &&
        Number.isFinite(place.latitude) && Number.isFinite(place.longitude) &&
        Math.abs(place.latitude) <= 90 && Math.abs(place.longitude) <= 180;
      const directions = coordinatesVerified
        ? 'https://www.google.com/maps/dir/?api=1&destination=' +
          encodeURIComponent(place.latitude + ',' + place.longitude)
        : undefined;
      return <>
        <div className="directory-place-heading">
          {categoryIcon && <DirectoryIcon name={categoryIcon.id} />}
          <div>
            <p className="eyebrow">Reviewed directory record</p>
            <h1>{place.name}</h1>
            <p className="note">{place.category} · {lgas.find(item => item.id === place.lga_id)?.name || 'Ekiti State'}</p>
          </div>
        </div>
        {photo && <img className="directory-reviewed-photo" src={photo}
          alt={'Reviewed storefront image for ' + place.name} loading="lazy" />}
        <p>{place.description || 'No reviewed description has been added yet.'}</p>
        <dl className="detail-list">
          <dt>Address</dt><dd>{place.address_text || 'Not independently provided'}</dd>
          <dt>Business ownership</dt><dd>{place.owner_claim_state === 'claimed'
            ? 'Owner claim recorded by the platform'
            : 'Not claimed by a verified owner'}</dd>
          <dt>Source</dt><dd>{source
            ? <a href={source} target="_blank" rel="noopener noreferrer">{place.publisher} · View source</a>
            : place.publisher}</dd>
        </dl>
        <div className="directory-contact-actions">
          {place.contact_phone && <a href={'tel:' + place.contact_phone.replace(/[^+0-9]/g, '')}>
            Call listed number
          </a>}
          {website && <a href={website} target="_blank" rel="noopener noreferrer">Business website</a>}
          {directions && <a href={directions} target="_blank" rel="noopener noreferrer">Open directions in Google Maps</a>}
        </div>
        {!directions && <p className="note">Map directions are unavailable until exact coordinates are reviewed.</p>}
        <p className="directory-data-note">Details are published from a reviewed source; opening times and current availability are not independently guaranteed.</p>
      </>;
    })()}
  </main>;
}
