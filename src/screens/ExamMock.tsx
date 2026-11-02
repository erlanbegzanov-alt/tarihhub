import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Clock,
  FileText,
  Map as MapIcon,
  RotateCcw,
  Target,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconButton, ProgressBar, SectionHeading } from '../components/ui'
import { topicLabel } from '../data/codifier'
import { s } from '../i18n/strings'
import { useLang } from '../i18n/useLang'
import { ExamMapStimulus } from '../components/ExamMapStimulus'
import { cn } from '../lib/cn'
import {
  EXAM_STANDALONE_COUNT,
  EXAM_THRESHOLD,
  EXAM_TIME_BUDGET_MS,
  EXAM_TOTAL,
  buildExamVariant,
  buildSchoolVariant,
  formatCountdown,
  scoreExam,
} from '../lib/exam'
import type { BreakdownRow, ExamAnswers, ExamItem } from '../lib/exam'
import { schoolVariants } from '../data/schoolVariants'
import type { SchoolVariant } from '../data/types'
import {
  bestByVariant,
  daysUntilExam,
  forecastExam,
  readExamAttempts,
  readExamDate,
  recordExamAttempt,
  saveExamDate,
} from '../lib/examForecast'
import type { ExamAttempt, ExamForecast } from '../lib/examForecast'
import { localDateString, useProfile } from '../lib/progress'
import { canHover, easeOut, springSoft, staggerContainer, staggerItem } from '../lib/motion'

/**
 * The ҰБТ mock (`/exam`): forecast first, then the shelves of variants, the
 * attempt, and the result with its answer sheet.
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

type Phase = 'home' | 'shelves' | 'brief' | 'running' | 'result' | 'retake'

/** How one task of a finished attempt went. */
type Mark = 'right' | 'wrong' | 'blank'

const markOf = (item: ExamItem, answers: ExamAnswers): Mark => {
  const picked = answers[item.question.id] ?? null
  return picked === null ? 'blank' : picked === item.question.correctId ? 'right' : 'wrong'
}

const letterOf = (item: ExamItem, optionId: string) =>
  LETTERS[item.question.options.findIndex((o) => o.id === optionId)] ?? ''

const oneDecimal = (v: number) => v.toFixed(1).replace('.', ',')

const primaryButton =
  'focus-ring flex items-center justify-center gap-2 rounded-full bg-brand px-5 py-3.5 text-[15px] font-semibold text-white shadow-soft hover:bg-brand-dark'
const secondaryButton =
  'focus-ring flex items-center justify-center gap-2 rounded-full bg-surface px-5 py-3.5 text-[15px] font-semibold text-brand ring-[1.5px] ring-brand/45 hover:bg-brand-tint'

/** Back arrow, title, an optional subtitle and right-hand slot — the top row of every phase. */
function ScreenHeader({
  title,
  sub,
  onBack,
  children,
}: {
  title: string
  sub?: ReactNode
  onBack: () => void
  children?: ReactNode
}) {
  const { t } = useLang()
  return (
    <motion.div variants={staggerItem} className="flex items-center gap-3">
      <IconButton label={t(s.common.back)} onClick={onBack}>
        <ArrowLeft className="h-5 w-5" strokeWidth={2} />
      </IconButton>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-bold tracking-tight text-ink">{title}</h1>
        {sub && <p className="text-[12.5px] text-ink-faint tabular-nums">{sub}</p>}
      </div>
      {children}
    </motion.div>
  )
}

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

const SCALE_W = 340
const SCALE_PAD = 14
const AXIS_Y = 50

