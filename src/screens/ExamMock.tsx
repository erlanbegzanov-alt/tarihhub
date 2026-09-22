import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Clock,
  FileText,
  RotateCcw,
  Target,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconButton, ProgressBar, SectionHeading } from '../components/ui'
import { levelLabels, patternLabels, topicLabel } from '../data/codifier'
import type { ExamLevel } from '../data/types'
import { s } from '../i18n/strings'
import { useLang } from '../i18n/useLang'
import { cn } from '../lib/cn'
import {
  EXAM_STANDALONE_COUNT,
  EXAM_TIME_BUDGET_MS,
  buildExamVariant,
  formatCountdown,
  scoreExam,
} from '../lib/exam'
import type { BreakdownRow, ExamAnswers } from '../lib/exam'
import { canHover, easeOut, springSoft, staggerContainer, staggerItem } from '../lib/motion'

/**
 * The ҰБТ mock (`/battle/exam`).
 *
 * Differs from `Quiz.tsx` in the one way that matters: it withholds feedback
 * until the end. A practice quiz tells you straight away whether you were
 * right, which is how you learn a fact; an exam does not, and the whole point
 * of this screen is the thing that only appears without feedback — reading a
 * stimulus once, committing to five answers on it, and finding out afterwards
 * that a single misreading took four of them down (see `contextBlocks.ts`).
 *
 * The question card, option rows and reveal colours use the same vocabulary as
 * `Quiz.tsx` on purpose, so nothing here has to be re-learnt visually.
 */

const LETTERS = ['A', 'B', 'C', 'D']

type Phase = 'brief' | 'running' | 'result'

