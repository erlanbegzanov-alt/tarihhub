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
  onAuthStateChanged,
  signInWithCredential,
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

/**
 * Takes the ID token Google Identity Services hands back (see `SignIn.tsx`'s
 * native Google button) and exchanges it for a Firebase session directly —
 * one client-side REST call, no popup and no cross-domain redirect. Both of
 * those were tried first and both turned out to be unreliable in practice:
 * popups silently failed across mobile browsers, and the redirect flow's
 * cross-origin handoff through Firebase's own auth-domain handler kept
 * resolving with nothing to complete, in Incognito and on real devices
 * alike, with no error to act on either way.
 */
export async function signInWithGoogleIdToken(idToken: string): Promise<void> {
  if (!auth) throw new Error('firebase-not-configured')
  await signInWithCredential(auth, GoogleAuthProvider.credential(idToken))
  // The auth listener above flips the gate to the app.
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
