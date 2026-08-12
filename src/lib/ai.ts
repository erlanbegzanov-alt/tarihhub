import type { CannedKey, Lang, Person } from '../data/types'

export const API_KEY_STORAGE = 'tarihhub_gemini_key'

/**
 * `gemini-2.0-flash` is on Google's free tier (a Google AI Studio key needs no
 * billing setup) and — unlike the 2.5 "thinking" variants — has no internal
 * reasoning phase, so the whole output budget is spent on the actual reply.
 */
const MODEL = 'gemini-2.0-flash'
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

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
 * API key storage (browser-local only)
 * ------------------------------------------------------------------ */

export function getApiKey(): string {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(API_KEY_STORAGE) ?? ''
}

export function setApiKey(key: string): void {
  const trimmed = key.trim()
  if (trimmed) window.localStorage.setItem(API_KEY_STORAGE, trimmed)
  else window.localStorage.removeItem(API_KEY_STORAGE)
}

export function clearApiKey(): void {
  window.localStorage.removeItem(API_KEY_STORAGE)
}

export function hasApiKey(): boolean {
  return getApiKey().length > 0
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

/** Realistic typing pause so the demo chat feels alive without an API key. */
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
 * Google Gemini generateContent API
 * ------------------------------------------------------------------ */

function buildSystemPrompt(persona: Person, lang: Lang): string {
  const langName = lang === 'kz' ? 'қазақ тілінде (Kazakh)' : 'на русском языке (Russian)'
  return [
    `You are the historical figure ${persona.name.ru} (${persona.name.kz}) — ${persona.role.ru}.`,
    `Always answer in the first person, as if you are this person speaking today to a curious student.`,
    `Answer strictly ${langName}. Never switch languages.`,
    `Use simple, warm, concrete language — short sentences, no academic jargon. 2-5 sentences per answer.`,
    `Stay grounded in your real biography and the real history of Kazakhstan and the Great Steppe.`,
    `If you do not know something or it is outside your lifetime, say so plainly in character instead of inventing facts.`,
    `Never mention that you are an AI, a model, or a simulation.`,
    '',
    `Your biography (Kazakh): ${persona.bio.kz}`,
    `Your biography (Russian): ${persona.bio.ru}`,
    `Your era: ${persona.eraBadge.ru}. Your role: ${persona.role.ru}.`,
  ].join('\n')
}

interface GeminiPart {
  text?: string
}

interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] } }[]
}

async function callGemini(
  key: string,
  persona: Person,
  history: ChatTurn[],
  question: string,
  lang: Lang,
): Promise<string> {
  const response = await fetch(
    `${GEMINI_ENDPOINT}?key=${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        // Persona grounding goes in `systemInstruction`, not the transcript, so
        // it stays out of the conversation the model is continuing.
        systemInstruction: {
          parts: [{ text: buildSystemPrompt(persona, lang) }],
        },
        contents: [
          ...history.slice(-10).map((turn) => ({
            // Gemini calls the assistant side "model".
            role: turn.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: turn.content }],
          })),
          { role: 'user', parts: [{ text: question }] },
        ],
        generationConfig: {
          // Budget for a 2-5 sentence in-character reply. The model has no
          // internal reasoning phase (see MODEL), so every token here is spent
          // on the answer itself rather than on thinking that never gets shown.
          maxOutputTokens: 700,
          temperature: 0.8,
        },
      }),
    },
  )

  if (!response.ok) {
    throw new Error(`Gemini API error ${response.status}`)
  }

  const data = (await response.json()) as GeminiResponse
  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .map((part) => part.text)
    .filter((part): part is string => Boolean(part))
    .join('\n')
    .trim()

  if (!text) throw new Error('Empty response from Gemini API')
  return text
}

/* ------------------------------------------------------------------ *
 * Public entry point
 * ------------------------------------------------------------------ */

/**
 * Ask a historical persona a question.
 *
 * Uses the Google Gemini generateContent API when a key is stored in
 * localStorage, and falls back to the scripted offline engine when there is no
 * key or the request fails, so the chat always answers. The returned `engine`
 * says which one actually replied — the UI uses it so a failing key can never
 * be presented to the user as a working Gemini connection.
 */
export async function askPersona(
  persona: Person,
  conversationHistory: ChatTurn[],
  question: string,
  lang: Lang,
): Promise<PersonaAnswer> {
  const key = getApiKey()
  if (key) {
    try {
      const text = await callGemini(
        key,
        persona,
        conversationHistory,
        question,
        lang,
      )
      return { text, engine: 'live' }
    } catch (error) {
      console.warn('[TarihHub] Falling back to scripted answers:', error)
    }
  }
  return { text: await scriptedAnswer(persona, question, lang), engine: 'demo' }
}
