import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_STATE,
  LESSON_PASS_RATIO,
  LESSON_SCORE_XP_MAX,
  XP_PER_LESSON,
  completeDaily,
  completeQuiz,
  getProfile,
  lessonScoreXp,
  lessonXpRemaining,
  levelInfo,
  loadProfileForUser,
  normalizeProfile,
  quizXpRemaining,
  recordPersonQuizResult,
  recordLessonQuizResult,
  recordVisit,
} from './progress'

// `progress.ts` early-returns from `recordVisit` when `window` is undefined and
// reads/writes `window.localStorage` everywhere else. Give it a throwaway
// in-memory `window` so the real code path runs; each test starts from empty.
function memoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size
    },
  } as Storage
}

beforeEach(() => {
  vi.stubGlobal('window', { localStorage: memoryStorage() })
  loadProfileForUser(null)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('normalizeProfile', () => {
  it('replaces a non-numeric xp with the default', () => {
    expect(normalizeProfile({ xp: 'lots' }).xp).toBe(0)
    expect(normalizeProfile({ xp: 500 }).xp).toBe(500)
  })

  it('clamps every lessonProgress value into 0..100 and drops non-finite ones', () => {
    const out = normalizeProfile({
      lessonProgress: { a: 250, b: -5, c: 47.6, d: Number.NaN, e: Infinity },
    }).lessonProgress
    expect(out).toEqual({ a: 100, b: 0, c: 48 })
  })

  it('drops a lessonQuizBest entry with total < 1 and clamps correct <= total', () => {
    const out = normalizeProfile({
      lessonQuizBest: {
        ok: { correct: 9, total: 5 },
        empty: { correct: 1, total: 0 },
        junk: { correct: 'x', total: 5 },
      },
    }).lessonQuizBest
    expect(out).toEqual({ ok: { correct: 5, total: 5 } })
  })

  it('keeps only string ids in the array fields', () => {
    const out = normalizeProfile({
      completedLessons: ['l1', 2, null, 'l2'],
      unlockedBadges: ['flame', {}],
    })
    expect(out.completedLessons).toEqual(['l1', 'l2'])
    expect(out.unlockedBadges).toEqual(['flame'])
  })

  it('returns the full default state for a non-object input', () => {
    expect(normalizeProfile(null)).toEqual(DEFAULT_STATE)
    expect(normalizeProfile('nope')).toEqual(DEFAULT_STATE)
  })
})

describe('levelInfo', () => {
  it('maps xp to a 1-based level and the progress within it', () => {
    expect(levelInfo(0)).toMatchObject({ level: 1, xpInLevel: 0, percent: 0 })
    expect(levelInfo(200)).toMatchObject({ level: 2, xpInLevel: 0 })
    expect(levelInfo(310)).toMatchObject({ level: 2, xpInLevel: 110, percent: 55 })
  })
})

describe('lessonScoreXp', () => {
  it('scales with the share correct, rounded, capped at LESSON_SCORE_XP_MAX', () => {
    expect(lessonScoreXp(0, 30)).toBe(0)
    expect(lessonScoreXp(6, 30)).toBe(4)
    expect(lessonScoreXp(24, 30)).toBe(16)
    expect(lessonScoreXp(30, 30)).toBe(LESSON_SCORE_XP_MAX)
    expect(lessonScoreXp(1, 3)).toBe(7) // 6.67 rounds
  })

  it('clamps nonsense instead of paying for it', () => {
    expect(lessonScoreXp(99, 30)).toBe(LESSON_SCORE_XP_MAX)
    expect(lessonScoreXp(-5, 30)).toBe(0)
    expect(lessonScoreXp(Number.NaN, 30)).toBe(0)
    expect(lessonScoreXp(3, 0)).toBe(0)
  })
})

describe('recordLessonQuizResult', () => {
  it('passes only at or above LESSON_PASS_RATIO', () => {
    expect(recordLessonQuizResult('l1', 3, 5).passed).toBe(false) // 0.6
    expect(getProfile().completedLessons).toEqual([])
    expect(recordLessonQuizResult('l1', 4, 5).passed).toBe(true) // 0.8 == ratio
    expect(getProfile().completedLessons).toContain('l1')
    expect(LESSON_PASS_RATIO).toBe(0.8)
  })

  it('the screenshot case: 6/30 pays 4, not 20', () => {
    const outcome = recordLessonQuizResult('l1', 6, 30)
    expect(outcome).toEqual({ passed: false, xpEarned: 4 })
    expect(getProfile().xp).toBe(4)
  })

  it('what it returns is exactly what it stored', () => {
    let shown = 0
    for (const [c, t] of [[6, 30], [24, 30], [20, 30], [30, 30]] as const) {
      shown += recordLessonQuizResult('l1', c, t).xpEarned
      expect(getProfile().xp).toBe(shown)
    }
  })

  it('pays only the improvement over the best, plus the pass bonus once', () => {
    expect(recordLessonQuizResult('l1', 6, 30).xpEarned).toBe(4)
    // 24/30 = 16 score XP, 4 already paid, + first-pass bonus
    expect(recordLessonQuizResult('l1', 24, 30).xpEarned).toBe(12 + XP_PER_LESSON)
    expect(recordLessonQuizResult('l1', 30, 30).xpEarned).toBe(4)
    expect(getProfile().xp).toBe(LESSON_SCORE_XP_MAX + XP_PER_LESSON)
  })

  it('retakes cannot farm: the same or a worse score pays 0', () => {
    recordLessonQuizResult('l1', 30, 30)
    for (let i = 0; i < 5; i++) {
      expect(recordLessonQuizResult('l1', 30, 30).xpEarned).toBe(0)
      expect(recordLessonQuizResult('l1', 2, 30).xpEarned).toBe(0)
    }
    expect(getProfile().xp).toBe(LESSON_SCORE_XP_MAX + XP_PER_LESSON)
  })

  it('a failed retake after a pass pays nothing and un-passes nothing', () => {
    recordLessonQuizResult('l1', 5, 5)
    const outcome = recordLessonQuizResult('l1', 1, 5)
    expect(outcome).toEqual({ passed: false, xpEarned: 0 })
    expect(getProfile().lessonQuizBest.l1).toEqual({ correct: 5, total: 5 })
    expect(getProfile().lessonProgress.l1).toBe(100)
    expect(getProfile().completedLessons).toEqual(['l1'])
  })

  it('an empty quiz can never be passed or paid', () => {
    expect(recordLessonQuizResult('l1', 0, 0)).toEqual({ passed: false, xpEarned: 0 })
    expect(getProfile().xp).toBe(0)
  })

  it('lessons are independent of each other', () => {
    recordLessonQuizResult('l1', 5, 5)
    expect(recordLessonQuizResult('l2', 5, 5).xpEarned).toBe(LESSON_SCORE_XP_MAX + XP_PER_LESSON)
  })
})

describe('lessonXpRemaining', () => {
  it('counts down to zero as the lesson is banked', () => {
    expect(lessonXpRemaining('l1')).toBe(LESSON_SCORE_XP_MAX + XP_PER_LESSON)
    recordLessonQuizResult('l1', 6, 30)
    expect(lessonXpRemaining('l1')).toBe(16 + XP_PER_LESSON)
    recordLessonQuizResult('l1', 24, 30)
    expect(lessonXpRemaining('l1')).toBe(4)
    recordLessonQuizResult('l1', 30, 30)
    expect(lessonXpRemaining('l1')).toBe(0)
  })
})

describe('completeDaily', () => {
  it('returns what it paid: the XP once, then 0 for the rest of the day', () => {
    expect(completeDaily(3, 5, 20)).toBe(20)
    expect(completeDaily(5, 5, 20)).toBe(0)
    expect(getProfile().xp).toBe(20)
  })
})

describe('recordVisit streak', () => {
  afterEach(() => vi.useRealTimers())

  it('same day is a no-op, the next day is +1, a gap resets to 1', () => {
    vi.useFakeTimers()

    vi.setSystemTime(new Date('2026-03-01T09:00:00'))
    recordVisit()
    expect(getProfile().streak).toBe(1)
    expect(getProfile().totalVisits).toBe(1)

    vi.setSystemTime(new Date('2026-03-01T21:00:00'))
    recordVisit()
    expect(getProfile().streak).toBe(1)
    expect(getProfile().totalVisits).toBe(1)

    vi.setSystemTime(new Date('2026-03-02T08:00:00'))
    recordVisit()
    expect(getProfile().streak).toBe(2)

    vi.setSystemTime(new Date('2026-03-05T08:00:00'))
    recordVisit()
    expect(getProfile().streak).toBe(1)
  })
})

describe('completeQuiz', () => {
  it('adds the given xp and unlocks the perfect-score badge only on a clean sheet', () => {
    completeQuiz(4, 5, 20)
    expect(getProfile().xp).toBe(20)
    expect(getProfile().unlockedBadges).not.toContain('sage')
    completeQuiz(5, 5, 20)
    expect(getProfile().xp).toBe(40)
    expect(getProfile().unlockedBadges).toContain('sage')
  })
})

describe('recordPersonQuizResult', () => {
  it('pays only the improvement on this quiz, so repeating it cannot farm XP', () => {
    expect(recordPersonQuizResult('abylai', 5, 10)).toBe(10)
    expect(recordPersonQuizResult('abylai', 5, 10)).toBe(0)
    expect(recordPersonQuizResult('abylai', 4, 10)).toBe(0)
    expect(recordPersonQuizResult('abylai', 10, 10)).toBe(LESSON_SCORE_XP_MAX - 10)
    for (let i = 0; i < 20; i += 1) recordPersonQuizResult('abylai', 10, 10)
    expect(getProfile().xp).toBe(LESSON_SCORE_XP_MAX)
    expect(quizXpRemaining('abylai')).toBe(0)
    // Another person's quiz is its own budget.
    expect(quizXpRemaining('tauke')).toBe(LESSON_SCORE_XP_MAX)
    // Every finish still counts for the counter.
    expect(getProfile().quizzesCompleted).toBe(24)
  })
})

describe('the flame badge', () => {
  afterEach(() => vi.useRealTimers())

  it('comes from seven daily sets in a row, not from seven app opens', () => {
    vi.useFakeTimers()
    for (let d = 1; d <= 7; d += 1) {
      vi.setSystemTime(new Date(`2026-03-0${d}T09:00:00`))
      recordVisit()
    }
    expect(getProfile().streak).toBe(7)
    expect(getProfile().unlockedBadges).not.toContain('flame')

    for (let d = 1; d <= 7; d += 1) {
      vi.setSystemTime(new Date(`2026-04-0${d}T09:00:00`))
      completeDaily(3, 5, 20)
      if (d < 7) expect(getProfile().unlockedBadges).not.toContain('flame')
    }
    expect(getProfile().unlockedBadges).toContain('flame')
  })
})
