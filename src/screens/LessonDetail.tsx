import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Lock,
  Trophy,
  UserRound,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { SectionCheck } from '../components/SectionCheck'
import { EraBadge, IconButton, ProgressBar } from '../components/ui'
import { eraColor, eras } from '../data/eras'
import { getLesson, lessonsInCourseOrder } from '../data/lessons'
import { getPerson } from '../data/people'
import { buildLessonQuiz } from '../data/quiz'
import { getUnit } from '../data/units'
import { s } from '../i18n/strings'
import { useLang } from '../i18n/useLang'
import { cn } from '../lib/cn'
import { easeOut, springSoft, staggerContainer, staggerItem } from '../lib/motion'
import { recordLessonStarted, useProfile } from '../lib/progress'

export function LessonDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useLang()
  const profile = useProfile()
  const lesson = getLesson(id)

  // Which part is on screen right now — parts live on separate "pages" inside
  // the lesson (like Khan Academy's per-lesson sidebar), not stacked in one
  // long scroll.
  const [activeIndex, setActiveIndex] = useState(0)

  // Opening a lesson is the only progress the reader awards themselves, and it
  // can never complete anything — that takes passing the quiz below.
  useEffect(() => {
    if (lesson) recordLessonStarted(lesson.id)
  }, [lesson])

  // A fresh lesson always opens on its first part.
  useEffect(() => setActiveIndex(0), [id])

  // Only the count matters here: whether this lesson can be gated at all.
  const questionCount = useMemo(
    () => (lesson ? buildLessonQuiz(lesson.id).length : 0),
    [lesson],
  )

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
  const best = profile.lessonQuizBest[lesson.id]
  const person = getPerson(lesson.relatedPersonId)
  const unit = getUnit(lesson.unitId)
  const quizReady = questionCount > 0

  // Next lesson in real course order, when there is one after this.
  const currentIndex = lessonsInCourseOrder.findIndex((item) => item.id === lesson.id)
  const nextLesson =
    currentIndex === -1 ? undefined : lessonsInCourseOrder[currentIndex + 1]

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
          {unit && (
            <Link
              to="/course"
              className="focus-ring mb-2.5 inline-flex items-center gap-1.5 rounded-lg text-[13px] font-semibold text-brand"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={2.2} />
              {t(s.course.unitBefore)}
              {unit.order}
              {t(s.course.unitAfter)} · {t(unit.title)}
            </Link>
          )}
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

        {/* ---------- part stepper — one part on screen at a time ---------- */}
        <motion.div
          variants={staggerItem}
          className="rail-scroll -mx-4 mt-7 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 md:mx-0 md:px-0"
        >
          {lesson.sections.map((section, index) => {
            const done = profile.sectionChecksDone.includes(`${lesson.id}:${index}`)
            const isActive = index === activeIndex
            return (
              <button
                key={section.heading.ru}
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={t(section.heading)}
                aria-current={isActive ? 'step' : undefined}
                className={cn(
                  'focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-full text-[13px] font-bold transition-colors duration-200',
                  isActive
                    ? 'text-white shadow-soft'
                    : done
                      ? 'text-white'
                      : 'bg-surface text-ink-soft ring-1 ring-line/60 hover:ring-brand/40',
                )}
                style={isActive || done ? { backgroundColor: color } : undefined}
              >
                {done && !isActive ? (
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                ) : (
                  index + 1
                )}
              </button>
            )
          })}
        </motion.div>

        <div className="mt-4">
          <AnimatePresence mode="wait">
            <motion.section
              key={activeIndex}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.22, ease: easeOut }}
            >
              <div className="mb-2.5 flex items-center gap-2">
                <span
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-bold text-white"
                  style={{ backgroundColor: color }}
                >
                  {activeIndex + 1}
                </span>
                <h2 className="text-[17px] leading-snug font-semibold text-ink">
                  {t(lesson.sections[activeIndex].heading)}
                </h2>
              </div>
              <div
                className="rounded-card bg-surface p-5 shadow-soft ring-1 ring-line/60 sm:p-6"
                style={{ borderLeft: `4px solid ${color}` }}
              >
                <p className="text-[15.5px] leading-[1.75] whitespace-pre-line text-ink">
                  {t(lesson.sections[activeIndex].body)}
                </p>
              </div>
              {lesson.sections[activeIndex].check &&
                lesson.sections[activeIndex].check!.length > 0 && (
                  <SectionCheck
                    questions={lesson.sections[activeIndex].check!}
                    lessonId={lesson.id}
                    sectionIndex={activeIndex}
                    totalSections={lesson.sections.length}
                    color={color}
                  />
                )}

              {/* ---------- prev/next between parts ---------- */}
              <div className="mt-4 flex items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={activeIndex === 0}
                  onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
                  className={cn(
                    'focus-ring inline-flex items-center gap-1 rounded-full px-4 py-2.5 text-[13.5px] font-semibold transition-colors',
                    activeIndex === 0
                      ? 'cursor-not-allowed bg-surface/60 text-ink-faint ring-1 ring-line/40'
                      : 'bg-surface text-ink ring-1 ring-line/60 hover:ring-brand/40',
                  )}
                >
                  <ChevronLeft className="h-4 w-4" strokeWidth={2.2} />
                  {t(s.lesson.prevPart)}
                </button>
                <button
                  type="button"
                  disabled={activeIndex === lesson.sections.length - 1}
                  onClick={() =>
                    setActiveIndex((i) => Math.min(lesson.sections.length - 1, i + 1))
                  }
                  className={cn(
                    'focus-ring inline-flex items-center gap-1 rounded-full px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-soft transition-colors',
                    activeIndex === lesson.sections.length - 1 &&
                      'cursor-not-allowed opacity-40',
                  )}
                  style={{ backgroundColor: color }}
                >
                  {t(s.lesson.nextPart)}
                  <ChevronRight className="h-4 w-4" strokeWidth={2.2} />
                </button>
              </div>
            </motion.section>
          </AnimatePresence>
        </div>

        <motion.p
          variants={staggerItem}
          className="mt-5 flex items-start gap-2 text-[12.5px] leading-relaxed text-ink-faint"
        >
          <BookOpen className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
          {t(s.lesson.sourceNote)}
        </motion.p>

        {/* ---------- the quiz gate ---------- */}
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
              {/* The real score, never a bare checkmark. */}
              {best && (
                <p className="mt-2 text-[15px] font-semibold text-ink">
                  {t(s.lesson.bestScore)}: {best.correct}/{best.total}
                </p>
              )}
              <p className="mt-2.5 text-[14px] leading-relaxed text-ink-soft">
                {t(s.quiz.lessonPassedText)}
              </p>

              <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
                {quizReady && (
                  <Link
                    to={`/quiz/lesson/${lesson.id}`}
                    className={cn(
                      'focus-ring inline-flex items-center justify-center gap-2 rounded-full',
                      'bg-surface px-5 py-3 text-[15px] font-semibold text-brand',
                      'ring-[1.5px] ring-brand/45 transition-colors hover:bg-brand-tint',
                    )}
                  >
                    <Trophy className="h-[18px] w-[18px]" strokeWidth={2.2} />
                    {t(s.lesson.retryQuiz)}
                  </Link>
                )}
                <Link
                  to={nextLesson ? `/lesson/${nextLesson.id}` : '/course'}
                  className={cn(
                    'focus-ring inline-flex items-center justify-center gap-2 rounded-full',
                    'bg-brand px-5 py-3 text-[15px] font-semibold text-white shadow-soft',
                    'transition-colors hover:bg-brand-dark',
                  )}
                >
                  {nextLesson ? t(s.lesson.nextLesson) : t(s.quiz.toCourse)}
                  <ChevronRight className="h-[18px] w-[18px]" strokeWidth={2.2} />
                </Link>
              </div>

              {person && (
                <Link
                  to={`/person/${person.id}`}
                  className="focus-ring mt-3.5 inline-flex items-center justify-center gap-1.5 rounded-lg text-[13.5px] font-semibold text-brand"
                >
                  <UserRound className="h-4 w-4" strokeWidth={2.2} />
                  {t(person.name)}
                </Link>
              )}
            </div>
          ) : quizReady ? (
            <div className="text-center">
              <p className="mb-3 text-[13px] leading-relaxed text-ink-faint">
                {t(s.lesson.gateNote)}
              </p>
              <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} transition={springSoft}>
                <Link
                  to={`/quiz/lesson/${lesson.id}`}
                  className={cn(
                    'focus-ring flex w-full items-center justify-center gap-2 rounded-full',
                    'bg-brand px-5 py-3.5 text-[15px] font-semibold text-white shadow-soft',
                    'transition-colors hover:bg-brand-dark',
                  )}
                >
                  <Trophy className="h-[18px] w-[18px]" strokeWidth={2.2} />
                  {t(s.lesson.startQuiz)}
                </Link>
              </motion.div>
            </div>
          ) : (
            /* No questions written for this lesson yet — say so plainly rather
               than offering a button that opens an empty quiz. */
            <div className="rounded-card bg-cream p-5 text-center ring-1 ring-line/60 sm:p-6">
              <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-surface text-ink-faint ring-1 ring-line/60">
                <Lock className="h-5 w-5" strokeWidth={2.2} />
              </span>
              <h2 className="mt-3 text-[17px] font-bold text-ink">
                {t(s.lesson.quizNotReady)}
              </h2>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
                {t(s.lesson.quizNotReadyText)}
              </p>
              <Link
                to="/course"
                className="focus-ring mt-3.5 inline-flex items-center justify-center gap-1.5 rounded-lg text-[13.5px] font-semibold text-brand"
              >
                {t(s.quiz.toCourse)}
                <ChevronRight className="h-4 w-4" strokeWidth={2.2} />
              </Link>
            </div>
          )}
        </motion.section>
      </div>
    </motion.div>
  )
}
