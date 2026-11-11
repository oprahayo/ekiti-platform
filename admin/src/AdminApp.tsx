import * as React from 'react';
import {
  QUEUES, QUEUE_LABELS, agencyEvidence, applyDemoAction, availableActions,
  caseQueue, filterCases, formatDate, queueCounts, InvalidCaseAction,
  type Action, type AdminCase, type Queue,
} from './case-model.ts';
import { makeDemoCases } from './demo-cases.ts';
import { ModerationWorkspace, RoutingWorkspace } from './OperationsModules.tsx';
import { OpsAlerts, deriveDemoAlerts } from './OpsAlerts.tsx';
const EkitiOpsMap=React.lazy(()=>import('./EkitiOpsMap.tsx'));
import { adminViewUrl, isCaseView, readAdminView, type AdminView } from './navigation.ts';
import './admin-refinement.css';

type View = AdminView;

const ACTION_LABELS: Record<Action, string> = {
  assign: 'Assign to me',
  await: 'Awaiting information',
  escalate: 'Escalate internally',
  resolve: 'Mark platform resolved',
  reopen: 'Reopen case',
  note: 'Add internal note',
};
const EVENT_LABELS: Record<string, string> = {
  received: 'Received by demo platform',
  assigned: 'Assigned internally',
  awaiting_response: 'Awaiting information',
  escalated: 'Escalated internally',
  resolved: 'Platform case closed',
  reopened: 'Case reopened',
  internal_note: 'Internal note added',
};

function Dot({ priority }: { priority: 'normal' | 'high' }) {
  return <span className={'priority-dot ' + priority} aria-label={priority + ' priority'} />;
}

function NavigationIcon({ name }: { name: 'cases' | 'moderation' | 'routing' | 'analytics' }) {
  const shapes: Record<typeof name, React.ReactNode> = {
    cases: <><rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 9h8M8 13h8M8 17h5" /></>,
    moderation: <><path d="M12 3 20 7v5c0 5-3 8-8 10-5-2-8-5-8-10V7l8-4Z" />
      <path d="m9 12 2 2 4-4" /></>,
    routing: <><circle cx="6" cy="6" r="2"/><circle cx="18" cy="18" r="2" />
      <path d="M6 8v6c0 2 2 4 4 4h6M12 4h6v8m0-8-4 4" /></>,
    analytics: <><path d="M4 20V11M9 20V6M14 20V14M19 20V3" /></>,
  };
  return <svg viewBox="0 0 24 24" width="21" height="21" fill="none"
    stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">{shapes[name]}</svg>;
}

function Sidebar({ view, onViewChange, counts }: {
  view: View;
  onViewChange: (view: View) => void;
  counts: Record<Queue, number>;
}) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const items = [
    { key: 'all', icon: 'cases', label: 'Cases', count: total },
    { key: 'moderation', icon: 'moderation', label: 'Moderation' },
    { key: 'routing', icon: 'routing', label: 'Routing' },
    { key: 'analytics', icon: 'analytics', label: 'Overview' },
  ] as const;
  return <aside className="sidebar">
    <div className="brand">
      <span className="brand-mark">e<span>•</span></span>
      <div><strong>Ekiti Civic</strong><small>Operations workspace</small></div>
    </div>
    <div className="sidebar-section-label">WORKSPACE</div>
    <nav className="main-nav" aria-label="Primary admin navigation">
      {items.map(item => {
        const active = item.key === 'all' ? isCaseView(view) : view === item.key;
        return <button type="button" key={item.key}
          className={'nav-link ' + (active ? 'active' : '')}
          onClick={() => onViewChange(item.key)} aria-current={active ? 'page' : undefined}>
          <span className="nav-glyph"><NavigationIcon name={item.icon} /></span>
          <span className="nav-label">{item.label}</span>
          {'count' in item && <span className="nav-count">{item.count}</span>}
        </button>;
      })}
    </nav>
    <div className="sidebar-bottom">
      <span className="workspace-indicator" aria-hidden="true" />
      <div><strong>Demo environment</strong><small>No production connection</small></div>
    </div>
  </aside>;
}

