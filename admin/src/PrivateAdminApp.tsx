import * as React from 'react';
import {
  createStaffAuthClient, StaffRequestError,
  type StaffAuthConfig, type StaffIdentity, type PrivateCase,
  type PrivateCaseEvent, type StaffSignInStep,
} from './staff-auth.ts';
import './private-admin.css';

type View = 'cases' | 'moderation' | 'routing' | 'overview';
type PendingMfa = Extract<StaffSignInStep,{kind:'mfa'}>;
const caseRoles = new Set(['platform_admin','case_manager','moderator']);
const labels: Record<PrivateCase['currentState'],string> = {
  intake_accepted:'Accepted by platform',under_review:'Under internal review',
  needs_information:'Needs information',closed:'Platform closed',
};
function readable(value: string): string {
  return Number.isFinite(Date.parse(value)) ?
    new Date(value).toLocaleString('en-NG',{dateStyle:'medium',timeStyle:'short'}) : 'Unknown';
}
function message(error: unknown): string {
  if (error instanceof StaffRequestError) {
    if (error.status === 401) return 'Session expired or sign-in was unsuccessful.';
    if (error.status === 403) return 'Access requires approved staff membership and verified MFA.';
    if (error.status === 429) return 'Too many attempts. Try again later.';
  }
  return 'The private service is unavailable. No data has been saved.';
}