/** One breakdown row: a label, "3/5", and a bar. */
function BreakdownList<K>({
  rows,
  label,
}: {
  rows: BreakdownRow<K>[]
  label: (key: K) => string
}) {
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => {
        const share = row.correct / row.total
        return (
          <li
            key={String(row.key)}
            className="rounded-card bg-surface px-4 py-3 shadow-soft ring-1 ring-line/60"
          >
            <div className="flex items-baseline gap-3">
              <span className="min-w-0 flex-1 text-[13.5px] leading-snug font-medium text-ink">
                {label(row.key)}
              </span>
              <span
                className={cn(
                  'shrink-0 text-[13px] font-bold tabular-nums',
                  share === 1 ? 'text-correct' : share === 0 ? 'text-wrong' : 'text-ink-soft',
                )}
              >
                {row.correct}/{row.total}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-cream">
              <div
                className={cn(
                  'h-full rounded-full',
                  share === 1 ? 'bg-correct' : share === 0 ? 'bg-wrong' : 'bg-brand',
                )}
                style={{ width: `${Math.max(share * 100, share > 0 ? 6 : 0)}%` }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export function ExamMock() {
  const navigate = useNavigate()
  const { t, lang } = useLang()

  const [phase, setPhase] = useState<Phase>('brief')
  /** Bumped to draw a fresh variant — `buildExamVariant` re-runs on change. */
  const [round, setRound] = useState(0)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `round` is the retry counter: bumping it is exactly what should re-draw the variant.
  const variant = useMemo(() => buildExamVariant(), [round])

  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<ExamAnswers>({})
  const [passageOpen, setPassageOpen] = useState(true)
  const [warnBlank, setWarnBlank] = useState(false)
  const [ranOutOfTime, setRanOutOfTime] = useState(false)
  /** Wall-clock end of our 40-minute budget, set when the attempt starts. */
  const [deadline, setDeadline] = useState<number | null>(null)
  const [msLeft, setMsLeft] = useState(EXAM_TIME_BUDGET_MS)

  const item = variant.items[index]
  const isLast = index === variant.items.length - 1
  const blankCount = variant.items.filter((i) => !answers[i.question.id]).length

  /* The countdown. Ticks once a second and closes the attempt at zero — the
     budget is ours, but it is worth nothing if it can be ignored. */
  useEffect(() => {
    if (phase !== 'running' || deadline === null) return
    const tick = () => {
      const left = deadline - Date.now()
      setMsLeft(left)
      if (left <= 0) {
        setRanOutOfTime(true)
        setPhase('result')
      }
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [phase, deadline])

  const begin = () => {
    setDeadline(Date.now() + EXAM_TIME_BUDGET_MS)
    setMsLeft(EXAM_TIME_BUDGET_MS)
    setPhase('running')
  }

  const restart = () => {
    setRound((r) => r + 1)
    setIndex(0)
    setAnswers({})
    setWarnBlank(false)
    setRanOutOfTime(false)
    setPassageOpen(true)
    setPhase('brief')
  }

  const goTo = (next: number) => {
    // A new stimulus opens expanded; moving inside the same block leaves the
    // reader's own choice alone.
    const from = variant.items[index]?.block?.id ?? null
    const to = variant.items[next]?.block?.id ?? null
    if (from !== to) setPassageOpen(true)
    setIndex(next)
    setWarnBlank(false)
  }

  const pick = (optionId: string) => {
    setAnswers((prev) => ({ ...prev, [item.question.id]: optionId }))
    setWarnBlank(false)
  }

  const advance = () => {
    if (!isLast) {
      goTo(index + 1)
      return
    }
    // No negative marking (§3.3), so a blank is a mark thrown away. Say so
    // once, then let the reader decide.
    if (blankCount > 0 && !warnBlank) {
      setWarnBlank(true)
      return
    }
    setPhase('result')
  }

  const jumpToFirstBlank = () => {
    const at = variant.items.findIndex((i) => !answers[i.question.id])
    if (at >= 0) goTo(at)
  }

  /* ------------------------------- brief ------------------------------- */

  if (phase === 'brief') {
    return (
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="mx-auto max-w-2xl lg:max-w-3xl"
      >
        <motion.div variants={staggerItem} className="flex items-center gap-3">
          <IconButton label={t(s.common.back)} onClick={() => navigate('/battle')}>
            <ArrowLeft className="h-5 w-5" strokeWidth={2} />
          </IconButton>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold tracking-tight text-ink">
              {t(s.exam.title)}
            </h1>
            <p className="text-[12.5px] text-ink-faint">{t(s.exam.subtitle)}</p>
          </div>
        </motion.div>

        <motion.section
          variants={staggerItem}
          className="mt-5 rounded-card bg-surface p-5 shadow-soft ring-1 ring-line/60 sm:p-6"
        >
          <h2 className="text-[17px] font-bold text-ink">{t(s.exam.briefTitle)}</h2>
          <ul className="mt-4 flex flex-col gap-3.5">
            {[
              { icon: FileText, text: t(s.exam.briefFormat) },
              { icon: Clock, text: t(s.exam.briefTime) },
              { icon: Target, text: t(s.exam.briefThreshold) },
              { icon: AlertTriangle, text: t(s.exam.briefBlank) },
            ].map(({ icon: Icon, text }, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-cream text-ink-soft">
                  <Icon className="h-[15px] w-[15px]" strokeWidth={2} aria-hidden />
                </span>
                <p className="text-[14px] leading-relaxed text-ink-soft">{text}</p>
              </li>
            ))}
          </ul>

          <motion.button
            type="button"
            onClick={begin}
            whileHover={canHover ? { y: -2 } : undefined}
            whileTap={{ scale: 0.98 }}
            transition={springSoft}
            className="focus-ring mt-6 w-full rounded-full bg-brand px-5 py-3.5 text-[15px] font-semibold text-white shadow-soft hover:bg-brand-dark"
          >
            {t(s.exam.start)}
          </motion.button>
        </motion.section>
      </motion.div>
    )
  }

  /* ------------------------------- result ------------------------------ */

  if (phase === 'result') {
    const result = scoreExam(variant, answers)

    return (
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="mx-auto max-w-2xl pb-4 lg:max-w-3xl"
      >
        <motion.div variants={staggerItem} className="flex items-center gap-3">
          <IconButton label={t(s.common.back)} onClick={() => navigate('/battle')}>
            <ArrowLeft className="h-5 w-5" strokeWidth={2} />
          </IconButton>
          <h1 className="min-w-0 flex-1 truncate text-lg font-bold tracking-tight text-ink">
            {t(s.exam.resultTitle)}
          </h1>
        </motion.div>

        {ranOutOfTime && (
          <motion.p
            variants={staggerItem}
            className="mt-4 rounded-card bg-gold-tint px-4 py-3 text-[13.5px] leading-relaxed text-ink-soft ring-1 ring-gold/35"
          >
            <span className="font-bold text-ink">{t(s.exam.timeUp)}.</span>{' '}
            {t(s.exam.timeUpText)}
          </motion.p>
        )}

        {/* Score, threshold, blanks. */}
        <motion.section
          variants={staggerItem}
          className="mt-4 rounded-card bg-surface p-5 shadow-soft ring-1 ring-line/60"
        >
          <div className="flex items-end gap-4">
            <p className="text-[44px] leading-none font-bold text-brand tabular-nums">
              {result.correct}
              <span className="text-[22px] text-ink-faint">/{result.total}</span>
            </p>
            <p className="pb-1.5 text-[12.5px] font-semibold tracking-wide text-ink-faint uppercase">
              {t(s.exam.score)}
            </p>
          </div>
          <p
            className={cn(
              'mt-3 text-[13.5px] leading-relaxed',
              result.passedThreshold ? 'text-ink-soft' : 'font-semibold text-wrong',
            )}
          >
            {result.passedThreshold ? t(s.exam.thresholdOk) : t(s.exam.thresholdFail)}
          </p>
          {result.blank > 0 && (
            <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
              {t(s.exam.blankLeft)}: <span className="font-bold">{result.blank}</span>.{' '}
              {t(s.exam.blankCost)}
            </p>
          )}
        </motion.section>

        {/* This variant's difficulty mix against the specification's. */}
        <motion.section
          variants={staggerItem}
          className="mt-3 rounded-card bg-surface p-5 shadow-soft ring-1 ring-line/60"
        >
          <h2 className="text-[13px] font-semibold tracking-wide text-ink-faint uppercase">
            {t(s.exam.mixTitle)}
          </h2>
          <div className="mt-3 grid grid-cols-3 gap-2.5">
            {(['A', 'B', 'C'] as ExamLevel[]).map((level) => (
              <div key={level} className="rounded-card bg-cream px-3 py-2.5 text-center">
                <p className="text-[11.5px] font-semibold text-ink-faint">
                  {t(levelLabels[level])}
                </p>
                <p className="mt-1 text-[17px] font-bold text-ink tabular-nums">
                  {variant.levels[level]}
                  <span className="text-[12px] font-semibold text-ink-faint">
                    {' '}
                    / {variant.levelTarget[level]}
                  </span>
                </p>
              </div>
            ))}
          </div>
          <p className="mt-2.5 text-[12px] leading-relaxed text-ink-faint">
            {t(s.exam.mixThis)} · {t(s.exam.mixTarget)}
            {Object.keys(variant.shortfall).length > 0 && <> — {t(s.exam.mixHonest)}</>}
          </p>
        </motion.section>

        <motion.div variants={staggerItem} className="mt-6">
          <SectionHeading title={t(s.exam.byTopic)} />
        </motion.div>
        <motion.div variants={staggerItem}>
          <BreakdownList rows={result.byTopic} label={(id) => topicLabel(id, lang)} />
        </motion.div>

        <motion.div variants={staggerItem} className="mt-6">
          <SectionHeading title={t(s.exam.byPattern)} />
        </motion.div>
        <motion.div variants={staggerItem}>
          <BreakdownList rows={result.byPattern} label={(p) => t(patternLabels[p])} />
        </motion.div>

        <motion.div variants={staggerItem} className="mt-6">
          <SectionHeading title={t(s.exam.byLevel)} />
        </motion.div>
        <motion.div variants={staggerItem}>
          <BreakdownList rows={result.byLevel} label={(l) => t(levelLabels[l])} />
        </motion.div>

        {/* Task-by-task review — the explanations withheld during the attempt. */}
        <motion.div variants={staggerItem} className="mt-6">
          <SectionHeading title={t(s.exam.reviewTitle)} />
        </motion.div>
        <motion.ul variants={staggerItem} className="flex flex-col gap-2.5">
          {variant.items.map(({ position, question }) => {
            const picked = answers[question.id] ?? null
            const right = picked === question.correctId
            const correctOption = question.options.find((o) => o.id === question.correctId)!
            const pickedOption = question.options.find((o) => o.id === picked)

            return (
              <li
                key={question.id}
                className="rounded-card bg-surface p-4 shadow-soft ring-1 ring-line/60"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      'grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-bold',
                      right
                        ? 'bg-correct text-white'
                        : picked === null
                          ? 'bg-cream text-ink-faint'
                          : 'bg-wrong text-white',
                    )}
                  >
                    {right ? (
                      <Check className="h-4 w-4" strokeWidth={3} />
                    ) : picked === null ? (
                      position
                    ) : (
                      <X className="h-4 w-4" strokeWidth={3} />
                    )}
                  </span>
                  <p className="min-w-0 flex-1 text-[14.5px] leading-snug font-semibold text-ink">
                    {t(question.question)}
                  </p>
                </div>

                <div className="mt-3 flex flex-col gap-1 pl-10 text-[13px]">
                  {!right && (
                    <p className={picked === null ? 'text-ink-faint' : 'text-wrong'}>
                      {picked === null
                        ? t(s.exam.leftBlank)
                        : `${t(s.exam.yourAnswer)}: ${t(pickedOption!.label)}`}
                    </p>
                  )}
                  <p className="text-correct">
                    {t(s.exam.correctAnswer)}: {t(correctOption.label)}
                  </p>
                </div>

                <p className="mt-2.5 pl-10 text-[13px] leading-relaxed text-ink-soft">
                  {t(question.explanation)}
                </p>
              </li>
            )
          })}
        </motion.ul>

        <motion.div variants={staggerItem} className="mt-6 flex flex-col gap-2.5 sm:flex-row">
          <motion.button
            type="button"
            onClick={restart}
            whileTap={{ scale: 0.97 }}
            transition={springSoft}
            className="focus-ring flex flex-1 items-center justify-center gap-2 rounded-full bg-brand px-5 py-3.5 text-[15px] font-semibold text-white shadow-soft hover:bg-brand-dark"
          >
            <RotateCcw className="h-[18px] w-[18px]" strokeWidth={2.2} />
            {t(s.exam.retry)}
          </motion.button>
          <motion.button
            type="button"
            onClick={() => navigate('/battle')}
            whileTap={{ scale: 0.97 }}
            transition={springSoft}
            className="focus-ring flex-1 rounded-full bg-surface px-5 py-3.5 text-[15px] font-semibold text-brand ring-[1.5px] ring-brand/45 hover:bg-brand-tint"
          >
            {t(s.exam.toBattle)}
          </motion.button>
        </motion.div>
      </motion.div>
    )
  }

  /* ------------------------------- running ----------------------------- */

  const answered = variant.items.filter((i) => answers[i.question.id]).length
  const progress = (answered / variant.items.length) * 100
  const picked = answers[item.question.id] ?? null
  const blockLabel =
    item.block === null
      ? null
      : item.position <= EXAM_STANDALONE_COUNT + 5
        ? t(s.exam.contextOne)
        : t(s.exam.contextTwo)

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="mx-auto max-w-2xl pb-4 lg:max-w-3xl"
    >
      <motion.div variants={staggerItem} className="flex items-center gap-3">
        <IconButton label={t(s.common.back)} onClick={() => navigate('/battle')}>
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </IconButton>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold tracking-tight text-ink">
            {t(s.exam.title)}
          </h1>
          <p className="text-[12.5px] text-ink-faint tabular-nums">
            {item.position}/{variant.items.length} {t(s.exam.counter)}
          </p>
        </div>
        <span
          className={cn(
            'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-bold tabular-nums',
            msLeft <= 5 * 60 * 1000 ? 'bg-wrong-tint text-wrong' : 'bg-cream text-ink-soft',
          )}
        >
          <Clock className="h-[14px] w-[14px]" strokeWidth={2.4} aria-hidden />
          {formatCountdown(msLeft)}
        </span>
      </motion.div>

      <motion.div variants={staggerItem} className="mt-4">
        <ProgressBar percent={progress} height={5} />
      </motion.div>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${round}-${item.question.id}`}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.26, ease: easeOut }}
          className="mt-5"
        >
          {/* The stimulus. Collapsible, because five questions hang on it and
              re-reading it must not mean scrolling back up the page. */}
          {item.block && (
            <div className="mb-3 overflow-hidden rounded-card bg-cream ring-1 ring-line/60">
              <button
                type="button"
                onClick={() => setPassageOpen((open) => !open)}
                className="focus-ring flex w-full items-center gap-3 px-4 py-3 text-left"
              >
                <FileText
                  className="h-4 w-4 shrink-0 text-ink-faint"
                  strokeWidth={2}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[11.5px] font-semibold tracking-wide text-ink-faint uppercase">
                    {blockLabel}
                  </span>
                  <span className="block truncate text-[14px] font-bold text-ink">
                    {t(item.block.title)}
                  </span>
                </span>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 shrink-0 text-ink-faint transition-transform duration-200',
                    passageOpen && 'rotate-180',
                  )}
                  strokeWidth={2}
                  aria-hidden
                />
              </button>
              <AnimatePresence initial={false}>
                {passageOpen && item.block.passage && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: easeOut }}
                    className="overflow-hidden"
                  >
                    <p className="border-t border-line-soft px-4 py-3.5 text-[14px] leading-relaxed text-ink-soft">
                      {t(item.block.passage)}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          <div className="rounded-card bg-surface p-5 shadow-soft ring-1 ring-line/60 sm:p-6">
            <span className="rounded-full bg-cream px-3 py-1 text-[11.5px] font-semibold text-ink-soft">
              {t(item.question.category)}
            </span>
            <h2 className="mt-4 text-[19px] leading-snug font-semibold text-ink sm:text-[21px]">
              {t(item.question.question)}
            </h2>
          </div>

          {/* No reveal colours here — right and wrong are withheld until the
              end, exactly as on the real exam. */}
          <ul className="mt-3 flex flex-col gap-2.5">
            {item.question.options.map((option, optionIndex) => {
              const isPicked = picked === option.id
              return (
                <li key={option.id}>
                  <motion.button
                    type="button"
                    onClick={() => pick(option.id)}
                    whileHover={canHover ? { y: -2 } : undefined}
                    whileTap={{ scale: 0.99 }}
                    transition={springSoft}
                    aria-pressed={isPicked}
                    className={cn(
                      'focus-ring flex w-full items-center gap-3.5 rounded-card px-4 py-3.5 text-left',
                      'ring-1 transition-colors duration-200',
                      isPicked
                        ? 'bg-brand-tint text-ink ring-brand/45'
                        : 'bg-surface text-ink shadow-soft ring-line/60 hover:ring-brand/40',
                    )}
                  >
                    <span
                      className={cn(
                        'grid h-8 w-8 shrink-0 place-items-center rounded-full text-[13px] font-bold transition-colors duration-200',
                        isPicked ? 'bg-brand text-white' : 'bg-cream text-ink-soft',
                      )}
                    >
                      {LETTERS[optionIndex]}
                    </span>
                    <span className="text-[15px] font-medium">{t(option.label)}</span>
                  </motion.button>
                </li>
              )
            })}
          </ul>

          <p className="mt-3 text-center text-[12px] text-ink-faint">
            {t(s.exam.noFeedbackNote)}
          </p>

          {/* Warning shown once, on an attempt to finish with blanks left. */}
          <AnimatePresence>
            {warnBlank && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: easeOut }}
                className="overflow-hidden"
              >
                <div className="mt-3 rounded-card bg-gold-tint p-4 ring-1 ring-gold/35">
                  <p className="text-[13px] font-bold text-ink">{t(s.exam.blankWarnTitle)}</p>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-ink-soft">
                    {t(s.exam.blankWarnText)} <b>{blankCount}</b>. {t(s.exam.blankWarnHint)}
                  </p>
                  <button
                    type="button"
                    onClick={jumpToFirstBlank}
                    className="focus-ring mt-2.5 rounded-full bg-surface px-4 py-2 text-[13px] font-semibold text-brand ring-[1.5px] ring-brand/45 hover:bg-brand-tint"
                  >
                    {t(s.exam.backToBlank)}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-4 flex gap-2.5">
            <motion.button
              type="button"
              onClick={() => goTo(index - 1)}
              disabled={index === 0}
              whileTap={index === 0 ? undefined : { scale: 0.98 }}
              transition={springSoft}
              className={cn(
                'focus-ring flex items-center justify-center gap-2 rounded-full px-5 py-3.5 text-[15px] font-semibold',
                index === 0
                  ? 'cursor-not-allowed bg-surface/60 text-ink-faint ring-1 ring-line/50'
                  : 'bg-surface text-brand ring-[1.5px] ring-brand/45 hover:bg-brand-tint',
              )}
            >
              <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2.2} />
              <span className="hidden sm:inline">{t(s.exam.prev)}</span>
            </motion.button>

            <motion.button
              type="button"
              onClick={advance}
              whileHover={canHover ? { y: -2 } : undefined}
              whileTap={{ scale: 0.98 }}
              transition={springSoft}
              className="focus-ring flex flex-1 items-center justify-center gap-2 rounded-full bg-brand px-5 py-3.5 text-[15px] font-semibold text-white shadow-soft hover:bg-brand-dark"
            >
              {isLast
                ? warnBlank
                  ? t(s.exam.finishAnyway)
                  : t(s.exam.finish)
                : t(s.exam.next)}
              {!isLast && <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.2} />}
            </motion.button>
          </div>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  )
}