function CaseList({
  view, cases, query, onQuery, onQueueChange, counts, selectedId, onSelect,
}: {
  view: Queue | 'all';
  cases: AdminCase[];
  onQueueChange: (next: Queue | 'all') => void;
  counts: Record<Queue, number>;
  query: string;
  onQuery: (query: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return <section className="case-panel" aria-label="Case list">
    <div className="list-heading">
      <div><p className="eyebrow">CASE MANAGEMENT</p>
        <h1>Cases</h1>
        <p className="subdued">{cases.length} sample {cases.length === 1 ? 'case' : 'cases'}</p>
      </div>
    </div>
    <div className="case-queue-picker">
      <label htmlFor="case-queue-filter">Filter by status</label>
      <select id="case-queue-filter" value={view}
        onChange={event => onQueueChange(event.target.value as Queue | 'all')}
        aria-label="Filter cases by status">
        <option value="all">All statuses · {Object.values(counts).reduce((a, b) => a + b, 0)}</option>
        {QUEUES.map(queue => <option value={queue} key={queue}>
          {QUEUE_LABELS[queue]} · {counts[queue]}
        </option>)}
      </select>
    </div>
    <label className="search-box">
      <span aria-hidden="true">⌕</span>
      <span className="sr-only">Search cases by title, reference, category or LGA</span>
      <input type="search" placeholder="Search cases..." value={query}
        onChange={event => onQuery(event.target.value)} />
      {query && <button type="button" onClick={() => onQuery('')} aria-label="Clear search">×</button>}
    </label>
    <div className="list-meta"><span>RECENT ACTIVITY</span><span>NEWEST FIRST</span></div>
    <div className="case-scroll">
      {cases.length === 0 && <div className="empty-state">
        <strong>No matching cases</strong>
        <p>Try another queue or change your search.</p>
      </div>}
      {cases.map(item => <button type="button" key={item.id}
        className={'case-list-item ' + (selectedId === item.id ? 'selected' : '')}
        onClick={() => onSelect(item.id)} aria-pressed={selectedId === item.id}>
        <div className="case-row-top"><span className="case-id">{item.id}</span>
          <span className={'case-mini-status ' + caseQueue(item)}>{QUEUE_LABELS[caseQueue(item)]}</span></div>
        <div className="case-title-line"><h2>{item.title}</h2><Dot priority={item.priority} /></div>
        <p className="case-preview">{item.summary}</p>
        <div className="case-row-bottom"><span className="location-label">{item.lga} · {item.kind}</span>
          <time dateTime={item.events[item.events.length - 1]!.at}>
            {formatDate(item.events[item.events.length - 1]!.at).split(',')[0]}
          </time>
        </div>
      </button>)}
    </div>
  </section>;
}

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="info-item"><dt>{label}</dt><dd>{value}</dd></div>;
}

function CaseDetails({
  item, onBack, onApply,
}: {
  item: AdminCase | null;
  onBack: () => void;
  onApply: (id: string, action: Action, note: string) => void;
}) {
  const [action, setAction] = React.useState<Action | null>(null);
  const [note, setNote] = React.useState('');
  const [error, setError] = React.useState('');
  const [feedback, setFeedback] = React.useState('');
  React.useEffect(() => { setAction(null); setNote(''); setError(''); setFeedback(''); }, [item?.id]);
  if (!item) return <section className="detail-panel detail-empty" aria-label="Case details">
    <div><strong>Select a sample case</strong><p>Choose a record from the list to see its activity.</p></div>
  </section>;

  const queue = caseQueue(item);
  const evidence = agencyEvidence();
  const actions = availableActions(queue);
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!action) return;
    try {
      onApply(item.id, action, note);
      setAction(null); setNote(''); setError('');
      setFeedback('Demo action recorded in this browser session. No agency was contacted.');
    } catch (cause) {
      setError(cause instanceof InvalidCaseAction
        ? 'Enter a reason between 8 and 500 characters.'
        : 'This action is unavailable.');
    }
  };
  return <section className="detail-panel" aria-label={'Details for ' + item.id}>
    <div className="detail-topbar">
      <button className="back-button" type="button" onClick={onBack}>← Cases</button>
      <span className="detail-reference">{item.id}</span>
      <span className="label-demo">SAMPLE</span>
    </div>
    <div className="detail-scroll">
      <header className="detail-header">
        <div className="detail-badges">
          <span className={'status-pill ' + queue}>{QUEUE_LABELS[queue]}</span>
          <span className="kind-pill">{item.kind}</span>
          <span className="priority-label"><Dot priority={item.priority} /> {item.priority === 'high' ? 'High' : 'Normal'} priority</span>
        </div>
        <h2>{item.title}</h2>
        <p className="detail-description">{item.summary}</p>
      </header>
      <div className="detail-section">
        <div className="section-heading"><h3>Case information</h3><span>Read-only</span></div>
        <dl className="info-grid">
          <InfoItem label="Local government" value={item.lga} />
          <InfoItem label="Category" value={item.category} />
          <InfoItem label="Assigned to" value={item.assignee || 'Unassigned'} />
          <InfoItem label="Received" value={formatDate(item.receivedAt)} />
        </dl>
      </div>
      <div className="detail-section">
        <div className="section-heading"><h3>Agency verification</h3><span className="subtle-lock">Independent platform</span></div>
        <div className="verification-grid">
          <div><span className="verification-title">Agency delivery</span><strong>{evidence.label}</strong><small>No confirmed external receipt</small></div>
          <div><span className="verification-title">Agency viewed</span><strong>{evidence.label}</strong><small>No authenticated view event</small></div>
        </div>
        <p className="verification-note">Internal actions below do not imply government delivery, acknowledgement or emergency dispatch.</p>
      </div>
      <div className="detail-section">
        <div className="section-heading"><h3>Activity history</h3><span>{item.events.length} platform events</span></div>
        <ol className="timeline">
          {[...item.events].reverse().map(event => <li key={event.id}>
            <div className="timeline-icon" aria-hidden="true">•</div>
            <div className="timeline-body">
              <div className="timeline-title"><strong>{EVENT_LABELS[event.kind]}</strong>
                <time dateTime={event.at}>{formatDate(event.at)}</time></div>
              <p>{event.detail}</p>
              <small>{event.actor}</small>
            </div>
          </li>)}
        </ol>
      </div>
    </div>
    <div className="action-footer">
      <div className="action-caption"><strong>Platform actions</strong><span>In-memory demo only</span></div>
      {feedback && <p className="action-feedback" role="status">{feedback}</p>}
      <div className="action-buttons">
        {actions.map(value => <button key={value} type="button"
          className={'action-button ' + (value === 'resolve' ? 'action-primary ' : '') + (action === value ? 'chosen' : '')}
          aria-pressed={action === value} onClick={() => { setAction(action === value ? null : value); setError(''); }}>
          {ACTION_LABELS[value]}</button>)}
      </div>
      {action && <form className="action-form" onSubmit={submit}>
        <label htmlFor="action-note">{action === 'assign' ? 'Assignment' : 'Internal reason or note'}</label>
        {action === 'assign'
          ? <p>Assign this sample case to the demo moderator.</p>
          : <textarea id="action-note" value={note} onChange={event => setNote(event.target.value)}
              placeholder="Add an internal reason (minimum 8 characters)" required minLength={8} maxLength={500}
              rows={3} />}
        {error && <p role="alert" className="form-error">{error}</p>}
        <div className="form-actions">
          <button type="button" className="button-secondary" onClick={() => { setAction(null); setNote(''); }}>Cancel</button>
          <button type="submit" className="button-submit">Confirm demo action</button>
        </div>
      </form>}
    </div>
  </section>;
}

