import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Check, RotateCcw, Trophy, X, Zap } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PortraitPanel } from '../components/PortraitPanel'
import { IconButton, ProgressBar, XpPill } from '../components/ui'
import { getPerson } from '../data/people'
import { XP_PER_QUIZ, buildQuiz } from '../data/quiz'
import { s } from '../i18n/strings'
import { useLang } from '../i18n/useLang'
import { cn } from '../lib/cn'
import { easeOut, springSoft, staggerContainer, staggerItem } from '../lib/motion'
import { completeQuiz } from '../lib/progress'

const LETTERS = ['A', 'B', 'C', 'D']

export function Quiz() {
  const { personId } = useParams()
  const navigate = useNavigate()
  const { t } = useLang()
  const person = getPerson(personId)

  /** Bumped on retry so question cards re-enter with a fresh animation key. */
  const [round, setRound] = useState(0)
  const questions = useMemo(() => buildQuiz(personId), [personId])

  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [correctCount, setCorrectCount] = useState(0)
  const [finished, setFinished] = useState(false)

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
      completeQuiz(correctCount, questions.length, XP_PER_QUIZ)
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
  }

  /* ------------------------------ result ------------------------------ */

  if (finished) {
    const ratio = correctCount / questions.length
    const verdict =
      ratio === 1 ? s.quiz.perfect : ratio >= 0.6 ? s.quiz.good : s.quiz.poor

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={springSoft}
        className="mx-auto max-w-lg py-6 text-center md:py-12"
      >
        <motion.span
          initial={{ scale: 0.5, rotate: -12 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ ...springSoft, delay: 0.1 }}
          className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-gold-tint"
        >
          <Trophy className="h-9 w-9 text-gold" strokeWidth={1.8} />
        </motion.span>

        <h1 className="mt-5 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          {t(s.quiz.resultTitle)}
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
          {t(verdict)}
        </p>

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
            <p className="text-3xl font-bold text-gold">+{XP_PER_QUIZ}</p>
            <p className="mt-1 text-[12.5px] text-ink-faint">
              {t(s.quiz.xpEarned)}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
          <motion.button
            type="button"
            onClick={() => navigate('/profile')}
            whileTap={{ scale: 0.97 }}
            transition={springSoft}
            className="focus-ring flex-1 rounded-full bg-brand px-5 py-3.5 text-[15px] font-semibold text-white shadow-soft hover:bg-brand-dark"
          >
            {t(s.quiz.toProfile)}
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
            {t(s.quiz.title)}
          </h1>
          <p className="text-[12.5px] text-ink-faint">
            {index + 1}/{questions.length} {t(s.quiz.counter)}
            {person ? ` · ${t(person.name)}` : ''}
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
                    whileHover={revealed ? undefined : { y: -2 }}
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
                  whileHover={{ y: -2 }}
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
