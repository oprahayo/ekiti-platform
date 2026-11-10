import * as React from 'react';
import type { AdminCase } from './case-model.ts';
import { formatDate } from './case-model.ts';
import { assessDemoRoute } from './routing-model.ts';
import {
  makeModerationExamples, moderateDemoItem, moderationActions,
  MODERATION_LABELS, MODERATION_STATES, InvalidModerationDecision,
  type ModerationAction, type ModerationKind, type ModerationItem,
} from './moderation-model.ts';

const kinds: ModerationKind[] = ['listing', 'review', 'claim', 'knowledge', 'correction'];
const actionLabels: Record<ModerationAction, string> = {
  request_evidence: 'Request more evidence (demo)',
  approve: 'Mark reviewed (demo)',
  reject: 'Reject (demo)',
  reopen: 'Reopen (demo)',
};

export function ModerationWorkspace() {
  const [items, setItems] = React.useState(makeModerationExamples);
  const [kind, setKind] = React.useState<ModerationKind>('listing');
  const [selectedId, setSelectedId] = React.useState('DEMO-MOD-101');
  const [action, setAction] = React.useState<ModerationAction | null>(null);
  const [reason, setReason] = React.useState('');
  const [error, setError] = React.useState('');
  const [mobileReviewOpen, setMobileReviewOpen] = React.useState(false);
  const [feedback, setFeedback] = React.useState('');
  const filtered = items.filter(item => item.kind === kind);
  const selected = filtered.find(item => item.id === selectedId) ?? filtered[0]!;
  const switchKind = (next: ModerationKind) => {
    setKind(next); setSelectedId(''); setAction(null); setReason(''); setError('');
    setMobileReviewOpen(false); setFeedback('');
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!action) return;
    try {
      const next = moderateDemoItem(selected, action, reason, new Date().toISOString());
      setItems(previous => previous.map(item => item.id === next.id ? next : item));
      setAction(null); setReason(''); setError('');
      setFeedback('Decision saved in demo memory only. No public record was changed.');
    } catch (cause) {
      setError(cause instanceof InvalidModerationDecision
        ? 'Provide a reason of 8–500 characters and use an available decision.'
        : 'Moderation is unavailable.');
    }
  };
  return <main className={'operations-section ' + (mobileReviewOpen ? 'detail-open' : '')}>
    <header className="operations-intro">
      <p className="eyebrow">QUALITY & SAFETY</p><h1>Moderation</h1>
      <p>Review proposed listings, citizen reviews, ownership claims, corrections and sourced knowledge. Actions are isolated demonstrations and never publish or verify a real record.</p>
    </header>
    <div className="moderation-mobile-picker">
      <label htmlFor="review-category">Review category</label>
      <select id="review-category" aria-label="Review category" value={kind}
        onChange={event => switchKind(event.target.value as ModerationKind)}>
        {kinds.map(key => <option key={key} value={key}>
          {MODERATION_LABELS[key]} · {items.filter(item => item.kind === key && item.status === 'pending').length}
        </option>)}
      </select>
    </div>
    <div className="moderation-categories" role="group" aria-label="Moderation queues">
      {kinds.map(key => <button type="button" key={key} className={kind === key ? 'active' : ''}
        onClick={() => switchKind(key)} aria-pressed={kind === key}>
        {MODERATION_LABELS[key]} <small>{items.filter(item => item.kind === key && item.status === 'pending').length}</small>
      </button>)}
    </div>
    <div className={'moderation-layout ' + (mobileReviewOpen ? 'mobile-review-open' : '')}>
      <section className="moderation-list" aria-label="Moderation items">
        {filtered.map(item => <button type="button" className={'moderation-list-item ' +
          (selected.id === item.id ? 'selected' : '')} key={item.id}
          aria-pressed={selected.id === item.id}
          onClick={() => { setSelectedId(item.id); setAction(null); setReason(''); setFeedback(''); setMobileReviewOpen(true); }}>
          <span>{item.id}</span><strong>{item.title}</strong>
          <small>{MODERATION_STATES[item.status]}</small>
        </button>)}
      </section>
      <section className="moderation-inspector" aria-label="Moderation review">
        <button type="button" className="panel-back" onClick={() => setMobileReviewOpen(false)}>← Moderation queue</button>
        <div className="inspector-head"><span>{selected.id}</span>
          <span className="inspector-status">{MODERATION_STATES[selected.status]}</span></div>
        <h2>{selected.title}</h2><p>{selected.detail}</p>
        <dl className="moderation-data">
          <div><dt>Queue</dt><dd>{MODERATION_LABELS[selected.kind]}</dd></div>
          <div><dt>LGA</dt><dd>{selected.lga ?? 'Not supplied'}</dd></div>
          <div><dt>Source</dt><dd>{selected.sourceLabel}</dd></div>
          <div><dt>Demonstration evidence</dt><dd>{selected.sourceReviewedInDemo ? 'Sample review gate fulfilled' : 'Not reviewed'}</dd></div>
        </dl>
        {selected.kind === 'claim' && <p className="warning-note">An email-code login does not prove business ownership. Claim verification is blocked until a real independent review and authorized server workflow exists.</p>}
        <h3>Review history</h3>
        <ol className="moderation-history">
          {[...selected.history].reverse().map((event, index) => <li key={index}>
            <strong>{event.action === 'submitted' ? 'Added to demo queue' : actionLabels[event.action]}</strong>
            <span>{formatDate(event.at)}</span><p>{event.reason}</p>
          </li>)}
        </ol>
        {feedback && <p role="status" className="action-feedback">{feedback}</p>}
        <div className="moderation-actions">
          {moderationActions(selected).map(value => <button type="button" key={value}
            aria-pressed={action === value} onClick={() => { setAction(action === value ? null : value); setError(''); }}
            className={action === value ? 'chosen' : ''}>{actionLabels[value]}</button>)}
        </div>
        {action && <form className="moderation-decision" onSubmit={submit}>
          <label htmlFor="moderation-reason">Internal decision reason</label>
          <textarea id="moderation-reason" value={reason} onChange={event => setReason(event.target.value)}
            minLength={8} maxLength={500} required rows={3}
            placeholder="Explain the evidence or reason for the decision" />
          {error && <p role="alert">{error}</p>}
          <div><button type="button" onClick={() => setAction(null)}>Cancel</button>
            <button className="decision-submit" type="submit">Record demo decision</button></div>
        </form>}
      </section>
    </div>
  </main>;
}