function Analytics({ cases, onNavigate, onOpenCase, onArea }: {
  cases: AdminCase[]; onNavigate: (next: View) => void;
  onOpenCase:(id:string)=>void;onArea:(area:string)=>void;
}) {
  const counts = queueCounts(cases);
  const total = cases.length;
  const kindCounts = ['Complaint', 'Issue', 'Commendation'].map(kind =>
    ({ kind, count: cases.filter(item => item.kind === kind).length }));
  return <main className="analytics">
    <div className="analytics-top"><p className="eyebrow">OPERATIONS / DEMO</p>
      <h1>Workspace overview</h1>
      <p>Numbers below refer only to fictional cases in this browser session. No government performance metrics are published.</p></div>
    <div className="ops-dashboard-grid">
      <OpsAlerts cases={cases} onOpenCase={onOpenCase}/>
      <React.Suspense fallback={<section className="ops-map-loading" role="status">Loading Ekiti boundaries…</section>}>
        <EkitiOpsMap cases={cases} onSelectArea={onArea}/>
      </React.Suspense>
    </div>
    <section className="attention-panel" aria-label="Next actions">
      <div className="attention-title"><h2>Next actions</h2><span>Sample work only</span></div>
      <div className="attention-actions">
        <button type="button" onClick={() => onNavigate('inbox')}>
          <strong>Review unassigned cases</strong><span>{counts.inbox} pending in sample inbox</span>
        </button>
        <button type="button" onClick={() => onNavigate('moderation')}>
          <strong>Moderate contributions</strong><span>Listings, reviews and ownership claims</span>
        </button>
        <button type="button" onClick={() => onNavigate('routing')}>
          <strong>Check office routing</strong><span>Review suggested jurisdiction manually</span>
        </button>
      </div>
    </section>
    <div className="analytics-metrics">
      <div><small>All cases</small><strong>{total}</strong><span>Simulated records</span></div>
      <div><small>Unassigned</small><strong>{counts.inbox}</strong><span>In platform inbox</span></div>
      <div><small>Escalations</small><strong>{counts.escalated}</strong><span>Internal, not external</span></div>
      <div><small>Platform resolved</small><strong>{counts.resolved}</strong><span>No agency outcome implied</span></div>
    </div>
    <div className="analytics-card"><h2>Case workflow</h2>
      {QUEUES.map(queue => <div className="chart-row" key={queue}>
        <span>{QUEUE_LABELS[queue]}</span><div className="chart-track"><div className={'chart-bar chart-' + queue}
          style={{ width: total ? ((counts[queue] / total) * 100) + '%' : '0%' }} /></div>
        <strong>{counts[queue]}</strong></div>)}
    </div>
    <div className="analytics-card"><h2>Report types</h2>
      <div className="type-grid">{kindCounts.map(item => <div key={item.kind}><strong>{item.count}</strong><span>{item.kind}</span></div>)}</div>
    </div>
  </main>;
}

