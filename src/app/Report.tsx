import * as React from 'react';
import { Link, useSearchParams } from 'react-router';
import { lgas } from './fixtures.ts';

const MapLocation = React.lazy(() => import('./MapLocation.tsx'));
const DRAFT_KEY = 'ekiti-report-preview-v2';
const SAMPLE_REFERENCE = 'DEMO-EKP-2026-00001';
const SAMPLE_TOKEN = 'DEMO-ONLY-NOT-VALID';

type ReportKind = 'Issue' | 'Complaint' | 'Commendation';
interface Area { id: string; name: string; kind: 'lga' | 'ward'; parentId: string; }
interface ReportDraft {
  kind: ReportKind;
  description: string;
  lgaId: string;
  wardId: string;
  place: string;
}

const initialDraft: ReportDraft = { kind: 'Issue', description: '', lgaId: '', wardId: '', place: '' };

function restoreDraft(): ReportDraft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return { ...initialDraft };
    const candidate: unknown = JSON.parse(raw);
    if (typeof candidate !== 'object' || candidate === null) return { ...initialDraft };
    const record = candidate as Partial<ReportDraft>;
    return {
      kind: record.kind === 'Complaint' || record.kind === 'Commendation' ? record.kind : 'Issue',
      description: typeof record.description === 'string' ? record.description.slice(0, 4000) : '',
      lgaId: typeof record.lgaId === 'string' ? record.lgaId : '',
      wardId: typeof record.wardId === 'string' ? record.wardId : '',
      place: typeof record.place === 'string' ? record.place.slice(0, 160) : '',
    };
  } catch { return { ...initialDraft }; }
}

function stepFromParams(params: URLSearchParams) {
  const value = Number(params.get('step') || 1);
  return Number.isInteger(value) && value >= 1 && value <= 4 ? value : 1;
}

async function preparePhoto(file: File): Promise<{ url: string; size: number }> {
  if (!file.type.startsWith('image/') || file.size > 5_000_000)
    throw new Error('Choose an image smaller than 5 MB.');
  if (typeof createImageBitmap !== 'function') throw new Error('Photo preview is unavailable in this browser.');
  const image = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1280 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image preview is unavailable.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    // A new JPEG contains raster pixels, not the source file's EXIF metadata.
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Could not process photo.')), 'image/jpeg', 0.82);
    });
    return { url: URL.createObjectURL(blob), size: blob.size };
  } finally { image.close(); }
}

