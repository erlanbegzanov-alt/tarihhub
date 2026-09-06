import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_STATE,
  LESSON_PASS_RATIO,
  XP_PER_LESSON,
  completeQuiz,
  getProfile,
  levelInfo,
  loadProfileForUser,
  normalizeProfile,
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

describe('recordLessonQuizResult', () => {
  it('passes only at or above LESSON_PASS_RATIO', () => {
    expect(recordLessonQuizResult('l1', 3, 5)).toBe(false) // 0.6
    expect(getProfile().xp).toBe(0)
    expect(recordLessonQuizResult('l1', 4, 5)).toBe(true) // 0.8 == ratio
    expect(getProfile().xp).toBe(XP_PER_LESSON)
    expect(getProfile().completedLessons).toContain('l1')
    expect(LESSON_PASS_RATIO).toBe(0.8)
  })

  it('pays the lesson XP once, never again', () => {
    recordLessonQuizResult('l1', 5, 5)
    recordLessonQuizResult('l1', 5, 5)
    recordLessonQuizResult('l1', 5, 5)
    expect(getProfile().xp).toBe(XP_PER_LESSON)
  })

  it('a worse retry never lowers the best score or un-completes the lesson', () => {
    recordLessonQuizResult('l1', 5, 5)
    recordLessonQuizResult('l1', 1, 5)
    expect(getProfile().lessonQuizBest.l1).toEqual({ correct: 5, total: 5 })
    expect(getProfile().lessonProgress.l1).toBe(100)
    expect(getProfile().completedLessons).toEqual(['l1'])
  })

  it('an empty quiz can never be passed', () => {
    expect(recordLessonQuizResult('l1', 0, 0)).toBe(false)
    expect(getProfile().xp).toBe(0)
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
