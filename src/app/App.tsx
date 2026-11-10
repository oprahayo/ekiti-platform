import * as React from 'react';
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation, useNavigate, useParams } from 'react-router';
import { categories, demoAnswer, demoMetrics, demoPlaces, demoTimeline, lgas } from './fixtures.ts';
import { AppProvider, speechSupported, useApp } from './state.tsx';

const Report = React.lazy(() => import('./Report.tsx'));
const VoiceOverlay = React.lazy(() => import('./VoiceOverlay.tsx'));
const MapLocation = React.lazy(() => import('./MapLocation.tsx'));
const DEMO_REF = 'DEMO-EKP-2026-00001';
const DEMO_TOKEN = 'DEMO-ONLY-NOT-VALID';

type Message = { id: number; question: string; response: ReturnType<typeof demoAnswer> };
let inMemoryMessages: Message[] = [];

function Icon({ name }: { name: 'home' | 'explore' | 'report' | 'track' | 'scores' | 'mic' | 'settings' | 'search' }) {
  const shapes: Record<typeof name, React.ReactNode> = {
    home: <><path d="m3 10 9-7 9 7v10H3z" /><path d="M9 20v-7h6v7" /></>,
    explore: <><circle cx="12" cy="12" r="9" /><path d="m15 9-2 5-4 1 2-5z" /></>,
    report: <><path d="M12 3 2.7 20h18.6L12 3Z" /><path d="M12 9v5m0 3v.2" /></>,
    track: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h4" /></>,
    scores: <><path d="M4 20V12m5 8V7m5 13V4m5 16V10" /></>,
    mic: <><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 17v5m-4 0h8" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m16 16 5 5" /></>,
  };
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{shapes[name]}</svg>;
}

function Settings() {
  const { dark, toggleTheme } = useApp();
  const [open, setOpen] = React.useState(false);
  return (
    <div className="settings-wrap">
      <button type="button" className="icon-control" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-label="Settings">
        <Icon name="settings" />
      </button>
      {open && <div className="settings-panel" role="group" aria-label="Display settings">
        <p>Display</p>
        <button type="button" onClick={toggleTheme}>{dark ? 'Use light mode' : 'Use dark mode'}</button>
        <span>Low-data mode is always on.</span>
      </div>}
    </div>
  );
}

function AskBar({ home = false }: { home?: boolean }) {
  const navigate = useNavigate();
  const { askDraft, setAskDraft, openVoice } = useApp();
  const [hasSpeech, setHasSpeech] = React.useState(false);
  React.useEffect(() => setHasSpeech(speechSupported()), []);
  const focusAsk = () => { if (home) navigate('/ask?focus=1'); };
  return (
    <div className={'ask-bar ' + (home ? 'ask-home' : '')} role="search">
      <Icon name="search" />
      <input id={home ? 'home-ask-input' : 'ask-input'} type="search" aria-label="Ask about Ekiti"
        placeholder="Ask about Ekiti…" readOnly={home}
        value={home ? '' : askDraft}
        onFocus={focusAsk}
        onChange={event => setAskDraft(event.target.value)}
        onKeyDown={event => { if (event.key === 'Enter' && home) focusAsk(); }} />
      {hasSpeech && <button className="icon-control mic-trigger" aria-label="Open voice mode" type="button" onClick={openVoice}><Icon name="mic" /></button>}
    </div>
  );
}

function Home() {
  return (
    <main className="home-page page" id="main">
      <h1>Welcome to Ekiti</h1>
      <div className="home-actions">
        <AskBar home />
        <Link to="/report" className="home-row">
          <span className="row-icon icon-danger"><Icon name="report" /></span>
          <span><strong>Report a problem</strong><small>Start a private draft</small></span>
          <span aria-hidden="true" className="row-arrow">→</span>
        </Link>
        <Link to="/explore" className="home-row">
          <span className="row-icon"><Icon name="explore" /></span>
          <span><strong>Explore Ekiti</strong><small>Find places and local areas</small></span>
          <span aria-hidden="true" className="row-arrow">→</span>
        </Link>
      </div>
      <p className="independence">Independent civic project · Not a government service</p>
    </main>
  );
}

