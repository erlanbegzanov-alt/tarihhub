import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Check, Lock, RotateCcw, Trophy, X, Zap } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PortraitPanel } from '../components/PortraitPanel'
import { IconButton, ProgressBar, XpPill } from '../components/ui'
import { getLesson } from '../data/lessons'
import { getPerson } from '../data/people'
import { XP_PER_QUIZ, buildLessonQuiz, buildQuiz } from '../data/quiz'
import { s } from '../i18n/strings'
import { useLang } from '../i18n/useLang'
import { cn } from '../lib/cn'
import { canHover, easeOut, springSoft, staggerContainer, staggerItem } from '../lib/motion'
import {
  LESSON_PASS_RATIO,
  completeQuiz,
  recordLessonQuizResult,
} from '../lib/progress'

const LETTERS = ['A', 'B', 'C', 'D']

export function Quiz() {
  const { personId, lessonId } = useParams()
  const navigate = useNavigate()
  const { t } = useLang()
  const person = getPerson(personId)
  const lesson = getLesson(lessonId)

  /** Bumped on retry so question cards re-enter with a fresh animation key. */
  const [round, setRound] = useState(0)
  // Lesson mode serves only that lesson's own questions; everything else keeps
  // the practice/persona behaviour untouched. `round` is in the deps on
  // purpose: a retry re-draws and re-shuffles, so passing a lesson can't come
  // down to memorising which option sat in which slot last time.
  const questions = useMemo(
    () => (lessonId ? buildLessonQuiz(lessonId) : buildQuiz(personId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `round` is the retry counter: bumping it is exactly what should re-draw the questions.
    [lessonId, personId, round],
  )

  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [correctCount, setCorrectCount] = useState(0)
  const [finished, setFinished] = useState(false)
  /** Whether the finished attempt reached the lesson pass mark. Lesson mode only. */
  const [lessonPassed, setLessonPassed] = useState(false)
  /**
   * Whether this mounted screen has already paid its `XP_PER_QUIZ`. Retry
   * re-draws the questions and lets the reader practice again, but it must
   * not reopen the XP faucet — `restart` deliberately never resets this, so
   * finishing the same on-screen session five times pays once, not five.
   * (`recordLessonQuizResult` doesn't need the same guard — it already only
   * pays a lesson's completion XP the first time that lesson is ever passed.)
   */
  const xpAwardedRef = useRef(false)
  /** What the result screen actually just paid — `0` on a retry's finish. */
  const [xpEarnedThisRound, setXpEarnedThisRound] = useState(0)

  const question = questions[index]
  const isLast = index === questions.length - 1

  const choose = (optionId: string) => {
    if (picked) return
    setPicked(optionId)
    if (optionId === question.correctId) setCorrectCount((prev) => prev + 1)
  }

  const advance = () => {
    if (isLast) {
      // `correctCount` already includes the current answer — `choose` runs first.
      // A lesson quiz is still a quiz: it earns the usual XP, streak and badges…
      if (!xpAwardedRef.current) {
        xpAwardedRef.current = true
        setXpEarnedThisRound(XP_PER_QUIZ)
        completeQuiz(correctCount, questions.length, XP_PER_QUIZ)
      } else {
        setXpEarnedThisRound(0)
      }
      // …and, on top of that, decides whether the lesson itself is passed.
      if (lessonId) {
        setLessonPassed(
          recordLessonQuizResult(lessonId, correctCount, questions.length),
        )
      }
      setFinished(true)
      return
    }
    setIndex((prev) => prev + 1)
    setPicked(null)
  }

  const restart = () => {
    setRound((prev) => prev + 1)
    setIndex(0)
    setPicked(null)
    setCorrectCount(0)
    setFinished(false)
    setLessonPassed(false)
  }

  /* --------------------- no questions written yet --------------------- */

  // A lesson whose questions haven't been authored yet must land here rather
  // than in an empty quiz that crashes on `questions[0]`.
  if (questions.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={springSoft}
        className="mx-auto max-w-lg py-6 text-center md:py-12"
      >
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-surface text-ink-faint ring-1 ring-line/60">
          <Lock className="h-7 w-7" strokeWidth={1.8} />
        </span>
        <h1 className="mt-5 text-xl font-bold tracking-tight text-ink sm:text-2xl">
          {t(s.quiz.notReadyTitle)}
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
          {t(s.quiz.notReadyText)}
        </p>
        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
          {lesson && (
            <Link
              to={`/lesson/${lesson.id}`}
              className="focus-ring rounded-full bg-brand px-5 py-3.5 text-[15px] font-semibold text-white shadow-soft hover:bg-brand-dark"
            >
              {t(s.quiz.toLesson)}
            </Link>
          )}
          <Link
            to="/course"
            className="focus-ring rounded-full bg-surface px-5 py-3.5 text-[15px] font-semibold text-brand ring-[1.5px] ring-brand/45 hover:bg-brand-tint"
          >
            {t(s.quiz.toCourse)}
          </Link>
        </div>
      </motion.div>
    )
  }

  /* ------------------------------ result ------------------------------ */

  if (finished) {
    const ratio = correctCount / questions.length
    const verdict =
      ratio === 1 ? s.quiz.perfect : ratio >= 0.6 ? s.quiz.good : s.quiz.poor
    // Lesson mode splits the result in two: a pass confirms the lesson counted,
    // a miss is framed as "not yet", never as a failure to be ashamed of.
    const lessonMode = Boolean(lessonId)
    const missed = lessonMode && !lessonPassed
    const passMark = Math.ceil(LESSON_PASS_RATIO * questions.length)

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={springSoft}
        className="mx-auto max-w-lg py-6 text-center md:py-12"
      >
        <motion.span
          initial={{ scale: 0.5, rotate: missed ? 0 : -12 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ ...springSoft, delay: 0.1 }}
          className={cn(
            'mx-auto grid h-20 w-20 place-items-center rounded-full',
            missed ? 'bg-brand-tint' : 'bg-gold-tint',
          )}
        >
          {missed ? (
            <RotateCcw className="h-9 w-9 text-brand" strokeWidth={1.8} />
          ) : (
            <Trophy className="h-9 w-9 text-gold" strokeWidth={1.8} />
          )}
        </motion.span>

        <h1 className="mt-5 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          {missed
            ? t(s.quiz.lessonFailedTitle)
            : lessonMode
              ? t(s.quiz.lessonPassedTitle)
              : t(s.quiz.resultTitle)}
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
          {missed
            ? t(s.quiz.lessonFailedText)
            : lessonMode
              ? t(s.quiz.lessonPassedText)
              : t(verdict)}
        </p>
        {lesson && (
          <p className="mt-2 text-[13px] font-medium text-ink-faint">
            {t(lesson.title)}
          </p>
        )}

        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-card bg-surface p-5 shadow-soft ring-1 ring-line/60">
            <p className="text-3xl font-bold text-brand">
              {correctCount}
              <span className="text-lg text-ink-faint">/{questions.length}</span>
            </p>
            <p className="mt-1 text-[12.5px] text-ink-faint">
              {t(s.quiz.resultScore)}
            </p>
          </div>
          <div className="rounded-card bg-surface p-5 shadow-soft ring-1 ring-line/60">
            <p className="text-3xl font-bold text-gold">+{xpEarnedThisRound}</p>
            <p className="mt-1 text-[12.5px] text-ink-faint">
              {t(s.quiz.xpEarned)}
            </p>
          </div>
        </div>

        {lessonMode && (
          <p className="mt-3 text-[12.5px] text-ink-faint">
            {t(s.quiz.passMark)}: {passMark}/{questions.length}
          </p>
        )}

        {/* A missed pass mark leads with "try again"; nothing else is offered
            as the celebratory next step. */}
        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
          {missed ? (
            <>
              <motion.button
                type="button"
                onClick={restart}
                whileTap={{ scale: 0.97 }}
                transition={springSoft}
                className="focus-ring flex flex-1 items-center justify-center gap-2 rounded-full bg-brand px-5 py-3.5 text-[15px] font-semibold text-white shadow-soft hover:bg-brand-dark"
              >
                <RotateCcw className="h-[18px] w-[18px]" strokeWidth={2.2} />
                {t(s.quiz.retry)}
              </motion.button>
              <motion.button
                type="button"
                onClick={() => navigate(`/lesson/${lessonId}`)}
                whileTap={{ scale: 0.97 }}
                transition={springSoft}
                className="focus-ring flex-1 rounded-full bg-surface px-5 py-3.5 text-[15px] font-semibold text-brand ring-[1.5px] ring-brand/45 hover:bg-brand-tint"
              >
                {t(s.quiz.toLesson)}
              </motion.button>
            </>
          ) : (
            <>
              <motion.button
                type="button"
                onClick={() => navigate(lessonMode ? '/course' : '/profile')}
                whileTap={{ scale: 0.97 }}
                transition={springSoft}
                className="focus-ring flex-1 rounded-full bg-brand px-5 py-3.5 text-[15px] font-semibold text-white shadow-soft hover:bg-brand-dark"
              >
                {lessonMode ? t(s.quiz.toCourse) : t(s.quiz.toProfile)}
              </motion.button>
              <motion.button
                type="button"
                onClick={restart}
                whileTap={{ scale: 0.97 }}
                transition={springSoft}
                className="focus-ring flex flex-1 items-center justify-center gap-2 rounded-full bg-surface px-5 py-3.5 text-[15px] font-semibold text-brand ring-[1.5px] ring-brand/45 hover:bg-brand-tint"
              >
                <RotateCcw className="h-[18px] w-[18px]" strokeWidth={2.2} />
                {t(s.quiz.retry)}
              </motion.button>
            </>
          )}
        </div>
      </motion.div>
    )
  }

  /* ------------------------------ question ---------------------------- */

  const progress = ((index + (picked ? 1 : 0)) / questions.length) * 100

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="mx-auto max-w-2xl lg:max-w-3xl"
    >
      <motion.div variants={staggerItem} className="flex items-center gap-3">
        <IconButton label={t(s.common.back)} onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </IconButton>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold tracking-tight text-ink">
            {lesson ? t(lesson.title) : t(s.quiz.title)}
          </h1>
          <p className="text-[12.5px] text-ink-faint">
            {index + 1}/{questions.length} {t(s.quiz.counter)}
            {!lesson && person ? ` · ${t(person.name)}` : ''}
          </p>
        </div>
        <XpPill>
          <Zap className="h-3 w-3" strokeWidth={2.6} fill="currentColor" />
          +{XP_PER_QUIZ} XP
        </XpPill>
      </motion.div>

      <motion.div variants={staggerItem} className="mt-4">
        <ProgressBar percent={progress} height={5} />
      </motion.div>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${round}-${question.id}`}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.26, ease: easeOut }}
          className="mt-5"
        >
          <div className="rounded-card bg-surface p-5 shadow-soft ring-1 ring-line/60 sm:p-6">
            <div className="flex items-center gap-3">
              {person && (
                <PortraitPanel
                  initial={person.initial}
                  eraKey={person.eraKey}
                  motif={person.motif}
                  portrait={person.portrait}
                  name={t(person.name)}
                  size="sm"
                  className="h-9 w-9 shrink-0 rounded-lg"
                />
              )}
              <span className="rounded-full bg-cream px-3 py-1 text-[11.5px] font-semibold text-ink-soft">
                {t(question.category)}
              </span>
            </div>
            <h2 className="mt-4 text-[19px] leading-snug font-semibold text-ink sm:text-[21px]">
              {t(question.question)}
            </h2>
          </div>

          <ul className="mt-3 flex flex-col gap-2.5">
            {question.options.map((option, optionIndex) => {
              const isCorrect = option.id === question.correctId
              const isPicked = picked === option.id
              const revealed = picked !== null

              return (
                <li key={option.id}>
                  <motion.button
                    type="button"
                    onClick={() => choose(option.id)}
                    disabled={revealed}
                    whileHover={canHover && !revealed ? { y: -2 } : undefined}
                    whileTap={revealed ? undefined : { scale: 0.99 }}
                    transition={springSoft}
                    className={cn(
                      'focus-ring flex w-full items-center gap-3.5 rounded-card px-4 py-3.5 text-left',
                      'ring-1 transition-colors duration-300',
                      !revealed &&
                        'bg-surface text-ink shadow-soft ring-line/60 hover:ring-brand/40',
                      revealed &&
                        isCorrect &&
                        'bg-correct-tint text-ink ring-correct/45',
                      revealed &&
                        isPicked &&
                        !isCorrect &&
                        'bg-wrong-tint text-ink ring-wrong/45',
                      revealed &&
                        !isCorrect &&
                        !isPicked &&
                        'bg-surface/60 text-ink-faint ring-line/50',
                    )}
                  >
                    <span
                      className={cn(
                        'grid h-8 w-8 shrink-0 place-items-center rounded-full text-[13px] font-bold',
                        'transition-colors duration-300',
                        !revealed && 'bg-cream text-ink-soft',
                        revealed && isCorrect && 'bg-correct text-white',
                        revealed && isPicked && !isCorrect && 'bg-wrong text-white',
                        revealed &&
                          !isCorrect &&
                          !isPicked &&
                          'bg-cream text-ink-faint',
                      )}
                    >
                      {revealed && isCorrect ? (
                        <Check className="h-4 w-4" strokeWidth={3} />
                      ) : revealed && isPicked ? (
                        <X className="h-4 w-4" strokeWidth={3} />
                      ) : (
                        LETTERS[optionIndex]
                      )}
                    </span>
                    <span className="text-[15px] font-medium">
                      {t(option.label)}
                    </span>
                  </motion.button>
                </li>
              )
            })}
          </ul>

          <AnimatePresence>
            {picked && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: easeOut }}
                className="overflow-hidden"
              >
                <div className="mt-4 rounded-card bg-cream p-4 ring-1 ring-line/60">
                  <p
                    className={cn(
                      'text-[13px] font-bold',
                      picked === question.correctId ? 'text-correct' : 'text-wrong',
                    )}
                  >
                    {picked === question.correctId
                      ? t(s.quiz.correct)
                      : t(s.quiz.wrong)}
                  </p>
                  <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">
                    {t(question.explanation)}
                  </p>
                </div>

                <motion.button
                  type="button"
                  onClick={advance}
                  whileHover={canHover ? { y: -2 } : undefined}
                  whileTap={{ scale: 0.98 }}
                  transition={springSoft}
                  className="focus-ring mt-3.5 w-full rounded-full bg-brand px-5 py-3.5 text-[15px] font-semibold text-white shadow-soft hover:bg-brand-dark"
                >
                  {isLast ? t(s.quiz.finish) : t(s.quiz.next)}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  )
}
