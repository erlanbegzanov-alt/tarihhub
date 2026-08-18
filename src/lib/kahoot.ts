/**
 * The teacher-hosted live quiz ("Кахут").
 *
 * Same constraint as the 1v1 duels in `battle.ts`: there is no server anywhere
 * in this project, so the *teacher's own browser* is the thing that drives a
 * live game forward. Every state change in a room is a write the host makes to
 * one document; the students only ever read that document and write their own
 * row in a subcollection under it.
 *
 * Three collections (see `firestore.rules`, written around exactly this flow):
 *
 * - `kahootGames/{gameId}`   — an authored quiz. Fully private to the teacher
 *   who owns it, *including from their own students*: the answers live here, so
 *   a student who could read this collection could read the answer key
 *   mid-game straight out of Firestore. Nobody but `hostUid` ever touches it.
 * - `kahootSessions/{code}`  — one live room, keyed by the join code students
 *   type. Readable by any signed-in user, writable only by the host. Because
 *   the host is the only writer, `currentQuestion` can be trusted by everyone
 *   reading it — and it deliberately carries no `correctIndex`. The answer is
 *   published separately, as `revealedCorrectIndex`, only when the host flips
 *   the room to `reveal`.
 * - `kahootSessions/{code}/players/{uid}` — one row per student, so each one
 *   writes only their own. Scores are self-reported, exactly like each duelist
 *   reports their own `xp` in `battle.ts` — the same trust model, not a
 *   stricter one.
 *
 * Like every other module that touches Firebase, nothing here throws when the
 * app runs unconfigured: `db` is `null`, every call turns into a no-op, and the
 * screens show their "not available" state instead of crashing.
 */
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { db, storage } from './firebase'

/* ------------------------------ the rules ------------------------------ */

/** Answer options per question — fixed, like the duel questions. */
export const KAHOOT_OPTIONS = 4

/**
 * Seconds a question stays open.
 *
 * Longer than a duel's 12 (`QUESTION_SECONDS`) because a teacher's question may
 * carry a photo that has to be looked at, and a whole class has to keep up.
 * The scoring is *not* stretched to match: `answerXp` clamps its speed bonus at
 * the duel's own window, so the extra seconds are reading time rather than a
 * way to out-earn a duel.
 */
export const KAHOOT_QUESTION_SECONDS = 20

/** Characters in a join code. */
export const KAHOOT_CODE_LENGTH = 6

/**
 * Join-code alphabet, with every character a person could misread dropped:
 * no `0`/`O`, no `1`/`I`/`L`. The code gets read off a projector and typed on a
 * phone, so an ambiguous glyph is a failed join.
 */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/** How many fresh codes to try before giving up on a collision. */
const CODE_ATTEMPTS = 6

/** Biggest question photo accepted, before any upload is attempted. */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024

/* -------------------------------- shapes -------------------------------- */

export interface KahootQuestion {
  id: string
  text: string
  /** `null` until a photo is uploaded, and again if the teacher removes it. */
  photoURL: string | null
  options: string[]
  correctIndex: number
}

export interface KahootGame {
  id: string
  hostUid: string
  title: string
  questions: KahootQuestion[]
  createdAt: number
}

export type KahootStatus = 'lobby' | 'question' | 'reveal' | 'done'

/** The public half of a question: what students are allowed to see while it is
 *  open. Deliberately has no `correctIndex` — see the file header. */
export interface KahootLiveQuestion {
  text: string
  photoURL: string | null
  options: string[]
}

export interface KahootSession {
  /** Doc id — the join code itself. */
  code: string
  gameId: string
  hostUid: string
  title: string
  status: KahootStatus
  questionIndex: number
  currentQuestion: KahootLiveQuestion | null
  /** Set by the host only on the way into `reveal`; `null` at every other time. */
  revealedCorrectIndex: number | null
  totalQuestions: number
  createdAt: number
  /**
   * Stamped by the host the instant it opens a question, so every client
   * derives the same countdown from the same instant instead of each starting
   * its own timer whenever its snapshot happened to arrive.
   */
  questionStartedAt: number | null
}

export interface KahootPlayer {
  uid: string
  displayName: string
  photoURL: string
  score: number
  /** Option picked for the question that was open; `-1` when the clock ran out. */
  lastAnswerIndex: number | null
  lastAnswerAt: number | null
  joinedAt: number
}

