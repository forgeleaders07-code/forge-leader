/*
 * Service worker minimal — requis pour rendre la plateforme installable
 * (PWA) sur Android et sur PC (Chrome/Edge). Il assure un fonctionnement
 * réseau normal et une petite page de repli hors-ligne.
 */
const CACHE = 'forge-shell-v1';
const OFFLINE_URL = '/';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(OFFLINE_URL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Navigation : réseau d'abord, repli sur le cache si hors-ligne. Le reste passe
// directement par le réseau (données toujours fraîches, sécurité préservée).
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
  }
});
