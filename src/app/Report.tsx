import * as React from 'react';
import { Link } from 'react-router';
import { lgas } from './fixtures.ts';
import { useApp } from './state.tsx';
import {
  DRAFT_STORAGE_KEY, OLD_DRAFT_STORAGE_KEY, startConversation, readConversation,
  submitLine, chooseArea, revise, markDownloaded, draftAsText,
  type Conversation, type AreaName, type ReportKind,
} from './report-conversation.ts';

const MapLocation = React.lazy(() => import('./MapLocation.tsx'));
type Area = AreaName & { kind: 'lga' | 'ward'; parentId: string };
const promptTranslation: Record<string, string> = {
  'Tell me what happened': 'Sọ ohun tó ṣẹlẹ̀ ní àdúgbò rẹ fún mi. Èyí jẹ́ àkọsílẹ̀ àdáni, kì í ṣe ìfíṣùn ránṣẹ́.',
  'Could you add a little more': 'Jọ̀wọ́ ṣàlàyé rẹ̀ sí i kí àkọsílẹ̀ lè péye.',
  'Thank you. Which local': 'Ẹ ṣé. Ìjọba ìbílẹ̀ wo ni ìṣẹ̀lẹ̀ náà ti ṣẹlẹ̀? O lè kọ orúkọ rẹ̀ tàbí yàn án.',
  'I could not confidently': 'Mi ò lè fìdí ìjọba ìbílẹ̀ yẹn múlẹ̀. Jọ̀wọ́ yàn án láti inú àtòjọ.',
  'Understood —': 'Mo gbọ́. Ṣé ohun míì wà tó yẹ kí a fi kún àkọsílẹ̀, bí ọjọ́ tàbí àmì ibi? Tẹ “skip” láti kọjá.',
  'Here is what I understood': 'Èyí ni àkótán ohun tí o sọ. Ṣàyẹ̀wò, ṣàtúnṣe rẹ̀ kí o tó gba àkọsílẹ̀ náà.',
  'Please tell me the corrected': 'Jọ̀wọ́ sọ àtúnṣe àlàyé náà.',
  'Which local government area should': 'Ìjọba ìbílẹ̀ wo ni kí n lò dípò èyí?',
  'What additional details': 'Àlàyé míì wo ni o fẹ́ kún un?',
  'Your file was prepared': 'A ti pèsè fáìlì àdáni rẹ. A kò fi ránṣẹ́ sí ìjọba tàbí fún un ní nọ́mbà ìtọ́pinpin.',
};
function localPrompt(value: string, language: 'en' | 'yo') {
  if (language === 'en') return value;
  const match = Object.keys(promptTranslation).find(key => value.startsWith(key));
  return match ? promptTranslation[match] : value;
}
function saveText(text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = 'ekiti-private-report-draft.txt';
  document.body.appendChild(anchor);
  anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}