/** This component never mounts the fictional case demo or a public Worker API. */
export function PrivateAdminApp({ config }: { config: StaffAuthConfig }) {
  const client = React.useMemo(() => {
    try { return createStaffAuthClient(config); } catch { return null; }
  },[config.authUrl,config.publishableKey,config.adminOrigin]);
  const [email,setEmail] = React.useState('');
  const [password,setPassword] = React.useState('');
  const [totp,setTotp] = React.useState('');
  const [pending,setPending] = React.useState<PendingMfa|null>(null);
  const [session,setSession] = React.useState<{token:string;identity:StaffIdentity}|null>(null);
  const [items,setItems] = React.useState<readonly PrivateCase[]>([]);
  const [selected,setSelected] = React.useState<PrivateCase|null>(null);
  const [events,setEvents] = React.useState<readonly PrivateCaseEvent[]>([]);
  const [view,setView] = React.useState<View>('cases');
  const [busy,setBusy] = React.useState(false);
  const [error,setError] = React.useState('');
  const epoch = React.useRef(0);

  const forget = React.useCallback(() => {
    epoch.current++;
    setPending(null);setSession(null);setItems([]);setSelected(null);setEvents([]);
    setPassword('');setTotp('');setBusy(false);setView('cases');
  },[]);
  const exit = async () => {
    const token = session?.token ?? pending?.provisionalToken;
    forget();
    if (token && client) await client.signOut(token);
  };
  const openSession = async (token: string, index: number) => {
    if (!client) return;
    try {
      const identity = await client.me(token);
      if (index !== epoch.current) return;
      let records: readonly PrivateCase[] = [];
      if (caseRoles.has(identity.role)) records = await client.listCases(token);
      if (index !== epoch.current) return;
      setSession({token,identity});setItems(records);setPending(null);
      setPassword('');setTotp('');setSelected(null);setEvents([]);
      setError('');
    } catch (cause) {
      if (index !== epoch.current) return;
      forget();setError(message(cause));
    } finally {
      if (index === epoch.current) setBusy(false);
    }
  };
  const signIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!client || busy) return;
    const index = ++epoch.current;
    setBusy(true);setError('');
    try {
      const step = await client.signIn(email.trim(),password);
      if (index !== epoch.current) return;
      setPassword('');
      if (step.kind === 'mfa') {setPending(step);setBusy(false);}
      else await openSession(step.token,index);
    } catch (cause) {
      if (index !== epoch.current) return;
      setBusy(false);setPassword('');setError(message(cause));
    }
  };
  const verify = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!client || !pending || busy) return;
    const index=++epoch.current;
    setBusy(true);setError('');
    try {
      const token = await client.verifyMfa(pending,totp);
      if (index !== epoch.current) return;
      await openSession(token,index);
    } catch (cause) {
      if (index !== epoch.current) return;
      setBusy(false);setTotp('');setError(message(cause));
    }
  };
  const showCase = async (record: PrivateCase) => {
    if (!session || !client || busy) return;
    const index=++epoch.current;
    setSelected(record);setEvents([]);setBusy(true);setError('');
    try {
      const history = await client.events(session.token,record.id);
      if (index === epoch.current) setEvents(history);
    } catch (cause) {
      if (index === epoch.current) {
        if (cause instanceof StaffRequestError && cause.status === 401) forget();
        setError(message(cause));
      }
    } finally {
      if (index === epoch.current) setBusy(false);
    }
  };
  if (!client || typeof window === 'undefined' || window.location.origin !== config.adminOrigin) {
    return <main className="staff-locked">
      <h1>Private workspace unavailable</h1>
      <p>Staff login is disabled because the isolated HTTPS admin origin or identity provider is not configured.</p>
      <p>No demo or private records have been loaded.</p>
    </main>;
  }
  if (!session) return <main className="staff-auth-shell">
    <div className="staff-auth-card">
      <div className="staff-brand"><span className="staff-logo">e.</span>
        <span><strong>Ekiti Civic</strong><small>Protected operations workspace</small></span></div>
      <span className="staff-eyebrow">INDEPENDENT CIVIC PLATFORM</span>
      <h1>{pending ? 'Verify your identity' : 'Staff sign in'}</h1>
      <p>{pending ? 'Enter the six-digit code from your enrolled authenticator. Only verified MFA sessions may open staff records.' :
        'Access is limited to staff invited and approved by the independent platform operator.'}</p>
      {error && <p role="alert" className="staff-error">{error}</p>}
      {pending ?
        <form onSubmit={verify}>
          <label htmlFor="staff-totp">Authenticator code</label>
          <input id="staff-totp" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}"
            maxLength={6} value={totp} onChange={event=>setTotp(event.target.value.replace(/\D/g,''))}
            required autoFocus disabled={busy} />
          <button disabled={busy || !/^\d{6}$/.test(totp)} type="submit">{busy?'Verifying…':'Verify and continue'}</button>
          <button type="button" className="staff-text-button" onClick={()=>{forget();setError('');}}>Cancel sign in</button>
        </form> :
        <form onSubmit={signIn}>
          <label htmlFor="staff-email">Staff email</label>
          <input id="staff-email" type="email" autoComplete="username" value={email}
            onChange={event=>setEmail(event.target.value)} maxLength={254} required disabled={busy} />
          <label htmlFor="staff-password">Password</label>
          <input id="staff-password" type="password" autoComplete="current-password" value={password}
            onChange={event=>setPassword(event.target.value)} required disabled={busy} />
          <button type="submit" disabled={busy}>{busy?'Checking access…':'Continue securely'}</button>
        </form>}
      <div className="staff-auth-note">No self-registration. No device storage of authentication tokens.
        This service cannot confirm government delivery, emergency dispatch or official responses.</div>
    </div>
  </main>;

  const canSeeCases = caseRoles.has(session.identity.role);
  return <div className="staff-workspace">
    <a className="staff-skip" href="#staff-content">Skip to content</a>
    <aside className="staff-sidebar">
      <div className="staff-brand"><span className="staff-logo">e.</span>
        <span><strong>Ekiti Civic</strong><small>Staff workspace</small></span></div>
      <nav aria-label="Private admin navigation">
        {(['cases','moderation','routing','overview'] as const).map(key =>
          <button type="button" key={key} aria-current={view===key?'page':undefined}
            onClick={()=>{setView(key);setSelected(null);setEvents([]);}}>
            {({cases:'Cases',moderation:'Moderation',routing:'Routing',overview:'Overview'} as const)[key]}
          </button>)}
      </nav>
      <div className="staff-private-label">PRIVATE · MFA VERIFIED</div>
    </aside>
    <main className="staff-main" id="staff-content">
      <header className="staff-topbar">
        <div><strong>Operations</strong><small>{session.identity.role.replaceAll('_',' ')}</small></div>
        <button type="button" onClick={()=>{void exit();}}>Sign out</button>
      </header>
      <p className="staff-notice" role="note">These are internal platform records only. No listed case implies
        a government office has received, viewed or resolved a report.</p>
      {error && <p role="alert" className="staff-error">{error}</p>}
      {view==='cases' ? <section className="staff-content">
        <div className="staff-section-head"><div><h1>Private cases</h1>
          <p>{canSeeCases ? 'Authorized report metadata, without citizen identity, narrative or exact coordinates.' :
            'This staff role has no access to the private case queue.'}</p></div>
          <span>{canSeeCases ? items.length + ' shown' : 'Restricted'}</span></div>
        {!canSeeCases ? null : items.length===0 ? <p className="staff-empty">No cases are available in your authorized scope.</p> :
          <div className="staff-case-layout">
            <div className="staff-case-list" aria-label="Authorized case list">{items.map(item =>
              <button type="button" key={item.id} onClick={()=>{void showCase(item);}}
                aria-pressed={selected?.id===item.id}>
                <span>{item.kind} · {item.lgaId}</span>
                <strong>{item.publicReference}</strong>
                <small>{labels[item.currentState]} · {readable(item.receivedAt)}</small>
              </button>)}</div>
            <section className="staff-case-detail" aria-label="Case activity">
              {selected ? <>
                <button type="button" className="staff-back" onClick={()=>setSelected(null)}>← Cases</button>
                <h2>Case {selected.publicReference}</h2>
                <dl><div><dt>Classification</dt><dd>{selected.kind}</dd></div>
                  <div><dt>Local government</dt><dd>{selected.lgaId}</dd></div>
                  <div><dt>Platform status</dt><dd>{labels[selected.currentState]}</dd></div>
                  <div><dt>Revision</dt><dd>{selected.revision}</dd></div></dl>
                <h3>Internal audit events</h3>
                {busy ? <p role="status">Loading case history…</p> : events.length===0 ?
                  <p>No visible history for this case.</p> :
                  <ol>{events.map(entry=><li key={entry.id}>
                    <strong>{entry.kind.replaceAll('_',' ')}</strong>
                    <time dateTime={entry.createdAt}>{readable(entry.createdAt)}</time>
                    <p>{entry.detail}</p>
                    <small>{entry.actorKind} · platform event only</small>
                  </li>)}</ol>}
              </> : <p className="staff-empty">Select an authorized case to view its internal history.</p>}
            </section>
          </div>}
      </section> : view==='overview' ? <section className="staff-content">
        <h1>Overview</h1><p>Counts reflect only the current authorized page (maximum 20 cases), not statewide totals.</p>
        <div className="staff-stats">
          <div><strong>{canSeeCases?items.length:'—'}</strong><span>Visible cases</span></div>
          <div><strong>{canSeeCases?items.filter(item=>item.currentState==='under_review').length:'—'}</strong>
            <span>Under internal review</span></div>
          <div><strong>{canSeeCases?items.filter(item=>item.currentState==='closed').length:'—'}</strong>
            <span>Platform closed</span></div>
        </div>
      </section> : <section className="staff-content">
        <h1>{view==='moderation'?'Moderation':'Office routing'}</h1>
        <p className="staff-empty">{view==='moderation' ?
          'The authenticated moderation API has not been approved. No real listings, reviews or ownership claims can be decided here.' :
          'Verified office registry and signed delivery evidence are not available. Staff cannot forward or mark any case as received.'}</p>
      </section>}
    </main>
  </div>;
}
