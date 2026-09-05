#!/usr/bin/env node
/**
 * Post-deploy smoke check.
 *
 *   npm run smoke                       # against https://tarihhub.com
 *   npm run smoke https://<preview>.vercel.app
 *
 * Fast, unauthenticated, read-only. Confirms the serverless proxy still rejects
 * the two requests it must (GET, and a POST with no session) and that the
 * security headers `vercel.json` promises are actually on the wire — the exact
 * things a bad deploy silently drops. Exits non-zero on the first failure so it
 * can gate a release.
 */
const base = (process.argv[2] || 'https://tarihhub.com').replace(/\/$/, '')

let failures = 0
function check(name, ok, detail = '') {
  const mark = ok ? 'ok  ' : 'FAIL'
  if (!ok) failures++
  console.log(`${mark}  ${name}${detail ? `  — ${detail}` : ''}`)
}

const REQUIRED_HEADERS = [
  'content-security-policy',
  'strict-transport-security',
  'x-content-type-options',
  'x-frame-options',
]

try {
  // 1. GET /api/gemini → 405 Method Not Allowed
  const get = await fetch(`${base}/api/gemini`, { method: 'GET' })
  check('GET /api/gemini is 405', get.status === 405, `got ${get.status}`)

  // 2. POST /api/gemini with no Authorization → 401 Unauthorized
  const post = await fetch(`${base}/api/gemini`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mode: 'explain', lang: 'ru', heading: 'x', body: 'y' }),
  })
  check('POST /api/gemini unauthenticated is 401', post.status === 401, `got ${post.status}`)

  // 3. GET / → 200 with the security headers vercel.json defines
  const home = await fetch(`${base}/`)
  check('GET / is 200', home.status === 200, `got ${home.status}`)
  for (const h of REQUIRED_HEADERS) {
    check(`response carries ${h}`, home.headers.has(h))
  }

  // 4. The SEO files that had to be added by hand are still served
  const robots = await fetch(`${base}/robots.txt`)
  check('GET /robots.txt is 200', robots.status === 200, `got ${robots.status}`)
  const sitemap = await fetch(`${base}/sitemap.xml`)
  check('GET /sitemap.xml is 200', sitemap.status === 200, `got ${sitemap.status}`)
} catch (error) {
  check('network', false, String(error))
}

console.log(
  failures === 0
    ? `\nall checks passed against ${base}`
    : `\n${failures} check(s) failed against ${base}`,
)
process.exit(failures === 0 ? 0 : 1)
