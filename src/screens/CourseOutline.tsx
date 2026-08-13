import { motion } from 'framer-motion'
import { Check, ChevronRight, Play, Sparkles } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ProgressBar } from '../components/ui'
import { eras } from '../data/eras'
import { allLessons, lessonsOfUnit } from '../data/lessons'
import { units } from '../data/units'
import { s } from '../i18n/strings'
import { useLang } from '../i18n/useLang'
import { cn } from '../lib/cn'
import { springSoft, staggerContainer, staggerItem } from '../lib/motion'
import { useProfile } from '../lib/progress'

/**
 * Accent colours borrowed from the era palette by unit position. Purely
 * decorative — a unit is not claimed to belong to the era it borrows from.
 */
const ACCENTS = Object.values(eras).map((era) => era.color)

export function CourseOutline() {
  const { t } = useLang()
  const profile = useProfile()

  const orderedUnits = useMemo(
    () => [...units].sort((a, b) => a.order - b.order),
    [],
  )

  // Real counts, read live from the profile against the lessons that actually
  // exist right now — the course grows as content lands, and so does this.
  const totalLessons = allLessons.length
  const passedLessons = allLessons.filter((lesson) =>
    profile.completedLessons.includes(lesson.id),
  ).length
  const coursePercent =
    totalLessons > 0 ? (passedLessons / totalLessons) * 100 : 0

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      {/* ---------- header ---------- */}
      <motion.header variants={staggerItem}>
        <h1 className="text-2xl font-bold tracking-tight text-ink md:text-[28px]">
          {t(s.course.title)}
        </h1>
        <p className="mt-1.5 text-[14.5px] text-ink-soft">
          {t(s.course.subtitle)}
        </p>

        <div className="mt-5 rounded-card bg-surface p-4 shadow-soft ring-1 ring-line/60 sm:p-5">
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-2xl font-bold text-ink">
              {passedLessons}
              <span className="text-lg text-ink-faint"> / {totalLessons}</span>
            </p>
            <p className="text-[12.5px] font-medium text-ink-faint">
              {t(s.course.lessonsPassed)}
            </p>
          </div>
          <ProgressBar percent={coursePercent} className="mt-3" height={8} />
        </div>
      </motion.header>

      {/* ---------- units ---------- */}
      <div className="mt-7 flex flex-col gap-7 lg:mx-auto lg:max-w-4xl">
        {orderedUnits.map((unit) => {
          const accent = ACCENTS[unit.order % ACCENTS.length]
          const lessons = lessonsOfUnit(unit.id)
          const unitPassed = lessons.filter((lesson) =>
            profile.completedLessons.includes(lesson.id),
          ).length

          return (
            <motion.section key={unit.id} variants={staggerItem}>
              {/* unit head */}
              <div
                className="rounded-card bg-surface p-4 shadow-soft ring-1 ring-line/60 sm:p-5"
                style={{ borderLeft: `4px solid ${accent}` }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p
                      className="text-[12.5px] font-bold tracking-wide"
                      style={{ color: accent }}
                    >
                      {t(s.course.unitBefore)}
                      {unit.order}
                      {t(s.course.unitAfter)}
                    </p>
                    <h2 className="mt-1 text-[19px] leading-snug font-semibold text-ink">
                      {t(unit.title)}
                    </h2>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[15px] font-bold text-ink">
                      {unitPassed}
                      <span className="text-ink-faint"> / {lessons.length}</span>
                    </p>
                    <p className="text-[11.5px] text-ink-faint">
                      {t(s.course.unitPassed)}
                    </p>
                  </div>
                </div>
                <p className="mt-2 max-w-prose text-[14px] leading-relaxed text-ink-soft">
                  {t(unit.summary)}
                </p>
              </div>

              {/* lessons */}
              {lessons.length === 0 ? (
                <p className="mt-2.5 px-1 text-[13px] text-ink-faint">
                  {t(s.course.unitEmpty)}
                </p>
              ) : (
                <ul className="mt-2.5 flex flex-col gap-2">
                  {lessons.map((lesson) => {
                    const best = profile.lessonQuizBest[lesson.id]
                    const passed = profile.completedLessons.includes(lesson.id)
                    const started = (profile.lessonProgress[lesson.id] ?? 0) > 0

                    return (
                      <li key={lesson.id}>
                        <motion.div whileHover={{ y: -2 }} transition={springSoft}>
                          <Link
                            to={`/lesson/${lesson.id}`}
                            className={cn(
                              'focus-ring flex w-full items-center gap-3.5 rounded-card bg-surface p-3.5',
                              'shadow-soft ring-1 ring-line/60 transition-shadow duration-300 hover:shadow-lift',
                            )}
                          >
                            <span
                              className="grid h-10 w-10 shrink-0 place-items-center rounded-full"
                              style={{
                                background: passed
                                  ? accent
                                  : `color-mix(in srgb, ${accent} 14%, var(--color-surface))`,
                              }}
                            >
                              {passed ? (
                                <Check
                                  className="h-[18px] w-[18px] text-white"
                                  strokeWidth={2.6}
                                />
                              ) : started ? (
                                <Play
                                  className="h-4 w-4 translate-x-px"
                                  strokeWidth={2.4}
                                  style={{ color: accent }}
                                  fill="currentColor"
                                />
                              ) : (
                                <Sparkles
                                  className="h-[18px] w-[18px]"
                                  strokeWidth={2}
                                  style={{ color: accent }}
                                />
                              )}
                            </span>

                            <div className="min-w-0 flex-1">
                              <h3 className="truncate text-[14.5px] font-semibold text-ink">
                                {t(lesson.title)}
                              </h3>
                              <p className="mt-0.5 truncate text-[12.5px] text-ink-faint">
                                {passed
                                  ? `${t(s.course.statusPassed)}${
                                      best ? ` · ${best.correct}/${best.total}` : ''
                                    }`
                                  : started
                                    ? t(s.course.statusStarted)
                                    : t(s.course.statusNew)}
                              </p>
                            </div>

                            <ChevronRight className="h-5 w-5 shrink-0 text-ink-faint" />
                          </Link>
                        </motion.div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </motion.section>
          )
        })}
      </div>
    </motion.div>
  )
}
