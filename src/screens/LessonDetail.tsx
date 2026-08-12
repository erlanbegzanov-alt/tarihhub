import { motion } from 'framer-motion'
import { ArrowLeft, BookOpen, Check, Trophy, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { EraBadge, IconButton, ProgressBar, XpPill } from '../components/ui'
import { eraColor, eras } from '../data/eras'
import { getLesson } from '../data/lessons'
import { getPerson } from '../data/people'
import { s } from '../i18n/strings'
import { useLang } from '../i18n/useLang'
import { cn } from '../lib/cn'
import { springSoft, staggerContainer, staggerItem } from '../lib/motion'
import { XP_PER_LESSON, recordLessonProgress, useProfile } from '../lib/progress'

/** Recorded on open, so a lesson the reader started shows up under "continue". */
const STARTED_PERCENT = 10

export function LessonDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useLang()
  const profile = useProfile()
  const lesson = getLesson(id)

  /** True only for a completion that actually paid XP in this visit. */
  const [awarded, setAwarded] = useState(false)

  // Opening the lesson is real progress — but never enough to overwrite a
  // higher percentage already recorded (`recordLessonProgress` clamps that).
  useEffect(() => {
    if (lesson) recordLessonProgress(lesson.id, STARTED_PERCENT)
  }, [lesson])

  if (!lesson) {
    return (
      <div className="py-24 text-center">
        <p className="text-ink-soft">{t(s.lesson.missing)}</p>
        <Link
          to="/"
          className="focus-ring mt-4 inline-block rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white"
        >
          {t(s.lesson.toHome)}
        </Link>
      </div>
    )
  }

  const color = eraColor(lesson.eraKey)
  const percent = profile.lessonProgress[lesson.id] ?? 0
  const completed = profile.completedLessons.includes(lesson.id)
  const person = getPerson(lesson.relatedPersonId)
  const quizPath = lesson.relatedPersonId ? `/quiz/${lesson.relatedPersonId}` : '/quiz'

  const finish = () => {
    // Read before recording: a repeat completion pays nothing, so promise nothing.
    setAwarded(!completed)
    recordLessonProgress(lesson.id, 100)
  }

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      {/* ---------- top bar ---------- */}
      <motion.div variants={staggerItem} className="mb-5">
        <IconButton label={t(s.common.back)} onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </IconButton>
      </motion.div>

      <div className="mx-auto max-w-3xl">
        {/* ---------- title ---------- */}
        <motion.div variants={staggerItem}>
          <EraBadge eraKey={lesson.eraKey}>{t(eras[lesson.eraKey].label)}</EraBadge>
          <h1 className="mt-3 text-[26px] leading-[1.15] font-bold tracking-tight text-ink sm:text-[32px]">
            {t(lesson.title)}
          </h1>
          <p className="mt-1.5 text-[13.5px] text-ink-faint">
            {t(lesson.meta)} · {t(lesson.duration)}
          </p>

          <div className="mt-4">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <span className="text-[12.5px] font-medium text-ink-soft">
                {t(s.lesson.progress)}
              </span>
              <span className="text-[12.5px] font-bold text-ink">{percent}%</span>
            </div>
            <ProgressBar percent={percent} color={color} height={8} />
          </div>
        </motion.div>

        {/* ---------- sections ---------- */}
        <div className="mt-7 flex flex-col gap-5">
          {lesson.sections.map((section, index) => (
            <motion.section key={section.heading.ru} variants={staggerItem}>
              <div className="mb-2.5 flex items-center gap-2">
                <span
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-bold text-white"
                  style={{ backgroundColor: color }}
                >
                  {index + 1}
                </span>
                <h2 className="text-[17px] leading-snug font-semibold text-ink">
                  {t(section.heading)}
                </h2>
              </div>
              <div
                className="rounded-card bg-surface p-5 shadow-soft ring-1 ring-line/60 sm:p-6"
                style={{ borderLeft: `4px solid ${color}` }}
              >
                <p className="text-[15.5px] leading-[1.75] whitespace-pre-line text-ink">
                  {t(section.body)}
                </p>
              </div>
            </motion.section>
          ))}
        </div>

        <motion.p
          variants={staggerItem}
          className="mt-5 flex items-start gap-2 text-[12.5px] leading-relaxed text-ink-faint"
        >
          <BookOpen className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
          {t(s.lesson.sourceNote)}
        </motion.p>

        {/* ---------- completion ---------- */}
        <motion.section variants={staggerItem} className="mt-7">
          {completed ? (
            <div
              className="rounded-card bg-surface p-5 text-center shadow-soft ring-1 ring-line/60 sm:p-6"
              style={{ borderTop: `4px solid ${color}` }}
            >
              <span
                className="mx-auto grid h-12 w-12 place-items-center rounded-full text-white"
                style={{ backgroundColor: color }}
              >
                <Check className="h-6 w-6" strokeWidth={2.6} />
              </span>
              <h2 className="mt-3 text-[19px] font-bold text-ink">
                {t(s.lesson.completedTitle)}
              </h2>
              {awarded ? (
                <p className="mt-2 flex justify-center">
                  <XpPill>
                    +{XP_PER_LESSON} {t(s.common.xp)}
                  </XpPill>
                </p>
              ) : (
                <p className="mt-2 text-[12.5px] text-ink-faint">
                  {t(s.lesson.alreadyCompleted)}
                </p>
              )}
              <p className="mt-2.5 text-[14px] leading-relaxed text-ink-soft">
                {t(s.lesson.completedText)}
              </p>

              <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
                <Link
                  to={quizPath}
                  className={cn(
                    'focus-ring inline-flex items-center justify-center gap-2 rounded-full',
                    'bg-brand px-5 py-3 text-[15px] font-semibold text-white shadow-soft',
                    'transition-colors hover:bg-brand-dark',
                  )}
                >
                  <Trophy className="h-[18px] w-[18px]" strokeWidth={2.2} />
                  {t(s.lesson.toQuiz)}
                </Link>
                {person && (
                  <Link
                    to={`/person/${person.id}`}
                    className={cn(
                      'focus-ring inline-flex items-center justify-center gap-2 rounded-full',
                      'bg-surface px-5 py-3 text-[15px] font-semibold text-brand',
                      'ring-[1.5px] ring-brand/45 transition-colors hover:bg-brand-tint',
                    )}
                  >
                    <UserRound className="h-[18px] w-[18px]" strokeWidth={2.2} />
                    {t(person.name)}
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <motion.button
              type="button"
              onClick={finish}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              transition={springSoft}
              className={cn(
                'focus-ring flex w-full items-center justify-center gap-2 rounded-full',
                'bg-brand px-5 py-3.5 text-[15px] font-semibold text-white shadow-soft',
                'transition-colors hover:bg-brand-dark',
              )}
            >
              <Check className="h-[18px] w-[18px]" strokeWidth={2.4} />
              {t(s.lesson.complete)}
            </motion.button>
          )}
        </motion.section>
      </div>
    </motion.div>
  )
}
