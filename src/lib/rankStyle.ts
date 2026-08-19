import { ranks } from '../data/ranks'
import type { LocalizedText } from '../data/types'

/**
 * The look of the rank ladder, kept apart from the components that draw it
 * (`RankBadge.tsx`, `RankSheet.tsx`) so both read the same table.
 */

/**
 * The owner tier, one step past the real ladder. It deliberately sits outside
 * `ranks` so no amount of XP can compute its way into it: it is granted by
 * identity alone (see `OWNER_EMAIL` below), and the only reason this index
 * exists is so `profile.displayedRankTier` can point at it. Anyone else's
 * saved profile carrying this number falls back to their real tier, so it is
 * not something a hand-edited localStorage entry can claim.
 */
export const OWNER_TIER_INDEX = ranks.length

/**
 * The one account the owner tier is granted to. Checked against the *signed-in
 * Firebase session*, not against anything the browser can set — unlike a
 * localStorage flag, which anyone could flip. Email rather than UID because
 * the UID isn't knowable without reading it out of a live session first, and
 * this address is already Google-verified by the time Firebase reports it.
 * The single source of truth for every screen that grants the owner tier
 * (Profile, Battle, Кахут) — never re-declare this elsewhere.
 */
export const OWNER_EMAIL = 'erlanbegzanov@gmail.com'

/**
 * The one title in the app that isn't a real Kazakh historical term — it is an
 * explicit out-of-universe badge, so plain modern wording is the honest choice.
 * Kept out of `strings.ts` because exactly one account ever renders it.
 */
export const OWNER_TITLE: LocalizedText = { kz: 'Әзірлеуші', ru: 'Разработчик' }

export interface TierEffect {
  /** `null` on tier 1, which stays deliberately plain. */
  color: string | null
  /** Share of `color` mixed into the badge fill, 0-1. */
  tint: number
  glow?: 'rank-glow-soft' | 'rank-glow' | 'rank-glow-rich'
  glowDuration?: string
  shimmer?: 'plain' | 'rich'
  sparkles?: number
  /** Adds the hue cycle and the rotating ring — owner tier only. */
  owner?: boolean
}

/**
 * Graduated by tier index. The primary signal is hue, not opacity: each tier
 * owns one of the `--tier-*` tokens in index.css, the way game rarity ladders
 * read. Animation layers on top of that, starting modestly at tier 3 and only
 * reaching a real spectacle at tier 7 — and past it, at the owner tier, which
 * takes tier 7's whole treatment and adds a slow colour cycle, a turning ring
 * and two more sparkles.
 */
export const TIER_EFFECTS: TierEffect[] = [
  { color: null, tint: 0 },
  { color: 'var(--tier-2)', tint: 0.3 },
  { color: 'var(--tier-3)', tint: 0.32, glow: 'rank-glow-soft', glowDuration: '4.6s' },
  { color: 'var(--tier-4)', tint: 0.34, glow: 'rank-glow-soft', glowDuration: '3.2s' },
  { color: 'var(--tier-5)', tint: 0.36, glow: 'rank-glow', glowDuration: '2.8s' },
  {
    color: 'var(--tier-6)',
    tint: 0.38,
    glow: 'rank-glow',
    glowDuration: '2.8s',
    shimmer: 'plain',
  },
  {
    color: 'var(--color-gold)',
    tint: 0.46,
    glow: 'rank-glow-rich',
    glowDuration: '2.3s',
    shimmer: 'rich',
    sparkles: 4,
  },
  {
    color: 'var(--color-gold)',
    tint: 0.52,
    glow: 'rank-glow-rich',
    glowDuration: '2.3s',
    shimmer: 'rich',
    sparkles: 6,
    owner: true,
  },
]

export function tierEffect(tierIndex: number): TierEffect {
  return TIER_EFFECTS[tierIndex] ?? TIER_EFFECTS[0]
}

/** Tier fill, or `null` on the uncoloured first tier. */
export function tierBackground(tierIndex: number): string | null {
  const fx = tierEffect(tierIndex)
  if (!fx.color) return null
  return `linear-gradient(140deg,
    color-mix(in srgb, ${fx.color} ${Math.round(fx.tint * 100)}%, var(--color-surface)) 0%,
    color-mix(in srgb, ${fx.color} ${Math.round(fx.tint * 35)}%, var(--color-surface)) 100%)`
}

/** Tier-tinted ink, dark enough to stay readable on that tier's fill. */
export function tierTextColor(tierIndex: number): string | null {
  const fx = tierEffect(tierIndex)
  return fx.color ? `color-mix(in srgb, ${fx.color} 72%, var(--color-ink))` : null
}

/** Positions round the circular badge; the last two are owner-only. */
export const BADGE_SPARKLES = [
  { left: '78%', top: '0%', delay: 0 },
  { left: '-6%', top: '38%', delay: 0.7 },
  { left: '60%', top: '82%', delay: 1.3 },
  { left: '35%', top: '-10%', delay: 1.8 },
  { left: '-4%', top: '76%', delay: 1 },
  { left: '96%', top: '52%', delay: 2.2 },
]

/** Same idea round the much wider status pill, so they clear the text. */
export const PILL_SPARKLES = [
  { left: '92%', top: '-30%', delay: 0 },
  { left: '-8%', top: '10%', delay: 0.7 },
  { left: '78%', top: '95%', delay: 1.3 },
  { left: '45%', top: '-35%', delay: 1.8 },
  { left: '18%', top: '100%', delay: 1 },
  // Kept below the pill's right edge rather than beside it, where it would sit
  // on top of the chevron.
  { left: '100%', top: '105%', delay: 2.2 },
]

/** Gold → amber → rose → violet → gold, the owner ring's full turn. */
export const OWNER_RING =
  'conic-gradient(from 0deg, var(--color-gold), #e08a2e, #d1547a, #7a5ab8, var(--color-gold))'

export const OWNER_CYCLE = '7.5s'

/** Trims the ring gradient down to a 3px band round the badge. */
export const OWNER_RING_MASK =
  'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))'
