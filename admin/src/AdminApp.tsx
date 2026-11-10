import * as React from 'react';
import {
  QUEUES, QUEUE_LABELS, agencyEvidence, applyDemoAction, availableActions,
  caseQueue, filterCases, formatDate, queueCounts, InvalidCaseAction,
  type Action, type AdminCase, type Queue,
} from './case-model.ts';
import { makeDemoCases } from './demo-cases.ts';
import { ModerationWorkspace, RoutingWorkspace } from './OperationsModules.tsx';

type View = Queue | 'all' | 'analytics' | 'moderation' | 'routing';

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

function Sidebar({
  view, onViewChange, counts,
}: {
  view: View;
  onViewChange: (view: View) => void;
  counts: Record<Queue, number>;
}) {
  const items: { key: View; icon: string; label: string; count?: number }[] = [
    { key: 'all', icon: '◫', label: 'All cases', count: Object.values(counts).reduce((a, b) => a + b, 0) },
    ...QUEUES.map((queue, index) => ({
      key: queue, icon: ['▤', '◉', '◷', '↗', '✓'][index]!, label: QUEUE_LABELS[queue],
      count: counts[queue],
    })),
  ];
  return <aside className="sidebar">
    <div className="brand">
      <span className="brand-mark">e<span>•</span></span>
      <div><strong>Ekiti Civic</strong><small>Operations workspace</small></div>
    </div>
    <div className="sidebar-section-label">WORKSPACE</div>
    <nav className="main-nav" aria-label="Operations views">
      {items.map(item => <button type="button" key={item.key}
        className={'nav-link ' + (view === item.key ? 'active' : '')}
        onClick={() => onViewChange(item.key)} aria-current={view === item.key ? 'page' : undefined}>
        <span className="nav-glyph" aria-hidden="true">{item.icon}</span>
        <span>{item.label}</span>
        <span className="nav-count">{item.count}</span>
      </button>)}
      <div className="sidebar-divider" />
      <button type="button" className={'nav-link ' + (view === 'moderation' ? 'active' : '')}
        onClick={() => onViewChange('moderation')} aria-current={view === 'moderation' ? 'page' : undefined}>
        <span className="nav-glyph" aria-hidden="true">◇</span><span>Moderation</span>
      </button>
      <button type="button" className={'nav-link ' + (view === 'routing' ? 'active' : '')}
        onClick={() => onViewChange('routing')} aria-current={view === 'routing' ? 'page' : undefined}>
        <span className="nav-glyph" aria-hidden="true">↪</span><span>Office routing</span>
      </button>
      <button type="button" className={'nav-link ' + (view === 'analytics' ? 'active' : '')}
        onClick={() => onViewChange('analytics')} aria-current={view === 'analytics' ? 'page' : undefined}>
        <span className="nav-glyph" aria-hidden="true">▥</span><span>Analytics</span>
      </button>
    </nav>
    <div className="sidebar-bottom">
      <span className="workspace-indicator" aria-hidden="true" />
      <div><strong>Demo environment</strong><small>No production connection</small></div>
    </div>
  </aside>;
}

function CaseList({
  view, cases, query, onQuery, selectedId, onSelect,
}: {
  view: Queue | 'all';
  cases: AdminCase[];
  query: string;
  onQuery: (query: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return <section className="case-panel" aria-label="Case list">
    <div className="list-heading">
      <div><p className="eyebrow">CASE MANAGEMENT</p>
        <h1>{view === 'all' ? 'All cases' : QUEUE_LABELS[view]}</h1>
        <p className="subdued">{cases.length} sample {cases.length === 1 ? 'case' : 'cases'}</p>
      </div>
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
          <span className="case-kind">{item.kind}</span></div>
        <div className="case-title-line"><h2>{item.title}</h2><Dot priority={item.priority} /></div>
        <p className="case-preview">{item.summary}</p>
        <div className="case-row-bottom"><span className="location-label">⌁ {item.lga}</span>
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
  React.useEffect(() => { setAction(null); setNote(''); setError(''); }, [item?.id]);
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

function Analytics({ cases }: { cases: AdminCase[] }) {
  const counts = queueCounts(cases);
  const total = cases.length;
  const kindCounts = ['Complaint', 'Issue', 'Commendation'].map(kind =>
    ({ kind, count: cases.filter(item => item.kind === kind).length }));
  return <main className="analytics">
    <div className="analytics-top"><p className="eyebrow">OPERATIONS / DEMO</p>
      <h1>Workspace overview</h1>
      <p>Numbers below refer only to fictional cases in this browser session. No government performance metrics are published.</p></div>
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
  const [view, setView] = React.useState<View>('all');
  const [query, setQuery] = React.useState('');
  const [selectedId, setSelectedId] = React.useState<string | null>('DEMO-1001');
  const [mobileDetail, setMobileDetail] = React.useState(false);
  const counts = React.useMemo(() => queueCounts(cases), [cases]);
  const shown = React.useMemo(() =>
    view === 'analytics' || view === 'moderation' || view === 'routing' ? [] : filterCases(cases, view, query), [cases, view, query]);
  const selected = shown.find(item => item.id === selectedId) ?? shown[0] ?? null;
  const changeView = (next: View) => { setView(next); setSelectedId(null); setMobileDetail(false); };
  const apply = (id: string, action: Action, note: string) => {
    const current = cases.find(item => item.id === id);
    if (!current) throw new InvalidCaseAction();
    const updated = applyDemoAction(current, action, note, new Date().toISOString());
    setCases(previous => previous.map(item => item.id === id ? updated : item));
    // Stay on the case even when it moves to another queue.
    if (QUEUES.includes(view as Queue) && caseQueue(updated) !== view) setView('all');
    setSelectedId(id);
  };
  const reset = () => {
    setCases(makeDemoCases()); setView('all'); setQuery(''); setSelectedId('DEMO-1001'); setMobileDetail(false);
  };
  return <div className="admin-app">
    <a href="#workspace" className="skip-link">Skip to workspace</a>
    <Sidebar view={view} onViewChange={changeView} counts={counts} />
    <div className="workspace-shell" id="workspace">
      <header className="workspace-header">
        <div className="header-title"><span className="header-mobile-brand">ekiti civic / </span><span>Operations</span><span className="header-slash">/</span><strong>{view === 'analytics' ? 'Analytics' : view === 'moderation' ? 'Moderation' : view === 'routing' ? 'Office routing' : view === 'all' ? 'All cases' : QUEUE_LABELS[view]}</strong></div>
        <div className="header-actions"><span className="environment-pill"><span aria-hidden="true" /> DEMO MODE</span>
          <button type="button" onClick={reset} title="Restore sample cases" className="reset-button">Reset demo</button>
          <div className="avatar" aria-label="Demo moderator">DM</div></div>
      </header>
      <div className="workspace-notice" role="note"><strong>Demonstration workspace.</strong> All cases and updates are fictional and stay in memory. Real case intake, authorized staff login, notifications and agency integrations are not connected.</div>
      {view === 'analytics' ? <Analytics cases={cases} /> :
        view === 'moderation' ? <ModerationWorkspace /> :
        view === 'routing' ? <RoutingWorkspace cases={cases} /> :
        <div className={'case-workspace ' + (mobileDetail ? 'mobile-detail-open' : '')}>
          <CaseList view={view} cases={shown} query={query} onQuery={setQuery}
            selectedId={selected?.id || null}
            onSelect={id => { setSelectedId(id); setMobileDetail(true); }} />
          <CaseDetails item={selected} onBack={() => setMobileDetail(false)} onApply={apply} />
        </div>}
    </div>
  </div>;
}
