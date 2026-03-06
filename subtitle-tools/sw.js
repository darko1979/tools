'use strict';

const CACHE_NAME = 'subtitle-tools-v1';
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

// ── Activate: purge outdated caches ─────────────────────────────────────────
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
    );
});

// ── Fetch: cache-first, then network fallback ────────────────────────────────
self.addEventListener('fetch', event => {
    // Only handle same-origin GET requests; let everything else pass through
    const url = new URL(event.request.url);
    if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;

            return fetch(event.request).then(response => {
                // Cache successful responses for future offline use
                if (response && response.status === 200 && response.type === 'basic') {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            });
        })
    );
});
