/**
 * The screen a reader sees instead of nothing.
 *
 * Until now a thrown render error unmounted the whole React tree and left a
 * blank page: no message, no reload button, nothing to tell the reader whether
 * the app was broken or their connection was. That is the "сайт упал" the owner
 * kept reporting, and the most common cause was not even a bug in a screen —
 * it was a code file that no longer existed (see `isChunkLoadError`).
 *
 * Two of these are mounted. One at the root, around everything, which is the
 * difference between a blank page and a sentence. One inside each route, which
 * is the difference between "the timeline is broken" and "the app is broken" —
 * the screens are all `lazy()`, so a single failed chunk would otherwise take
 * the entire app down with it.
 *
 * A class component on purpose: `getDerivedStateFromError` has no hook
 * equivalent, not even in React 19. The root callbacks React 19 added
 * (`onUncaughtError`, `onCaughtError`) are reporting channels, not a fallback
 * UI, and they do not replace this.
 */
import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { LANG_STORAGE_KEY } from '../i18n/context'
import { s } from '../i18n/strings'
import type { Lang, LocalizedText } from '../data/types'
import { isChunkLoadError, reloadOnceForChunkError, report } from '../lib/report'

/**
 * The language, read straight from storage rather than from `useLang`.
 *
 * The root boundary renders *outside* `LanguageProvider` — it has to, or a
 * failure inside the provider itself would have nothing above it to catch it —
 * so there is no context to read here. Same key the provider uses, same
 * fallback, and the same guard: in a private window the `localStorage` getter
 * throws rather than returning null.
 */
function storedLang(): Lang {
  try {
    const stored = window.localStorage.getItem(LANG_STORAGE_KEY)
    return stored === 'ru' || stored === 'kz' ? stored : 'kz'
  } catch {
    return 'kz'
  }
}

interface Props {
  children: ReactNode
  /** Which part of the app this guards — goes into the report as `where`. */
  where: string
  /** `page` fills the viewport (the root); `screen` sits inside the shell. */
  variant?: 'page' | 'screen'
}

interface State {
  failed: boolean
  /** A reload is already on its way, so say that instead of showing an error. */
  reloading: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, reloading: false }

  static getDerivedStateFromError(error: unknown): State {
    // The reload itself is started in `componentDidCatch`, not here: this
    // method must stay a pure state computation, and React calls it during
    // rendering, where a side effect would run twice under StrictMode.
    return { failed: true, reloading: isChunkLoadError(error) }
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    report(this.props.where, error)
    if (info.componentStack) {
      // Separate from the error itself, so the first line of the report stays
      // the message — which is what anyone reads first.
      console.error('[tarihhub] component stack:', info.componentStack)
    }
    if (isChunkLoadError(error)) {
      // A missing chunk means this tab is running a build that no longer
      // exists on the server. One reload fixes it for good: `index.html` is
      // served `must-revalidate`, so the fresh load asks for the current file
      // names. If a reload has already been tried in this tab, fall through to
      // the message rather than loop.
      if (!reloadOnceForChunkError()) this.setState({ reloading: false })
    }
  }

  private reload = (): void => {
    window.location.reload()
  }

  private goHome = (): void => {
    // A plain assignment, not the router: the router is React, and React is
    // what just failed. This leaves the broken screen behind entirely.
    window.location.href = '/'
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children

    const lang = storedLang()
    const t = (text: LocalizedText) => text[lang]
    const page = this.props.variant === 'page'
    const title = this.state.reloading
      ? s.error.staleTitle
      : page
        ? s.error.appTitle
        : s.error.screenTitle

    return (
      <div
        role="alert"
        className={
          page
            ? 'grid min-h-dvh place-items-center bg-cream px-5'
            : 'grid min-h-[50vh] place-items-center px-5'
        }
      >
        <div className="w-full max-w-sm rounded-card bg-surface p-6 text-center shadow-soft ring-1 ring-line/60">
          <AlertTriangle className="mx-auto h-7 w-7 text-gold-ink" aria-hidden />
          <h1 className="mt-3.5 text-[18px] font-bold tracking-tight text-ink">{t(title)}</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
            {t(this.state.reloading ? s.error.staleBody : s.error.body)}
          </p>
          {!this.state.reloading && (
            <div className="mt-5 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={this.reload}
                className="focus-ring flex w-full items-center justify-center rounded-full bg-brand px-6 py-3 text-[15px] font-semibold text-white shadow-soft hover:bg-brand-dark"
              >
                {t(s.error.reload)}
              </button>
              {!page && (
                <button
                  type="button"
                  onClick={this.goHome}
                  className="focus-ring flex w-full items-center justify-center rounded-full px-6 py-3 text-[15px] font-semibold text-ink-soft ring-1 ring-line/60 hover:bg-cream"
                >
                  {t(s.error.home)}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }
}