export function RoutingWorkspace({ cases }: { cases: AdminCase[] }) {
  const [selectedId, setSelectedId] = React.useState(cases[0]?.id ?? '');
  const [mobileRouteOpen, setMobileRouteOpen] = React.useState(false);
  const selected = cases.find(item => item.id === selectedId) ?? cases[0];
  const assessment = selected && assessDemoRoute(selected);
  return <main className={'operations-section ' + (mobileRouteOpen ? 'detail-open' : '')}>
    <header className="operations-intro">
      <p className="eyebrow">TRIAGE & RESPONSIBILITY</p><h1>Office routing</h1>
      <p>Prepare an internal routing assessment using category and LGA. A suggested level of government is not a verified office, assignment, delivery or official acknowledgement.</p>
    </header>
    <div className={'routing-layout ' + (mobileRouteOpen ? 'mobile-route-open' : '')}>
      <section className="routing-list" aria-label="Cases requiring routing review">
        <h2>Case routing queue</h2>
        {cases.map(item => <button type="button" key={item.id}
          aria-pressed={selected?.id === item.id}
          onClick={() => { setSelectedId(item.id); setMobileRouteOpen(true); }}
          className={'routing-list-item ' + (selected?.id === item.id ? 'selected' : '')}>
          <span>{item.id}</span><strong>{item.title}</strong><small>{item.lga}</small></button>)}
      </section>
      <section className="routing-detail" aria-label="Routing assessment">
        <button type="button" className="panel-back" onClick={() => setMobileRouteOpen(false)}>← Routing queue</button>
        {assessment && <>
          <div className="inspector-head"><span>{assessment.caseId}</span><span className="inspector-status">Manual verification</span></div>
          <h2>Responsibility assessment</h2>
          <dl className="moderation-data">
            <div><dt>Detected category</dt><dd>{assessment.category} (fixture)</dd></div>
            <div><dt>Provided LGA</dt><dd>{assessment.lga}</dd></div>
            <div><dt>Ward mapping</dt><dd>Not mapped from verified polygons</dd></div>
            <div><dt>Suggested triage</dt><dd>{assessment.scope.replaceAll('_', ' ')}</dd></div>
            <div><dt>Confirmed responsible office</dt><dd>Not assigned</dd></div>
            <div><dt>Government delivery</dt><dd>Not attempted</dd></div>
          </dl>
          <div className="routing-advice">
            <h3>Why this needs review</h3><p>{assessment.reason}</p>
          </div>
          <p className="warning-note">This routing assessment cannot send, forward or mark a report as seen. Only a server-authorized office-directory and evidence-backed government gateway can record those events.</p>
        </>}
      </section>
    </div>
  </main>;
}