export default function Report() {
  const [params, setParams] = useSearchParams();
  const step = stepFromParams(params);
  const [maxReached, setMaxReached] = React.useState(1);
  const [draft, setDraft] = React.useState<ReportDraft>(restoreDraft);
  const [saveStatus, setSaveStatus] = React.useState('Saved on this device');
  const [error, setError] = React.useState('');
  const [areas, setAreas] = React.useState<Area[]>([]);
  const [directoryError, setDirectoryError] = React.useState('');
  const [locationStatus, setLocationStatus] = React.useState('');
  const [point, setPoint] = React.useState<{ lat: number; lon: number } | null>(null);
  const [pointEvidence, setPointEvidence] = React.useState('');
  const [mapOpen, setMapOpen] = React.useState(false);
  const [checking, setChecking] = React.useState(false);
  const [consent, setConsent] = React.useState(false);
  const [photo, setPhoto] = React.useState<{ url: string; size: number } | null>(null);
  const [photoStatus, setPhotoStatus] = React.useState('');
  const [copyStatus, setCopyStatus] = React.useState('');

  React.useEffect(() => {
    setSaveStatus('Saving…');
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        setSaveStatus('Draft saved · just now');
      } catch { setSaveStatus('Device storage unavailable. Copy your text before leaving.'); }
    }, 500);
    return () => clearTimeout(timer);
  }, [draft]);

  React.useEffect(() => {
    if (step > maxReached) setParams({ step: '1' }, { replace: true });
  }, [step, maxReached, setParams]);

  React.useEffect(() => {
    if (step !== 2 || areas.length) return;
    const controller = new AbortController();
    fetch('/api/areas', { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('unavailable');
      return response.json() as Promise<Area[]>;
    }).then(value => {
      setAreas(value.filter(item => item.kind === 'lga' || item.kind === 'ward'));
      setDirectoryError('');
    }).catch(() => {
      if (!controller.signal.aborted) setDirectoryError('Ward directory unavailable. You can still choose an LGA and continue.');
    });
    return () => controller.abort();
  }, [step, areas.length]);

  React.useEffect(() => () => {
    if (photo) URL.revokeObjectURL(photo.url);
  }, [photo]);

  const update = (patch: Partial<ReportDraft>) => {
    setDraft(current => ({ ...current, ...patch }));
    setError('');
  };
  const next = () => {
    setError('');
    if (step === 1 && draft.description.trim().length < 20) {
      setError('Write at least 20 characters describing what happened.');
      return;
    }
    if (step === 2 && !draft.lgaId) {
      setError('Choose the local government area where the incident happened.');
      return;
    }
    if (step === 3 && !consent) {
      setError('Confirm that you understand this is a demo, not a real submission.');
      return;
    }
    if (step >= 4) return;
    setMaxReached(value => Math.max(value, step + 1));
    setParams({ step: String(step + 1) });
  };
  const back = () => {
    if (step > 1) {
      setError('');
      setParams({ step: String(step - 1) }, { replace: true });
    }
  };
  const clear = () => {
    if (!window.confirm('Clear your saved report draft from this device?')) return;
    setDraft({ ...initialDraft });
    setConsent(false);
    setPoint(null);
    setPointEvidence('');
    setMaxReached(1);
    setParams({ step: '1' }, { replace: true });
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* No storage permission */ }
  };

  const candidateLgas = areas.some(item => item.kind === 'lga')
    ? areas.filter(item => item.kind === 'lga') : lgas;
  const wards = areas.filter(item => item.kind === 'ward' && item.parentId === draft.lgaId);
  const lgaName = candidateLgas.find(item => item.id === draft.lgaId)?.name || 'Not selected';
  const wardName = wards.find(item => item.id === draft.wardId)?.name || 'Not specified';

  const proposeGPS = () => {
    if (!navigator.geolocation) {
      setLocationStatus('GPS is unavailable. Choose an LGA manually.');
      return;
    }
    setLocationStatus('Waiting for device permission…');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setPoint({ lat: coords.latitude, lon: coords.longitude });
        setPointEvidence('');
        setLocationStatus('Position proposed. Confirm before checking the boundary.');
      },
      () => setLocationStatus('Location permission denied or unavailable. Manual selection still works.'),
      { enableHighAccuracy: false, maximumAge: 0, timeout: 10000 },
    );
  };
  const checkBoundary = async () => {
    if (!point) return;
    setChecking(true);
    setLocationStatus('Checking against verified LGA boundaries…');
    try {
      const response = await fetch('/api/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: point.lat, longitude: point.lon, confirmed: true }),
      });
      if (!response.ok) throw new Error('lookup_failed');
      const result = await response.json() as {
        lga?: { match?: { id: string; name: string }; status?: string };
        ward?: { status?: string };
      };
      if (result.lga?.match?.id) {
        setPointEvidence('LGA matched in verified boundary data: ' + result.lga.match.name +
          '. Ward location is not spatially verified.');
        if (!draft.lgaId) update({ lgaId: result.lga.match.id });
      } else {
        setPointEvidence('No unambiguous LGA match found. Choose an area manually.');
      }
      setLocationStatus('Boundary check finished.');
    } catch {
      setLocationStatus('Boundary service unavailable. You can continue with a manual LGA.');
    } finally { setChecking(false); }
  };

  const selectPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhotoStatus('Preparing a metadata-free preview…');
    try {
      const nextPhoto = await preparePhoto(file);
      setPhoto(nextPhoto);
      setPhotoStatus('Local preview created with original EXIF metadata removed. Nothing uploaded.');
    } catch (cause) {
      setPhotoStatus(cause instanceof Error ? cause.message : 'Could not preview this image.');
    }
    event.target.value = '';
  };

  const copyToken = async () => {
    try {
      await navigator.clipboard.writeText(SAMPLE_TOKEN);
      setCopyStatus('Demo token copied. It is not valid for tracking.');
    } catch { setCopyStatus('Copy unavailable. This demo token is not valid.'); }
  };

  return (
    <main className="page report-page" id="main">
      <div className="page-heading">
        <p className="eyebrow">Report · demonstration</p>
        <h1>{step === 1 ? 'What happened?' : step === 2 ? 'Where is it?' : step === 3 ? 'Review your draft' : 'Preview complete'}</h1>
        <p className="help-text">This is a UI preview. No report is submitted or tracked.</p>
      </div>

      <div className="report-progress" aria-label="Report progress">
        {[1, 2, 3, 4].map(number => (
          <button type="button" key={number}
            aria-label={'Step ' + number + (number <= maxReached ? ', available' : ', locked')}
            aria-current={number === step ? 'step' : undefined}
            disabled={number > maxReached}
            onClick={() => setParams({ step: String(number) })} />
        ))}
      </div>

      <div className="report-step" key={step}>
        {step === 1 && (
          <section aria-label="Incident description">
            <p className="field-legend">Choose a type</p>
            <div className="choice-row" role="group" aria-label="Report type">
              {(['Issue', 'Complaint', 'Commendation'] as ReportKind[]).map(kind => (
                <button type="button" className="chip" aria-pressed={draft.kind === kind} key={kind} onClick={() => update({ kind })}>{kind}</button>
              ))}
            </div>
            <label htmlFor="incident-description">What should be recorded?</label>
            <textarea id="incident-description" value={draft.description}
              onChange={event => update({ description: event.target.value.slice(0, 4000) })}
              rows={8} maxLength={4000}
              placeholder="Describe the issue, location and what you observed…" />
            <div className="field-bottom"><span>{saveStatus}</span><span>{draft.description.length} / 4000</span></div>
            <p className="note">This text is stored only in this browser for drafting. Clear it on shared devices.</p>
          </section>
        )}

        {step === 2 && (
          <section aria-label="Incident location">
            <p className="body-emphasis">Choose the incident location, not necessarily yours.</p>
            <button type="button" className="quiet-action" onClick={proposeGPS}>Use my current location</button>
            <p className="note">Only after you tap — never in the background.</p>
            <label htmlFor="lga">Local government area</label>
            <select id="lga" value={draft.lgaId} onChange={event => {
              update({ lgaId: event.target.value, wardId: '' });
              setPointEvidence('');
            }}>
              <option value="">Select an LGA</option>
              {candidateLgas.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <label htmlFor="ward">Electoral ward <span className="field-optional">Optional</span></label>
            <select id="ward" value={draft.wardId} disabled={!draft.lgaId || !wards.length}
              onChange={event => update({ wardId: event.target.value })}>
              <option value="">Not specified</option>
              {wards.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            {directoryError && <p className="warning-note" role="status">{directoryError}</p>}
            {draft.wardId && <p className="warning-note">Ward selected by you. Its exact geographic boundary is not verified.</p>}
            <label htmlFor="place">Landmark <span className="field-optional">Optional</span></label>
            <input id="place" maxLength={160} value={draft.place} onChange={event => update({ place: event.target.value })} placeholder="Town, road or nearby place" />
            <button type="button" className="text-link" onClick={() => setMapOpen(value => !value)}>
              {mapOpen ? 'Hide map' : 'Open Ekiti map · more data'}
            </button>
            {mapOpen && <React.Suspense fallback={<p role="status">Loading map only now…</p>}>
              <MapLocation onPoint={(lat, lon) => {
                setPoint({ lat, lon });
                setPointEvidence('');
                setLocationStatus('Map point proposed. Confirm it before boundary lookup.');
              }} />
            </React.Suspense>}
            {point && <button type="button" className="quiet-action" onClick={checkBoundary} disabled={checking}>Confirm incident position</button>}
            {locationStatus && <p role="status" className="note">{locationStatus}</p>}
            {pointEvidence && <p className="boundary-evidence" role="status">{pointEvidence}</p>}
            {pointEvidence && <button type="button" className="text-link" onClick={() => {
              setPoint(null); setPointEvidence(''); setLocationStatus('Choose a different area or point.');
            }}>Location is wrong — correct it</button>}
          </section>
        )}

        {step === 3 && (
          <section aria-label="Review and consent">
            <dl className="review-list">
              <dt>Report type</dt><dd>{draft.kind}</dd>
              <dt>What happened</dt><dd>{draft.description}</dd>
              <dt>LGA</dt><dd>{lgaName}</dd>
              <dt>Ward</dt><dd>{wardName}</dd>
              <dt>Landmark</dt><dd>{draft.place || 'Not provided'}</dd>
              <dt>Visibility</dt><dd>Anonymous · demo only</dd>
            </dl>
            <label htmlFor="report-photo">Photo <span className="field-optional">Optional · local preview only</span></label>
            <input type="file" id="report-photo" accept="image/*" onChange={selectPhoto} />
            {photo && <img className="photo-preview" src={photo.url} alt="Local image preview; never uploaded" />}
            {photoStatus && <p className="note" role="status">{photoStatus}</p>}
            <p className="warning-note">This application cannot receive reports yet. There is no actual case, submission, or government notification.</p>
            <label className="check-line"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} />
              <span>I understand this is a demonstration and nothing will be submitted.</span>
            </label>
            <Link to="/report?step=1" className="text-link">Edit description</Link>
          </section>
        )}

        {step === 4 && (
          <section className="preview-success" aria-label="Illustrative completion">
            <div className="success-mark" aria-hidden="true">✓</div>
            <h2>Demo complete</h2>
            <p>No report was stored, transmitted, or sent to an agency.</p>
            <p className="field-legend">Example reference · not valid</p>
            <code className="reference-text">{SAMPLE_REFERENCE}</code>
            <p className="field-legend">Example private token · not valid</p>
            <div className="token-line"><code>{SAMPLE_TOKEN}</code><button type="button" onClick={copyToken}>Copy</button></div>
            {copyStatus && <p role="status" className="note">{copyStatus}</p>}
            <p className="warning-note">A real reference and token will only appear after secure report storage is approved and implemented.</p>
          </section>
        )}
      </div>

      {error && <p role="alert" className="form-error">{error}</p>}
      <div className="report-actions">
        {step < 4 && <button type="button" className="primary-action" onClick={next}>
          {step === 1 ? 'Continue to location' : step === 2 ? 'Review draft' : 'Preview completion'}
        </button>}
        {step === 4 && <Link className="primary-action action-anchor" to={'/track/' + SAMPLE_REFERENCE}>Preview tracking</Link>}
        {step > 1 && step < 4 && <button type="button" className="text-link" onClick={back}>Back</button>}
        {step === 1 && <button type="button" className="text-link" onClick={clear}>Clear saved draft</button>}
      </div>
    </main>
  );
}
