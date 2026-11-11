import * as React from 'react';
import {
  caseQueue, filterCases, formatDate, queueCounts, QUEUE_LABELS,
  type AdminCase, type Queue,
} from './case-model.ts';
import { OpsAlerts } from './OpsAlerts.tsx';

const EkitiOpsMap = React.lazy(() => import('./EkitiOpsMap.tsx'));

type DashboardProps = {
  cases: AdminCase[];
  query: string;
  onQuery: (value: string) => void;
  onOpenCase: (id: string) => void;
  onArea: (area: string) => void;
  onInbox: () => void;
  onModeration: () => void;
  onRouting: () => void;
};

function SignalMetric({label, value, context, tone}:{
  label:string;value:number;context:string;tone:'green'|'red';
}) {
  return <div className={'precision-metric precision-metric-'+tone}>
    <div className="precision-metric-heading">{label}</div>
    <div className="precision-metric-number">{value}</div>
    <p>{context}</p>
    <div className="precision-metric-bars" aria-hidden="true">
      {[.38,.52,.46,.73,.63,1].map((factor,index)=>
        <span key={index} style={{height:(15+factor*36)+'%'}} />)}
    </div>
  </div>;
}

export function OperationsDashboard({
  cases,query,onQuery,onOpenCase,onArea,onInbox,onModeration,onRouting,
}:DashboardProps) {
  const counts=React.useMemo(()=>queueCounts(cases),[cases]);
  const [queue,setQueue]=React.useState<Queue|'all'>('all');
  const [area,setArea]=React.useState('');
  const areas=React.useMemo(()=>[...new Set(cases.map(item=>item.lga))].sort(),[cases]);
  const filtered=React.useMemo(()=>filterCases(cases,queue,query)
    .filter(item=>!area||item.lga===area),[cases,queue,query,area]);
  const unresolved=cases.length-counts.resolved;

  return <main className="analytics precision-dashboard" aria-label="Ekiti Civic operations overview">
    <header className="precision-intro">
      <div>
        <span className="precision-kicker">INEKITI OFFICIAL / OPERATIONS</span>
        <h1>Workspace overview</h1>
        <p>Ekiti incident visibility, triage and agency accountability.</p>
      </div>
      <span className="precision-status" role="note">Sample environment — not live dispatch</span>
    </header>

    <div className="precision-map-grid">
      <React.Suspense fallback={<section className="ops-map-loading" role="status">Loading Ekiti boundaries…</section>}>
        <EkitiOpsMap cases={cases} onSelectArea={onArea}/>
      </React.Suspense>
      <section className="precision-signals" aria-label="Sample operational indicators">
        <SignalMetric label="Open platform cases" value={unresolved}
          context="Unresolved fictional cases — not active emergency calls" tone="green"/>
        <SignalMetric label="Internal escalations" value={counts.escalated}
          context="Escalated for demo review; no ministry delivery implied" tone="red"/>
        <div className="precision-proof">
          <span className="precision-kicker">AGENCY CONNECTION</span>
          <strong>Not connected</strong>
          <p>Delivery, read and acknowledgement events remain unavailable until agencies are verified and signed in.</p>
        </div>
      </section>
    </div>

    <section className="precision-table-section" aria-label="Sample incident operations table">
      <header className="precision-table-head">
        <div><span className="precision-kicker">CASE OPERATIONS</span>
          <h2>Incident reports</h2>
          <p>{filtered.length} of {cases.length} fictional records · Simulated records</p></div>
        <div className="precision-table-filters">
          <label htmlFor="precision-area">Area
            <select id="precision-area" value={area}
              onChange={event=>setArea(event.target.value)}>
              <option value="">All LGAs</option>
              {areas.map(name=><option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <label htmlFor="precision-status">Queue
            <select id="precision-status" value={queue}
              onChange={event=>setQueue(event.target.value as Queue|'all')}>
              <option value="all">All statuses</option>
              {Object.keys(QUEUE_LABELS).map(name=><option key={name} value={name}>
                {QUEUE_LABELS[name as Queue]}</option>)}
            </select>
          </label>
        </div>
      </header>
      <div className="precision-table-scroll">
        <table>
          <thead><tr>
            <th scope="col">Reference / incident</th>
            <th scope="col">Locality</th>
            <th scope="col">Priority</th>
            <th scope="col">Platform status</th>
            <th scope="col">Agency receipt</th>
            <th scope="col">Action</th>
          </tr></thead>
          <tbody>
            {filtered.map(item=><tr key={item.id}>
              <td><strong>{item.title}</strong><small>{item.id} · {item.kind}</small></td>
              <td>{item.lga}<small>{formatDate(item.receivedAt)}</small></td>
              <td><span className={'precision-priority '+item.priority}>
                <i aria-hidden="true"/>{item.priority==='high'?'High':'Normal'}</span></td>
              <td><span className={'precision-queue '+caseQueue(item)}>{QUEUE_LABELS[caseQueue(item)]}</span></td>
              <td><span className="precision-unverified">Not verified</span></td>
              <td><button type="button" className="precision-open-case"
                onClick={()=>onOpenCase(item.id)}>Review sample case</button></td>
            </tr>)}
            {filtered.length===0&&<tr><td colSpan={6}>
              <div className="precision-empty">No matching sample incidents.
                <button type="button" onClick={()=>{setArea('');setQueue('all');onQuery('');}}>Clear filters</button>
              </div>
            </td></tr>}
          </tbody>
        </table>
      </div>
      <footer className="precision-table-footer">
        <span>Search and filters run locally on sample data only</span>
        <button type="button" onClick={onInbox}>Review unassigned cases ({counts.inbox})</button>
      </footer>
    </section>

    <div className="precision-alerts-panel">
      <OpsAlerts cases={cases} onOpenCase={onOpenCase}/>
      <section className="precision-agency-panel" aria-label="Agency access readiness">
        <span className="precision-kicker">AGENCY WORKSPACES</span>
        <h2>Dedicated access by responsibility</h2>
        <p>The final workspace will show each verified ministry or agency only the cases within its authorized remit, with receipt, read and action evidence. This preview contains no agency identities or live incident coordinates.</p>
        <div className="precision-next-actions">
          <button type="button" onClick={onModeration}>Moderate contributions</button>
          <button type="button" onClick={onRouting}>Check office routing</button>
        </div>
      </section>
    </div>
  </main>;
}