/* ------------------------------ authoring ------------------------------ */

function randomId(length: number, alphabet: string): string {
  const values = new Uint32Array(length)
  crypto.getRandomValues(values)
  let out = ''
  for (const value of values) out += alphabet[value % alphabet.length]
  return out
}

/** A fresh join code. Uniqueness is proved against Firestore, not assumed. */
function newCode(): string {
  return randomId(KAHOOT_CODE_LENGTH, CODE_ALPHABET)
}

/**
 * What a student typed, turned into something that could be a real code:
 * upper-cased, with every character the alphabet doesn't contain dropped.
 * Typing a lowercase `k` or pasting the code with a space around it has to
 * work — the code is read aloud off a board, not copied.
 */
export function normalizeCode(raw: string): string {
  return [...raw.toUpperCase()]
    .filter((character) => CODE_ALPHABET.includes(character))
    .join('')
    .slice(0, KAHOOT_CODE_LENGTH)
}

/**
 * A new game id, handed out *before* the game is first saved.
 *
 * Photos upload into `kahootPhotos/{uid}/{gameId}/…`, and a teacher can attach
 * one to the very first question of a game they haven't saved yet — so the id
 * has to exist from the moment the form opens.
 */
export function newGameId(): string {
  if (!db) return randomId(20, 'abcdefghijklmnopqrstuvwxyz0123456789')
  return doc(collection(db, 'kahootGames')).id
}

export function newQuestionId(): string {
  return randomId(10, 'abcdefghijklmnopqrstuvwxyz0123456789')
}

export function emptyQuestion(): KahootQuestion {
  return {
    id: newQuestionId(),
    text: '',
    photoURL: null,
    options: Array.from({ length: KAHOOT_OPTIONS }, () => ''),
    correctIndex: 0,
  }
}

/** What is wrong with a game that can't be published yet. `index` is the
 *  question it applies to, or `-1` when the problem is the game as a whole. */
export interface KahootFlaw {
  reason: 'title' | 'noQuestions' | 'text' | 'options' | 'correct'
  index: number
}

/** First reason this game can't go live, or `null` when it is ready. */
export function findFlaw(title: string, questions: KahootQuestion[]): KahootFlaw | null {
  if (!title.trim()) return { reason: 'title', index: -1 }
  if (questions.length === 0) return { reason: 'noQuestions', index: -1 }
  for (const [index, question] of questions.entries()) {
    if (!question.text.trim()) return { reason: 'text', index }
    if (
      question.options.length !== KAHOOT_OPTIONS ||
      question.options.some((option) => !option.trim())
    ) {
      return { reason: 'options', index }
    }
    if (
      !Number.isInteger(question.correctIndex) ||
      question.correctIndex < 0 ||
      question.correctIndex >= KAHOOT_OPTIONS
    ) {
      return { reason: 'correct', index }
    }
  }
  return null
}

/* ------------------------------ normalising ------------------------------ */

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

function nullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizeQuestion(value: unknown): KahootQuestion {
  const data = (value ?? {}) as Record<string, unknown>
  const options = Array.isArray(data.options) ? data.options : []
  return {
    id: stringOr(data.id, newQuestionId()),
    text: stringOr(data.text, ''),
    photoURL: typeof data.photoURL === 'string' && data.photoURL ? data.photoURL : null,
    options: Array.from({ length: KAHOOT_OPTIONS }, (_, index) =>
      stringOr(options[index], ''),
    ),
    correctIndex: Math.max(
      0,
      Math.min(KAHOOT_OPTIONS - 1, Math.round(numberOr(data.correctIndex, 0))),
    ),
  }
}

function normalizeGame(id: string, value: unknown): KahootGame {
  const data = (value ?? {}) as Record<string, unknown>
  const questions = Array.isArray(data.questions) ? data.questions : []
  return {
    id,
    hostUid: stringOr(data.hostUid, ''),
    title: stringOr(data.title, ''),
    questions: questions.map(normalizeQuestion),
    createdAt: numberOr(data.createdAt, 0),
  }
}

function normalizeStatus(value: unknown): KahootStatus {
  return value === 'question' || value === 'reveal' || value === 'done'
    ? value
    : 'lobby'
}

