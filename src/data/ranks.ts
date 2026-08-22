import type { LocalizedText } from './types'

/** Which of the two gendered title tracks a profile reads its rank from. */
export type AvatarGender = 'm' | 'f'

export interface Rank {
  /** Total XP at which this tier opens. */
  minXp: number
  title: Record<AvatarGender, LocalizedText>
}

/**
 * Seven honorific tiers, in two gendered tracks. The titles are real Kazakh
 * historical and cultural terms, kept exactly as they are said.
 *
 * Tier 6 opens at 1240 XP — the 62 lessons × `XP_PER_LESSON` of the whole
 * course, so it marks finishing everything. Tier 7 deliberately sits past that
 * total: it is only reachable with the extra XP of repeat person quizzes.
 */
export const ranks: Rank[] = [
  {
    minXp: 0,
    title: {
      m: { kz: 'Шәкірт', ru: 'Шакирт' },
      f: { kz: 'Шәкірт', ru: 'Шакирт' },
    },
  },
  {
    minXp: 120,
    title: {
      m: { kz: 'Жігіт', ru: 'Джигит' },
      f: { kz: 'Ару', ru: 'Ару' },
    },
  },
  {
    minXp: 300,
    title: {
      m: { kz: 'Батыр', ru: 'Батыр' },
      f: { kz: 'Жаужүрек', ru: 'Жаужурек' },
    },
  },
  {
    minXp: 560,
    title: {
      m: { kz: 'Тархан', ru: 'Тархан' },
      f: { kz: 'Абыз', ru: 'Абыз' },
    },
  },
  {
    minXp: 900,
    title: {
      m: { kz: 'Би', ru: 'Би' },
      f: { kz: 'Шешен', ru: 'Шешен' },
    },
  },
  {
    minXp: 1240,
    title: {
      m: { kz: 'Сұлтан', ru: 'Султан' },
      f: { kz: 'Ханым', ru: 'Ханым' },
    },
  },
  {
    minXp: 2000,
    title: {
      m: { kz: 'Хан', ru: 'Хан' },
      f: { kz: 'Ханша', ru: 'Ханша' },
    },
  },
]

export interface RankInfo {
  /** 0-based position in `ranks`. */
  tierIndex: number
  title: LocalizedText
  minXp: number
  /** `null` at the top tier, which nothing follows. */
  nextMinXp: number | null
  xpToNext: number | null
}

/**
 * The rank the given XP has reached. Coarser than `levelInfo` in
 * `src/lib/progress.ts` and read from the same `profile.xp` — the two
 * progressions run side by side.
 */
export function rankInfo(xp: number, gender: AvatarGender): RankInfo {
  let tierIndex = 0
  for (let i = ranks.length - 1; i > 0; i -= 1) {
    if (xp >= ranks[i].minXp) {
      tierIndex = i
      break
    }
  }

  const next = ranks[tierIndex + 1]
  return {
    tierIndex,
    title: ranks[tierIndex].title[gender],
    minXp: ranks[tierIndex].minXp,
    nextMinXp: next ? next.minXp : null,
    xpToNext: next ? Math.max(0, next.minXp - xp) : null,
  }
}
