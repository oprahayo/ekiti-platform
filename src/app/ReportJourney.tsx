import * as React from 'react';
import { Link, useSearchParams } from 'react-router';
import { lgas } from './fixtures.ts';
import { useApp } from './state.tsx';

type Step = 'method' | 'category' | 'description' | 'location' | 'evidence' | 'followup' | 'contact' | 'review' | 'saved';
type EvidenceMethod = 'Text' | 'Photo' | 'Video' | 'Audio';
type ContactMethod = 'none' | 'email' | 'sms';
type Line = { id: number; speaker: 'assistant' | 'resident'; text: string };

const categories = [
  'Emergency', 'Security', 'Roads', 'Drainage', 'Water', 'Electricity',
  'Sanitation', 'Health', 'Education', 'Environment',
  'Public facilities', 'Service delay / corruption', 'Suggestion', 'Commendation', 'Other',
] as const;
type ReportCategory = typeof categories[number];

const methodHelp: Record<EvidenceMethod, string> = {
  Text: 'Type what happened. You can add media later.',
  Photo: 'Take a photo or choose an existing image.',
  Video: 'Record a video or attach an existing clip.',
  Audio: 'Record an audio note or choose an audio file.',
};
const prompts: Record<Step, string> = {
  method: 'How would you like to share what happened?',
  category: 'What best describes the report? Choose one category.',
  description: 'Tell me what happened, in your own words. A short, clear explanation is enough.',
  location: 'Where in Ekiti did it happen? Choose the LGA and optionally add a community or nearby landmark.',
  evidence: 'Would you like to attach evidence now? Only you can see media previews in this browser.',
  followup: 'Would you like a private tracking link sent to you once real reporting launches?',
  contact: 'Where should that tracking link be sent? Your contact is only held in this tab during this preview.',
  review: 'Here is your draft. Check it before saving on this device.',
  saved: 'Your draft is saved in this browser session. No government office has received it.',
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
function initialLines(feedback: boolean): Line[] {
  return [{ id: 1, speaker: 'assistant',
    text: feedback
      ? 'Welcome. We can prepare your feedback together. ' + prompts.method
      : 'Welcome. I will guide you through a report, one question at a time. ' + prompts.method }];
}

export default function ReportJourney() {
  const [search] = useSearchParams();
  const { pendingReportText, setPendingReportText } = useApp();
  const feedback = search.get('kind') === 'feedback';
  const [step, setStep] = React.useState<Step>('method');
  const [lines, setLines] = React.useState<Line[]>(() => initialLines(feedback));
  const nextId = React.useRef(2);
  const [method, setMethod] = React.useState<EvidenceMethod>('Text');
  const [category, setCategory] = React.useState<ReportCategory>(feedback ? 'Suggestion' : 'Other');
  const [description, setDescription] = React.useState('');
  const [community, setCommunity] = React.useState('');
  const [lgaId, setLgaId] = React.useState('');
  const [media, setMedia] = React.useState<File | null>(null);
  const [mediaUrl, setMediaUrl] = React.useState('');
  const [mediaError, setMediaError] = React.useState('');
  const [contactMethod, setContactMethod] = React.useState<ContactMethod>('none');
  const [contact, setContact] = React.useState('');
  const [validation, setValidation] = React.useState('');
  const [savedNote, setSavedNote] = React.useState('');
  const threadEnd = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (pendingReportText) {
      // Keep a narrative passed from Ask locally. It is never sent to /api/ask.
      setDescription(pendingReportText.slice(0,4000));
      setPendingReportText('');
    }
  }, [pendingReportText, setPendingReportText]);
  React.useEffect(() => () => { if (mediaUrl) URL.revokeObjectURL(mediaUrl); }, [mediaUrl]);
  React.useEffect(() => {
    if (lines.length > 1) threadEnd.current?.scrollIntoView({ block: 'nearest' });
  }, [lines.length]);

  function respond(answer: string, next: Step, customPrompt?: string) {
    setLines(current => [...current,
      { id: nextId.current++, speaker: 'resident', text: answer },
      { id: nextId.current++, speaker: 'assistant', text: customPrompt || prompts[next] },
    ]);
    setStep(next); setValidation('');
  }
  function reset() {
    if (!window.confirm('Clear this report conversation and all local evidence?')) return;
    setStep('method'); setLines(initialLines(feedback)); nextId.current = 2;
    setMethod('Text'); setCategory(feedback ? 'Suggestion' : 'Other'); setDescription('');
    setCommunity(''); setLgaId(''); setMedia(null); setMediaUrl(''); setMediaError('');
    setContactMethod('none'); setContact(''); setValidation(''); setSavedNote('');
    try { sessionStorage.removeItem('ekiti-guided-draft-v1'); } catch { /* Works in memory too. */ }
  }
  function chooseMethod(value: EvidenceMethod) {
    setMethod(value); setMedia(null); setMediaUrl(''); setMediaError('');
    respond(value + ' · ' + methodHelp[value], 'category');
  }
  function chooseCategory(value: ReportCategory) {
    setCategory(value);
    respond(value, 'description', value === 'Emergency'
      ? 'If anyone is in immediate danger, contact emergency services directly. This project does not dispatch help. You can still describe the incident here as a private draft.'
      : prompts.description);
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
    if (!file || method === 'Text') return;
    if (!ACCEPT[method].split(',').includes(file.type) || file.size > MAX_FILE[method] || file.size === 0) {
      setMedia(null); setMediaUrl('');
      setMediaError('Please select a supported ' + method.toLowerCase() + ' under ' + Math.round(MAX_FILE[method]/1_000_000) + ' MB.');
      return;
    }
    setMedia(file); setMediaUrl(URL.createObjectURL(file));
  }
  function nextEvidence(skip = false) {
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
    const snapshot = {
      purpose: feedback ? 'feedback' : 'report', method, category, description: description.trim(),
      lgaId, community: community.trim(), attachment: media ? 'Not stored: ' + media.name : 'None',
      followupRequested: contactMethod !== 'none', savedAt: new Date().toISOString(),
    };
    try {
      // Only this browser session. Raw media, phone and email are NEVER saved.
      sessionStorage.setItem('ekiti-guided-draft-v1', JSON.stringify(snapshot));
      setSavedNote('Saved in this browser session. Evidence and contact details were not stored.');
    } catch { setSavedNote('Saved only in this open tab. Browser storage is unavailable.'); }
    respond('Save private draft', 'saved');
  }
  const chosenArea = lgas.find(item => item.id === lgaId)?.name || 'Not selected';
  return <main className="page guided-report-page" id="main">
    <header className="chat-conversation-top">
      <span className="chat-avatar" aria-hidden="true">e</span>
      <div className="chat-contact">
        <h1>{feedback ? 'Share feedback' : 'Report an issue'}</h1>
        <p>Step-by-step chat · Private preview</p>
      </div>
      <button type="button" className="chat-clear" onClick={reset}>Start over</button>
    </header>

    <p className="guided-progress" aria-label="Reporting progress">
      {step === 'saved' ? 'Private draft saved' : 'Preparing your report · ' +
        Math.max(1, ['method','category','description','location','evidence','followup','contact','review'].indexOf(step)+1) + ' of 8'}
    </p>
    <div className="guided-thread" role="log" aria-label="Report conversation" aria-live="polite">
      {lines.map(line => <div key={line.id} className={'guided-bubble ' + (line.speaker === 'resident' ? 'guided-user' : 'guided-assistant')}>
        {line.speaker === 'assistant' && <span className="conversation-author">Ekiti Civic</span>}
        <p>{line.text}</p>
      </div>)}
      <div ref={threadEnd}/>
    </div>

    {step === 'method' && <section className="guided-choices" aria-label="Choose how to report">
      {(['Text','Photo','Video','Audio'] as EvidenceMethod[]).map(value =>
        <button type="button" key={value} onClick={()=>chooseMethod(value)} className="guided-choice">
          <strong>{value === 'Photo' ? 'Photo / camera' : value === 'Video' ? 'Video / record' : value === 'Audio' ? 'Audio note' : 'Write text'}</strong>
          <small>{methodHelp[value]}</small>
        </button>)}
      <p className="guided-hint">Media choices are for evidence, not voice commands. Nothing is recorded or uploaded automatically.</p>
    </section>}

    {step === 'category' && <section className="guided-choices guided-category-choices" aria-label="Choose report category">
      {categories.map(value => <button className="guided-choice" key={value} type="button"
        onClick={()=>chooseCategory(value)}>{value}</button>)}
    </section>}

    {step === 'description' && <form className="guided-input-form" onSubmit={event=>{event.preventDefault();nextDescription();}}>
      <label htmlFor="guided-description">Your report</label>
      <textarea id="guided-description" rows={4} maxLength={4000} value={description}
        onChange={event=>{setDescription(event.target.value);setValidation('');}}
        placeholder="Tell us what you saw, where and when. Avoid sharing someone's private information." />
      {validation && <p role="alert" className="guided-error">{validation}</p>}
      <button className="primary-action" type="submit">Continue</button>
    </form>}

    {step === 'location' && <form className="guided-input-form" onSubmit={event=>{event.preventDefault();nextLocation();}}>
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

    {step === 'evidence' && <section className="guided-input-form" aria-label="Attach optional evidence">
      {method === 'Text' ? <p>Text-only report selected. You can proceed without media.</p> : <>
        <p>{methodHelp[method]} Choose to capture new evidence or select a saved file.</p>
        <div className="guided-evidence-buttons">
          <label className="guided-file-label">Capture {method.toLowerCase()}
            <input aria-label={'Capture ' + method.toLowerCase()} type="file"
              accept={ACCEPT[method]} capture={method === 'Audio' ? 'user' : 'environment'}
              onChange={event=>{selectMedia(event.target.files?.[0]);event.target.value='';}}/>
          </label>
          <label className="guided-file-label">Choose existing file
            <input aria-label="Choose existing evidence" type="file"
              accept={ACCEPT[method]}
              onChange={event=>{selectMedia(event.target.files?.[0]);event.target.value='';}}/>
          </label>
        </div>
        {media && <div className="guided-evidence-preview">
          <p>{media.name} · {(media.size/1_000_000).toFixed(1)} MB · Stored only in memory</p>
          {method === 'Photo' && mediaUrl && <img src={mediaUrl} alt="Local evidence preview"/>}
          {method === 'Video' && mediaUrl && <video controls src={mediaUrl} aria-label="Video evidence preview"/>}
          {method === 'Audio' && mediaUrl && <audio controls src={mediaUrl} aria-label="Audio evidence preview"/>}
        </div>}
        {mediaError && <p className="guided-error" role="alert">{mediaError}</p>}
        <p className="guided-hint">Original media might reveal faces, addresses or metadata. It is never uploaded or published in this preview.</p>
      </>}
      <button type="button" className="primary-action" onClick={()=>nextEvidence()}>{method === 'Text' ? 'Continue' : 'Continue with evidence'}</button>
      {method !== 'Text' && <button type="button" className="text-link" onClick={()=>nextEvidence(true)}>Continue without attachment</button>}
    </section>}

    {step === 'followup' && <section className="guided-choices" aria-label="Choose tracking contact">
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

    {step === 'contact' && <form className="guided-input-form" onSubmit={event=>{event.preventDefault();nextContact();}}>
      <label htmlFor="guided-contact">{contactMethod === 'email' ? 'Email address' : 'Phone number (include country code)'}</label>
      <input id="guided-contact" type={contactMethod === 'email' ? 'email' : 'tel'} maxLength={160}
        autoComplete={contactMethod === 'email' ? 'email' : 'tel'} value={contact}
        onChange={event=>{setContact(event.target.value);setValidation('');}}
        placeholder={contactMethod === 'email' ? 'you@example.com' : '+234…'}/>
      <p className="guided-hint">Not submitted, saved or used to send anything. A receipt link will only be issued by a future verified intake service.</p>
      {validation && <p className="guided-error" role="alert">{validation}</p>}
      <button type="submit" className="primary-action">Continue</button>
    </form>}

    {step === 'review' && <section className="guided-review" aria-label="Review private report">
      <h2>Review your private draft</h2>
      <dl className="review-list">
        <dt>Purpose</dt><dd>{feedback ? 'Feedback' : 'Report'}</dd>
        <dt>Category</dt><dd>{category}</dd>
        <dt>Method</dt><dd>{method}</dd>
        <dt>Description</dt><dd>{description.trim()}</dd>
        <dt>Location</dt><dd>{chosenArea}{community ? ' · ' + community : ''}</dd>
        <dt>Evidence</dt><dd>{media ? media.name + ' (not uploaded)' : 'No file attached'}</dd>
        <dt>Follow-up</dt><dd>{contactMethod === 'none' ? 'None requested' : contactMethod.toUpperCase() + ' · delivery not active'}</dd>
      </dl>
      <p className="privacy-notice">This is not a submission. No real report ID, phone/email receipt, official assignment or public map marker can be issued until secure intake and moderation are enabled.</p>
      <button className="primary-action" type="button" onClick={save}>Save private draft on this device</button>
      <button type="button" className="quiet-action" onClick={()=>setStep('category')}>Change category</button>
    </section>}

    {step === 'saved' && <section className="guided-review" role="status">
      <h2>Draft saved locally</h2>
      <p>{savedNote}</p>
      <p className="privacy-notice">No report has been submitted. There is no tracking ID or email/SMS receipt, and nothing has been placed on the public map.</p>
      <Link to="/track" className="text-link">How tracking will work</Link>
      <button className="quiet-action" type="button" onClick={reset}>Start another report</button>
    </section>}

    <p className="guided-independent-note">Independent civic project · Not a government emergency service. Report evidence and contact details stay in this tab until secure intake is approved.</p>
  </main>;
}
