const CACHE_NAME = 'dungeons-shell-v3';
const BASE_URL = new URL('./', self.location.href);
const APP_ASSETS = [
    'index.html',
    'privacy.html',
    'manifest.webmanifest',
    'icons/dungeon-logo-d.png',
    'icons/dungeon-192.png',
    'icons/dungeon-512.png',
    'wiyotl_logo.webp',
    'js/supabase-config.js',
    'js/loading-screen.js',
    'js/game-utils.js',
    'js/secondary-missions.js',
    'js/game-core.js',
    'js/save-progression.js',
    'js/game-runtime.js',
    'js/cloud-save.js',
    'js/onboarding.js',
    'js/pwa.js'
].map(path => new URL(path, BASE_URL).href);

self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE_NAME)
        .then(cache => cache.addAll(APP_ASSETS))
        .then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
    event.waitUntil(caches.keys()
        .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
        .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);
    if (request.method !== 'GET' || url.origin !== self.location.origin) return;
    if (request.mode === 'navigate') {
        event.respondWith(fetch(request)
            .then(response => {
                const copy = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(new URL('index.html', BASE_URL), copy));
                return response;
            })
            .catch(async () => (await caches.match(new URL('index.html', BASE_URL))
                || Response.error())));
        return;
    }
    event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
});
