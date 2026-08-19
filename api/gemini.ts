/// <reference types="node" />
/**
 * Server-side Gemini proxy.
 *
 * `GEMINI_API_KEY` lives only here (a Vercel-only env var, never `VITE_`-
 * prefixed) — the browser never sees it. Every visitor used to bring their
 * own free key (see the old `src/lib/ai.ts`); this replaces that with one
 * shared key so nobody has to find their own, while keeping it from being
 * readable in the page's JS bundle or network tab the way a client-side
 * constant or `VITE_GEMINI_API_KEY` would be.
 *
 * The one new risk a shared key introduces — anyone finding this URL and
 * spending it on the app's behalf — is closed by requiring a real signed-in
 * Firebase session: the caller sends its ID token, and this handler confirms
 * it with Google's own `accounts:lookup` endpoint before ever touching
 * Gemini. No `firebase-admin` needed for that one check, so this stays a
 * dependency-free function.
 *
 * The `{ fetch }` export (not `export default function handler(req, res)`)
 * is the Web-standard shape Vercel Functions expect outside a Next.js app —
 * this project is plain Vite, so that's the one that applies here.
 *
 * Model: `gemini-3.5-flash-lite`, not `gemini-3.6-flash`. The 3.6 model is
 * reasoning-first and always spends part of its token budget "thinking"
 * before answering — measured at 20-40s per reply here, even at the lowest
 * available thinking level. flash-lite ships with thinking off by default,
 * which is what actually removes that delay (verified directly against the
 * live API, since docs list several flash-lite generations inconsistently).
 * Answers are a bit shorter/plainer, which is fine for short in-character
 * replies and lesson rephrasing — this isn't a complex-reasoning use case.
 */
const MODEL = 'gemini-3.5-flash-lite'
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

const MAX_CONTENTS = 12
const MAX_TEXT_LENGTH = 4000

interface GeminiContent {
  role: 'user' | 'model'
  parts: { text: string }[]
}

interface RequestBody {
  systemPrompt: string
  contents: GeminiContent[]
  config?: { maxOutputTokens?: number; temperature?: number }
}

async function verifyFirebaseToken(idToken: string): Promise<boolean> {
  const webApiKey = process.env.VITE_FIREBASE_API_KEY
  if (!webApiKey) return false
  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${webApiKey}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ idToken }),
      },
    )
    if (!response.ok) return false
    const data = (await response.json()) as { users?: unknown[] }
    return Array.isArray(data.users) && data.users.length > 0
  } catch {
    return false
  }
}

/** Only the shape this endpoint actually accepts survives — anything else is
 *  a malformed or hostile request, not something to forward to Gemini. */
function validateBody(value: unknown): RequestBody | null {
  if (!value || typeof value !== 'object') return null
  const body = value as Partial<RequestBody>

  if (typeof body.systemPrompt !== 'string' || body.systemPrompt.length > MAX_TEXT_LENGTH) {
    return null
  }
  if (!Array.isArray(body.contents) || body.contents.length === 0 || body.contents.length > MAX_CONTENTS) {
    return null
  }
  for (const turn of body.contents) {
    if (
      !turn ||
      (turn.role !== 'user' && turn.role !== 'model') ||
      !Array.isArray(turn.parts) ||
      turn.parts.length === 0
    ) {
      return null
    }
    for (const part of turn.parts) {
      if (typeof part.text !== 'string' || part.text.length === 0 || part.text.length > MAX_TEXT_LENGTH) {
        return null
      }
    }
  }
  return body as RequestBody
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[]
}

export default {
  async fetch(req: Request): Promise<Response> {
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 })
    }

    const authHeader = req.headers.get('authorization') ?? ''
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (!idToken || !(await verifyFirebaseToken(idToken))) {
      return new Response('Unauthorized', { status: 401 })
    }

    const geminiKey = process.env.GEMINI_API_KEY
    if (!geminiKey) {
      return new Response('Server not configured', { status: 500 })
    }

    let raw: unknown
    try {
      raw = await req.json()
    } catch {
      return new Response('Bad Request', { status: 400 })
    }

    const body = validateBody(raw)
    if (!body) {
      return new Response('Bad Request', { status: 400 })
    }

    const maxOutputTokens = Math.min(Math.max(Math.round(body.config?.maxOutputTokens ?? 500), 1), 2000)
    const temperature = Math.min(Math.max(body.config?.temperature ?? 0.6, 0), 1)

    try {
      const geminiResponse = await fetch(GEMINI_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': geminiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: body.systemPrompt }] },
          contents: body.contents,
          generationConfig: {
            maxOutputTokens,
            temperature,
          },
          // This is an educational app about Kazakh history, so ordinary
          // lesson content (wars, conquest, khans dying in battle) sits
          // naturally in "medium" harassment/dangerous-content territory —
          // BLOCK_LOW_AND_ABOVE blocked a plain "tell me about your life"
          // question here (measured directly), so MEDIUM is the strictest
          // threshold that still lets real history through while still
          // catching profanity, hate speech and explicit content.
          safetySettings: [
            'HARM_CATEGORY_HARASSMENT',
            'HARM_CATEGORY_HATE_SPEECH',
            'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            'HARM_CATEGORY_DANGEROUS_CONTENT',
          ].map((category) => ({ category, threshold: 'BLOCK_MEDIUM_AND_ABOVE' })),
        }),
      })

      if (!geminiResponse.ok) {
        return new Response('Upstream error', { status: 502 })
      }

      const data = (await geminiResponse.json()) as GeminiResponse
      const text = (data.candidates?.[0]?.content?.parts ?? [])
        .map((part) => part.text)
        .filter((part): part is string => Boolean(part))
        .join('\n')
        .trim()

      return new Response(JSON.stringify({ text }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    } catch {
      return new Response('Upstream error', { status: 502 })
    }
  },
}