function normalizeLiveQuestion(value: unknown): KahootLiveQuestion | null {
  if (!value || typeof value !== 'object') return null
  const data = value as Record<string, unknown>
  const options = Array.isArray(data.options) ? data.options : []
  return {
    text: stringOr(data.text, ''),
    photoURL: typeof data.photoURL === 'string' && data.photoURL ? data.photoURL : null,
    options: Array.from({ length: KAHOOT_OPTIONS }, (_, index) =>
      stringOr(options[index], ''),
    ),
  }
}

function normalizeSession(code: string, value: unknown): KahootSession | null {
  const data = (value ?? {}) as Record<string, unknown>
  const hostUid = stringOr(data.hostUid, '')
  // A room with no host is not a room — nobody can ever move it forward.
  if (!hostUid) return null
  return {
    code,
    gameId: stringOr(data.gameId, ''),
    hostUid,
    title: stringOr(data.title, ''),
    status: normalizeStatus(data.status),
    questionIndex: Math.max(0, Math.round(numberOr(data.questionIndex, 0))),
    currentQuestion: normalizeLiveQuestion(data.currentQuestion),
    revealedCorrectIndex: nullableNumber(data.revealedCorrectIndex),
    totalQuestions: Math.max(0, Math.round(numberOr(data.totalQuestions, 0))),
    createdAt: numberOr(data.createdAt, 0),
    questionStartedAt: nullableNumber(data.questionStartedAt),
  }
}

function normalizePlayer(uid: string, value: unknown): KahootPlayer {
  const data = (value ?? {}) as Record<string, unknown>
  return {
    uid,
    displayName: stringOr(data.displayName, ''),
    photoURL: stringOr(data.photoURL, ''),
    score: Math.max(0, Math.round(numberOr(data.score, 0))),
    lastAnswerIndex: nullableNumber(data.lastAnswerIndex),
    lastAnswerAt: nullableNumber(data.lastAnswerAt),
    joinedAt: numberOr(data.joinedAt, 0),
  }
}

/** Highest score first, then whoever got there earliest. */
export function byScore(a: KahootPlayer, b: KahootPlayer): number {
  return b.score - a.score || a.joinedAt - b.joinedAt
}

/* ------------------------------- the games ------------------------------- */

/**
 * Every game this teacher owns.
 *
 * Sorted here rather than in the query on purpose: an equality filter combined
 * with an `orderBy` on another field would need a composite index deployed
 * alongside the rules, and one teacher's game list is a handful of documents.
 */
export async function fetchMyGames(uid: string): Promise<KahootGame[]> {
  if (!db) return []
  try {
    const snapshot = await getDocs(
      query(collection(db, 'kahootGames'), where('hostUid', '==', uid), limit(50)),
    )
    return snapshot.docs
      .map((entry) => normalizeGame(entry.id, entry.data()))
      .sort((a, b) => b.createdAt - a.createdAt)
  } catch (error) {
    console.warn('[tarihhub] Could not read the kahoot games.', error)
    return []
  }
}

export async function fetchGame(gameId: string): Promise<KahootGame | null> {
  if (!db) return null
  try {
    const snapshot = await getDoc(doc(db, 'kahootGames', gameId))
    if (!snapshot.exists()) return null
    return normalizeGame(snapshot.id, snapshot.data())
  } catch (error) {
    console.warn('[tarihhub] Could not read a kahoot game.', error)
    return null
  }
}

/** Writes a game whole, under an id the caller already holds. Returns success. */
export async function saveGame(game: KahootGame): Promise<boolean> {
  if (!db) return false
  try {
    await setDoc(doc(db, 'kahootGames', game.id), {
      hostUid: game.hostUid,
      title: game.title.trim(),
      questions: game.questions.map((question) => ({
        id: question.id,
        text: question.text.trim(),
        photoURL: question.photoURL,
        options: question.options.map((option) => option.trim()),
        correctIndex: question.correctIndex,
      })),
      createdAt: game.createdAt,
    })
    return true
  } catch (error) {
    console.warn('[tarihhub] Could not save the kahoot game.', error)
    return false
  }
}

export async function deleteGame(gameId: string): Promise<void> {
  if (!db) return
  try {
    await deleteDoc(doc(db, 'kahootGames', gameId))
  } catch (error) {
    console.warn('[tarihhub] Could not delete the kahoot game.', error)
  }
}

/* -------------------------------- photos -------------------------------- */

