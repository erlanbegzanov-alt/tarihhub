# Security model

TarihHub has **no backend** — no Cloud Functions, no matchmaker, no game
server. The client runs against Firebase Auth and Firestore directly, plus one
stateless Vercel function (`api/gemini.ts`) that proxies the shared Gemini key.

That makes **`firestore.rules` the entire server-side trust boundary.** Every
rule is written around a specific client flow in `src/lib/*`; the file's inline
comments say which. The guiding rule: *"my own document" is not "any bytes I
like"* — a client holding the write credential for its own data still only gets
to write **valid, in-bounds, monotonic** data.

## What the rules enforce

| Area | Guarantee |
| --- | --- |
| `users/{uid}/profile/state` | Only the owner reads/writes; never deletable. Every field type- and range-checked (`xp` ≤ 10M, arrays capped). Lifetime counters (`xp`, `quizzesCompleted`, `totalVisits`, casual/ranked duels & wins) may only **stay equal or grow**, and `xp` by ≤ 100k per write. No unknown fields. |
| `battlePlayers/{uid}` | Public read, owner-only write. `weekXp`/`rating` self-reported but bounded per write **and** throttled to one scoring write per 60 real seconds (`request.time`), so the weekly board can't be won faster than roughly one duel per minute of grinding. `photoURL` must be empty or an `https://` URL on `lh3.googleusercontent.com` / `res.cloudinary.com` (mirrors `src/lib/safeUrl.ts` and the CSP `img-src`). |
| `battleMatches` / `battleQueue` / `battleClaims` | Each player writes only their own half; a match can't be self-paired or seeded with a winner; a queue slot / claim can only be cleared by its owner. |
| `kahootGames` | Host-only read — the answer key never leaves Firestore for a student. |
| `kahootSessions/{code}` (+ `/players`) | Any signed-in user reads (that's how a student plays); only the host writes the room. A student row's `score` only rises, ≤ one question's worth per write. Name capped, `photoURL` allow-listed (client side, in `joinSession`). |
| `aiUsage/{bucket}/days/{day}` | Increment-only, un-deletable per-user and global counters. Lets `api/gemini.ts` meter the shared AI key **without** a service-account key: the caller writes with their own token but can only ever add 1, never reset. |
| everything else | Explicit `allow read, write: if false`. |

## `api/gemini.ts`

- **Auth:** every request needs a valid Firebase ID token, checked against
  Google's `accounts:lookup`. GET → 405, no/bad token → 401.
- **Prompt injection:** the client sends only `mode` + `personaId` + `lang` +
  turns; the system prompt is built server-side from a fixed table, with
  explicit anti-injection instructions. Input length and history depth capped.
- **Abuse cap on the shared key**, three tiers, in order:
  1. `firebase-admin` transaction — when `FIREBASE_SERVICE_ACCOUNT_KEY` is set.
  2. Firestore REST against the increment-only `aiUsage` counters — needs no
     service account; the rules make the counter tamper-evident.
  3. `ALLOW_UNMETERED_AI=1` — explicit escape hatch, only if neither metered
     path can run at all. Otherwise the request fails **closed** (429).

## Residual, accepted risks

- **Leaderboard grind.** With no server to settle a duel, `weekXp`/`rating` are
  self-reported. The rules cap the *rate* (~600 weekXp / ~20 rating per minute)
  but a script left running still climbs without playing. Fixing it properly
  needs a backend the project deliberately doesn't have.
- **Global AI circuit-breaker griefing.** Any signed-in user can push the
  `_shared` daily counter up, so a determined client could trip the day's
  global ceiling early. A mild-DoS trade for metering a shared key with no
  service account. The per-user cap is unaffected.
- **Profile inflation is contained, not impossible.** The rules stop absurd
  values and roll-backs, but a user can still, slowly and within bounds, award
  themselves progress. The document is readable only by its owner and feeds no
  cross-user surface, so the blast radius is self-deception.
- **Signup reveals a known email.** `auth/email-already-in-use` is inherent to
  email signup. Enable **Email Enumeration Protection** in the Firebase console
  to collapse the *login-time* oracle (the client already shows one generic
  message for wrong-password vs. no-such-user).

## Reporting

Open a private security advisory on the GitHub repo, or email the address on
the repo owner's profile. Please don't file a public issue for anything
exploitable.
