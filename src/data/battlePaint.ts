/**
 * The art and colours of the Батл hub's blocks (`src/screens/Battle.tsx`), in
 * the «Ойын» direction: a solid colour block, an era illustration from the
 * course fading into it, and a darker ledge under it.
 *
 * Fixed hexes, not the era tokens, and data rather than theme: these blocks
 * carry white type in both themes, and the era tokens lighten in dark mode,
 * which would sink that type below 4.5:1. Every `bg` here holds white at 4.6:1
 * or better; `ledge` is the same hue, darker.
 */

export interface Paint {
  image: string
  bg: string
  ledge: string
}

/**
 * One per league, climbing through the course's eras as the leagues climb.
 * Қола is the Bronze Age itself, Алтын gets the gold one; the rest simply keep
 * the order of history.
 */
export const LEAGUE_PAINT: Paint[] = [
  { image: '/history-events/ancient.webp', bg: '#8a6a3f', ledge: '#5f4a2b' },
  { image: '/history-events/turkic.webp', bg: '#3d6585', ledge: '#27445c' },
  { image: '/history-events/golden.webp', bg: '#8c6a0e', ledge: '#5c4508' },
  { image: '/history-events/goldenHorde.webp', bg: '#34775a', ledge: '#22503c' },
  { image: '/history-events/independence.webp', bg: '#6a4aa8', ledge: '#4a3179' },
]

export const MODE_PAINT = {
  casual: { image: '/history-events/saka.webp', bg: '#c24d0c', ledge: '#8c3607' },
  team: { image: '/history-events/khanate.webp', bg: '#0d8462', ledge: '#085a43' },
  kahoot: { image: '/history-events/alash.webp', bg: '#2c4a8f', ledge: '#1c3166' },
  friends: { image: '/history-events/modern.webp', bg: '#6a4aa8', ledge: '#4a3179' },
} satisfies Record<string, Paint>

/** Waiting-on-you red, fixed for the same reason: white sits on it. */
export const ALERT_RED = '#c8321f'
