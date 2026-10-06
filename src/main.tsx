import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
// Side-effect import: applies the stored (or system) theme to <html> before
// the first render, so there is no flash of the wrong theme.
import './lib/theme'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { installGlobalErrorReporting, report } from './lib/report'

// Before anything else, so a failure during startup has somewhere to go.
installGlobalErrorReporting()

/**
 * One minute, which is the missing half of the "stale cache" problem.
 *
 * The service worker is registered with `autoUpdate`, and that part works: when
 * a new worker activates, the generated register script reloads the page by
 * itself. What nothing did was *check*. A browser revalidates the worker script
 * on navigation, and a student's phone keeps the tab open for days without ever
 * navigating — so no check, no new worker, no reload, and a tab left running a
 * build whose files have been deleted from the server. Polling `update()` is
 * the piece that makes `autoUpdate` mean what it says.
 *
 * (Writing `onNeedRefresh` instead would have been dead code: under
 * `autoUpdate` the plugin tree-shakes the prompt branch out of the register
 * script entirely — it is readable in node_modules if ever in doubt.)
 */
const SW_UPDATE_INTERVAL_MS = 60_000

registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return
    window.setInterval(() => {
      // Offline, this rejects every minute. That is not a failure worth
      // reporting — it is the expected answer when there is no network — so it
      // is swallowed here rather than left to the global rejection handler.
      void registration.update().catch(() => {})
    }, SW_UPDATE_INTERVAL_MS)
  },
  onRegisterError(error) {
    report('sw.register', error)
  },
})

createRoot(document.getElementById('root')!, {
  // React 19's root-level channel for an error no boundary caught. It is a
  // *report*, not a fallback — the boundary below is what draws the screen.
  // Errors a boundary does catch are reported by that boundary, so
  // `onCaughtError` is deliberately left out: it would file every one twice.
  onUncaughtError(error) {
    report('react.uncaught', error)
  },
}).render(
  <StrictMode>
    {/* Outside App, so a throw inside LanguageProvider — which reads
        localStorage, and on some browsers that *throws* — still has something
        above it. */}
    <ErrorBoundary where="root" variant="page">
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