/** Nysana's rangefinder: the reading, how sure it is, and the official threshold. */
function ForecastScale({
  now,
  low,
  high,
  ahead,
  thresholdLabel,
}: {
  now: number
  low: number
  high: number
  ahead: number | null
  thresholdLabel: string
}) {
  const x = (v: number) =>
    SCALE_PAD + (Math.max(0, Math.min(EXAM_TOTAL, v)) / EXAM_TOTAL) * (SCALE_W - SCALE_PAD * 2)
  const t0 = x(EXAM_THRESHOLD)
  return (
    <svg viewBox={`0 0 ${SCALE_W} 74`} width="100%" className="mt-4" aria-hidden>
      <rect
        x={x(low)}
        y={AXIS_Y - 13}
        width={Math.max(2, x(high) - x(low))}
        height={13}
        className="fill-gold-tint"
      />
      <line
        x1={SCALE_PAD}
        y1={AXIS_Y}
        x2={SCALE_W - SCALE_PAD}
        y2={AXIS_Y}
        className="stroke-line"
        strokeWidth={2}
      />
      {[0, 5, 10, 15, 20].map((v) => (
        <g key={v}>
          <line
            x1={x(v)}
            y1={AXIS_Y}
            x2={x(v)}
            y2={AXIS_Y + 5}
            className="stroke-line"
            strokeWidth={1.5}
          />
          <text
            x={x(v)}
            y={AXIS_Y + 19}
            textAnchor="middle"
            fontSize={10}
            className="fill-ink-faint font-mono"
          >
            {v}
          </text>
        </g>
      ))}
      <line
        x1={t0}
        y1={AXIS_Y - 30}
        x2={t0}
        y2={AXIS_Y + 4}
        className="stroke-ink-faint"
        strokeWidth={1}
        strokeDasharray="3 3"
      />
      <text
        x={t0}
        y={AXIS_Y - 35}
        textAnchor="middle"
        fontSize={9.5}
        letterSpacing="0.14em"
        className="fill-ink-faint font-mono"
      >
        {thresholdLabel.toUpperCase()}
      </text>
      {ahead !== null && Math.abs(ahead - now) > 0.3 && (
        <circle
          cx={x(ahead)}
          cy={AXIS_Y - 6.5}
          r={4}
          fill="none"
          className="stroke-ink-faint"
          strokeWidth={1.5}
        />
      )}
      <line
        x1={x(now)}
        y1={AXIS_Y - 22}
        x2={x(now)}
        y2={AXIS_Y + 6}
        className="stroke-gold"
        strokeWidth={2.5}
      />
      <path
        d={`M ${x(now) - 5} ${AXIS_Y - 28} L ${x(now) + 5} ${AXIS_Y - 28} L ${x(now)} ${AXIS_Y - 20} Z`}
        className="fill-gold"
      />
    </svg>
  )
}

/**
 * Nysana's main screen in TarihHub's colours: the reading, how sure it is,
 * where the line lands in a month, and the days left to the student's own
 * exam. Shown with no mocks yet too — the empty state says what fills it.
 */
function ForecastPanel({
  forecast,
  examDay,
  onExamDay,
}: {
  forecast: ExamForecast
  examDay: string | null
  onExamDay: (day: string | null) => void
}) {
  const { t } = useLang()
  const ahead = forecast.ahead && !forecast.unclear ? forecast.ahead.score : null
  return (
    <motion.section
      variants={staggerItem}
      className="mt-5 rounded-card bg-surface p-5 shadow-soft ring-1 ring-line/60 sm:p-6"
    >
      <div className="flex items-baseline justify-between gap-3 font-mono text-[11px] tracking-[0.16em] text-ink-faint uppercase">
        <span>{t(s.exam.forecastTitle)}</span>
        {examDay && (
          <span className="tabular-nums">
            {daysUntilExam(examDay)} {t(s.exam.daysLeft)}
          </span>
        )}
      </div>
      <p className="mt-3 font-mono leading-none tabular-nums">
        <b className="text-[52px] font-bold text-gold-ink">
          {forecast.now !== null ? oneDecimal(forecast.now) : '—'}
        </b>
        <span className="ml-1.5 text-[20px] text-ink-faint">/ {EXAM_TOTAL}</span>
      </p>
      <p className="mt-2 text-[13.5px] text-ink-soft">
        {forecast.now !== null ? t(s.exam.forecastNow) : t(s.exam.forecastEmpty)}
      </p>

      {forecast.now !== null && forecast.nowBand && (
        <ForecastScale
          now={forecast.now}
          low={forecast.nowBand.low}
          high={forecast.nowBand.high}
          ahead={ahead}
          thresholdLabel={t(s.exam.forecastThreshold)}
        />
      )}

      <div className="mt-4 flex items-center gap-4 rounded-card bg-cream px-4 py-3.5">
        <p className="min-w-0 flex-1 text-[13px] leading-snug text-ink-soft">
          {t(s.exam.forecastAhead)}
        </p>
        <p className="shrink-0 font-mono text-[26px] font-bold text-ink tabular-nums">
          {ahead ?? '—'}
        </p>
      </div>
      {forecast.now !== null && !forecast.ahead && (
        <p className="mt-2.5 text-[13px] leading-relaxed text-ink-soft">
          {t(s.exam.forecastNeed)} <span className="font-bold">{forecast.daysNeeded}</span>
        </p>
      )}
      {forecast.ahead && forecast.unclear && (
        <p className="mt-2.5 text-[13px] leading-relaxed text-ink-soft">
          {t(s.exam.forecastUnclear)}
        </p>
      )}

      <div className="mt-5 border-t border-line-soft pt-4">
        <label className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="font-mono text-[11px] tracking-[0.16em] text-ink-faint uppercase">
            {t(s.exam.examDate)}
          </span>
          <input
            type="date"
            value={examDay ?? ''}
            min={localDateString()}
            onChange={(e) => onExamDay(e.target.value || null)}
            className="focus-ring rounded-full bg-cream px-3 py-1.5 text-[13.5px] font-semibold text-ink tabular-nums ring-1 ring-line/60"
          />
        </label>
        {!examDay && (
          <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{t(s.exam.examDateAsk)}</p>
        )}
      </div>
    </motion.section>
  )
}

