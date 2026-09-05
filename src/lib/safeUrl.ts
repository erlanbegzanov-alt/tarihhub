/**
 * Allow-list for the one user-controllable URL the app ever stores where
 * *another* user's browser will render it: `photoURL` on the public battle
 * mirror (`battlePlayers/{uid}`) and on a Кахут player row.
 *
 * The CSP already blocks an off-list `img-src` from actually loading, so this
 * is defence in depth, not the only guard — but it keeps the stored value
 * honest (no attacker-planted tracker URL sitting in a row every leaderboard
 * viewer fetches) and it means the value the app persists always matches the
 * value the CSP would allow to paint.
 *
 * Two hosts, matching the CSP's `img-src`:
 *   - `lh3.googleusercontent.com` — Google account photos (the only source the
 *     app ever sets `photoURL` from today).
 *   - `res.cloudinary.com` — the Кахут question-photo upload path.
 * Anything else — a bare string, `javascript:`, `data:`, or a plain http://
 * URL — collapses to `''`, which every `PlayerAvatar` caller already renders
 * as the initial-on-a-disc fallback.
 */
const ALLOWED_PHOTO_HOSTS = new Set([
  'lh3.googleusercontent.com',
  'res.cloudinary.com',
])

/** The stored-`photoURL` cap, matching `firestore.rules`' `photoURL.size() <= 300`. */
const MAX_PHOTO_URL_LENGTH = 300

/**
 * Returns `url` unchanged when it is an `https://` URL on an allowed image
 * host and within the length cap, or `''` for everything else.
 */
export function safePhotoURL(url: unknown): string {
  if (typeof url !== 'string' || url === '' || url.length > MAX_PHOTO_URL_LENGTH) {
    return ''
  }
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return ''
  }
  if (parsed.protocol !== 'https:') return ''
  return ALLOWED_PHOTO_HOSTS.has(parsed.hostname) ? url : ''
}