function Ask() {
  const navigate = useNavigate();
  const location = useLocation();
  const { askDraft, setAskDraft } = useApp();
  const [messages, setMessages] = React.useState<Message[]>(() => inMemoryMessages);
  const input = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (new URLSearchParams(location.search).has('focus')) input.current?.focus();
  }, [location.search]);
  const submit = (question = askDraft) => {
    const clean = question.trim().slice(0, 350);
    if (!clean) return;
    const next = [...inMemoryMessages, { id: Date.now(), question: clean, response: demoAnswer(clean) }];
    inMemoryMessages = next;
    setMessages(next);
    setAskDraft('');
    navigate('/ask', { replace: true });
  };
  return (
    <main className="page ask-page" id="main">
      <header className="page-heading">
        <p className="eyebrow">Ask</p>
        <h1>What would you like to know?</h1>
        <p className="help-text">Answers are demo responses until verified source retrieval is connected.</p>
      </header>
      {messages.length === 0 && <section aria-label="Example questions">
        <p className="metadata">Try a question</p>
        <div className="choice-row">
          {['How many LGAs?', 'Where are clinics?', 'Find hotels in Ikogosi'].map(question => (
            <button className="chip" key={question} type="button" onClick={() => submit(question)}>{question}</button>
          ))}
        </div>
      </section>}
      <div className="chat-thread" aria-live="polite">
        {messages.map(message => <div className="chat-exchange" key={message.id}>
          <p className="chat-question">{message.question}</p>
          <div className="chat-answer">
            <p>{message.response.text}</p>
            <span className="source-line">Source: {message.response.source}</span>
            <span className="source-line">Updated: demo fixture · 10 Nov 2026</span>
            <span className="source-line">{message.response.confidence}</span>
            <p className="help-text">This is a preview, not a live AI answer.</p>
          </div>
        </div>)}
      </div>
      {messages.length > 0 && <div className="chat-related">
        <Link to="/explore">Explore areas</Link>
        <Link to="/report">Write a report draft</Link>
      </div>}
      <div className="ask-composer">
        <div className="ask-input-row">
          <AskBar />
          <input type="text" className="visually-hidden" ref={input} aria-hidden="true" tabIndex={-1} />
          <button className="send-button" type="button" onClick={() => submit()} disabled={!askDraft.trim()}>Send</button>
        </div>
      </div>
    </main>
  );
}

function Explore() {
  const { exploreCategory, setExploreCategory, exploreQuery, setExploreQuery, exploreLga, setExploreLga } = useApp();
  const [mapOpen, setMapOpen] = React.useState(false);
  const filtered = demoPlaces.filter(place => (
    (exploreCategory === 'All' || place.category === exploreCategory) &&
    (!exploreLga || place.lgaId === exploreLga) &&
    (place.name.toLowerCase().includes(exploreQuery.toLowerCase()) || place.description.toLowerCase().includes(exploreQuery.toLowerCase()))
  ));
  return (
    <main className="page explore-page" id="main">
      <header className="page-heading">
        <p className="eyebrow">Explore</p>
        <h1>Explore Ekiti</h1>
        <p className="help-text">Sample listings only. No place below is verified or accepting claims yet.</p>
      </header>
      <label htmlFor="place-search" className="visually-hidden">Search places</label>
      <input id="place-search" type="search" placeholder="Search places" value={exploreQuery} onChange={event => setExploreQuery(event.target.value)} />
      <div className="choice-row category-row" role="group" aria-label="Filter category">
        {categories.map(category => <button type="button" className="chip" aria-pressed={exploreCategory === category} key={category} onClick={() => setExploreCategory(category)}>{category}</button>)}
      </div>
      <label htmlFor="explore-lga" className="select-label">Local government area</label>
      <select id="explore-lga" value={exploreLga} onChange={event => setExploreLga(event.target.value)}>
        <option value="">All LGAs</option>
        {lgas.map(area => <option key={area.id} value={area.id}>{area.name}</option>)}
      </select>
      <div className="section-meta"><span>{filtered.length} sample listings</span><span>Demo · not verified</span></div>
      {filtered.length ? <ul className="plain-list">
        {filtered.map((place) => {
          const area = lgas.find(lga => lga.id === place.lgaId)?.name || 'Ekiti';
          const colors = { Health: 1, Schools: 2, Offices: 3, Hotels: 4 };
          return <li key={place.id}>
            <Link className="place-row" to={'/places/' + place.id}>
              <span className={'category-dot dot-' + colors[place.category]} aria-hidden="true" />
              <span><strong>{place.name}</strong><small>{place.category} · {area} · Distance unavailable</small></span>
              <span aria-hidden="true">›</span>
            </Link>
          </li>;
        })}
      </ul> : <div className="empty-state" role="status">
        <h2>Nothing verified here yet</h2>
        <p>No example listings match this selection. The future directory will be moderated.</p>
        <button className="text-link" type="button" onClick={() => { setExploreQuery(''); setExploreCategory('All'); setExploreLga(''); }}>Clear filters</button>
      </div>}
      <button type="button" className="quiet-action map-toggle" onClick={() => setMapOpen(value => !value)}>
        {mapOpen ? 'Hide map' : 'Map · more data'}
      </button>
      {mapOpen && <React.Suspense fallback={<p role="status">Loading boundaries only now…</p>}>
        <MapLocation onPoint={() => { /* Demo places have no verified geocoded points. */ }} />
        <p className="note">The map shows verified LGA boundaries. Illustrative places are not geocoded or pinned.</p>
      </React.Suspense>}
      <p className="directory-footer">Own a business? Claim or submit a listing.</p>
      <p className="note">Moderated listing submissions are not available in this demo.</p>
    </main>
  );
}

