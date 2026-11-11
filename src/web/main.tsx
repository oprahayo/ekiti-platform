import * as React from 'react';
import { createRoot } from 'react-dom/client';
import App from '../app/App.tsx';
import '../app/styles.css';
import '../app/search-directory-workspace.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing application mount point');
createRoot(root).render(<React.StrictMode><App /></React.StrictMode>);

// Offline shell: static assets only. The service worker never caches API or case data.
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').then(async () => {
      const ready = await navigator.serviceWorker.ready;
      const assets = performance.getEntriesByType('resource')
        .map(entry => new URL(entry.name, location.href))
        .filter(url => url.origin === location.origin && url.pathname.startsWith('/assets/'))
        .map(url => url.pathname);
      ready.active?.postMessage({ type: 'CACHE_LOADED_ASSETS', assets });
    }).catch(() => { /* Online app still works. */ });
  });
}