/**
 * Uploads one question photo and returns its public URL, or `null` when the
 * upload could not happen at all.
 *
 * Failing is a normal outcome, not an error state: a question is perfectly
 * publishable without a photo, so the caller shows a note and carries on.
 */
export async function uploadQuestionPhoto(
  uid: string,
  gameId: string,
  questionId: string,
  file: File,
): Promise<string | null> {
  if (!storage) return null
  try {
    const target = ref(storage, `kahootPhotos/${uid}/${gameId}/${questionId}`)
    await uploadBytes(target, file, { contentType: file.type || 'image/jpeg' })
    return await getDownloadURL(target)
  } catch (error) {
    console.warn('[tarihhub] Could not upload the question photo.', error)
    return null
  }
}

/* ------------------------------- the room ------------------------------- */

/** True when no room is using this code. */
async function codeIsFree(code: string): Promise<boolean> {
  if (!db) return false
  const snapshot = await getDoc(doc(db, 'kahootSessions', code))
  return !snapshot.exists()
}

/**
 * Opens a live room for `game` and returns its join code.
 *
 * The code is the document id, so a collision is simply a document that is
 * already there — checked before writing, and retried with a fresh code.
 * `null` means every attempt collided or the write was refused.
 */
export async function createSession(game: KahootGame): Promise<string | null> {
  if (!db) return null
  try {
    for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt += 1) {
      const code = newCode()
      if (!(await codeIsFree(code))) continue
      await setDoc(doc(db, 'kahootSessions', code), {
        gameId: game.id,
        hostUid: game.hostUid,
        title: game.title,
        status: 'lobby',
        questionIndex: 0,
        currentQuestion: null,
        revealedCorrectIndex: null,
        totalQuestions: game.questions.length,
        createdAt: Date.now(),
        questionStartedAt: null,
      })
      return code
    }
  } catch (error) {
    console.warn('[tarihhub] Could not open the kahoot room.', error)
  }
  return null
}

export async function fetchSession(code: string): Promise<KahootSession | null> {
  if (!db) return null
  try {
    const snapshot = await getDoc(doc(db, 'kahootSessions', code))
    if (!snapshot.exists()) return null
    return normalizeSession(snapshot.id, snapshot.data())
  } catch (error) {
    console.warn('[tarihhub] Could not read the kahoot room.', error)
    return null
  }
}

/** Live view of the room. Fires on every move the host makes. */
export function watchSession(
  code: string,
  onChange: (session: KahootSession | null) => void,
): () => void {
  if (!db) return () => {}
  return onSnapshot(
    doc(db, 'kahootSessions', code),
    (snapshot) => {
      onChange(snapshot.exists() ? normalizeSession(snapshot.id, snapshot.data()) : null)
    },
    (error) => console.warn('[tarihhub] Kahoot room listener failed.', error),
  )
}

/** Live view of everyone in the room, already sorted for a leaderboard. */
export function watchPlayers(
  code: string,
  onChange: (players: KahootPlayer[]) => void,
): () => void {
  if (!db) return () => {}
  return onSnapshot(
    collection(db, 'kahootSessions', code, 'players'),
    (snapshot) => {
      onChange(
        snapshot.docs
          .map((entry) => normalizePlayer(entry.id, entry.data()))
          .sort(byScore),
      )
    },
    (error) => console.warn('[tarihhub] Kahoot player listener failed.', error),
  )
}

/* ------------------------- the host's four moves ------------------------- */

/**
 * Opens question `index`, publishing only the half students may see.
 *
 * `correctIndex` is deliberately dropped here: while a question is open the
 * answer exists nowhere a student can reach, not even by reading Firestore
 * directly. `questionStartedAt` is what every client's countdown is measured
 * from, so it is stamped in the same write that opens the question.
 */
export async function openQuestion(
  code: string,
  question: KahootQuestion,
  index: number,
): Promise<void> {
  if (!db) return
  try {
    await updateDoc(doc(db, 'kahootSessions', code), {
      status: 'question',
      questionIndex: index,
      currentQuestion: {
        text: question.text,
        photoURL: question.photoURL,
        options: question.options,
      },
      revealedCorrectIndex: null,
      questionStartedAt: Date.now(),
    })
  } catch (error) {
    console.warn('[tarihhub] Could not open the kahoot question.', error)
  }
}

