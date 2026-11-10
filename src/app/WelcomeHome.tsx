import * as React from 'react';
import { Link } from 'react-router';
import { useApp } from './state.tsx';

/** The gateway is intentionally NOT a chat. Conversation begins inside each task. */
const actions = [
  { to: '/report', icon: '!', title: 'Report an issue', description: 'Roads, water, safety, emergencies and services', tone: 'priority' },
  { to: '/report?kind=feedback', icon: '♡', title: 'Give feedback', description: 'A complaint, suggestion or commendation', tone: 'neutral' },
  { to: '/post', icon: '✎', title: 'Community post', description: 'Prepare a community notice or story', tone: 'neutral' },
  { to: '/explore', icon: '⌕', title: 'Explore Ekiti', description: 'Find businesses, places and public services', tone: 'neutral' },
  { to: '/listings/new', icon: '+', title: 'Post a listing', description: 'Suggest a business for Yellow Pages review', tone: 'neutral' },
  { to: '/ask', icon: '?', title: 'Ask a question', description: 'Get source-backed answers about Ekiti', tone: 'neutral' },
] as const;

export default function WelcomeHome() {
  const { language } = useApp();
  return <main id="main" className="page welcome-gateway">
    <div className="welcome-heading">
      <p className="eyebrow">An independent civic platform</p>
      <h1>{language === 'yo' ? 'Káàbọ̀ sí Ekiti Civic' : 'Welcome to Ekiti Civic'}</h1>
      <p>{language === 'yo'
        ? 'Ẹnu ọ̀nà rẹ sí ìwífún àti iṣẹ́ àdúgbò ní Ìpínlẹ̀ Èkìtì.'
        : 'Your mobile gateway to Ekiti State.'}</p>
      <p className="welcome-helper">What would you like to do today?</p>
    </div>
    <nav aria-label="Choose an activity" className="welcome-action-list">
      {actions.map(action => <Link key={action.to} to={action.to}
        className={'welcome-action' + (action.tone === 'priority' ? ' welcome-action-priority' : '')}>
        <span className="welcome-action-icon" aria-hidden="true">{action.icon}</span>
        <span className="welcome-action-copy"><strong>{action.title}</strong><small>{action.description}</small></span>
        <span className="welcome-action-arrow" aria-hidden="true">›</span>
      </Link>)}
    </nav>
    <div className="welcome-footer">
      <Link to="/track">Have a report reference? Check tracking</Link>
      <p>Real reports, official receipts and public case publication are not enabled yet. Emergencies require direct contact with emergency services.</p>
    </div>
  </main>;
}