/** One variant on a shelf: its name, its best score so far, and the start button. */
function ShelfCard({
  title,
  meta,
  share,
  onStart,
}: {
  title: string
  meta: string
  /** Best score as a share of the paper, or `null` if never sat. */
  share: number | null
  onStart: () => void
}) {
  const { t } = useLang()
  return (
    <div className="flex items-center gap-4 rounded-card bg-surface px-4 py-3.5 shadow-soft ring-1 ring-line/60 sm:px-5">
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold text-ink">{title}</p>
        <p className="mt-0.5 text-[12.5px] leading-snug text-ink-faint">{meta}</p>
        {share !== null && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-cream">
            <div
              className="h-full rounded-full bg-brand"
              style={{ width: `${Math.max(share * 100, share > 0 ? 6 : 0)}%` }}
            />
          </div>
        )}
      </div>
      <motion.button
        type="button"
        onClick={onStart}
        whileTap={{ scale: 0.97 }}
        transition={springSoft}
        className="focus-ring shrink-0 rounded-full bg-brand px-5 py-2.5 text-[14px] font-semibold text-white shadow-soft hover:bg-brand-dark"
      >
        {t(s.exam.start)}
      </motion.button>
    </div>
  )
}

/** One shelf of variants: a heading and what sits on it. */
function Shelf({ title, children }: { title: string; children: ReactNode }) {
  return (
    <motion.section variants={staggerItem} className="mt-6">
      <SectionHeading title={title} />
      {children}
    </motion.section>
  )
}

/**
 * «Қателерді қайта тапсыру»: the tasks missed in this attempt, again, with the
 * answer shown at once — the opposite of the mock, because the point now is to
 * learn the fact, not to measure. Never recorded: it would read as a five-task
 * mock and drag the forecast about.
 */
