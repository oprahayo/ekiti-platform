import * as React from 'react';
import { Link, useSearchParams } from 'react-router';
import { lgas } from './fixtures.ts';
import { useApp } from './state.tsx';
import {
  CHAT_SOUND_KEY, REPORT_CATEGORIES, REPORT_DRAFT_KEY, REPORT_STEPS,
  journeyPrompt, journeyWelcome, readJourneyDraft,
  type JourneyStep, type ReportCategory, type EvidenceMethod,
  type SavedJourneyDraft,
} from './report-journey-state.ts';
import {
  INCIDENT_TAXONOMY, taxonomyQuestion, taxonomyChoiceLabel,
  reviewSignal, possibleSameTabDraft, type DangerAnswer,
 } from './incident-taxonomy.ts';
import {
  restrictPreviewEvidence, hasExpiredLocalDraft, type SafeguardConcern,
} from './report-safeguarding.ts';

const OnDeviceRecorder = React.lazy(() => import('./OnDeviceRecorder.tsx'));

function MethodSymbol({kind}: {kind:'Text'|'Photo'|'Video'|'Audio'}) {
  const icon: Record<typeof kind,React.ReactNode> = {
    Text: <><path d="M6 4h12v16H6z"/><path d="M9 9h6M9 13h6M9 17h4"/></>,
    Photo: <><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m4 17 5-4 4 3 3-4 4 5"/></>,
    Video: <><rect x="3" y="5" width="13" height="14" rx="2"/><path d="m16 10 5-3v10l-5-3"/></>,
    Audio: <><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4M8 21h8"/></>,
  };
  return <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">{icon[kind]}</svg>;
}

type Step = JourneyStep;
type ContactMethod = 'none' | 'email' | 'sms';
type Line = { id: number; speaker: 'assistant' | 'resident'; text: string };

const categories = REPORT_CATEGORIES;

const methodHelp: Record<EvidenceMethod, string> = {
  Text: 'Type what happened. You can add media later.',
  Photo: 'Take a photo or choose an existing image.',
  Video: 'Record a video or attach an existing clip.',
  Audio: 'Record an audio note or choose an audio file.',
};
const MAX_FILE: Record<Exclude<EvidenceMethod, 'Text'>, number> = {
  Photo: 8_000_000, Video: 25_000_000, Audio: 15_000_000,
};
const ACCEPT: Record<Exclude<EvidenceMethod, 'Text'>, string> = {
  Photo: 'image/jpeg,image/png,image/webp',
  Video: 'video/mp4,video/webm,video/quicktime',
  Audio: 'audio/mpeg,audio/mp4,audio/wav,audio/webm,audio/ogg,audio/x-m4a',
};
function secureContact(kind: ContactMethod, value: string): boolean {
  if (kind === 'none') return true;
  if (kind === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) && value.length <= 160;
  return /^\+?[0-9\s()-]{8,22}$/.test(value.trim());
}
function initialLines(feedback:boolean, language:'en'|'yo'):Line[] {
  return [{id:1,speaker:'assistant',text:journeyWelcome(feedback,language)}];
}

