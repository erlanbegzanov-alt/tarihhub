import { auth } from './firebase'
import { report } from './report'
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
  /** Set only when `engine` is `'demo'`: why no live answer arrived. */
  failure?: AiFailure
}

/**
 * Why a live answer did not arrive.
 *
 * All of these used to be one word — "demo mode". But a reader who has spent
 * today's fifty questions, a deployment with no `GEMINI_API_KEY` at all, and
 * Gemini itself being down are three different pieces of news, and whoever
 * has to fix it needs them apart most of all: the proxy already answers
 * 401 / 429 / 500 / 502 to say exactly which it is, and the client used to
 * read that number, format it into a message string, and throw the whole
 * thing away one line later.
 */
export type AiFailure =
  | 'signed-out'
  | 'limit'
  | 'unconfigured'
  | 'upstream'
  | 'timeout'
  | 'network'

/** An `Error` that still knows which of those it was. */
export class AiError extends Error {
  readonly reason: AiFailure

  constructor(reason: AiFailure, message: string) {
    super(message)
    this.name = 'AiError'
    this.reason = reason
  }
}

/**
 * The proxy's own codes, as `api/gemini.ts` returns them: 401 for a token it
 * would not accept, 429 for either daily cap, 500 for a missing API key — the
 * one 500 it raises deliberately — and 502 for every failure of Gemini
 * itself. Anything unmapped reads as upstream, which is the honest reading of
 * "the server answered, badly".
 *
 * Exported for its own test. This map is the whole difference between telling
 * a reader to come back tomorrow and telling them the server was deployed
 * without a key, and getting a line of it wrong is invisible from outside.
 */
export function reasonFromStatus(status: number): AiFailure {
  if (status === 401 || status === 403) return 'signed-out'
  if (status === 429) return 'limit'
  if (status === 500) return 'unconfigured'
  return 'upstream'
}

/**
 * How long to wait for the answer to *start*.
 *
 * Must stay above the proxy's own first-token budget (FIRST_PIECE_BUDGET_MS
 * in api/gemini.ts), or this deadline fires first and the server's log never
 * gets to record how long the model actually took — which is the measurement
 * currently missing. Wide and temporary for the same reason it is wide there;
 * it comes down with it.
 */
const FIRST_BYTE_TIMEOUT_MS = 50_000
/** How long a silence *inside* an answer may last before the stream counts as
 *  dead. Reset by every chunk, so a long reply is never cut off. */
const STREAM_GAP_TIMEOUT_MS = 15_000

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
async function callGeminiProxy(
  body: Record<string, unknown>,
  /**
   * Called with the answer so far, every time more of it arrives. The whole
   * reply takes the same time either way — what changes is that the reader
   * sees it being written instead of watching three dots and deciding the
   * chat is broken.
   */
  onDelta?: (soFar: string) => void,
): Promise<string> {
  const token = await auth?.currentUser?.getIdToken()
  if (!token) throw new AiError('signed-out', 'no signed-in user')

  /*
   * A deadline on silence, not on the answer.
   *
   * There was no bound of any kind here, and the hole that left was not the
   * request — it was the stream. A phone that loses signal halfway through a
   * reply leaves `reader.read()` below pending forever: no error, no
   * rejection, the composer stays locked and the only way out is reloading
   * the page. A plain total timeout cannot close that without also cutting
   * off long legitimate answers, so the timer is pushed forward by every
   * chunk that arrives — a live stream keeps renewing it, a dead one trips
   * it.
   */
  const controller = new AbortController()
  let timer = setTimeout(() => controller.abort(), FIRST_BYTE_TIMEOUT_MS)
  const waitAgain = (ms: number) => {
    clearTimeout(timer)
    timer = setTimeout(() => controller.abort(), ms)
  }
  /** Which of the two it was, told apart by who pulled the plug. */
  const stalled = () =>
    controller.signal.aborted
      ? new AiError('timeout', 'the proxy went quiet')
      : new AiError('network', 'the connection dropped')

  let response: Response
  try {
    response = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch {
    clearTimeout(timer)
    throw stalled()
  }

  if (!response.ok) {
    clearTimeout(timer)
    throw new AiError(reasonFromStatus(response.status), `proxy ${response.status}`)
  }

  // Both shapes have to work. The proxy streams when the upstream lets it and
  // answers with one JSON body when it cannot, and a deploy can briefly leave
  // one side older than the other — the chat must not break in that window.
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('text/event-stream') || !response.body) {
    let data: { text?: string }
    try {
      data = (await response.json()) as { text?: string }
    } catch {
      clearTimeout(timer)
      throw stalled()
    }
    clearTimeout(timer)
    const text = typeof data.text === 'string' ? data.text.trim() : ''
    if (!text) throw new AiError('upstream', 'the proxy answered with no text')
    return text
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let carry = ''
  let text = ''
  for (;;) {
    let chunk: Awaited<ReturnType<typeof reader.read>>
    try {
      chunk = await reader.read()
    } catch {
      clearTimeout(timer)
      throw stalled()
    }
    if (chunk.done) break
    // More bytes arrived, so the stream is alive: push the deadline out.
    waitAgain(STREAM_GAP_TIMEOUT_MS)
    carry += decoder.decode(chunk.value, { stream: true })
    const lines = carry.split('\n')
    // A chunk boundary can land inside an event, so the unfinished tail waits
    // for the next read rather than being parsed and thrown away.
    carry = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trim()
      if (!payload || payload === '[DONE]') continue
      try {
        const piece = (JSON.parse(payload) as { t?: string }).t
        if (typeof piece === 'string' && piece) {
          text += piece
          onDelta?.(text)
        }
      } catch {
        // Not a complete event yet; ignore and let the carry handle it.
      }
    }
  }

  clearTimeout(timer)
  const trimmed = text.trim()
  if (!trimmed) throw new AiError('upstream', 'the proxy answered with no text')
  return trimmed
}

async function callGemini(
  persona: Person,
  history: ChatTurn[],
  question: string,
  lang: Lang,
  onDelta?: (soFar: string) => void,
): Promise<string> {
  return callGeminiProxy(
    {
      mode: 'persona',
      personaId: persona.id,
      lang,
      history: history.slice(-10),
      question,
    },
    onDelta,
  )
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
  /** Optional: the answer so far, as it is written. See `callGeminiProxy`. */
  onDelta?: (soFar: string) => void,
): Promise<PersonaAnswer> {
  try {
    const text = await callGemini(persona, conversationHistory, question, lang, onDelta)
    return { text, engine: 'live' }
  } catch (error) {
    // Reported, not merely logged. This is the one failure in the app that is
    // *designed* to look like success — the reader still gets a plausible
    // in-character answer — so without a trace here, "the AI fell over again"
    // leaves nothing behind to read afterwards. `report` keeps the last
    // twenty in sessionStorage for exactly that.
    report('ai.persona', error)
    return {
      text: await scriptedAnswer(persona, question, lang),
      engine: 'demo',
      failure: error instanceof AiError ? error.reason : 'network',
    }
  }
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
