import * as React from 'react';
import { Link } from 'react-router';
import { useApp } from './state.tsx';

/** The gateway stays separate from the task conversations. */
const actions = [
  { to: '/report', icon: 'report', title: 'Report an issue', description: 'Open the guided incident report' },
  { to: '/report?kind=feedback', icon: 'feedback', title: 'Give feedback', description: 'Share a complaint, suggestion or commendation' },
  { to: '/ask', icon: 'ask', title: 'Ask about Ekiti', description: 'Ask about services, places and public information in Ekiti' },
  { to: '/explore', icon: 'explore', title: 'Explore Ekiti', description: 'Browse places, businesses and services' },
  { to: '/listings/new', icon: 'listing', title: 'Post a listing', description: 'Suggest a business or service for review' },
] as const;

type ActionIcon = typeof actions[number]['icon'];

function ActionSymbol({ name }: { name: ActionIcon }) {
  const shapes: Record<ActionIcon, React.ReactNode> = {
    report: <><path d="M12 3 2.7 20h18.6L12 3Z"/><path d="M12 9v5m0 3v.2"/></>,
    feedback: <><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-4.5-1.2L3 20l1.2-5A8.5 8.5 0 1 1 21 11.5Z"/><path d="M8 11.5h8m-8 3h5"/></>,
    explore: <><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2.7 6-4.3 1 2.7-6 4.3-1Z"/></>,
    listing: <><path d="M4 10.5h16V20H4v-9.5ZM3 10.5 5 4h14l2 6.5M9 20v-6h6v6"/></>,
    ask: <><circle cx="12" cy="12" r="9"/><path d="M9.4 9a2.8 2.8 0 0 1 5.2 1.3c0 1.9-2.6 2.1-2.6 4M12 17.5h.01"/></>,
  };
  return <svg className="welcome-action-icon" viewBox="0 0 24 24" width="24" height="24"
    fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">{shapes[name]}</svg>;
}

export default function WelcomeHome() {
  const { language, deviceLocation, requestDeviceLocation, dismissDeviceLocation } = useApp();
  return <main id="main" className="page welcome-gateway">
    <section className="welcome-heading" aria-labelledby="welcome-title">
      <h1 id="welcome-title">{language === 'yo' ? 'Káàbọ̀ sí Ekiti Civic' : 'Welcome to Ekiti Civic'}</h1>
      <p className="welcome-subtitle">{language === 'yo'
        ? 'Ẹnu ọ̀nà rẹ sí ìwífún àti iṣẹ́ àdúgbò ní Ìpínlẹ̀ Èkìtì.'
        : 'Your mobile gateway to Ekiti State.'}</p>
    </section>

    <section className="welcome-activities" aria-labelledby="welcome-task-heading">
      <h2 id="welcome-task-heading">{language === 'yo' ? 'Kí ni o fẹ́ ṣe lónìí?' : 'What would you like to do?'}</h2>
      <nav aria-label="Choose an activity" className="welcome-action-list welcome-dice-list">
        {actions.map(action => <Link key={action.to} to={action.to} className="welcome-action">
          <ActionSymbol name={action.icon}/>
          <span className="welcome-action-copy">
            <strong>{action.title}</strong>
            <span className="visually-hidden">{action.description}</span>
          </span>
        </Link>)}
      </nav>
    </section>

    {deviceLocation.status !== 'dismissed' && <section className="welcome-location" aria-label="Optional location setup">
      <div className="welcome-location-copy">
        <strong>{deviceLocation.status === 'prompt' ? 'Find what is relevant near you' : 'Device location'}</strong>
        <p role="status">{deviceLocation.status === 'prompt'
          ? 'Use your location to find the correct Ekiti LGA and nearby categories. We will ask permission first; you can always browse without it.'
          : deviceLocation.message}</p>
      </div>
      <div className="welcome-location-actions">
        {deviceLocation.status !== 'matched' && <button type="button" className="welcome-location-allow"
          disabled={deviceLocation.status === 'loading'} onClick={() => void requestDeviceLocation()}>
          {deviceLocation.status === 'loading' ? 'Checking…' : deviceLocation.status === 'prompt' ? 'Use my location' : 'Try location again'}
        </button>}
        <button type="button" className="welcome-location-skip" onClick={dismissDeviceLocation}>Not now</button>
      </div>
    </section>}
    <div className="welcome-footer">
      <Link to="/track">Have a report reference? Check tracking</Link>
      <p>Real submissions, official receipts and public case publication are not enabled yet. Contact emergency services directly if anyone is in immediate danger.</p>
    </div>
  </main>;
}