export function AdminApp() {
  const [cases, setCases] = React.useState<AdminCase[]>(makeDemoCases);
  const [view, setView] = React.useState<View>(() => readAdminView(window.location.search));
  const [query, setQuery] = React.useState('');
  const [areaSearch,setAreaSearch]=React.useState('');
  const [selectedId, setSelectedId] = React.useState<string | null>('DEMO-1001');
  const [mobileDetail, setMobileDetail] = React.useState(false);
  const counts = React.useMemo(() => queueCounts(cases), [cases]);
  const shown = React.useMemo(() =>
    view === 'analytics' || view === 'moderation' || view === 'routing' ? [] :
      filterCases(cases, view, query||areaSearch),
    [cases, view, query, areaSearch]);
  const selected = shown.find(item => item.id === selectedId) ?? shown[0] ?? null;
  React.useEffect(() => {
    const onPopState = () => {
      setView(readAdminView(window.location.search));
      setSelectedId(null);
      setMobileDetail(false);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  const changeView = (next: View) => {
    if (next !== view) window.history.pushState(null, '', adminViewUrl(next, window.location.pathname));
    setView(next); setSelectedId(null); setMobileDetail(false);
    setAreaSearch('');
  };
  const openArea=(area:string)=>{
    setQuery(area);setAreaSearch('');
    changeView('all');
    setQuery(area);
  };
  const openAttentionCase=(id:string)=>{
    changeView('all');setQuery('');setAreaSearch('');
    setSelectedId(id);setMobileDetail(true);
  };
  const apply = (id: string, action: Action, note: string) => {
    const current = cases.find(item => item.id === id);
    if (!current) throw new InvalidCaseAction();
    const updated = applyDemoAction(current, action, note, new Date().toISOString());
    setCases(previous => previous.map(item => item.id === id ? updated : item));
    // Stay on the case even when it moves to another queue.
    if (isCaseView(view) && view !== 'all' && caseQueue(updated) !== view) {
      setView('all');
      window.history.replaceState(null, '', adminViewUrl('all', window.location.pathname));
    }
    setSelectedId(id);
  };
  const reset = () => {
    setCases(makeDemoCases()); setView('all'); setQuery('');setAreaSearch(''); setSelectedId('DEMO-1001'); setMobileDetail(false);
    window.history.replaceState(null, '', adminViewUrl('all', window.location.pathname));
  };
  return <div className="admin-app">
    <a href="#workspace" className="skip-link">Skip to workspace</a>
    <Sidebar view={view} onViewChange={changeView} counts={counts} />
    <div className="workspace-shell" id="workspace">
      <header className="workspace-header">
        <div className="header-title"><span className="header-mobile-brand">ekiti civic / </span><span>Operations</span><span className="header-slash">/</span><strong>{isCaseView(view) ? 'Cases' : view === 'analytics' ? 'Overview' : view === 'moderation' ? 'Moderation' : 'Routing'}</strong></div>
        <div className="header-actions">
          <button className="ops-alert-shortcut" type="button" onClick={()=>changeView('analytics')}
            aria-label={'Open sample alerts, '+deriveDemoAlerts(cases).length+' items'}>
            <span aria-hidden="true">Alerts</span>
            <strong>{deriveDemoAlerts(cases).length}</strong></button>
          <span className="environment-pill"><span aria-hidden="true" /> DEMO MODE</span>
          <button type="button" onClick={reset} title="Restore sample cases" className="reset-button">Reset demo</button>
          <div className="avatar" aria-label="Demo moderator">DM</div></div>
      </header>
      <div className="workspace-notice" role="note"><strong>Demo only.</strong>
        <span className="notice-wide"> All cases and updates are fictional and stay in memory. Live intake, staff login, notifications and government connections are not enabled.</span>
        <span className="notice-mobile"> Sample records; no live reports or government access.</span>
      </div>
      {view === 'analytics' ? <Analytics cases={cases} onNavigate={changeView}
        onOpenCase={openAttentionCase} onArea={openArea}/> :
        view === 'moderation' ? <ModerationWorkspace /> :
        view === 'routing' ? <RoutingWorkspace cases={cases} /> :
        <div className={'case-workspace ' + (mobileDetail ? 'mobile-detail-open' : '')}>
          <CaseList view={view} cases={shown} query={query} onQuery={setQuery}
            onQueueChange={changeView} counts={counts}
            selectedId={selected?.id || null}
            onSelect={id => { setSelectedId(id); setMobileDetail(true); }} />
          <CaseDetails item={selected} onBack={() => setMobileDetail(false)} onApply={apply} />
        </div>}
    </div>
  </div>;
}
