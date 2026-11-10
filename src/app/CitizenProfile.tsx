import * as React from 'react';
import { Link, useSearchParams } from 'react-router';
import { useApp } from './state.tsx';
import { readReviewDrafts, deleteReviewDraft, type ReviewDraft } from './citizen-local.ts';
import InfoDialog, { AboutContent } from './InfoDialog.tsx';
import CitizenSignIn from './CitizenSignIn.tsx';
import { useCitizenAuth } from './CitizenAuth.tsx';

type Popup = 'about' | 'signin' | 'listing' | 'notifications' | null;
interface SavedPlace {
  id: string;
  name: string;
  category: string;
  lga_id: string;
}

function MenuRow({ title, description, onClick, href, symbol }: {
  title: string; description: string; symbol: string;
  onClick?: () => void; href?: string;
}) {
  const content = <><span className="profile-row-icon" aria-hidden="true">{symbol}</span>
    <span className="profile-row-copy"><strong>{title}</strong><small>{description}</small></span>
    <span aria-hidden="true" className="profile-row-chevron">›</span></>;
  return href ? <Link className="profile-menu-row" to={href}>{content}</Link> :
    <button type="button" className="profile-menu-row" onClick={onClick}>{content}</button>;
}

export default function CitizenProfile() {
  const { savedPlaceIds, toggleSavedPlace, clearSavedPlaces } = useApp();
  const auth = useCitizenAuth();
  const [params, setParams] = useSearchParams();
  const view = params.get('view');
  const [popup, setPopup] = React.useState<Popup>(null);
  const [drafts, setDrafts] = React.useState<Record<string, ReviewDraft>>(readReviewDrafts);
  const [saved, setSaved] = React.useState<SavedPlace[]>([]);
  const [missing, setMissing] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [accountReviews,setAccountReviews] = React.useState<{place_id:string;stars:number;status:string;updated_at:string}[]>([]);
  const [accountClaims,setAccountClaims] = React.useState<{place_id:string;status:string;requested_at:string}[]>([]);
  const [accountStatus,setAccountStatus] = React.useState('');
  const count = Object.keys(drafts).length;

  React.useEffect(() => {
    if (view !== 'saved' || !savedPlaceIds.length) { setSaved([]); setMissing(0); setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true);
    const ids = savedPlaceIds.slice(0, 60);
    void Promise.all(ids.map(async id => {
      try {
        const response = await fetch('/api/places/' + id, { signal: controller.signal });
        if (!response.ok) return null;
        const data = await response.json() as { reviewedOnly?: boolean; item?: SavedPlace };
        return data.reviewedOnly && data.item?.id === id ? data.item : null;
      } catch { return null; }
    })).then(results => {
      if (controller.signal.aborted) return;
      setSaved(results.filter((place): place is SavedPlace => place !== null));
      setMissing(results.filter(place => place === null).length);
      setLoading(false);
    });
    return () => controller.abort();
  }, [view, savedPlaceIds]);

  React.useEffect(() => {
    if (!auth.account || (view !== 'reviews' && view !== 'claims')) {
      setAccountReviews([]);setAccountClaims([]);setAccountStatus('');
      return;
    }
    let cancelled = false;
    setAccountStatus('Checking your private account activity…');
    const task = view === 'reviews'
      ? auth.rpc<typeof accountReviews>('civic_my_reviews',{})
      : auth.rpc<typeof accountClaims>('civic_my_claims',{});
    void task.then(result => {
      if (cancelled) return;
      if (view === 'reviews') setAccountReviews(result as typeof accountReviews);
      else setAccountClaims(result as typeof accountClaims);
      setAccountStatus('');
    }).catch(() => {
      if (!cancelled) setAccountStatus('Private activity is not available until moderation services are activated.');
    });
    return () => { cancelled = true; };
  }, [auth.account?.id, view]);

  const setView = (value: 'saved' | 'reviews' | 'claims' | '') => {
    setParams(value ? { view: value } : {});
    if (value === 'reviews') setDrafts(readReviewDrafts());
  };
  const removeDraft = (id: string) => {
    if (deleteReviewDraft(id)) setDrafts(readReviewDrafts());
  };

  return <main className="page citizen-profile-page" id="main">
    <div className="profile-hero">
      <div className="profile-avatar" aria-hidden="true">
        <svg viewBox="0 0 48 48" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="24" cy="15" r="8" /><path d="M9 41c0-9 6-14 15-14s15 5 15 14"/>
        </svg>
      </div>
      <h1>Citizen Profile</h1>
      <p>{auth.account ? 'Email-verified account · Not government identity verification' : 'Guest browsing · Your device only'}</p>
      <button type="button" className="profile-signin" onClick={() => setPopup('signin')}>{auth.account ? 'Account: ' + auth.account.email : 'Sign in or create an account'}</button>
    </div>

    <div className="profile-counts" aria-label="Local profile counts">
      <button type="button" onClick={() => setView('saved')} aria-label={'Saved listings: ' + savedPlaceIds.length}>
        <strong>{savedPlaceIds.length}</strong><span>Saved</span>
      </button>
      <button type="button" onClick={() => setView('reviews')} aria-label={'Unpublished review drafts: ' + count}>
        <strong>{count}</strong><span>Review drafts</span>
      </button>
      <button type="button" onClick={() => setPopup('listing')}>
        <strong>—</strong><span>My listings</span>
      </button>
    </div>

    {view === 'saved' && <section className="profile-subview" aria-label="Saved listings">
      <div className="profile-subview-heading">
        <h2>Saved listings</h2>
        <button type="button" className="text-link" onClick={() => setView('')}>Back to profile</button>
      </div>
      <p className="note">Only published, reviewed listing IDs can be saved locally. These aren't synced to an account.</p>
      {loading && <p role="status">Loading saved listings…</p>}
      {!loading && saved.length === 0 && <p role="status">No available saved listings. Browse Explore to discover published entries.</p>}
      {saved.map(place => <div className="profile-saved-entry" key={place.id}>
        <Link to={'/places/' + place.id}><strong>{place.name}</strong><small>{place.category}</small></Link>
        <button type="button" onClick={() => toggleSavedPlace(place.id)}>Remove</button>
      </div>)}
      {missing > 0 && <p role="status" className="note">{missing} saved {missing === 1 ? 'listing is' : 'listings are'} unavailable or no longer published.</p>}
      {savedPlaceIds.length > 0 && <button type="button" className="text-link profile-clear" onClick={() => {
        if (window.confirm('Clear every saved listing from this browser?')) clearSavedPlaces();
      }}>Clear saved listings</button>}
    </section>}

    {view === 'reviews' && <section className="profile-subview" aria-label="My review drafts">
      <div className="profile-subview-heading">
        <h2>Unpublished review drafts</h2>
        <button type="button" className="text-link" onClick={() => setView('')}>Back to profile</button>
      </div>
      <p className="note">These reviews are stored only on this browser. No business has received or been rated by them.</p>
      {Object.entries(drafts).length === 0 && <p role="status">No saved review drafts yet.</p>}
      {Object.entries(drafts).map(([id, draft]) => <div key={id} className="profile-review-entry">
        <p><strong>{draft.stars} out of 5 stars</strong> · <span className="metadata">Not published</span></p>
        <p>{draft.text || 'Rating only'}</p>
        <div><Link to={'/places/' + id}>Open listing</Link>
          <button type="button" className="text-link" onClick={() => removeDraft(id)}>Delete local draft</button></div>
      </div>)}
      {auth.account && <div className="profile-account-activity">
        <h3>Reviews sent for moderation</h3>
        {accountStatus && <p role="status" className="note">{accountStatus}</p>}
        {accountReviews.length === 0 && !accountStatus && <p className="note">No submitted reviews on your account yet.</p>}
        {accountReviews.map(review => <div className="profile-review-entry" key={review.place_id}>
          <p><strong>{review.stars} out of 5 stars</strong> · <span className="metadata">Status: {review.status}</span></p>
          <Link to={'/places/' + review.place_id}>View listing</Link>
        </div>)}
      </div>}
    </section>}

    {view === 'claims' && <section className="profile-subview" aria-label="My ownership requests">
      <div className="profile-subview-heading"><h2>My listing claims</h2>
        <button type="button" className="text-link" onClick={() => setView('')}>Back to profile</button></div>
      {accountStatus && <p className="note" role="status">{accountStatus}</p>}
      {accountClaims.length === 0 && !accountStatus && <p className="note">No submitted ownership requests yet.</p>}
      {accountClaims.map(claim => <div className="profile-saved-entry" key={claim.place_id}>
        <Link to={'/places/' + claim.place_id}>View listing</Link>
        <small>{claim.status === 'verified' ? 'Ownership claim reviewed' : 'Request status: ' + claim.status}</small>
      </div>)}
      <p className="metadata">A verified email is not proof of business ownership; claims need review.</p>
    </section>}

    {!view && <nav className="profile-menu" aria-label="Profile services">
      <MenuRow title="My Listings" description={auth.account ? 'Check your ownership requests' : 'Learn about registering and claiming'} symbol="⌂"
        onClick={() => auth.account ? setView('claims') : setPopup('listing')}/>
      <MenuRow title="Saved Listings" description="Published businesses saved on this device" symbol="☆" onClick={() => setView('saved')}/>
      <MenuRow title="My Reviews" description="Unpublished drafts on this device" symbol="★" onClick={() => setView('reviews')}/>
      <MenuRow title="Account Details" description="Sign in when identity verification launches" symbol="♙" onClick={() => setPopup('signin')}/>
      <MenuRow title="Notifications" description="Account alerts are not active yet" symbol="♢" onClick={() => setPopup('notifications')}/>
      <MenuRow title="Public Response Scores" description="View clearly marked demo statistics" symbol="▥" href="/scores"/>
      <MenuRow title="About & Contact" description="A short pop-up about Ekiti Civic and support" symbol="ⓘ" onClick={() => setPopup('about')}/>
    </nav>}

    <p className="profile-footer">Independent civic project · Not a government service</p>

    {popup === 'signin' && <CitizenSignIn onClose={() => setPopup(null)}/>} 
    {popup && popup !== 'signin' && <InfoDialog title={{
      about: 'About Ekiti Civic',
      signin: 'Sign in & Citizen Profile',
      listing: 'Business listing & ownership',
      notifications: 'Notifications',
    }[popup]} onClose={() => setPopup(null)}>
      {popup === 'about' && <AboutContent />}
      {popup === 'listing' && <div className="about-dialog-copy">
        <p>We are preparing owner-claimed Yellow Pages listings with photos, verified addresses, and optional map locations.</p>
        <p>Ownership verification, submissions and business management are not accepting data yet. Existing sourced directory entries do not imply an owner has registered.</p>
        <Link to="/explore" onClick={() => setPopup(null)}>Browse the directory</Link>
      </div>}
      {popup === 'notifications' && <div className="about-dialog-copy">
        <p>Account notifications and case updates are not yet available. No alerts have been configured and no personal account exists.</p>
      </div>}
    </InfoDialog>}
  </main>;
}
