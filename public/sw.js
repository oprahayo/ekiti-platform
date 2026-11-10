/* Ekiti UI v2 offline shell.
 * Cache only public HTML/JS/CSS/static files. NEVER cache /api responses or
 * report descriptions. Drafts are stored on-device by the report component.
 */
const CACHE = 'ekiti-v2-public-shell-v1';
const SHELL = '/index.html';

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const response = await fetch(SHELL, { cache: 'reload' });
    if (!response.ok) return;
    const html = await response.clone().text();
    await cache.put(SHELL, response);
    // Vite emits content-hashed entry assets in the initial HTML.
    const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[a-zA-Z0-9_./-]+\.(?:js|css))"/g)]
      .map(match => match[1]);
    await Promise.allSettled(assets.map(path => cache.add(path)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('ekiti-v2-') && key !== CACHE)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin ||
      url.pathname.startsWith('/api/') ||
      request.method !== 'GET') return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(SHELL, response.clone());
        }
        return response;
      } catch {
        return await caches.match(SHELL) ||
          Response.error();
      }
    })());
    return;
  }

  if (url.pathname.startsWith('/assets/') &&
      /\.(?:js|css|mjs|json|svg|png|webp|woff2?)$/.test(url.pathname)) {
    event.respondWith((async () => {
      const hit = await caches.match(request);
      if (hit) return hit;
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE);
        await cache.put(request, response.clone());
      }
      return response;
    })());
  }
});