export default function Report() {
  const { language, pendingReportText, setPendingReportText } = useApp();
  const [state, setState] = React.useState<Conversation>(readConversation);
  const [input, setInput] = React.useState('');
  const [areas, setAreas] = React.useState<AreaName[]>([...lgas]);
  const [directoryNote, setDirectoryNote] = React.useState('');
  const [savedNote, setSavedNote] = React.useState('');
  const [position, setPosition] = React.useState<{ lat: number; lon: number } | null>(null);
  const [positionNote, setPositionNote] = React.useState('');
  const [mapOpen, setMapOpen] = React.useState(false);
  const [checking, setChecking] = React.useState(false);
  const [photo, setPhoto] = React.useState<string | null>(null);
  const [photoNote, setPhotoNote] = React.useState('');
  const end = React.useRef<HTMLDivElement>(null);
  const editor = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    const controller = new AbortController();
    fetch('/api/areas', { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('Unavailable');
      return response.json() as Promise<Area[]>;
    }).then(rows => {
      const found = rows.filter(row => row.kind === 'lga');
      if (found.length === 16) setAreas(found);
    }).catch(() => {
      if (!controller.signal.aborted) setDirectoryNote('The live area directory is unavailable. The saved 16-LGA reference list is shown.');
    });
    return () => controller.abort();
  }, []);
  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      try { localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(state)); setSavedNote('Saved on this device'); }
      catch { setSavedNote('Device storage unavailable. Download before leaving.'); }
    }, 450);
    return () => clearTimeout(timer);
  }, [state]);
  React.useEffect(() => {
    if (!pendingReportText) return;
    setState(current => current.stage === 'describe' ? submitLine(current, pendingReportText, areas) : current);
    setPendingReportText('');
  }, [pendingReportText, setPendingReportText, areas]);
  React.useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [state.lines.length, state.stage]);
  React.useEffect(() => () => { if (photo) URL.revokeObjectURL(photo); }, [photo]);

  const send = (value = input) => {
    if (!value.trim()) return;
    setState(current => submitLine(current, value, areas));
    setInput('');
  };
  const clear = () => {
    if (!window.confirm('Clear this private draft and conversation from your device?')) return;
    setState(startConversation()); setInput(''); setPosition(null); setPhoto(null);
    try { localStorage.removeItem(DRAFT_STORAGE_KEY); localStorage.removeItem(OLD_DRAFT_STORAGE_KEY); }
    catch { /* In-memory draft still cleared. */ }
  };
  const download = () => {
    saveText(draftAsText(state.draft));
    if (state.stage === 'review') setState(current => markDownloaded(current));
  };
  const gps = () => {
    if (!navigator.geolocation) { setPositionNote('GPS unavailable; choose an LGA instead.'); return; }
    setPositionNote('Requesting device permission…');
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      setPosition({ lat: coords.latitude, lon: coords.longitude });
      setPositionNote('Position proposed. It has not been sent to the server. Confirm to check the boundary.');
    }, () => setPositionNote('GPS denied or unavailable; choose an LGA instead.'),
    { enableHighAccuracy: false, maximumAge: 0, timeout: 10000 });
  };
  const verifyPoint = async () => {
    if (!position || checking || state.stage !== 'location') return;
    setChecking(true); setPositionNote('Checking LGA boundary…');
    try {
      const response = await fetch('/api/resolve', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: position.lat, longitude: position.lon, confirmed: true }),
      });
      if (!response.ok) throw new Error('Unavailable');
      const result = await response.json() as { lga?: { match?: AreaName } };
      const match = result.lga?.match;
      if (match && areas.some(area => area.id === match.id)) {
        setState(current => chooseArea(current, match));
        setPositionNote('Boundary match: ' + match.name + '. Ward borders are not verified.');
      } else setPositionNote('No certain LGA match. Choose manually.');
    } catch { setPositionNote('Boundary check unavailable. Choose manually.'); }
    finally { setChecking(false); }
  };
  const previewPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 5_000_000 || !('createImageBitmap' in window)) {
      setPhotoNote('Choose an image smaller than 5 MB. Preview is not supported in every browser.'); return;
    }
    try {
      const image = await createImageBitmap(file);
      const scale = Math.min(1, 1000 / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas unavailable');
      context.drawImage(image, 0, 0, canvas.width, canvas.height); image.close();
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b =>
        b ? resolve(b) : reject(new Error('Preview error')), 'image/jpeg', .8));
      setPhoto(URL.createObjectURL(blob));
      setPhotoNote('Photo preview prepared locally without original EXIF metadata. It is not uploaded or attached to the text draft.');
    } catch { setPhotoNote('Could not preview the photo; the text draft still works.'); }
  };
  const writing = ['describe', 'location', 'details'].includes(state.stage);

  return <main className="page civic-conversation-page report-page" id="main">
    <header className="chat-conversation-top conversation-heading">
      <span className="chat-avatar" aria-hidden="true">e</span>
      <div className="chat-contact">
        <h1>{language === 'yo' ? 'Ṣàlàyé ohun tó ṣẹlẹ̀' : 'Tell me what happened'}</h1>
        <p>Private chat draft · Not submitted</p>
      </div>
      <button type="button" className="chat-clear" aria-label="Clear private draft and conversation"
        onClick={clear}>Clear</button>
    </header>
    <div className="conversation-history" role="log" aria-live="polite" aria-label="Report preparation conversation" aria-relevant="additions text">
      {state.lines.map(line => <div key={line.id} className={'conversation-turn turn-' + line.role}>
        {line.role === 'assistant' && <span className="conversation-author">Ekiti Civic</span>}
        <p lang={line.role === 'assistant' && language === 'yo' ? 'yo' : undefined}>
          {line.role === 'assistant' ? localPrompt(line.text, language) : line.text}
        </p>
      </div>)}
      <div ref={end} />
    </div>
    {state.stage !== 'location' && positionNote.startsWith('Boundary match:') && <p className="boundary-evidence" role="status">{positionNote}</p>}
    {state.stage === 'location' && <section className="conversation-support" aria-label="Optional location tools">
      <label htmlFor="report-area">Or choose the local government area</label>
      <select id="report-area" value="" onChange={event => {
        const area = areas.find(item => item.id === event.target.value);
        if (area) {
          setPosition(null); setPositionNote('');
          setState(current => chooseArea(current, area));
        }
      }}>
        <option value="">Choose an LGA</option>
        {areas.map(area => <option key={area.id} value={area.id}>{area.name}</option>)}
      </select>
      {directoryNote && <p role="status" className="note">{directoryNote}</p>}
      <details className="conversation-disclosure">
        <summary>Optional: check a precise map location</summary>
        <p className="note">GPS requires permission; the position is sent only when you confirm.</p>
        <button type="button" className="quiet-action" onClick={gps}>Use device GPS</button>
        <button type="button" className="text-link" onClick={() => setMapOpen(current => !current)}>
          {mapOpen ? 'Hide map' : 'Open Ekiti map'}
        </button>
        {mapOpen && <React.Suspense fallback={<p role="status">Loading map…</p>}>
          <MapLocation onPoint={(lat, lon) => {
            setPosition({ lat, lon }); setPositionNote('Map point selected. Confirm before checking its boundary.');
          }} />
        </React.Suspense>}
        {position && <button type="button" className="quiet-action" onClick={() => void verifyPoint()} disabled={checking}>Confirm incident position</button>}
        {positionNote && <p role="status" className="note">{positionNote}</p>}
      </details>
    </section>}
    {state.stage === 'details' && <button type="button" className="text-link conversation-shortcut" onClick={() => send('skip')}>No more details — continue</button>}
    {(state.stage === 'review' || state.stage === 'saved') && <section className="conversation-review" aria-labelledby="report-review-title">
      <h2 id="report-review-title">Your private draft</h2>
      <dl className="review-list">
        <dt>Report type</dt><dd><select aria-label="Report type" value={state.draft.kind}
          onChange={event => setState(current => ({ ...current, draft: { ...current.draft, kind: event.target.value as ReportKind } }))}>
          <option>Issue</option><option>Complaint</option><option>Commendation</option></select></dd>
        <dt>What happened</dt><dd>{state.draft.description}</dd>
        <dt>Local government area</dt><dd>{state.draft.lgaName}</dd>
        <dt>Extra details</dt><dd>{state.draft.detail || 'None provided'}</dd>
      </dl>
      <div className="review-edit-links" role="group" aria-label="Make corrections">
        <button type="button" className="text-link" onClick={() => setState(current => revise(current, 'description'))}>Edit description</button>
        <button type="button" className="text-link" onClick={() => {
          setPosition(null); setPositionNote('');
          setState(current => revise(current, 'location'));
        }}>Change LGA</button>
        <button type="button" className="text-link" onClick={() => setState(current => revise(current, 'details'))}>Edit details</button>
      </div>
      <details className="conversation-disclosure">
        <summary>Optional: preview photo (not uploaded)</summary>
        <label htmlFor="draft-photo">Choose a photo</label>
        <input id="draft-photo" type="file" accept="image/*" onChange={event => void previewPhoto(event)} />
        {photo && <img className="photo-preview" alt="Local photo preview, not uploaded" src={photo} />}
        {photoNote && <p className="note" role="status">{photoNote}</p>}
        <p className="note">Photos are not included in downloaded text files.</p>
      </details>
      <p className="privacy-notice">This draft is stored only on this device. It is not sent to an agency. Real tracking begins only after secure reporting launches.</p>
      {state.stage === 'review' && <button type="button" className="primary-action" onClick={download}>Download private draft</button>}
      {state.stage === 'saved' && <div className="conversation-complete">
        <p role="status">Download prepared · Not submitted</p>
        <button type="button" className="quiet-action" onClick={download}>Download again</button>
        <Link to="/track">How tracking will work</Link>
      </div>}
    </section>}
    {writing && <form className="conversation-composer chat-composer" onSubmit={event => { event.preventDefault(); send(); }}>
      <label className="visually-hidden" htmlFor="report-message">Your reply</label>
      <div className="chat-compose-row">
        <textarea ref={editor} id="report-message" rows={1} maxLength={4000} value={input}
          onChange={event => setInput(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault(); send();
            }
          }} placeholder={state.stage === 'location' ? 'Type an LGA, e.g. Ido/Osi' :
            state.stage === 'details' ? 'More details, or type skip…' : 'Type your message…'} />
        <button type="submit" className="conversation-send" disabled={!input.trim()}>Send</button>
      </div>
      <span className="metadata chat-save-status" role="status">{savedNote}</span>
    </form>}
  </main>;
}