/** Publishes the answer to the question that is open. */
export async function revealAnswer(code: string, correctIndex: number): Promise<void> {
  if (!db) return
  try {
    await updateDoc(doc(db, 'kahootSessions', code), {
      status: 'reveal',
      revealedCorrectIndex: correctIndex,
    })
  } catch (error) {
    console.warn('[tarihhub] Could not reveal the kahoot answer.', error)
  }
}

/** Ends the game. The players subcollection stays, so the board is still there. */
export async function finishSession(code: string): Promise<void> {
  if (!db) return
  try {
    await updateDoc(doc(db, 'kahootSessions', code), {
      status: 'done',
      currentQuestion: null,
    })
  } catch (error) {
    console.warn('[tarihhub] Could not finish the kahoot game.', error)
  }
}

/**
 * Closes the room for good: every player row first, then the room itself.
 *
 * Firestore does not delete a subcollection with its parent, and there is no
 * server to sweep up afterwards, so the host — the only account the rules let
 * delete another user's player row — does it on the way out.
 */
export async function closeSession(code: string): Promise<void> {
  if (!db) return
  const database = db
  try {
    const players = await getDocs(collection(database, 'kahootSessions', code, 'players'))
    await Promise.all(players.docs.map((entry) => deleteDoc(entry.ref)))
    await deleteDoc(doc(database, 'kahootSessions', code))
  } catch (error) {
    console.warn('[tarihhub] Could not close the kahoot room.', error)
  }
}

/* ----------------------------- the students ----------------------------- */

export interface KahootJoinMeta {
  displayName: string
  photoURL: string
}

/** Writes this student's own row into the room. Returns success. */
export async function joinSession(
  code: string,
  uid: string,
  meta: KahootJoinMeta,
): Promise<boolean> {
  if (!db) return false
  try {
    await setDoc(doc(db, 'kahootSessions', code, 'players', uid), {
      uid,
      displayName: meta.displayName,
      photoURL: meta.photoURL,
      score: 0,
      lastAnswerIndex: null,
      lastAnswerAt: null,
      joinedAt: Date.now(),
    })
    return true
  } catch (error) {
    console.warn('[tarihhub] Could not join the kahoot room.', error)
    return false
  }
}

/**
 * Records which option this student picked, and when.
 *
 * The score is *not* written here — it can't be. While a question is open the
 * correct answer isn't published yet, so nobody, including the student's own
 * client, can tell whether they were right. `answeredAt` is kept so the speed
 * bonus can be worked out at reveal time from an instant that was recorded
 * while the clock was still running.
 */
export async function submitAnswer(
  code: string,
  uid: string,
  answerIndex: number,
): Promise<void> {
  if (!db) return
  try {
    await updateDoc(doc(db, 'kahootSessions', code, 'players', uid), {
      lastAnswerIndex: answerIndex,
      lastAnswerAt: Date.now(),
    })
  } catch (error) {
    console.warn('[tarihhub] Could not send the kahoot answer.', error)
  }
}

/** Writes this student's own running total, once the answer has been revealed. */
export async function pushScore(
  code: string,
  uid: string,
  score: number,
): Promise<void> {
  if (!db) return
  try {
    await updateDoc(doc(db, 'kahootSessions', code, 'players', uid), {
      score: Math.max(0, Math.round(score)),
    })
  } catch (error) {
    console.warn('[tarihhub] Could not save the kahoot score.', error)
  }
}

/* -------------------------------- timing -------------------------------- */

/**
 * Seconds still on the clock for the question the host opened at `startedAt`.
 *
 * Every client works this out from the host's stamp rather than from a timer it
 * started when its own snapshot arrived, so a slow connection doesn't hand one
 * student a longer question than the rest of the class. Clamped at both ends:
 * a device whose clock is badly off gets a short or full window, never a
 * negative one or a bonus it didn't earn.
 */
export function secondsLeft(startedAt: number | null, now: number = Date.now()): number {
  if (startedAt === null) return KAHOOT_QUESTION_SECONDS
  const elapsed = (now - startedAt) / 1000
  return Math.max(0, Math.min(KAHOOT_QUESTION_SECONDS, KAHOOT_QUESTION_SECONDS - elapsed))
}

/** Whether this player has answered the question that opened at `startedAt`. */
export function hasAnswered(player: KahootPlayer, startedAt: number | null): boolean {
  if (startedAt === null || player.lastAnswerAt === null) return false
  return player.lastAnswerAt >= startedAt
}
