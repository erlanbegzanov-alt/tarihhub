/**
 * The colours of the Батл hub's blocks (`src/screens/Battle.tsx`), in the
 * «Ойын» direction: a solid colour block and a darker ledge under it. The era
 * illustrations the blocks carried at first now head the course's unit cards;
 * each league has its own picture instead (owner's, 2026-11-09), painted in
 * that league's colour with the subject on the right.
 *
 * Fixed hexes, not the era tokens, and data rather than theme: these blocks
 * carry white type in both themes, and the era tokens lighten in dark mode,
 * which would sink that type below 4.5:1. Every `bg` here holds white at 4.6:1
 * or better; `ledge` is the same hue, darker.
 */

export interface Paint {
  bg: string
  ledge: string
}

/** A block that carries a picture under its colour — every league and mode. */
export interface LeaguePaint extends Paint {
  image: string
}

/** One per league, in the order the leagues climb. */
export const LEAGUE_PAINT: LeaguePaint[] = [
  { bg: '#8a6a3f', ledge: '#5f4a2b', image: '/battle/league-0.webp' },
  { bg: '#3d6585', ledge: '#27445c', image: '/battle/league-1.webp' },
  { bg: '#8c6a0e', ledge: '#5c4508', image: '/battle/league-2.webp' },
  { bg: '#34775a', ledge: '#22503c', image: '/battle/league-3.webp' },
  { bg: '#6a4aa8', ledge: '#4a3179', image: '/battle/league-4.webp' },
]

/** Each mode's picture is on its own theme: бәйге, көкпар, айтыс, friends at a yurt. */
export const MODE_PAINT = {
  casual: { bg: '#c24d0c', ledge: '#8c3607', image: '/battle/mode-casual.webp' },
  team: { bg: '#0d8462', ledge: '#085a43', image: '/battle/mode-team.webp' },
  kahoot: { bg: '#2c4a8f', ledge: '#1c3166', image: '/battle/mode-kahoot.webp' },
  friends: { bg: '#6a4aa8', ledge: '#4a3179', image: '/battle/mode-friends.webp' },
} satisfies Record<string, LeaguePaint>

/** Waiting-on-you red, fixed for the same reason: white sits on it. */
export const ALERT_RED = '#c8321f'
