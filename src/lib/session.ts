/**
 * Session gate: who the visitor is (a Firebase user or nobody yet) and which
 * of the three entry states the app should show — the intro tour, the sign-in
 * screen, or the app itself.
 *
 * Signing in with Google is mandatory: the app is only ever reachable with a
 * real account, so progress always has somewhere to sync.
 */
import {
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithRedirect,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { useSyncExternalStore } from 'react'
import { auth, isFirebaseReady } from './firebase'
import { startProfileSync, stopProfileSync } from './profileSync'

const ONBOARDED_KEY = 'tarihhub_onboarded'

export interface AuthUser {
  uid: string
  displayName: string
  photoURL: string
  email: string
}

export type SessionGate = 'loading' | 'onboarding' | 'signin' | 'app'

export interface SessionState {
  /** `null` until Firebase reports, then the user or `null` when signed out. */
  user: AuthUser | null
  /** False until the first `onAuthStateChanged` callback has run. */
  authResolved: boolean
  onboarded: boolean
  /**
   * Firebase error from a failed `signInWithRedirect` round trip, read once
   * by the sign-in screen after the visitor lands back on the site. `null`
   * on every load that isn't the tail end of a failed sign-in.
   */
  redirectError: { code: string; message: string } | null
}

function readFlag(key: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function writeFlag(key: string, value: boolean): void {
  try {
    if (value) window.localStorage.setItem(key, '1')
    else window.localStorage.removeItem(key)
  } catch {
    /* storage unavailable — the in-memory flag still carries this session */
  }
}

let state: SessionState = {
  user: null,
  // With no Firebase there is nothing to wait for: resolve immediately so the
  // gate never sits on a spinner.
  authResolved: !isFirebaseReady,
  onboarded: readFlag(ONBOARDED_KEY),
  redirectError: null,
}

const listeners = new Set<() => void>()

function set(patch: Partial<SessionState>) {
  state = { ...state, ...patch }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): SessionState {
  return state
}

export function useSession(): SessionState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/** Which screen the app root should render for the current session. */
export function sessionGate(session: SessionState): SessionGate {
  if (!session.authResolved) return 'loading'
  // A signed-in user is never sent back through the intro or the sign-in wall.
  if (session.user) return 'app'
  if (!session.onboarded) return 'onboarding'
  // Sign-in is mandatory: without an account there is no way past this wall.
  return 'signin'
}

if (auth) {
  // Catches a failed round trip through Google (denied consent, disallowed
  // domain, …) — `onAuthStateChanged` alone only ever reports "signed out",
  // never why, so the sign-in screen would otherwise fail silently.
  getRedirectResult(auth).catch((cause) => {
    const code =
      typeof cause === 'object' && cause !== null && 'code' in cause
        ? String((cause as { code: unknown }).code)
        : 'auth/unknown'
    const message =
      cause instanceof Error ? cause.message : String(cause)
    set({ redirectError: { code, message } })
  })

  onAuthStateChanged(auth, (firebaseUser) => {
    if (firebaseUser) {
      // Reaching a real account means the intro has served its purpose, even on
      // a device that restored the session before ever finishing the tour.
      writeFlag(ONBOARDED_KEY, true)
      set({
        authResolved: true,
        onboarded: true,
        user: {
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName ?? '',
          photoURL: firebaseUser.photoURL ?? '',
          email: firebaseUser.email ?? '',
        },
      })
      void startProfileSync(firebaseUser.uid)
    } else {
      stopProfileSync()
      set({ authResolved: true, user: null })
    }
  })
}

/* ------------------------------- actions ------------------------------- */

export function completeOnboarding(): void {
  writeFlag(ONBOARDED_KEY, true)
  set({ onboarded: true })
}

export async function signInWithGoogle(): Promise<void> {
  if (!auth) throw new Error('firebase-not-configured')
  // A full-page redirect rather than a popup: popups are unreliable across
  // mobile browsers and any desktop setup with strict third-party storage
  // limits, which was silently failing sign-in for real visitors. The result
  // is picked up by `getRedirectResult` above once Google sends the visitor
  // back, and the auth listener then flips the gate to the app.
  await signInWithRedirect(auth, new GoogleAuthProvider())
}

/** Overrides the display name shown in the app, on top of whatever Google supplied. */
export async function updateDisplayName(name: string): Promise<void> {
  if (!auth?.currentUser) throw new Error('not-signed-in')
  const trimmed = name.trim()
  if (!trimmed) return
  await updateProfile(auth.currentUser, { displayName: trimmed })
  // updateProfile doesn't re-fire onAuthStateChanged, so patch locally too.
  set({ user: state.user ? { ...state.user, displayName: trimmed } : state.user })
}

/** Signs out and returns the visitor to the sign-in screen (not the intro). */
export async function signOutUser(): Promise<void> {
  stopProfileSync()
  if (auth) await signOut(auth)
  else set({ user: null })
}