export default function ReportJourney() {
  const [search] = useSearchParams();
  const { pendingReportText, setPendingReportText, language } = useApp();
  const feedback = search.get('kind') === 'feedback';
  const [step, setStep] = React.useState<Step>('method');
  const [lines, setLines] = React.useState<Line[]>(() => initialLines(feedback,language));
  const nextId = React.useRef(2);
  const [method, setMethod] = React.useState<EvidenceMethod>('Text');
  const [category, setCategory] = React.useState<ReportCategory>(feedback ? 'Suggestion' : 'Other');
  const [description, setDescription] = React.useState('');
  const [subcategory,setSubcategory] = React.useState('');
  const [immediateDanger,setImmediateDanger] = React.useState<DangerAnswer>('unknown');
  const [resumedDraft,setResumedDraft] = React.useState(false);
  const [safeguardConcerns,setSafeguardConcerns] = React.useState<SafeguardConcern[]>([]);
  const [localSaveAcknowledged,setLocalSaveAcknowledged] = React.useState(false);
  const [savedSuccessfully,setSavedSuccessfully] = React.useState(false);
  const [community, setCommunity] = React.useState('');
  const [lgaId, setLgaId] = React.useState('');
  const [media, setMedia] = React.useState<File | null>(null);
  const [mediaUrl, setMediaUrl] = React.useState('');
  const [mediaError, setMediaError] = React.useState('');
  const [contactMethod, setContactMethod] = React.useState<ContactMethod>('none');
  const [contact, setContact] = React.useState('');
  const [validation, setValidation] = React.useState('');
  const [savedNote, setSavedNote] = React.useState('');
  const [captureMode, setCaptureMode] = React.useState<'record'|'upload'|null>(null);
  const [typing, setTyping] = React.useState(false);
  const [soundsOn, setSoundsOn] = React.useState(() => {
    try { return localStorage.getItem(CHAT_SOUND_KEY)==='on'; }
    catch { return false; }
  });
  const [history,setHistory] = React.useState<Step[]>([]);
  const [savedDraft,setSavedDraft] = React.useState<SavedJourneyDraft|null>(() => {
    try {
      const raw = sessionStorage.getItem(REPORT_DRAFT_KEY);
      if(hasExpiredLocalDraft(raw)) {
        sessionStorage.removeItem(REPORT_DRAFT_KEY);
        return null;
      }
      return readJourneyDraft(raw, feedback?'feedback':'report', lgas.map(area=>area.id));
    } catch { return null; }
  });
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const busyRef = React.useRef(false);
  const audioRef = React.useRef<AudioContext | null>(null);
  const threadEnd = React.useRef<HTMLDivElement>(null);
  const previousPurpose = React.useRef(feedback);
  const previousLanguage = React.useRef(language);

  function toggleSounds() {
    setSoundsOn(current => {
      const next=!current;
      try { localStorage.setItem(CHAT_SOUND_KEY,next?'on':'off'); } catch { /* Optional. */ }
      return next;
    });
  }

  function clearPendingReply() {
    if(timerRef.current) clearTimeout(timerRef.current);
    timerRef.current=null;
    busyRef.current=false;
    setTyping(false);
  }

  function goBack() {
    if(step==='saved') return;
    if(busyRef.current) {
      clearPendingReply();
      setLines(current=>current.slice(0,-1)); // Remove unconfirmed answer, not earlier messages.
      return;
    }
    const previous=history.at(-1);
    if(!previous) return;
    setStep(previous);
    setLocalSaveAcknowledged(false);
    setHistory(current=>current.slice(0,-1));
    setLines(current=>current.slice(0,-2)); // One answer + its response per completed step.
    setValidation('');setMediaError('');
  }

  function editCategory() {
    if(busyRef.current) return;
    const index=history.lastIndexOf('category');
    if(index>=0) {
      const remove=history.length-index;
      setHistory(current=>current.slice(0,index));
      setLines(current=>current.slice(0,-2*remove));
    } else {
      setLines([...initialLines(feedback,language),
        {id:nextId.current++,speaker:'assistant',text:journeyPrompt('category',language)}]);
      setHistory([]);
    }
    setStep('category');setValidation('');setLocalSaveAcknowledged(false);
  }

  function resumeDraft() {
    if(!savedDraft || busyRef.current) return;
    setMethod(savedDraft.method);setCategory(savedDraft.category);
    setDescription(savedDraft.description);setLgaId(savedDraft.lgaId);
    setSubcategory(savedDraft.subcategory ?? '');
    setImmediateDanger(savedDraft.immediateDanger ?? 'unknown');
    setResumedDraft(true);
    setSafeguardConcerns([]);setLocalSaveAcknowledged(false);setSavedSuccessfully(false);
    setCommunity(savedDraft.community);setMedia(null);setMediaUrl('');
    setMediaError('');setContact('');setContactMethod('none');setCaptureMode(null);
    setHistory([]);setValidation('');setSavedNote('');
    setLines([{id:nextId.current++,speaker:'assistant',
      text:'Your saved draft is ready to review. Evidence and contact details were not stored.'}]);
    setStep('review');
  }

  function discardDraft() {
    try { sessionStorage.removeItem(REPORT_DRAFT_KEY); } catch { /* Optional. */ }
    setSavedDraft(null);
  }

  function playChatCue(kind:'send'|'receive') {
    if (!soundsOn || typeof window === 'undefined' || !window.AudioContext) return;
    try {
      const context = audioRef.current || new window.AudioContext();
      audioRef.current = context;
      if (context.state === 'suspended') void context.resume().catch(() => {});
      const now=context.currentTime+0.012;
      const osc=context.createOscillator(), gain=context.createGain();
      osc.type='sine';
      osc.frequency.setValueAtTime(kind==='send'?550:700,now);
      if (kind==='receive') osc.frequency.exponentialRampToValueAtTime(900,now+0.09);
      gain.gain.setValueAtTime(0.0001,now);
      gain.gain.exponentialRampToValueAtTime(0.025,now+0.014);
      gain.gain.exponentialRampToValueAtTime(0.0001,now+0.15);
      osc.connect(gain);gain.connect(context.destination);
      osc.start(now);osc.stop(now+0.16);
    } catch { /* Sound is optional. */ }
  }

  React.useEffect(() => {
    if (pendingReportText) {
      // Keep a narrative passed from Ask locally. It is never sent to /api/ask.
      setDescription(pendingReportText.slice(0,4000));
      setPendingReportText('');
    }
  }, [pendingReportText, setPendingReportText]);
  React.useEffect(() => () => { if (mediaUrl) URL.revokeObjectURL(mediaUrl); }, [mediaUrl]);
  React.useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    void audioRef.current?.close().catch(()=>{});
  }, []);
  React.useEffect(() => {
    if(previousPurpose.current!==feedback) {
      clearPendingReply();
      previousPurpose.current=feedback;
      setStep('method');setHistory([]);
      setLines(initialLines(feedback,language));nextId.current=2;
      setDescription('');setLgaId('');setCommunity('');
      setSubcategory('');setImmediateDanger('unknown');setResumedDraft(false);
      setSafeguardConcerns([]);setLocalSaveAcknowledged(false);setSavedSuccessfully(false);
      setMedia(null);setMediaUrl('');setContact('');setContactMethod('none');
      try { setSavedDraft(readJourneyDraft(sessionStorage.getItem(REPORT_DRAFT_KEY),
        feedback?'feedback':'report',lgas.map(area=>area.id))); }
      catch {setSavedDraft(null);}
    } else if(previousLanguage.current!==language) {
      previousLanguage.current=language;
      // Only replace the opening bubble when the conversation is untouched.
      if(step==='method' && !history.length && !typing)
        setLines(initialLines(feedback,language));
    }
  },[feedback,language]);
  React.useEffect(() => {
    if (lines.length > 1) threadEnd.current?.scrollIntoView({ block: 'nearest' });
  }, [lines.length,typing]);

  function respond(answer: string, next: Step, customPrompt?: string, immediate = false) {
    if (busyRef.current) return;
    busyRef.current = true;
    setValidation('');
    const priorStep=step;
    playChatCue('send');
    setLines(current => [...current, { id: nextId.current++, speaker: 'resident', text: answer }]);
    const showReply = () => {
      setLines(current => [...current,
        { id: nextId.current++, speaker: 'assistant', text: customPrompt || journeyPrompt(next,language) },
      ]);
      setHistory(current=>[...current,priorStep]);
      setStep(next);
      setTyping(false);
      busyRef.current=false;
      timerRef.current=null;
      playChatCue('receive');
    };
    const reduceMotion=typeof window.matchMedia==='function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (immediate || reduceMotion) showReply(); // Never delay urgent or reduced-motion replies.
    else {
      setTyping(true);
      timerRef.current = setTimeout(showReply, 570);
    }
  }
  function reset() {
    if (!window.confirm('Clear this report conversation and all local evidence?')) return;
    clearPendingReply();
    setHistory([]);
    setStep('method'); setLines(initialLines(feedback,language)); nextId.current = 2;
    setMethod('Text'); setCategory(feedback ? 'Suggestion' : 'Other'); setDescription('');
    setSubcategory('');setImmediateDanger('unknown');setResumedDraft(false);
    setSafeguardConcerns([]);setLocalSaveAcknowledged(false);setSavedSuccessfully(false);
    setCommunity(''); setLgaId(''); setMedia(null); setMediaUrl(''); setMediaError('');
    setContactMethod('none'); setContact(''); setValidation(''); setSavedNote(''); setCaptureMode(null);
    discardDraft();
  }
  function toggleSafeguard(concern:SafeguardConcern,enabled:boolean) {
    setSafeguardConcerns(current=>{
      if (!enabled) return current.filter(value=>value!==concern);
      if (current.includes(concern)) return current;
      return [...current,concern];
    });
    if(enabled) {setMedia(null);setMediaUrl('');setCaptureMode(null);}
    setLocalSaveAcknowledged(false);
  }
  function chooseMethod(value: EvidenceMethod) {
    setMethod(value); setMedia(null); setMediaUrl(''); setMediaError(''); setCaptureMode(null);
    setResumedDraft(false);
    respond(value + ' · ' + methodHelp[value], 'category');
  }
  function chooseCategory(value: ReportCategory) {
    setCategory(value);setSubcategory('');setImmediateDanger('unknown');
    setLocalSaveAcknowledged(false);
    respond(value, 'description', value === 'Emergency'
      ? 'If anyone is in immediate danger, contact emergency services directly. This project does not dispatch help. You can still describe the incident here as a private draft.'
      : journeyPrompt('description',language), value === 'Emergency');
  }
  function nextDescription() {
    const text = description.trim();
    if (text.length < 20) { setValidation('Please add at least 20 characters so the issue is clear.'); return; }
    respond(text, 'location');
  }
  function nextLocation() {
    const selected = lgas.find(area => area.id === lgaId);
    if (!selected) { setValidation('Choose a local government area to continue.'); return; }
    respond(selected.name + (community.trim() ? ' · ' + community.trim() : ''), 'evidence');
  }
  function selectMedia(file?: File) {
    setMediaError('');
    if (restrictPreviewEvidence(safeguardConcerns)) {
      setMedia(null);setMediaUrl('');
      setMediaError('Media capture is unavailable for sensitive drafts in this preview. Continue without an attachment.');
      return;
    }
    if (!file || method === 'Text') return;
    if (!ACCEPT[method].split(',').includes(file.type) || file.size > MAX_FILE[method] || file.size === 0) {
      setMedia(null); setMediaUrl('');
      setMediaError('Please select a supported ' + method.toLowerCase() + ' under ' + Math.round(MAX_FILE[method]/1_000_000) + ' MB.');
      return;
    }
    setMedia(file); setMediaUrl(URL.createObjectURL(file));
  }
  function nextEvidence(skip = false) {
    if(restrictPreviewEvidence(safeguardConcerns)) {
      setMedia(null);setMediaUrl('');
      respond('Sensitive draft · no attachment', 'followup');
      return;
    }
    if (method !== 'Text' && !media && !skip) {
      setMediaError('Select evidence or choose Continue without attachment.'); return;
    }
    if (skip) { setMedia(null); setMediaUrl(''); }
    respond(skip || !media ? 'Continue without attachment' : method + ': ' + media.name, 'followup');
  }
  function chooseContact(value: ContactMethod) {
    setContactMethod(value); setContact('');
    if (value === 'none') respond('No follow-up contact', 'review');
    else respond(value === 'email' ? 'Email link' : 'SMS link', 'contact');
  }
  function nextContact() {
    if (!secureContact(contactMethod,contact)) {
      setValidation(contactMethod === 'email' ? 'Enter a valid email address.' : 'Enter a valid phone number with country code.');
      return;
    }
    respond('Contact entered for ' + (contactMethod === 'email' ? 'email' : 'SMS') + ' (not sent)', 'review');
  }
  function save() {
    if (!localSaveAcknowledged) {
      setValidation('Acknowledge the local browser storage notice before saving.');
      return;
    }
    const snapshot = {
      purpose: feedback ? 'feedback' : 'report', method, category, description: description.trim(),
      lgaId, community: community.trim(),
      ...(subcategory ? {subcategory} : {}),
      immediateDanger:feedback ? 'unknown' : immediateDanger,
      attachment: media ? 'Not stored: ' + media.name : 'None',
      followupRequested: contactMethod !== 'none', savedAt: new Date().toISOString(),
    };
    try {
      // Only this browser session. Raw media, phone and email are NEVER saved.
      sessionStorage.setItem(REPORT_DRAFT_KEY, JSON.stringify(snapshot));
      setSavedSuccessfully(true);
      setSavedNote('Saved in this browser session. Evidence, contact details and safeguarding choices were not stored.');
      setSavedDraft(readJourneyDraft(JSON.stringify(snapshot),
        feedback?'feedback':'report',lgas.map(area=>area.id)));
    } catch {
      setSavedSuccessfully(false);
      setSavedNote('Your text is visible on this screen, but browser storage is unavailable. It will not survive reload.');
    }
    respond('Save private draft', 'saved');
  }
  const chosenArea = lgas.find(item => item.id === lgaId)?.name || 'Not selected';
  const safetySignal = reviewSignal(category,feedback?'unknown':immediateDanger);
  const restrictEvidence = restrictPreviewEvidence(safeguardConcerns);
  const sameTabOverlap = !resumedDraft && possibleSameTabDraft(
    {purpose:feedback?'feedback':'report',category,lgaId,description:description.trim()},savedDraft);
  return <main className="page guided-report-page" id="main">
    <h1 className="visually-hidden">{feedback ? 'Share feedback' : 'Report an issue'}</h1>
    <div className="guided-chat-tools">
      {(history.length>0 || typing) && step!=='saved' && <button type="button"
        className="guided-back" onClick={goBack}>← Back</button>}
      <button type="button" className="guided-sound-toggle" aria-pressed={soundsOn}
        onClick={toggleSounds}>
        {soundsOn ? 'Chat sounds on' : 'Chat sounds off'}
      </button>
    </div>

    <p className="visually-hidden guided-progress" aria-label="Reporting progress">
      {step === 'saved' ? 'Private draft saved' : 'Preparing your report · ' +
        Math.max(1, ['method','category','description','location','evidence','followup','contact','review'].indexOf(step)+1) + ' of 8'}
    </p>
    {step==='method' && savedDraft && !typing && <aside className="guided-resume">
      <div><strong>Saved private draft</strong>
        <p>Continue your text draft in this tab. Media and contact information were not stored.</p></div>
      <div className="guided-resume-actions">
        <button type="button" onClick={resumeDraft}>Continue saved draft</button>
        <button type="button" onClick={discardDraft}>Discard draft</button>
      </div>
    </aside>}
    <div className="guided-thread" role="log" aria-label="Report conversation" aria-live="polite">
      {lines.map(line => <div key={line.id} className={'guided-bubble ' + (line.speaker === 'resident' ? 'guided-user' : 'guided-assistant')}>
        {line.speaker === 'assistant' && <span className="conversation-author">Ekiti Civic</span>}
        <p>{line.text}</p>
      </div>)}
      {typing && <div className="guided-bubble guided-assistant guided-typing" role="status"
        aria-label="Ekiti Civic is typing"><span/><span/><span/></div>}
      <div ref={threadEnd}/>
    </div>

    {!typing && step === 'method' && <section className="guided-choices guided-method-grid" aria-label="Choose how to report">
      {(['Text','Photo','Video','Audio'] as EvidenceMethod[]).map(value =>
        <button type="button" key={value} onClick={()=>chooseMethod(value)} className="guided-choice guided-method-choice">
          <MethodSymbol kind={value} />
          <strong>{value === 'Photo' ? 'Photo' : value === 'Video' ? 'Video' : value === 'Audio' ? 'Audio note' : 'Write text'}</strong>
        </button>)}
      <p className="guided-hint">Tap a format. Photo, video and audio are report evidence, not voice commands.</p>
    </section>}

    {!typing && step === 'category' && <section className="guided-choices guided-category-choices" aria-label="Choose report category">
      {categories.map(value => <button className="guided-choice" key={value} type="button"
        onClick={()=>chooseCategory(value)}>{value}</button>)}
    </section>}

    {!typing && step === 'description' && <form className="guided-input-form" onSubmit={event=>{event.preventDefault();nextDescription();}}>
      <fieldset className="guided-triage-question">
        <legend>{taxonomyQuestion(category,language)}</legend>
        <div className="guided-triage-options">
          {INCIDENT_TAXONOMY[category].choices.map(option=>
            <button key={option.id} type="button" aria-pressed={subcategory===option.id}
              onClick={()=>setSubcategory(subcategory===option.id?'':option.id)}>
              {option.label[language]}
            </button>)}
        </div>
        <p className="guided-hint">{language==='yo'
          ? 'O lè fo ìbéèrè yìí bí o kò bá mọ ìdáhùn.' : 'Choose a detail if it fits, or continue without selecting one.'}</p>
      </fieldset>
      {!feedback && <fieldset className="guided-triage-question">
        <legend>{language==='yo' ? 'Ṣé ẹnikẹ́ni wà nínú ewu báyìí?' : 'Is anyone in immediate danger right now?'}</legend>
        <div className="guided-triage-options">
          {([
            ['yes',language==='yo'?'Bẹ́ẹ̀ni':'Yes'],
            ['no',language==='yo'?'Rárá':'No'],
            ['unknown',language==='yo'?'Mi ò mọ̀':'Not sure'],
          ] as const).map(([value,label])=>
            <button key={value} type="button" aria-pressed={immediateDanger===value}
              onClick={()=>setImmediateDanger(value)}>{label}</button>)}
        </div>
        {(immediateDanger==='yes' || category==='Emergency') &&
          <p className="guided-urgent-advice" role="alert">
            If anyone is in immediate danger, contact local emergency services directly.
            Ekiti Civic cannot dispatch help, preserve emergency recordings or alert an agency.
          </p>}
        <p className="guided-hint">This answer only helps prepare a private draft for future human review. No priority is assigned or alert sent.</p>
      </fieldset>}
      <fieldset className="guided-safeguard-fieldset">
        <legend>{language==='yo' ? 'Ṣé ọ̀rọ̀ yìí lè fi ẹnikẹ́ni sínú ewu?' : 'Could this report expose someone to harm?'}</legend>
        <label><input type="checkbox" checked={safeguardConcerns.includes('vulnerable_person')}
          onChange={event=>toggleSafeguard('vulnerable_person',event.target.checked)}/>
          {language==='yo' ? 'Ó kan ọmọ tàbí ẹni tó nílò ààbò pàtàkì' :
            'It involves a child or a vulnerable person'}</label>
        <label><input type="checkbox" checked={safeguardConcerns.includes('retaliation')}
          onChange={event=>toggleSafeguard('retaliation',event.target.checked)}/>
          {language==='yo' ? 'Mo bẹ̀rù ìhalẹ̀ tàbí ìgbẹ̀san' :
            'I am worried about threats, identification or retaliation'}</label>
        {restrictEvidence && <p className="guided-urgent-advice" role="status">
          Please leave out names, faces, private addresses and other identifying details.
          Media capture is disabled for this sensitive draft because secure evidence handling is not active.
          This preview cannot keep identities confidential or alert protection services.
        </p>}
        <p className="guided-hint">These safety choices are advisory and stay in this page's memory only; they are not saved or sent.</p>
      </fieldset>
      <label htmlFor="guided-description">Your report</label>
      <textarea id="guided-description" rows={4} maxLength={4000} value={description}
        onChange={event=>{setDescription(event.target.value);setValidation('');}}
        placeholder="Tell us what you saw, where and when. Avoid sharing someone's private information." />
      {validation && <p role="alert" className="guided-error">{validation}</p>}
      <button className="primary-action" type="submit">Continue</button>
    </form>}

    {!typing && step === 'location' && <form className="guided-input-form" onSubmit={event=>{event.preventDefault();nextLocation();}}>
      <label htmlFor="guided-lga">Local government area</label>
      <select id="guided-lga" value={lgaId} required onChange={event=>{setLgaId(event.target.value);setValidation('');}}>
        <option value="">Choose one of the 16 LGAs</option>
        {lgas.map(area=><option key={area.id} value={area.id}>{area.name}</option>)}
      </select>
      <label htmlFor="guided-community">Community, ward or landmark (optional)</label>
      <input id="guided-community" value={community} maxLength={180}
        onChange={event=>setCommunity(event.target.value)} placeholder="e.g. Ikere town centre" />
      <p className="guided-hint">Exact GPS and household addresses will not be made public. After review, an approved report may appear at an approximate area on the Ekiti map.</p>
      {validation && <p role="alert" className="guided-error">{validation}</p>}
      <button className="primary-action" type="submit">Continue</button>
    </form>}

    {!typing && step === 'evidence' && <section className="guided-input-form" aria-label="Attach optional evidence">
      {restrictEvidence ? <p className="guided-urgent-advice" role="status">
        For a report involving a vulnerable person or fear of retaliation, photo, video and
        audio capture are disabled in this local preview. Use a non-identifying text summary only.
      </p> : method === 'Text' ? <p>Text-only report selected. You can proceed without media.</p> : <>
        <p>{methodHelp[method]} Choose to capture new evidence or select a saved file.</p>
        {(method === 'Video' || method === 'Audio') && <div className="guided-capture-choice" role="group" aria-label="Choose evidence source">
          <button type="button" aria-pressed={captureMode === 'record'}
            onClick={()=>setCaptureMode('record')}>Record on device</button>
          <button type="button" aria-pressed={captureMode === 'upload'}
            onClick={()=>setCaptureMode('upload')}>Upload existing file</button>
        </div>}
        {(method === 'Photo' || captureMode === 'upload') && <div className="guided-evidence-buttons">
          {method === 'Photo' && <label className="guided-file-label">Take a photo
            <input aria-label="Take a photo" type="file" accept={ACCEPT.Photo} capture="environment"
              onChange={event=>{selectMedia(event.target.files?.[0]);event.target.value='';}}/>
          </label>}
          <label className="guided-file-label">Choose existing file
            <input aria-label="Choose existing evidence" type="file" accept={ACCEPT[method]}
              onChange={event=>{selectMedia(event.target.files?.[0]);event.target.value='';}}/>
          </label>
        </div>}
        {(method === 'Video' || method === 'Audio') && captureMode === 'record' &&
          <React.Suspense fallback={<p role="status">Preparing device recorder…</p>}>
            <OnDeviceRecorder kind={method} onCaptured={selectMedia}/>
          </React.Suspense>}
        {media && <div className="guided-evidence-preview">
          <p>{media.name} · {(media.size/1_000_000).toFixed(1)} MB · Stored only in memory</p>
          {method === 'Photo' && mediaUrl && <img src={mediaUrl} alt="Local evidence preview"/>}
          {method === 'Video' && mediaUrl && <video controls src={mediaUrl} aria-label="Video evidence preview"/>}
          {method === 'Audio' && mediaUrl && <audio controls src={mediaUrl} aria-label="Audio evidence preview"/>}
        </div>}
        {mediaError && <p className="guided-error" role="alert">{mediaError}</p>}
        <p className="guided-hint">Original media can reveal faces, addresses or metadata. This preview does not upload or preserve recordings, even while recording. Never rely on it as emergency evidence storage.</p>
      </>}
      <button type="button" className="primary-action" onClick={()=>nextEvidence(restrictEvidence)}>
        {method === 'Text' || restrictEvidence ? 'Continue' : 'Continue with evidence'}
      </button>
      {method !== 'Text' && !restrictEvidence && <button type="button" className="text-link" onClick={()=>nextEvidence(true)}>Continue without attachment</button>}
    </section>}

    {!typing && step === 'followup' && <section className="guided-choices" aria-label="Choose tracking contact">
      <button className="guided-choice" type="button" onClick={()=>chooseContact('email')}>
        <strong>Email tracking link</strong><small>For a verified receipt when live submission is available</small>
      </button>
      <button className="guided-choice" type="button" onClick={()=>chooseContact('sms')}>
        <strong>SMS tracking link</strong><small>Send a private link to a phone number in a future live service</small>
      </button>
      <button className="guided-choice" type="button" onClick={()=>chooseContact('none')}>
        <strong>No follow-up contact</strong><small>Keep your report anonymous and do not provide a contact</small>
      </button>
      <p className="guided-hint">Email and SMS delivery are not active. We will not send messages or generate a real tracking number during this preview.</p>
    </section>}

    {!typing && step === 'contact' && <form className="guided-input-form" onSubmit={event=>{event.preventDefault();nextContact();}}>
      <label htmlFor="guided-contact">{contactMethod === 'email' ? 'Email address' : 'Phone number (include country code)'}</label>
      <input id="guided-contact" type={contactMethod === 'email' ? 'email' : 'tel'} maxLength={160}
        autoComplete={contactMethod === 'email' ? 'email' : 'tel'} value={contact}
        onChange={event=>{setContact(event.target.value);setValidation('');}}
        placeholder={contactMethod === 'email' ? 'you@example.com' : '+234…'}/>
      <p className="guided-hint">Not submitted, saved or used to send anything. A receipt link will only be issued by a future verified intake service.</p>
      {validation && <p className="guided-error" role="alert">{validation}</p>}
      <button type="submit" className="primary-action">Continue</button>
    </form>}

    {!typing && step === 'review' && <section className="guided-review" aria-label="Review private report">
      <h2>Review your private draft</h2>
      <dl className="review-list">
        <dt>Purpose</dt><dd>{feedback ? 'Feedback' : 'Report'}</dd>
        <dt>Category</dt><dd>{category}</dd>
        <dt>Issue detail</dt><dd>{taxonomyChoiceLabel(category,subcategory,language) ?? 'Not specified'}</dd>
        {!feedback && <><dt>Safety answer</dt><dd>{immediateDanger==='yes'?'Immediate danger reported':
          immediateDanger==='no'?'No immediate danger reported':'Not sure / not assessed'}</dd>
          <dt>Review signal</dt><dd>{safetySignal==='immediate_safety_concern'?
            'Possible immediate safety concern — manual review needed' :
            'Human assessment required before any priority decision'}</dd></>}
        <dt>Method</dt><dd>{method}</dd>
        <dt>Description</dt><dd>{description.trim()}</dd>
        <dt>Location</dt><dd>{chosenArea}{community ? ' · ' + community : ''}</dd>
        <dt>Evidence</dt><dd>{media ? media.name + ' (not uploaded)' : 'No file attached'}</dd>
        <dt>Safeguarding</dt><dd>{restrictEvidence
          ? 'Sensitive details noted in this tab only; no automatic reporting or protection'
          : 'No safeguarding flag selected (not assessed)'}</dd>
        <dt>Follow-up</dt><dd>{contactMethod === 'none' ? 'None requested' : contactMethod.toUpperCase() + ' · delivery not active'}</dd>
      </dl>
      {sameTabOverlap && <aside className="guided-duplicate-notice" role="status">
        <strong>Possible repeat of your own saved draft</strong>
        <p>This report resembles a draft saved in this browser tab. Check whether it describes the same incident.
        No other residents' reports were searched, no identity was compared and no case has been merged.</p>
      </aside>}
      {safetySignal==='immediate_safety_concern' && !feedback && <p className="guided-urgent-advice" role="alert">
        If the danger is current, seek emergency help directly; this private draft is not monitored or dispatched.
      </p>}
      <p className="privacy-notice">This is not a submission. These answers are preliminary, not verified severity or official triage. No real report ID, phone/email receipt, official assignment or public map marker can be issued until secure intake and moderation are enabled.</p>
      <div className="guided-local-save-notice">
        <strong>Save only if you want this browser to remember your draft</strong>
        <p>Your text, category and area will be stored in this browser tab for reopening up to 24 hours.
          It is not encrypted or sent as a report. Anyone with access to this browser may see it.
          The copy expires for reopening after 24 hours and is removed when this reporting page is next opened.
          Contact, evidence and safeguarding flags will not be stored.</p>
        <label className="guided-local-save-consent">
          <input type="checkbox" checked={localSaveAcknowledged}
            onChange={event=>{setLocalSaveAcknowledged(event.target.checked);setValidation('');}}/>
          I understand this is a local draft, not a report submission, and I choose to save it here.
        </label>
        <p className="guided-hint">This choice only authorizes this device's local draft save. It is not consent to future server processing.</p>
        <Link to="/privacy" target="_blank" rel="noopener noreferrer">Privacy and safety details</Link>
        {validation && <p role="alert" className="guided-error">{validation}</p>}
      </div>
      <button className="primary-action" type="button" onClick={save} disabled={!localSaveAcknowledged}>
        Save private draft on this device
      </button>
      <button type="button" className="quiet-action" onClick={editCategory}>Change category</button>
    </section>}

    {!typing && step === 'saved' && <section className="guided-review" role="status">
      <h2>{savedSuccessfully?'Draft saved locally':'Draft not saved to browser storage'}</h2>
      <p>{savedNote}</p>
      <p className="privacy-notice">No report has been submitted. There is no tracking ID or email/SMS receipt, and nothing has been placed on the public map.</p>
      <Link to="/track" className="text-link">How tracking will work</Link>
      <button className="quiet-action" type="button" onClick={reset}>Delete this draft and start another</button>
      <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="text-link">Manage local draft privacy</Link>
    </section>}

    <p className="guided-independent-note">Independent civic project · Not a government emergency service.
      No secure intake, moderation or dispatch is active. Legal operator identification and the live privacy policy await approval.
      {' '}<Link to="/privacy" target="_blank" rel="noopener noreferrer">Privacy and safety</Link></p>
  </main>;
}
