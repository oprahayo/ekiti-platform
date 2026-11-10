import * as React from 'react';
import { useCitizenAuth } from './CitizenAuth.tsx';
import CitizenSignIn from './CitizenSignIn.tsx';
import { readReviewDrafts, saveReviewDraft, deleteReviewDraft } from './citizen-local.ts';

interface PublishedReview {
  id: string;
  stars: number;
  body: string;
  published_at: string;
}
interface ReviewResponse {
  ratingCount: number;
  averageRating: number | null;
  items: PublishedReview[];
  moderatedOnly: true;
}
export function ReviewStars({ rating, interactive = false }: { rating: number; interactive?: boolean }) {
  return <span className={'rating-stars' + (interactive ? ' rating-stars-input' : '')} aria-hidden="true">
    {'★★★★★'.slice(0,Math.round(rating))}<span>{'☆☆☆☆☆'.slice(0,5-Math.round(rating))}</span>
  </span>;
}

export function PublishedReviews({ placeId }: { placeId: string }) {
  const [status,setStatus] = React.useState<'loading'|'ready'|'unavailable'>('loading');
  const [data,setData] = React.useState<ReviewResponse | null>(null);
  React.useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');setData(null);
    fetch('/api/places/' + placeId + '/reviews?limit=10',{ signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Unavailable');
        return response.json() as Promise<ReviewResponse>;
      }).then(value => {
        if (value.moderatedOnly !== true || !Number.isInteger(value.ratingCount) ||
            value.ratingCount < 0 || !Array.isArray(value.items) ||
            (value.ratingCount > 0 &&
             (typeof value.averageRating !== 'number' ||
              value.averageRating < 1 || value.averageRating > 5))) throw new Error('Invalid review source');
        setData(value);setStatus('ready');
      }).catch(() => {
        if (!controller.signal.aborted) setStatus('unavailable');
      });
    return () => controller.abort();
  },[placeId]);
  if (status === 'loading') return <p role="status" className="note">Checking moderated reviews…</p>;
  if (status === 'unavailable') return <p role="status" className="directory-data-note">
    No public review feed or aggregate rating is connected yet. Ratings shown in personal drafts are not public.
  </p>;
  if (!data) return null;
  if (!data.ratingCount) return <p className="directory-data-note" role="status">
    No published customer reviews yet. Reviews require moderation and are never counted until approved.
  </p>;
  return <div className="published-reviews">
    <p className="published-rating-summary">
      <ReviewStars rating={data.averageRating || 0}/>
      <strong>{data.averageRating?.toFixed(1)} / 5</strong>
      <span>{data.ratingCount} published {data.ratingCount === 1 ? 'review' : 'reviews'}</span>
    </p>
    <p className="metadata">Published after moderation · Reviewer identities are not displayed</p>
    <div className="published-review-list">
      {data.items.map(item => <article className="published-review" key={item.id}>
        <p><ReviewStars rating={item.stars}/><span className="metadata">
          {new Date(item.published_at).toLocaleDateString('en-NG')}
        </span></p>
        <p>{item.body}</p>
      </article>)}
    </div>
  </div>;
}

function Star({ filled }: { filled: boolean }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="26" height="26"
    stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"
    fill={filled ? 'currentColor' : 'none'}>
    <path d="m12 2.8 2.85 5.83 6.45.94-4.66 4.54 1.1 6.42L12 17.5l-5.74 3.03 1.1-6.42L2.7 9.57l6.45-.94z"/>
  </svg>;
}

export function ReviewComposer({ placeId }: { placeId: string }) {
  const auth = useCitizenAuth();
  const initial = React.useMemo(() => readReviewDrafts()[placeId],[placeId]);
  const [stars,setStars] = React.useState(initial?.stars || 0);
  const [body,setBody] = React.useState(initial?.text || '');
  const [status,setStatus] = React.useState('');
  const [savedDraft,setSavedDraft] = React.useState(Boolean(initial));
  const [authOpen,setAuthOpen] = React.useState(false);
  const [busy,setBusy] = React.useState(false);
  const validate = () => {
    if (stars < 1) { setStatus('Choose a rating from 1 to 5 stars first.');return false; }
    if (body.trim().length < 15 || body.trim().length > 1000) {
      setStatus('Describe your experience in 15–1000 characters.');return false;
    }
    return true;
  };
  const save = () => {
    if (!validate()) return;
    if (saveReviewDraft(placeId,stars,body.trim())) {
      setSavedDraft(true);
      setStatus('Saved on this browser only · Not posted or counted in ratings.');
    } else setStatus('Could not save locally. Copy your text before leaving.');
  };
  const submit = async () => {
    if (!validate() || busy) return;
    if (!auth.account) { setAuthOpen(true);return; }
    setBusy(true);setStatus('');
    try {
      await auth.rpc<string>('civic_submit_review',{
        _place_id:placeId,_stars:stars,_body:body.trim(),
      });
      deleteReviewDraft(placeId);
      setSavedDraft(false);
      setStatus('Submitted for moderation · Not published or included in ratings yet.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not submit your review.');
    } finally { setBusy(false); }
  };
  return <div className="directory-review-editor">
    <h3>Your experience</h3>
    <p className="note">Public reviews require a verified email account and moderation. Guest drafts never affect ratings.</p>
    <div className="directory-star-select" role="group" aria-label="Choose rating">
      {[1,2,3,4,5].map(value => <button key={value} type="button"
        aria-label={value+(value === 1 ? ' star' : ' stars')}
        aria-pressed={stars === value} onClick={() => { setStars(value);setStatus(''); }}
        className={stars >= value ? 'selected' : ''}><Star filled={stars >= value}/></button>)}
    </div>
    <label htmlFor="directory-review-text">Share your experience <span className="field-optional">15–1000 characters</span></label>
    <textarea id="directory-review-text" maxLength={1000} rows={4}
      placeholder="What went well? What should other customers know?"
      value={body} onChange={event => setBody(event.target.value)} />
    <div className="field-bottom"><span>{auth.account ? 'Moderated before publication' : 'You can save privately as a guest'}</span>
      <span>{body.length} / 1000</span></div>
    <div className="directory-review-actions">
      <button type="button" className="primary-action" onClick={save}>Save private review draft</button>
      {auth.available && auth.account ?
        <button type="button" className="quiet-action" disabled={busy} onClick={() => void submit()}>
          Submit for moderation
        </button> :
        <button type="button" className="quiet-action" onClick={() => setAuthOpen(true)}>
          Sign in to publish
        </button>}
      {savedDraft && <button type="button" className="text-link" onClick={() => {
        if (deleteReviewDraft(placeId)) {
          setStars(0);setBody('');setSavedDraft(false);setStatus('Local draft deleted.');
        }
      }}>Delete saved draft</button>}
    </div>
    {status && <p role="status" className="note">{status}</p>}
    {authOpen && <CitizenSignIn onClose={() => setAuthOpen(false)}/>}
  </div>;
}
