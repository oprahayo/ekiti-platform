import * as React from 'react';
import { Link } from 'react-router';
import { useApp } from './state.tsx';
import CivicActionIcon from './CivicActionIcon.tsx';

/** The gateway stays separate from the task conversations. */
const actions = [
  { to: '/report', icon: 'report', title: 'Report an issue', description: 'Open the guided incident report' },
  { to: '/report?kind=feedback', icon: 'feedback', title: 'Give feedback', description: 'Share a complaint, suggestion or commendation' },
  { to: '/ask', icon: 'ask', title: 'Ask about Ekiti', description: 'Ask about services, places and public information in Ekiti' },
  { to: '/explore', icon: 'explore', title: 'Explore Ekiti', description: 'Browse places, businesses and services' },
  { to: '/listings/new', icon: 'listing', title: 'Post a listing', description: 'Suggest a business or service for review' },
] as const;

export default function WelcomeHome() {
  const { language, deviceLocation, requestDeviceLocation, dismissDeviceLocation } = useApp();
  return <main id="main" className="page welcome-gateway">
    <div className="welcome-primary">
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
          <CivicActionIcon name={action.icon}/>
          <span className="welcome-action-copy">
            <strong>{action.title}</strong>
            <span className="visually-hidden">{action.description}</span>
          </span>
        </Link>)}
      </nav>
    </section>
    </div>

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
      <p>Real submissions, official receipts and public case publication are not enabled yet. Contact emergency services directly if anyone is in immediate danger.</p>
    </div>
  </main>;
}
