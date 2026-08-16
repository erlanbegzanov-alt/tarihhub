import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// The `runtimeCaching[].urlPattern` functions below run inside the generated
// service worker, not here — workbox-build serializes them via `toString()`
// as-is into that file, so `self` resolves to the real ServiceWorkerGlobalScope
// at runtime even though this config itself builds under Node.
declare const self: { location: { origin: string } }

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'TarihHub',
        short_name: 'TarihHub',
        description:
          'TarihHub — Қазақстан тарихын тірі оқыту: тарихи тұлғалармен AI арқылы сөйлесу, викториналар, уақыт сызығы және карта.',
        theme_color: '#F7F3EA',
        background_color: '#F7F3EA',
        display: 'standalone',
        start_url: '/',
        lang: 'kk',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Default cap is 2 MiB; the course content (60+ bilingual lessons and
        // their quiz pools) pushes the main bundle past that. Raised well
        // above the current size so it doesn't need revisiting as more
        // lessons land.
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        runtimeCaching: [
          {
            // Portrait PNGs (`public/portraits/*.png`) keep a stable filename even
            // when the underlying image is regenerated — there's no content hash
            // in the URL to bust a stale cache. CacheFirst would then serve last
            // month's portrait forever (up to the 30-day/200-entry cap) even
            // after the real file on the server changes. StaleWhileRevalidate
            // still answers instantly from cache, but also revalidates against
            // the network in the background, so a changed portrait shows up on
            // the visitor's next reload instead of staying stuck.
            //
            // Scoped to our own origin: an unscoped `destination === 'image'`
            // match also caught the signed-in user's Google profile photo
            // (lh3.googleusercontent.com) — the service worker's own fetch
            // for that isn't covered by the CSP's img-src, only connect-src,
            // which doesn't list Google's domains, so the fetch got blocked
            // outright instead of just falling through to the network.
            urlPattern: ({ request, url }) =>
              url.origin === self.location.origin && request.destination === 'image',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
          {
            // Fonts are genuinely immutable once shipped, so CacheFirst (no
            // revalidation round-trip) is the right, cheaper choice here.
            urlPattern: ({ request, url }) =>
              url.origin === self.location.origin && request.destination === 'font',
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts-cache',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
          {
            // Same origin-scoping bug, but for scripts: an unscoped match here
            // caught Google's own `apis.google.com/js/api.js` (loaded by the
            // Firebase Auth SDK as part of finishing Google sign-in). The
            // service worker's fetch for it violated the CSP's connect-src
            // (which only allows script-src for that domain, not fetches),
            // so the request came back as a network error and broke sign-in
            // right after the visitor picked their Google account.
            urlPattern: ({ request, url }) =>
              url.origin === self.location.origin &&
              (request.destination === 'script' || request.destination === 'style'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'app-shell-cache',
            },
          },
        ],
      },
    }),
  ],
})