function PlaceDetails() {
  const { id } = useParams();
  const place = demoPlaces.find(item => item.id === id);
  if (!place) return <main className="page"><h1>Listing not found</h1><Link to="/explore">Back to Explore</Link></main>;
  return <main className="page detail-page">
    <Link to="/explore" className="back-link">← Explore</Link>
    <p className="eyebrow">Illustrative listing · not verified</p>
    <h1>{place.name}</h1>
    <dl className="detail-list">
      <dt>Category</dt><dd>{place.category}</dd>
      <dt>Local government</dt><dd>{lgas.find(item => item.id === place.lgaId)?.name}</dd>
      <dt>About</dt><dd>{place.description}</dd>
    </dl>
    <p className="warning-note">Do not use this demo listing to find real services or contact a business.</p>
    <Link to="/explore" className="text-link">Explore more examples</Link>
  </main>;
}

function Track() {
  const { publicId } = useParams();
  const [token, setToken] = React.useState('');
  const [visible, setVisible] = React.useState(false);
  const [error, setError] = React.useState('');
  const [escalation, setEscalation] = React.useState(false);
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (publicId === DEMO_REF && token === DEMO_TOKEN) {
      setVisible(true); setError('');
    } else {
      setVisible(false);
      setError('No live case lookup is available. The demonstration accepts only the example reference and token.');
    }
  };
  return <main className="page track-page" id="main">
    <header className="page-heading"><p className="eyebrow">Track</p><h1>Follow a report</h1><p className="help-text">No real submissions or tracking are connected yet.</p></header>
    <form onSubmit={submit} className="track-form">
      <label htmlFor="case-reference">Case reference</label>
      <input id="case-reference" readOnly value={publicId || ''} placeholder="Open a sample case below" />
      <label htmlFor="tracking-token">Private tracking token</label>
      <input id="tracking-token" type="password" autoComplete="off" value={token} onChange={event => setToken(event.target.value)} placeholder="Token is never placed in a URL" />
      <button className="primary-action" type="submit">Check status</button>
    </form>
    {error && <p role="alert" className="form-error">{error}</p>}
    {!publicId && <div className="sample-entry">
      <p>See what a properly evidenced timeline could look like.</p>
      <Link to={'/track/' + DEMO_REF}>Open demo case</Link>
      <p className="metadata">Demo token: {DEMO_TOKEN}</p>
    </div>}
    {publicId === DEMO_REF && !visible && <p className="note">Use the example token <code>{DEMO_TOKEN}</code> to inspect the fictional timeline. Nothing is stored.</p>}
    {visible && <section className="track-result">
      <div className="status-note"><strong>Demo case only</strong><span>No real report or official communication exists.</span></div>
      <p className="metadata">Case: {publicId}</p>
      <p className="status-legend">● Recorded in demo &nbsp; ◐ Claimed/unverified &nbsp; ○ Waiting</p>
      <ol className="case-timeline">
        {demoTimeline.map((event, index) => <li key={index} className={'event-' + event.state}>
          <h2>{event.title}</h2>
          <p>{event.detail}</p>
          <small>Evidence: {event.evidence}</small>
        </li>)}
      </ol>
      <div className="escalation">
        <p className="body-emphasis">Example overdue threshold · 14 days without acknowledgment</p>
        <button type="button" className="quiet-action" onClick={() => setEscalation(true)} disabled={escalation}>Preview escalation</button>
        {escalation && <p role="status">Demo only — no escalation request was sent.</p>}
      </div>
      <p className="disabled-row" aria-disabled="true">Download signed receipt — unavailable in demo</p>
    </section>}
  </main>;
}

