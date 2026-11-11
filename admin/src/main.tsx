import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { AdminApp } from './AdminApp.tsx';
import { PrivateAdminApp } from './PrivateAdminApp.tsx';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Admin root missing');

// The local demo remains an independent, synthetic-only experience.
// Private mode NEVER falls back to the demo when its configuration is invalid.
// No public Worker route, database migration, or staging binding is changed.
const privateMode = import.meta.env.VITE_ADMIN_MODE === 'private';
const config = {
  authUrl: import.meta.env.VITE_STAFF_AUTH_URL || '',
  publishableKey: import.meta.env.VITE_STAFF_PUBLISHABLE_KEY || '',
  adminOrigin: window.location.origin,
};
createRoot(root).render(
  <React.StrictMode>
    {privateMode ? <PrivateAdminApp config={config} /> : <AdminApp />}
  </React.StrictMode>,
);
