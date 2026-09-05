/**
 * Allow-list for the one user-controllable URL the app stores where *another*
 * user's browser renders it: `photoURL` on the public battle mirror
 * (`battlePlayers/{uid}`) and on a Кахут player row.
 *
 * A player photo is only ever the signed-in user's Google account image, so
 * the list is exactly that one host. (Кахут *question* photos are a different,
 * host-authored field and go through Cloudinary — not this.) The CSP `img-src`
 * already blocks an off-list URL from loading; this keeps the stored value
 * honest so no attacker-planted tracker URL sits in a row every leaderboard
 * viewer fetches.
 *
 * Anything else — a bare string, `javascript:`, `data:`, a plain http:// URL,
 * or an https URL carrying userinfo / an explicit port / a non-Google host —
 * collapses to `''`, which every `PlayerAvatar` caller already renders as the
 * initials-on-a-disc fallback. The check mirrors `firestore.rules`'
 * `validSharedPhoto`, which is the actual enforcement.
 */
const ALLOWED_PHOTO_HOST = 'lh3.googleusercontent.com'

/** The stored-`photoURL` cap, matching `firestore.rules`' `photoURL.size() <= 300`. */
const MAX_PHOTO_URL_LENGTH = 300

/**
 * Returns `url` unchanged when it is a plain `https://lh3.googleusercontent.com`
 * URL (no userinfo, no explicit port) within the length cap, or `''` otherwise.
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
  if (parsed.username || parsed.password || parsed.port) return ''
  return parsed.hostname === ALLOWED_PHOTO_HOST ? url : ''
}
