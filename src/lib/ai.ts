import { auth } from './firebase'
import type { CannedKey, Lang, Person } from '../data/types'

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

/** Which engine actually produced an answer, so the UI can label the mode honestly. */
export type AnswerEngine = 'live' | 'demo'

export interface PersonaAnswer {
  text: string
  engine: AnswerEngine
}

/* ------------------------------------------------------------------ *
 * Offline scripted engine
 * ------------------------------------------------------------------ */

const INTENT_KEYWORDS: Record<Exclude<CannedKey, 'default'>, string[]> = {
  greeting: [
    'сәлем',
    'салем',
    'амансы',
    'ассалам',
    'сәлеметсіз',
    'кімсіз',
    'кім едіңіз',
    'привет',
    'здравств',
    'кто вы',
    'кто ты',
    'добрый',
    'hello',
    'hi ',
  ],
  bio: [
    'өмір',
    'туған',
    'туылған',
    'балалық',
    'қайда',
    'қашан',
    'өмірбаян',
    'жизн',
    'родил',
    'детств',
    'биограф',
    'кем был',
    'откуда',
    'когда вы',
  ],
  legacy: [
    'мұра',
    'қалды',
    'қалдырды',
    'жетістік',
    'ең маңызды',
    'атақты',
    'еңбег',
    'наслед',
    'остал',
    'достижен',
    'главн',
    'итог',
    'знамен',
    'известн',
  ],
}

function detectIntent(question: string): CannedKey {
  const q = question.toLowerCase()
  for (const key of ['greeting', 'bio', 'legacy'] as const) {
    if (INTENT_KEYWORDS[key].some((word) => q.includes(word))) return key
  }
  return 'default'
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Realistic typing pause so the demo chat feels alive when the proxy is unreachable. */
function typingDelay(): number {
  return 700 + Math.floor(Math.random() * 500)
}

async function scriptedAnswer(
  persona: Person,
  question: string,
  lang: Lang,
): Promise<string> {
  await delay(typingDelay())
  return persona.canned[detectIntent(question)][lang]
}

/* ------------------------------------------------------------------ *
 * Server-side Gemini proxy (api/gemini.ts)
 *
 * The system prompt (persona instructions, anti-injection rules) used to be
 * built right here and sent to the proxy as a plain string — which meant
 * anyone could call the endpoint directly and skip those instructions
 * entirely. It is now built server-side, from a fixed table keyed by
 * `personaId`/`mode`/`lang`; this module only ever sends those small
 * structured params plus the actual conversation turns.
 * ------------------------------------------------------------------ */

/**
 * The one call every live answer goes through — `api/gemini.ts`, never
 * Google's API directly. The key that used to live in this browser (one per
 * visitor, entered by hand) now lives only on the server, so what this sends
 * instead is proof of who's asking: the signed-in Firebase session's own ID
 * token. Sign-in is mandatory app-wide, so `auth.currentUser` is only ever
 * absent when Firebase itself isn't configured.
 */
async function callGeminiProxy(body: Record<string, unknown>): Promise<string> {
  const token = await auth?.currentUser?.getIdToken()
  if (!token) throw new Error('not-signed-in')

  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(`Gemini proxy error ${response.status}`)
  }

  const data = (await response.json()) as { text?: string }
  const text = typeof data.text === 'string' ? data.text.trim() : ''
  if (!text) throw new Error('Empty response from Gemini proxy')
  return text
}

async function callGemini(
  persona: Person,
  history: ChatTurn[],
  question: string,
  lang: Lang,
): Promise<string> {
  return callGeminiProxy({
    mode: 'persona',
    personaId: persona.id,
    lang,
    history: history.slice(-10),
    question,
  })
}

/* ------------------------------------------------------------------ *
 * Public entry point
 * ------------------------------------------------------------------ */

/**
 * Ask a historical persona a question.
 *
 * Tries the live proxy first and falls back to the scripted offline engine
 * when it fails (offline, the proxy down, a rate limit), so the chat always
 * answers. The returned `engine` says which one actually replied — the UI
 * uses it so a failed live call can never be presented as a working
 * connection.
 */
export async function askPersona(
  persona: Person,
  conversationHistory: ChatTurn[],
  question: string,
  lang: Lang,
): Promise<PersonaAnswer> {
  try {
    const text = await callGemini(persona, conversationHistory, question, lang)
    return { text, engine: 'live' }
  } catch (error) {
    console.warn('[TarihHub] Falling back to scripted answers:', error)
  }
  return { text: await scriptedAnswer(persona, question, lang), engine: 'demo' }
}

/* ------------------------------------------------------------------ *
 * In-lesson "explain simpler" hint
 * ------------------------------------------------------------------ */

/**
 * Rephrases one lesson section in simpler language, grounded strictly in its
 * own text. Unlike `askPersona`, there is no offline fallback: a lesson has
 * no pre-written "simple version" the way a persona has canned bio/legacy
 * answers, so this throws on failure and the caller (LessonDetail.tsx) shows
 * that plainly rather than faking an answer.
 */
export async function explainSection(
  heading: string,
  body: string,
  lang: Lang,
): Promise<string> {
  return callGeminiProxy({ mode: 'explain', lang, heading, body })
}
