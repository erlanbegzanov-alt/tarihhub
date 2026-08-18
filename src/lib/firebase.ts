/**
 * Firebase bootstrap.
 *
 * The whole app must keep working with no Firebase project attached, so this
 * module never throws at import time: if any of the six `VITE_FIREBASE_*`
 * variables is missing or blank, `auth`, `db` and `storage` stay `null` and the
 * sign-in screen says so instead of crashing. Copy `.env.local.example` to
 * `.env.local` and fill it in to switch real sign-in on.
 */
import { initializeApp } from 'firebase/app'
import type { FirebaseApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import type { Auth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import type { FirebaseStorage } from 'firebase/storage'

const env = import.meta.env

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
}

/** True only when all six keys are present and non-blank. */
export const isFirebaseConfigured = Object.values(firebaseConfig).every(
  (value) => typeof value === 'string' && value.trim() !== '',
)

let app: FirebaseApp | null = null
let authInstance: Auth | null = null
let dbInstance: Firestore | null = null
let storageInstance: FirebaseStorage | null = null

if (isFirebaseConfigured) {
  try {
    app = initializeApp(firebaseConfig as Record<string, string>)
    authInstance = getAuth(app)
    dbInstance = getFirestore(app)
    storageInstance = getStorage(app)
  } catch (error) {
    // A malformed config (wrong project id, bad app id, …) must leave the
    // app importable so the sign-in screen can explain itself.
    console.warn('[tarihhub] Firebase failed to initialise, staying local-only.', error)
    app = null
    authInstance = null
    dbInstance = null
    storageInstance = null
  }
}

/** Firebase Auth, or `null` when Firebase is not configured / failed to start. */
export const auth = authInstance
/** Firestore, or `null` when Firebase is not configured / failed to start. */
export const db = dbInstance
/**
 * Firebase Storage, or `null` on the same terms as `db`.
 *
 * Only the teacher-hosted quiz mode uses it, for the photo a question can carry
 * (see `src/lib/kahoot.ts`); every call site treats `null` as "this question
 * simply has no photo" rather than an error, so an unconfigured app still runs.
 */
export const storage = storageInstance
/** True when sign-in and cloud sync are actually available. */
export const isFirebaseReady = authInstance !== null && dbInstance !== null