function RetakeMistakes({ items, onDone }: { items: ExamItem[]; onDone: () => void }) {
  const { t } = useLang()
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const item = items[index]
  const isLast = index === items.length - 1

  const next = () => {
    if (isLast) {
      onDone()
      return
    }
    setIndex(index + 1)
    setPicked(null)
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="mx-auto max-w-2xl pb-4 lg:max-w-3xl"
    >
      <ScreenHeader
        title={t(s.exam.retakeTitle)}
        sub={`${index + 1}/${items.length}`}
        onBack={onDone}
      />
      <motion.p variants={staggerItem} className="mt-3 text-[13px] text-ink-faint">
        {t(s.exam.retakeNote)}
      </motion.p>

      <AnimatePresence mode="wait">
        <motion.div
          key={item.question.id}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.26, ease: easeOut }}
          className="mt-4"
        >
          {item.block?.passage && (
            <div className="mb-3 rounded-card bg-cream px-4 py-3.5 ring-1 ring-line/60">
              <p className="text-[14px] font-bold text-ink">{t(item.block.title)}</p>
              <p className="mt-1.5 text-[14px] leading-relaxed text-ink-soft">
                {t(item.block.passage)}
              </p>
            </div>
          )}

          <div className="rounded-card bg-surface p-5 shadow-soft ring-1 ring-line/60 sm:p-6">
            <span className="font-mono text-[12px] font-bold text-ink-faint">№{item.position}</span>
            <h2 className="mt-2 text-[18px] leading-snug font-semibold whitespace-pre-line text-ink sm:text-[20px]">
              {t(item.question.question)}
            </h2>
          </div>

          <ul className="mt-3 flex flex-col gap-2.5">
            {item.question.options.map((option, optionIndex) => {
              const shown = picked !== null
              const isRight = option.id === item.question.correctId
              const isPicked = option.id === picked
              return (
                <li key={option.id}>
                  <button
                    type="button"
                    disabled={shown}
                    onClick={() => setPicked(option.id)}
                    className={cn(
                      'focus-ring flex w-full items-center gap-3.5 rounded-card px-4 py-3.5 text-left',
                      'ring-1 transition-colors duration-200',
                      !shown
                        ? 'bg-surface text-ink shadow-soft ring-line/60 hover:ring-brand/40'
                        : isRight
                          ? 'bg-correct-tint text-ink ring-correct/50'
                          : isPicked
                            ? 'bg-wrong-tint text-ink ring-wrong/50'
                            : 'bg-surface text-ink-faint ring-line/40',
                    )}
                  >
                    <span
                      className={cn(
                        'grid h-8 w-8 shrink-0 place-items-center rounded-full text-[13px] font-bold',
                        shown && isRight
                          ? 'bg-correct text-white'
                          : shown && isPicked
                            ? 'bg-wrong text-white'
                            : 'bg-cream text-ink-soft',
                      )}
                    >
                      {shown && isRight ? (
                        <Check className="h-4 w-4" strokeWidth={3} />
                      ) : shown && isPicked ? (
                        <X className="h-4 w-4" strokeWidth={3} />
                      ) : (
                        LETTERS[optionIndex]
                      )}
                    </span>
                    <span className="text-[15px] font-medium">{t(option.label)}</span>
                  </button>
                </li>
              )
            })}
          </ul>

          {picked !== null && (
            <>
              <p className="mt-3 rounded-card bg-cream px-4 py-3 text-[13.5px] leading-relaxed text-ink-soft">
                {t(item.question.explanation)}
              </p>
              <motion.button
                type="button"
                onClick={next}
                whileTap={{ scale: 0.98 }}
                transition={springSoft}
                className={cn(primaryButton, 'mt-4 w-full')}
              >
                {isLast ? t(s.exam.retakeDone) : t(s.exam.next)}
                {!isLast && <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.2} />}
              </motion.button>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  )
}