function Scores() {
  const [lgaId, setLgaId] = React.useState('');
  const [openData, setOpenData] = React.useState(false);
  return <main className="page scores-page" id="main">
    <header className="page-heading"><p className="eyebrow">Scores</p><h1>Public response</h1><p className="help-text">Illustrative metrics only. No report analytics are connected.</p></header>
    <label htmlFor="scores-lga" className="visually-hidden">Scores for LGA</label>
    <select id="scores-lga" value={lgaId} onChange={event => setLgaId(event.target.value)}>
      <option value="">All Ekiti · demo</option>
      {lgas.map(area => <option key={area.id} value={area.id}>{area.name}</option>)}
    </select>
    <div className="metrics">
      {demoMetrics.map((metric, i) => <div className={'metric ' + (metric.negative ? 'metric-negative' : '')} key={metric.label}>
        <div className="metric-head"><span>{metric.label}</span><strong>{metric.value}{metric.unit}</strong></div>
        {metric.percent !== null && <div className="metric-track" aria-hidden="true">
          <span className={'metric-fill chart-' + ((i % 5) + 1)} style={{ '--metric-value': metric.percent + '%' } as React.CSSProperties} />
        </div>}
      </div>)}
    </div>
    <p className="note">Example denominator: 120 fictional reports. Percentages are synthetic and must not be cited as Ekiti government performance.</p>
    <button type="button" className="quiet-row" onClick={() => setOpenData(value => !value)} aria-expanded={openData}>Open data & API <span aria-hidden="true">›</span></button>
    {openData && <p className="note" role="status">Public data and an API have not launched. Published metrics will require verified source records and denominators.</p>}
  </main>;
}

function BottomNav() {
  const navItems = [
    { to: '/', label: 'Home', icon: 'home' },
    { to: '/explore', label: 'Explore', icon: 'explore' },
    { to: '/report', label: 'Report', icon: 'report' },
    { to: '/track', label: 'Track', icon: 'track' },
    { to: '/scores', label: 'Scores', icon: 'scores' },
  ] as const;
  return <nav className="bottom-nav" aria-label="Primary navigation">
    {navItems.map(item => <NavLink key={item.label} to={item.to}
      end={item.to === '/'} className={({ isActive }) =>
        'nav-item ' + (item.label === 'Report' ? 'nav-report ' : '') + (isActive ? 'active' : '')
      }>
      <span className="nav-icon"><Icon name={item.icon} /></span>
      <span className="nav-text">{item.label}</span>
      <span className="nav-active-dot" aria-hidden="true" />
    </NavLink>)}
  </nav>;
}

function Shell() {
  const { voiceOpen, closeVoice, setAskDraft } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [hasSpeech, setHasSpeech] = React.useState(false);
  React.useEffect(() => setHasSpeech(speechSupported()), []);
  const scrollByRoute = React.useRef<Map<string, number>>(new Map());
  const previousRoute = React.useRef(location.pathname);
  React.useLayoutEffect(() => {
    if (previousRoute.current !== location.pathname) {
      scrollByRoute.current.set(previousRoute.current, window.scrollY);
      window.scrollTo(0, scrollByRoute.current.get(location.pathname) ?? 0);
      previousRoute.current = location.pathname;
    }
  }, [location.pathname]);
  const closeVoiceToText = () => {
    closeVoice();
    navigate('/ask?focus=1');
  };
  const applyTranscript = (transcript: string) => {
    setAskDraft(transcript);
    closeVoice();
    navigate('/ask?focus=1');
  };
  return <div className="app-shell">
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="app-header">
      <Link className="wordmark" to="/" aria-label="Ekiti Civic home">ekiti<span>.</span><small>civic</small></Link>
      <Settings />
    </header>
    <div className="screen">
      <React.Suspense fallback={<p className="page" role="status">Loading screen…</p>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/ask" element={<Ask />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/report" element={<Report />} />
          <Route path="/track" element={<Track />} />
          <Route path="/track/:publicId" element={<Track />} />
          <Route path="/scores" element={<Scores />} />
          <Route path="/places/:id" element={<PlaceDetails />} />
          <Route path="*" element={<main className="page"><h1>Page not found</h1><Link to="/">Return home</Link></main>} />
        </Routes>
      </React.Suspense>
    </div>
    <BottomNav />
    {voiceOpen && hasSpeech && <React.Suspense fallback={null}><VoiceOverlay onClose={closeVoiceToText} onTranscript={applyTranscript} /></React.Suspense>}
  </div>;
}

export default function App() {
  return <BrowserRouter><AppProvider><Shell /></AppProvider></BrowserRouter>;
}
