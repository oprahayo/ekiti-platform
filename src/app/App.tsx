import * as React from 'react';
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation, useNavigate, useParams } from 'react-router';
import { categories, demoMetrics, demoPlaces, lgas } from './fixtures.ts';
import { Home, Ask } from './AskExperience.tsx';
import { AppProvider, speechSupported, useApp } from './state.tsx';

const Report = React.lazy(() => import('./Report.tsx'));
const Track = React.lazy(() => import('./TrackConversation.tsx'));
const VoiceOverlay = React.lazy(() => import('./VoiceOverlay.tsx'));
const MapLocation = React.lazy(() => import('./MapLocation.tsx'));

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

function HeaderControls() {
  const { dark, toggleTheme, language, setLanguage } = useApp();
  return <div className="header-controls">
    <div className="header-languages" role="group" aria-label="Answer language">
      <button type="button" onClick={() => setLanguage('en')}
        aria-pressed={language === 'en'} lang="en">EN</button>
      <span aria-hidden="true">/</span>
      <button type="button" onClick={() => setLanguage('yo')}
        aria-pressed={language === 'yo'} lang="yo">YOR</button>
    </div>
    <button type="button" className="icon-control theme-switch" onClick={toggleTheme}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}>
      {dark ? <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
        <circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.5 1.5m11.2 11.2 1.5 1.5M4.9 19.1l1.5-1.5M17.6 6.4l1.5-1.5"/>
      </svg> : <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
        <path d="M20.2 15.2A8.6 8.6 0 0 1 8.8 3.8 8.5 8.5 0 1 0 20.2 15.2Z"/>
      </svg>}
    </button>
  </div>;
}

function Explore() {
  const { exploreCategory, setExploreCategory, exploreQuery, setExploreQuery, exploreLga, setExploreLga, setAskDraft } = useApp();
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
      <div className="directory-filters" role="group" aria-label="Filter category">
        {categories.map(category => <button type="button" className="directory-filter" aria-pressed={exploreCategory === category} key={category} onClick={() => setExploreCategory(category)}>{category}</button>)}
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
      <p className="directory-footer">Looking for a place not shown here?</p>
      <Link to="/ask?focus=1" className="text-link" onClick={() => setAskDraft('Find a business in Ekiti')}>Ask Ekiti Civic to help</Link>
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
    <p className="warning-note">Do not use this demo listing to find real services or contact a business. Directions, contact details and owner claims require a verified location and moderation.</p>
    <Link to="/explore" className="text-link">Explore more examples</Link>
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
      end={item.to === '/'} onPointerDown={() => { if (typeof navigator.vibrate === 'function' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) navigator.vibrate(8); }} className={({ isActive }) =>
        'nav-item ' + (item.label === 'Report' ? 'nav-report ' : '') + (isActive ? 'active' : '')
      }>
      <span className="nav-icon"><Icon name={item.icon} /></span>
      <span className="nav-text">{item.label}</span>
      <span className="nav-active-dot" aria-hidden="true" />
    </NavLink>)}
  </nav>;
}

function Shell() {
  const { voiceOpen, closeVoice, setAskDraft, setReportSpeech, setTrackSpeech, language } = useApp();
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
    if (location.pathname === '/report') {
      document.getElementById('report-message')?.focus();
    } else if (location.pathname.startsWith('/track')) {
      document.getElementById('tracking-message')?.focus();
    } else {
      navigate('/ask?focus=1');
    }
  };
  const applyTranscript = (transcript: string) => {
    closeVoice();
    if (location.pathname === '/report') {
      setReportSpeech(transcript);
    } else if (location.pathname.startsWith('/track')) {
      setTrackSpeech(transcript);
    } else {
      setAskDraft(transcript);
      navigate('/ask?focus=1');
    }
  };
  return <div className="app-shell">
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="app-header">
      <Link className="wordmark" to="/" aria-label="Ekiti Civic home">ekit<span className="brand-i">i</span><small>civic</small></Link>
      <HeaderControls />
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
    {voiceOpen && hasSpeech && <React.Suspense fallback={null}><VoiceOverlay language={language} onClose={closeVoice} onType={closeVoiceToText} onTranscript={applyTranscript} /></React.Suspense>}
  </div>;
}

export default function App() {
  return <BrowserRouter><AppProvider><Shell /></AppProvider></BrowserRouter>;
}
