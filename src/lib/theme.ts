/**
 * Light / dark / system theme.
 *
 * Every colour in the app comes from a `--color-*` custom property, so the
 * whole UI re-themes by toggling one `dark` class on `<html>` — there is
 * nothing per-component to switch. The class is applied as a side effect of
 * importing this module (before React mounts) so the first paint is already
 * the right theme.
 */
import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'tarihhub_theme'

/** What the user picked. `'system'` follows the OS setting. */
export type ThemePreference = 'light' | 'dark' | 'system'
/** What that actually resolves to right now. */
export type ResolvedTheme = 'light' | 'dark'

/** Browser chrome tint per theme — kept in step with `--color-cream`. */
const THEME_COLOR: Record<ResolvedTheme, string> = {
  light: '#F7F3EA',
  dark: '#121917',
}

function readPreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system'
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw
  } catch {
    /* storage unavailable — fall through to the default */
  }
  return 'system'
}

function darkQuery(): MediaQueryList | null {
  if (typeof window === 'undefined' || !window.matchMedia) return null
  return window.matchMedia('(prefers-color-scheme: dark)')
}

function resolve(preference: ThemePreference): ResolvedTheme {
  if (preference !== 'system') return preference
  return darkQuery()?.matches ? 'dark' : 'light'
}

function apply(resolved: ResolvedTheme): void {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', resolved === 'dark')
  const meta = document.querySelector('meta[name="theme-color"]')
  meta?.setAttribute('content', THEME_COLOR[resolved])
}

let preference: ThemePreference = readPreference()
let resolved: ResolvedTheme = resolve(preference)

// Runs at import time, before React mounts, so there is no flash of the
// wrong theme on a cold load.
apply(resolved)

const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

function sync() {
  const next = resolve(preference)
  if (next === resolved) return
  resolved = next
  apply(resolved)
  emit()
}

// While the preference is 'system', the OS switching to night mode has to
// carry through live.
darkQuery()?.addEventListener('change', sync)

export function setTheme(next: ThemePreference): void {
  if (next === preference) return
  preference = next
  try {
    window.localStorage.setItem(STORAGE_KEY, next)
  } catch {
    /* storage unavailable — the in-memory choice still holds this session */
  }
  const nextResolved = resolve(next)
  if (nextResolved !== resolved) {
    resolved = nextResolved
    apply(resolved)
  }
  emit()
}

interface ThemeSnapshot {
  preference: ThemePreference
  resolved: ResolvedTheme
}

let snapshot: ThemeSnapshot = { preference, resolved }

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): ThemeSnapshot {
  // useSyncExternalStore compares by identity, so only rebuild when something
  // actually moved.
  if (snapshot.preference !== preference || snapshot.resolved !== resolved) {
    snapshot = { preference, resolved }
  }
  return snapshot
}

export function useTheme(): ThemeSnapshot & {
  setTheme: (next: ThemePreference) => void
} {
  const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return { ...current, setTheme }
}
