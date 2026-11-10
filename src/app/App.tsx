import * as React from 'react';
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation } from 'react-router';
import { demoMetrics, lgas } from './fixtures.ts';
import { Ask } from './AskExperience.tsx';
import WelcomeHome from './WelcomeHome.tsx';
import { AppProvider, useApp } from './state.tsx';
import { CitizenAuthProvider } from './CitizenAuth.tsx';

const Report = React.lazy(() => import('./ReportJourney.tsx'));
const LegacyReport = React.lazy(() => import('./Report.tsx'));
const Drafts = React.lazy(() => import('./ContributionDrafts.tsx'));
const Track = React.lazy(() => import('./TrackConversation.tsx'));
const Explore = React.lazy(() => import('./ExploreDirectory.tsx'));
const PlaceDetails = React.lazy(() => import('./PlaceDetails.tsx'));
const CitizenProfile = React.lazy(() => import('./CitizenProfile.tsx'));

function Icon({ name }: { name: 'home' | 'explore' | 'report' | 'track' | 'scores' | 'profile' | 'settings' | 'search' }) {
  const shapes: Record<typeof name, React.ReactNode> = {
    home: <><path d="m3 10 9-7 9 7v10H3z" /><path d="M9 20v-7h6v7" /></>,
    explore: <><circle cx="12" cy="12" r="9" /><path d="m15 9-2 5-4 1 2-5z" /></>,
    report: <><path d="M12 3 2.7 20h18.6L12 3Z" /><path d="M12 9v5m0 3v.2" /></>,
    track: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h4" /></>,
    scores: <><path d="M4 20V12m5 8V7m5 13V4m5 16V10" /></>,
    profile: <><circle cx="12" cy="8" r="4"/><path d="M4.5 21c0-5 3-8 7.5-8s7.5 3 7.5 8"/></>,
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
    { to: '/profile', label: 'Profile', icon: 'profile' },
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
  const location = useLocation();
  const isChat = ['/', '/ask', '/report', '/track'].includes(location.pathname) ||
    location.pathname.startsWith('/track/');
  const scrollByRoute = React.useRef<Map<string, number>>(new Map());
  const previousRoute = React.useRef(location.pathname);
  React.useLayoutEffect(() => {
    if (previousRoute.current !== location.pathname) {
      scrollByRoute.current.set(previousRoute.current, window.scrollY);
      window.scrollTo(0, scrollByRoute.current.get(location.pathname) ?? 0);
      previousRoute.current = location.pathname;
    }
  }, [location.pathname]);
  return <div className="app-shell">
    <a className="skip-link" href="#main">Skip to content</a>
    <header className={'app-header ' + (isChat ? 'chat-app-header' : '')}>
      <Link className="wordmark" to="/" aria-label="Ekiti Civic home">ekit<span className="brand-i">i</span><small>civic</small></Link>
      <HeaderControls />
      <Link to="/profile" className="header-profile-link" aria-label="Citizen profile"><Icon name="profile" /></Link>
    </header>
    <div className="screen">
      <React.Suspense fallback={<p className="page" role="status">Loading screen…</p>}>
        <Routes>
          <Route path="/" element={<WelcomeHome />} />
          <Route path="/ask" element={<Ask />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/report" element={<Report />} />
          <Route path="/report/text-draft" element={<LegacyReport />} />
          <Route path="/post" element={<Drafts.CommunityPostDraft />} />
          <Route path="/listings/new" element={<Drafts.default />} />
          <Route path="/track" element={<Track />} />
          <Route path="/track/:publicId" element={<Track />} />
          <Route path="/scores" element={<Scores />} />
          <Route path="/profile" element={<CitizenProfile />} />
          <Route path="/places/:id" element={<PlaceDetails />} />
          <Route path="*" element={<main className="page"><h1>Page not found</h1><Link to="/">Return home</Link></main>} />
        </Routes>
      </React.Suspense>
    </div>
    <BottomNav />
  </div>;
}

export default function App() {
  return <BrowserRouter><CitizenAuthProvider><AppProvider><Shell /></AppProvider></CitizenAuthProvider></BrowserRouter>;
}