export function ExamMock() {
  const navigate = useNavigate()
  const { t, lang } = useLang()
  // Re-render when the account resolves: the stored mocks are keyed per uid.
  useProfile()

  const [phase, setPhase] = useState<Phase>('home')
  /** Bumped when the exam day is saved, so the home screen re-reads it. */
  const [, setDateVersion] = useState(0)
  const [filter, setFilter] = useState<'all' | Mark>('all')
  /** Bumped to draw a fresh variant — `buildExamVariant` re-runs on change. */
  const [round, setRound] = useState(0)
  /** The school booklet being sat, or `null` for a drawn TarihHub variant. */
  const [booklet, setBooklet] = useState<SchoolVariant | null>(null)
  const variant = useMemo(
    () => (booklet ? buildSchoolVariant(booklet) : buildExamVariant()),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `round` is the retry counter: bumping it is exactly what should re-draw the variant.
    [round, booklet],
  )

  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<ExamAnswers>({})
  const [passageOpen, setPassageOpen] = useState(true)
  const [warnBlank, setWarnBlank] = useState(false)
  const [ranOutOfTime, setRanOutOfTime] = useState(false)
  /** Wall-clock end of our 40-minute budget, set when the attempt starts. */
  const [deadline, setDeadline] = useState<number | null>(null)
  const [msLeft, setMsLeft] = useState(EXAM_TIME_BUDGET_MS)
  /** Finished mocks including this one, set once the result is recorded. */
  const [attempts, setAttempts] = useState<ExamAttempt[] | null>(null)
  const recordedRound = useRef<number | null>(null)

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

  /* Record each finished mock exactly once — the forecast's only input. An
     attempt with nothing answered (opened, then the clock ran out) is not a
     reading of anything and would drag the line down. */
  useEffect(() => {
    if (phase !== 'result' || recordedRound.current === round) return
    recordedRound.current = round
    const answeredAny = variant.items.some((i) => answers[i.question.id])
    const { correct, total } = scoreExam(variant, answers)
    setAttempts(answeredAny ? recordExamAttempt(correct, total, booklet?.id) : readExamAttempts())
  }, [phase, round, variant, answers, booklet])

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
    setAttempts(null)
    setFilter('all')
    setPhase('brief')
  }

  const startVariant = (next: SchoolVariant | null) => {
    setBooklet(next)
    restart()
  }

  const variantLabel = booklet ? `${t(s.exam.variantNo)} ${booklet.id}` : t(s.exam.subtitle)

  /* The answer sheet's dots jump to that task's review, showing every task
     first so the one asked for is not hidden by the filter. */
  const jumpToTask = (position: number) => {
    setFilter('all')
    requestAnimationFrame(() =>
      document
        .getElementById(`exam-task-${position}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
    )
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

  /* ------------------------------- home -------------------------------- */

  if (phase === 'home') {
    return (
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="mx-auto max-w-2xl lg:max-w-3xl"
      >
        <ScreenHeader
          title={t(s.exam.title)}
          sub={t(s.exam.subtitle)}
          onBack={() => navigate('/')}
        />
        <ForecastPanel
          forecast={forecastExam(readExamAttempts())}
          examDay={readExamDate()}
          onExamDay={(day) => {
            saveExamDate(day)
            setDateVersion((v) => v + 1)
          }}
        />
        <motion.div variants={staggerItem} className="mt-4">
          <motion.button
            type="button"
            onClick={() => setPhase('shelves')}
            whileHover={canHover ? { y: -2 } : undefined}
            whileTap={{ scale: 0.98 }}
            transition={springSoft}
            className={cn(primaryButton, 'w-full')}
          >
            {t(s.exam.toVariants)}
            <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </motion.button>
        </motion.div>
      </motion.div>
    )
  }

  /* ------------------------------ shelves ------------------------------ */

  if (phase === 'shelves') {
    const bests = bestByVariant(readExamAttempts())
    return (
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="mx-auto max-w-2xl pb-4 lg:max-w-3xl"
      >
        <ScreenHeader title={t(s.exam.variantsTitle)} onBack={() => setPhase('home')} />

        {/* The official variant has no data yet; the shelf stands so it is
            plain where it will go. */}
        <Shelf title={t(s.exam.shelfOfficial)}>
          <p className="rounded-card border border-dashed border-ink-faint/40 px-4 py-3.5 text-[13.5px] text-ink-faint">
            {t(s.exam.shelfSoon)}
          </p>
        </Shelf>

        <Shelf title={t(s.exam.shelfSchool)}>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {schoolVariants.map((b) => {
              const best = bests.get(b.id)
              return (
                <ShelfCard
                  key={b.id}
                  title={`${t(s.exam.variantNo)} ${b.id}`}
                  meta={
                    best
                      ? `${t(s.exam.bestScore)} ${best.correct}/${best.total} · ${t(s.exam.repeatNote)}`
                      : t(s.exam.randomVariantMeta)
                  }
                  share={best ? best.correct / best.total : null}
                  onStart={() => startVariant(b)}
                />
              )
            })}
          </div>
        </Shelf>

        <Shelf title={t(s.exam.shelfOurs)}>
          <ShelfCard
            title={t(s.exam.randomVariant)}
            meta={t(s.exam.randomVariantMeta)}
            share={null}
            onStart={() => startVariant(null)}
          />
        </Shelf>
      </motion.div>
    )
  }

  /* ------------------------------- retake ------------------------------ */

  if (phase === 'retake') {
    return (
      <RetakeMistakes
        items={variant.items.filter((i) => markOf(i, answers) !== 'right')}
        onDone={() => setPhase('result')}
      />
    )
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
        <ScreenHeader
          title={t(s.exam.title)}
          sub={variantLabel}
          onBack={() => setPhase('shelves')}
        />

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
    const forecast = attempts ? forecastExam(attempts) : null
    const marks = variant.items.map((item) => markOf(item, answers))
    const wrong = result.total - result.correct - result.blank
    const spentMs =
      deadline === null ? null : Math.min(EXAM_TIME_BUDGET_MS, EXAM_TIME_BUDGET_MS - Math.max(0, msLeft))

    /* The sheet in the paper's own three parts: tasks 1–10, then each context. */
    const sheet: { label: string; at: number[] }[] = []
    variant.items.forEach((item, i) => {
      const label =
        item.block === null
          ? t(s.exam.singleTasks)
          : item.position <= EXAM_STANDALONE_COUNT + 5
            ? t(s.exam.contextOne)
            : t(s.exam.contextTwo)
      const part = sheet.find((p) => p.label === label)
      if (part) part.at.push(i)
      else sheet.push({ label, at: [i] })
    })

    const filters: { key: 'all' | Mark; label: string; n: number }[] = [
      { key: 'all', label: t(s.exam.filterAll), n: result.total },
      { key: 'wrong', label: t(s.exam.filterWrong), n: wrong },
      { key: 'blank', label: t(s.exam.filterBlank), n: result.blank },
      { key: 'right', label: t(s.exam.filterRight), n: result.correct },
    ]
    const shown = variant.items.filter((_, i) => filter === 'all' || marks[i] === filter)

    return (
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="mx-auto max-w-2xl pb-4 lg:max-w-3xl"
      >
        <ScreenHeader
          title={t(s.exam.resultTitle)}
          sub={booklet ? variantLabel : undefined}
          onBack={() => setPhase('home')}
        />

        {ranOutOfTime && (
          <motion.p
            variants={staggerItem}
            className="mt-4 rounded-card bg-gold-tint px-4 py-3 text-[13.5px] leading-relaxed text-ink-soft ring-1 ring-gold/35"
          >
            <span className="font-bold text-ink">{t(s.exam.timeUp)}.</span>{' '}
            {t(s.exam.timeUpText)}
          </motion.p>
        )}

        {/* Score, forecast, time — the three numbers a finished paper gives. */}
        <motion.div variants={staggerItem} className="mt-4 grid gap-2.5 sm:grid-cols-3">
          <section className="rounded-card bg-surface p-4 shadow-soft ring-1 ring-line/60">
            <p className="font-mono text-[11px] tracking-[0.16em] text-ink-faint uppercase">
              {t(s.exam.score)}
            </p>
            <p className="mt-1.5 font-mono leading-none tabular-nums">
              <b className="text-[40px] font-bold text-brand">{result.correct}</b>
              <span className="text-[18px] text-ink-faint">/{result.total}</span>
            </p>
            <p
              className={cn(
                'mt-2 text-[12.5px] leading-snug',
                result.passedThreshold ? 'text-ink-soft' : 'font-semibold text-wrong',
              )}
            >
              {result.passedThreshold ? t(s.exam.thresholdOk) : t(s.exam.thresholdFail)}
            </p>
          </section>
          <section className="rounded-card bg-surface p-4 shadow-soft ring-1 ring-line/60">
            <p className="font-mono text-[11px] tracking-[0.16em] text-ink-faint uppercase">
              {t(s.exam.forecastTitle)}
            </p>
            <p className="mt-1.5 font-mono leading-none tabular-nums">
              <b className="text-[40px] font-bold text-gold-ink">
                {forecast && forecast.now !== null ? oneDecimal(forecast.now) : '—'}
              </b>
              {forecast?.ahead && !forecast.unclear && (
                <span className="text-[18px] text-ink-faint"> → {forecast.ahead.score}</span>
              )}
            </p>
            <p className="mt-2 text-[12.5px] leading-snug text-ink-soft">
              {forecast?.ahead && !forecast.unclear
                ? t(s.exam.forecastAheadShort)
                : t(s.exam.forecastNow)}
            </p>
          </section>
          <section className="rounded-card bg-surface p-4 shadow-soft ring-1 ring-line/60">
            <p className="font-mono text-[11px] tracking-[0.16em] text-ink-faint uppercase">
              {t(s.exam.time)}
            </p>
            <p className="mt-1.5 font-mono text-[40px] leading-none font-bold text-ink tabular-nums">
              {spentMs === null ? '—' : formatCountdown(spentMs)}
            </p>
            <p className="mt-2 text-[12.5px] leading-snug text-ink-soft">{t(s.exam.timeOf)}</p>
          </section>
        </motion.div>

        {result.blank > 0 && (
          <motion.p
            variants={staggerItem}
            className="mt-2.5 text-[13px] leading-relaxed text-ink-soft"
          >
            {t(s.exam.blankLeft)}: <span className="font-bold">{result.blank}</span>.{' '}
            {t(s.exam.blankCost)}
          </motion.p>
        )}

        {/* The answer sheet: every task at a glance, a tap away from its review. */}
        <motion.section
          variants={staggerItem}
          className="mt-3 rounded-card bg-surface p-4 shadow-soft ring-1 ring-line/60 sm:p-5"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-mono text-[11px] tracking-[0.16em] text-ink-faint uppercase">
              {t(s.exam.answerSheet)}
            </h2>
            <p className="text-[12.5px] text-ink-soft tabular-nums">
              {t(s.exam.filterRight)} {result.correct} · {t(s.exam.filterWrong)} {wrong} ·{' '}
              {t(s.exam.filterBlank)} {result.blank}
            </p>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-3">
            {sheet.map((part) => (
              <div key={part.label}>
                <p className="mb-1.5 text-[12px] text-ink-faint">{part.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {part.at.map((i) => {
                    const { position } = variant.items[i]
                    return (
                      <button
                        key={position}
                        type="button"
                        onClick={() => jumpToTask(position)}
                        aria-label={`№${position}`}
                        className={cn(
                          'focus-ring grid h-9 w-9 place-items-center rounded-full font-mono text-[13px] font-bold tabular-nums',
                          marks[i] === 'right'
                            ? 'bg-correct-tint text-correct'
                            : marks[i] === 'wrong'
                              ? 'bg-wrong-tint text-wrong ring-2 ring-wrong'
                              : 'border border-dashed border-line text-ink-faint',
                        )}
                      >
                        {position}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Task-by-task review — the explanations withheld during the attempt. */}
        <motion.div variants={staggerItem} className="mt-4 flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
              className={cn(
                'focus-ring rounded-full px-3.5 py-1.5 text-[13px] font-semibold tabular-nums',
                filter === f.key
                  ? 'bg-brand text-white'
                  : 'bg-surface text-ink-soft ring-1 ring-line/60 hover:ring-brand/40',
              )}
            >
              {f.label} {f.n}
            </button>
          ))}
        </motion.div>
        <motion.ul variants={staggerItem} className="mt-3 flex flex-col gap-2.5">
          {shown.length === 0 && (
            <li className="text-[13.5px] text-ink-faint">{t(s.exam.filterNone)}</li>
          )}
          {shown.map((item) => {
            const { position, question } = item
            const mark = markOf(item, answers)
            const picked = answers[question.id]
            const correctOption = question.options.find((o) => o.id === question.correctId)!
            const pickedOption = question.options.find((o) => o.id === picked)

            return (
              <li
                key={question.id}
                id={`exam-task-${position}`}
                className={cn(
                  'scroll-mt-24 rounded-card bg-surface p-4 shadow-soft ring-1',
                  mark === 'wrong' ? 'ring-wrong/45' : 'ring-line/60',
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      'shrink-0 pt-px font-mono text-[13px] font-bold tabular-nums',
                      mark === 'right'
                        ? 'text-correct'
                        : mark === 'wrong'
                          ? 'text-wrong'
                          : 'text-ink-faint',
                    )}
                  >
                    №{position}
                  </span>
                  <p className="min-w-0 flex-1 text-[14.5px] leading-snug font-semibold whitespace-pre-line text-ink">
                    {t(question.question)}
                  </p>
                </div>

                <div className="mt-3 grid gap-2 text-[13px] leading-snug sm:grid-cols-2">
                  {mark !== 'right' && (
                    <p
                      className={cn(
                        'rounded-card px-3.5 py-2.5',
                        mark === 'blank' ? 'bg-cream text-ink-faint' : 'bg-wrong-tint text-wrong',
                      )}
                    >
                      {mark === 'blank' || !pickedOption
                        ? t(s.exam.leftBlank)
                        : `${t(s.exam.yourAnswer)}: ${letterOf(item, pickedOption.id)} · ${t(pickedOption.label)}`}
                    </p>
                  )}
                  <p
                    className={cn(
                      'rounded-card bg-correct-tint px-3.5 py-2.5 text-correct',
                      mark === 'right' && 'sm:col-span-2',
                    )}
                  >
                    {t(s.exam.correctAnswer)}: {letterOf(item, correctOption.id)} ·{' '}
                    {t(correctOption.label)}
                  </p>
                </div>

                <p className="mt-2.5 text-[13px] leading-relaxed text-ink-soft">
                  {t(question.explanation)}
                </p>
              </li>
            )
          })}
        </motion.ul>

        <motion.div variants={staggerItem} className="mt-6">
          <SectionHeading title={t(s.exam.byTopic)} />
        </motion.div>
        <motion.div variants={staggerItem}>
          <BreakdownList rows={result.byTopic} label={(id) => topicLabel(id, lang)} />
        </motion.div>

        <motion.div variants={staggerItem} className="mt-6 flex flex-col gap-2.5 sm:flex-row">
          {result.correct < result.total && (
            <motion.button
              type="button"
              onClick={() => setPhase('retake')}
              whileTap={{ scale: 0.97 }}
              transition={springSoft}
              className={cn(primaryButton, 'flex-1')}
            >
              <RotateCcw className="h-[18px] w-[18px]" strokeWidth={2.2} />
              {t(s.exam.retakeWrong)}
            </motion.button>
          )}
          <motion.button
            type="button"
            onClick={() => setPhase('shelves')}
            whileTap={{ scale: 0.97 }}
            transition={springSoft}
            className={cn(result.correct < result.total ? secondaryButton : primaryButton, 'flex-1')}
          >
            {t(s.exam.retry)}
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
        <IconButton label={t(s.common.back)} onClick={() => navigate('/')}>
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
                {item.block.kind === 'map' ? (
                  <MapIcon className="h-4 w-4 shrink-0 text-ink-faint" strokeWidth={2} aria-hidden />
                ) : (
                  <FileText className="h-4 w-4 shrink-0 text-ink-faint" strokeWidth={2} aria-hidden />
                )}
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
                {passageOpen && (item.block.passage || item.block.map) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: easeOut }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-line-soft px-4 py-3.5">
                      {item.block.passage && (
                        <p className="text-[14px] leading-relaxed text-ink-soft">
                          {t(item.block.passage)}
                        </p>
                      )}
                      {/* Tasks 11–15 of a real variant are unanswerable without
                          the map itself, so this is the stimulus, not an
                          illustration beside one. */}
                      {item.block.map && (
                        <ExamMapStimulus
                          eraKey={item.block.map.eraKey}
                          markers={item.block.map.markers}
                          route={item.block.map.route}
                          className={item.block.passage ? 'mt-3.5' : undefined}
                        />
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          <div className="rounded-card bg-surface p-5 shadow-soft ring-1 ring-line/60 sm:p-6">
            <span className="rounded-full bg-cream px-3 py-1 text-[11.5px] font-semibold text-ink-soft">
              {t(item.question.category)}
            </span>
            <h2 className="mt-4 text-[19px] leading-snug font-semibold whitespace-pre-line text-ink sm:text-[21px]">
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
