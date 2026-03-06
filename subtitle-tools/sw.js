'use strict';

const CACHE_NAME = 'subtitle-tools-v1.0.4';
const CORE_ASSETS = [
    './index.html',
    './manifest.json',
    './icons/icon.svg'
];

// ── Install: pre-cache core assets ──────────────────────────────────────────
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(CORE_ASSETS))
            .then(() => self.skipWaiting())
    );
});

// ── Activate: purge outdated caches, then notify clients ────────────────────
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys =>
                Promise.all(
                    keys
                        .filter(key => key !== CACHE_NAME)
                        .map(key => caches.delete(key))
                )
            )
            .then(() => self.clients.claim())
            .then(() =>
                // Tell every open tab that a new version has taken over
                self.clients.matchAll({ type: 'window' }).then(clients =>
                    clients.forEach(client => client.postMessage({ type: 'NEW_VERSION' }))
                )
            )
    );
});

// ── Message: allow the page to trigger immediate SW activation ───────────────
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// ── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
    // Only handle same-origin GET requests; let everything else pass through
    const url = new URL(event.request.url);
    if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
        return;
    }

    // Network-first for HTML navigation so a fresh deploy is always detected
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    if (response && response.status === 200) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    }
                    return response;
                })
                .catch(() => caches.match(event.request)) // offline fallback
        );
        return;
    }

    // Cache-first for all other assets (icons, manifest, etc.)
    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;

            return fetch(event.request).then(response => {
                if (response && response.status === 200 && response.type === 'basic') {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            });
        })
    );
});
