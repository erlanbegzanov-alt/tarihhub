import { AnimatePresence, motion } from 'framer-motion'
import { Check, ClipboardCheck, RotateCcw, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { SectionCheckQuestion } from '../data/types'
import { s } from '../i18n/strings'
import { useLang } from '../i18n/useLang'
import { cn } from '../lib/cn'
import { easeOut, springSoft } from '../lib/motion'
import { recordSectionCheckDone } from '../lib/progress'
import { shuffled } from '../lib/shuffle'

const LETTERS = ['A', 'B', 'C', 'D']

/**
 * Inline "check yourself" mini-quiz shown right under a lesson section's body
 * — the Khan-Academy-style step between reading and the lesson's real gating
 * quiz (`/quiz/lesson/:id`). Never blocks scrolling past: a reader can ignore
 * it entirely and keep reading. Finishing it once nudges `lessonProgress` up
 * (see `recordSectionCheckDone`) but never completes the lesson on its own.
 */
export function SectionCheck({
  questions,
  lessonId,
  sectionIndex,
  totalSections,
  color,
}: {
  questions: SectionCheckQuestion[]
  lessonId: string
  sectionIndex: number
  totalSections: number
  color: string
}) {
  const { t } = useLang()
  const [round, setRound] = useState(0)
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [correctCount, setCorrectCount] = useState(0)
  const [finished, setFinished] = useState(false)

  // Each round draws a random slice from the section's full question pool
  // (not just a reshuffle of the same set) so a reader who retries — or
  // revisits the lesson later — meets different questions, not the same
  // three reordered. Option order is shuffled too.
  const PICK_COUNT = 3
  const ordered = useMemo(
    () =>
      shuffled(questions)
        .slice(0, Math.min(PICK_COUNT, questions.length))
        .map((q) => ({ ...q, options: shuffled(q.options) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `round` is the retry counter: bumping it is exactly what should re-draw.
    [questions, round],
  )

  if (ordered.length === 0) return null

  const question = ordered[index]
  const isLast = index === ordered.length - 1
  const revealed = picked !== null

  const choose = (optionId: string) => {
    if (picked) return
    setPicked(optionId)
    if (optionId === question.correctId) setCorrectCount((prev) => prev + 1)
  }

  const advance = () => {
    if (isLast) {
      recordSectionCheckDone(lessonId, sectionIndex, totalSections)
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

  return (
    <div className="mt-3 rounded-card bg-cream p-4 ring-1 ring-line/60 sm:p-5">
      <div className="flex items-center gap-2">
        <span
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-white"
          style={{ backgroundColor: color }}
        >
          <ClipboardCheck className="h-3.5 w-3.5" strokeWidth={2.4} />
        </span>
        <h3 className="text-[13.5px] font-bold text-ink">{t(s.lesson.check.title)}</h3>
        {!finished && (
          <span className="ml-auto text-[12px] font-medium text-ink-faint">
            {t(s.lesson.check.counter)} {index + 1}/{ordered.length}
          </span>
        )}
      </div>

      <AnimatePresence mode="wait">
        {finished ? (
          <motion.div
            key="summary"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: easeOut }}
            className="mt-3 flex items-center justify-between gap-3"
          >
            <p className="text-[13.5px] font-semibold text-ink">
              {t(s.lesson.check.done)} — {correctCount}/{ordered.length}{' '}
              {t(s.lesson.check.score)}
            </p>
            <button
              type="button"
              onClick={restart}
              className="focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-[12.5px] font-semibold text-brand ring-1 ring-brand/35 hover:bg-brand-tint"
            >
              <RotateCcw className="h-3.5 w-3.5" strokeWidth={2.2} />
              {t(s.lesson.check.retry)}
            </button>
          </motion.div>
        ) : (
          <motion.div
            key={`${round}-${question.id}`}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2, ease: easeOut }}
            className="mt-2.5"
          >
            <p className="text-[14px] leading-snug font-semibold text-ink">
              {t(question.question)}
            </p>

            <ul className="mt-2.5 flex flex-col gap-1.5">
              {question.options.map((option, optionIndex) => {
                const isCorrect = option.id === question.correctId
                const isPicked = picked === option.id

                return (
                  <li key={option.id}>
                    <button
                      type="button"
                      onClick={() => choose(option.id)}
                      disabled={revealed}
                      className={cn(
                        'focus-ring flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left',
                        'ring-1 transition-colors duration-200',
                        !revealed &&
                          'bg-surface text-ink ring-line/60 hover:ring-brand/40',
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
                          'grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold',
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
                          <Check className="h-3 w-3" strokeWidth={3} />
                        ) : revealed && isPicked ? (
                          <X className="h-3 w-3" strokeWidth={3} />
                        ) : (
                          LETTERS[optionIndex]
                        )}
                      </span>
                      <span className="text-[13.5px] font-medium">
                        {t(option.label)}
                      </span>
                    </button>
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
                  transition={{ duration: 0.2, ease: easeOut }}
                  className="overflow-hidden"
                >
                  <div className="mt-2.5 rounded-lg bg-surface p-3 ring-1 ring-line/60">
                    <p
                      className={cn(
                        'text-[12px] font-bold',
                        picked === question.correctId ? 'text-correct' : 'text-wrong',
                      )}
                    >
                      {picked === question.correctId
                        ? t(s.quiz.correct)
                        : t(s.quiz.wrong)}
                    </p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-ink-soft">
                      {t(question.explanation)}
                    </p>
                  </div>

                  <motion.button
                    type="button"
                    onClick={advance}
                    whileTap={{ scale: 0.98 }}
                    transition={springSoft}
                    className="focus-ring mt-2.5 w-full rounded-full px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-soft"
                    style={{ backgroundColor: color }}
                  >
                    {isLast ? t(s.quiz.finish) : t(s.lesson.check.next)}
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
