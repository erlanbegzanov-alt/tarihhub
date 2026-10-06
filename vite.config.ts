import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// The `runtimeCaching[].urlPattern` functions below run inside the generated
// service worker, not here — workbox-build serializes them via `toString()`
// as-is into that file, so `self` resolves to the real ServiceWorkerGlobalScope
// at runtime even though this config itself builds under Node.
declare const self: { location: { origin: string } }

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // The contour and feature flags `src/lib/environment.ts` reads. Vite only
  // inlines a `VITE_` variable as a literal when it is actually set; an unset
  // one stays a runtime property lookup, which the bundler cannot fold — so
  // code behind a flag nobody set (every flag on production, by design) would
  // ship as dead weight instead of being dropped. Pinning each to its value,
  // or to '' when unset, makes every flag a build-time constant everywhere.
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  // The bundler still writes out a lazy screen's chunk even when the flag has
  // dropped every reference to it. Nothing can load such an orphan, but the
  // service worker precaches every file it finds, so without this each
  // production install would download the unfinished screens anyway.
  const isTest = env.VITE_APP_ENV === 'test'
  const teamBattleOn = isTest || env.VITE_FEATURE_TEAM_BATTLE === '1'
  const examMockOn = isTest || env.VITE_FEATURE_EXAM_MOCK === '1'
  const unfinishedChunks = [
    ...(teamBattleOn ? [] : ['**/Friends-*.js', '**/TeamBattle-*.js']),
    ...(examMockOn ? [] : ['**/ExamMock-*.js']),
  ]
  return {
    build: {
      rolldownOptions: {
        output: {
          // The quiz-question bank is imported by exactly two lazy screens —
          // Quiz and LessonDetail — and a dependency shared by two lazy
          // chunks gets hoisted into the entry. So ~2 MB of questions ended
          // up in the file every visitor downloads before the home screen
          // paints, on a phone, on school wifi, for a median session of one
          // visit.
          //
          // The `globIgnores` below already names `quiz-*.js` and has done
          // for a long time: this chunk is what the service-worker config has
          // been expecting all along. That rule simply stopped matching
          // anything when the chunking changed, and nothing failed — the
          // precache quietly grew instead.
          //
          // It was also 43 KB from a silent failure. Workbox skips any file
          // over `maximumFileSizeToCacheInBytes` (2 MB) without an error, and
          // the entry chunk had reached 2 054 060 bytes. One more screen and
          // the app shell would have dropped out of the offline precache with
          // nothing at all to show for it.
          advancedChunks: {
            groups: [
              // These two come FIRST and they are the whole trick. Grouping
              // a module pulls its dependencies in with it, and the first
              // attempt swallowed src/lib/shuffle.ts — which Home needs, via
              // the daily set, on every single load. The entry then imported
              // one tiny helper out of that 1.8 MB chunk, so the browser
              // preloaded all of it and the split bought nothing. Pinning
              // the shared modules to their own groups first keeps the quiz
              // group to the question data it is meant to hold.
              { name: 'shuffle', test: /[\\/]src[\\/]lib[\\/]shuffle\.ts$/ },
              { name: 'entQuestions', test: /[\\/]src[\\/]data[\\/]entQuestions\.ts$/ },
              {
                name: 'quiz',
                test: /[\\/]src[\\/]data[\\/](quiz|lessonQuestions|dateQuestions)\.ts$/,
              },
            ],
          },
        },
      },
    },
    define: {
      'import.meta.env.VITE_APP_ENV': JSON.stringify(env.VITE_APP_ENV ?? ''),
      'import.meta.env.VITE_FEATURE_TEAM_BATTLE': JSON.stringify(env.VITE_FEATURE_TEAM_BATTLE ?? ''),
      'import.meta.env.VITE_FEATURE_EXAM_MOCK': JSON.stringify(env.VITE_FEATURE_EXAM_MOCK ?? ''),
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        // src/main.tsx registers the worker itself, so that it can poll for an
        // update once a minute — the piece `autoUpdate` needs in a tab that
        // stays open for days and never navigates. Leaving this at 'auto' would
        // inject a second registration script alongside ours.
        injectRegister: null,
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
          maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
          // The two heaviest chunks — the full text of every lesson and the
          // whole quiz-question bank — are kept OUT of the install-time
          // precache (they alone were ~1.1 MB gzipped of a ~1.9 MB precache).
          // They still land in the cache the first time a lesson or quiz is
          // opened, via the same-origin `app-shell-cache` script rule below,
          // so offline-after-first-visit is unchanged; only the up-front
          // install download shrinks.
          globIgnores: ['**/lessons-*.js', '**/quiz-*.js', ...unfinishedChunks],
          runtimeCaching: [
            {
              // Portrait images (`public/portraits/*.webp`) keep a stable filename even
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
  }
})
