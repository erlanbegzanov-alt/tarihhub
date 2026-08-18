import { AnimatePresence, motion } from 'framer-motion'
import { Crown, Loader2, Swords, Trophy } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FilterChip, ProgressBar, SectionHeading } from '../components/ui'
import { battleQuestion } from '../data/battleQuestions'
import type { QuizQuestion } from '../data/types'
import { s } from '../i18n/strings'
import { useLang } from '../i18n/useLang'
import {
  MAX_BATTLE_XP,
  QUESTION_SECONDS,
  QUEUE_TTL_MS,
  RATING_LOSS,
  RATING_WIN,
  answerXp,
  applyRankedResult,
  clearClaim,
  closeMatch,
  fetchBattlePlayer,
  fetchWeeklyLeaderboard,
  findMatch,
  joinQueue,
  leaveQueue,
  pushSlot,
  slotKeyFor,
  syncBattlePlayer,
  watchClaim,
  watchMatch,
} from '../lib/battle'
import type {
  BattleMatch,
  BattleMode,
  BattlePlayer,
  BattlePlayerMeta,
} from '../lib/battle'
import { cn } from '../lib/cn'
import { isFirebaseReady } from '../lib/firebase'
import { easeOut, springSoft, staggerContainer, staggerItem } from '../lib/motion'
import { levelInfo, recordBattleResult, useProfile } from '../lib/progress'
import { useSession } from '../lib/session'

/** The opponent's accent, kept apart from the brand green the reader owns. */
const FOE_COLOR = 'var(--color-era-alash)'

/** How long a revealed answer stays on screen before the next question. */
const REVEAL_MS = 950
/** Gap between matchmaking sweeps while waiting in the queue. */
const POLL_MS = 1500
/**
 * How long a finished player waits for an opponent who may have closed the tab
 * before the duel is scored on whatever they had. Without this the screen would
 * have no way out of "waiting" at all.
 */
const WAIT_TIMEOUT_MS = 30_000

type Phase = 'idle' | 'searching' | 'duel' | 'waiting' | 'result'

interface Outcome {
  myXp: number
  foeXp: number
  won: boolean
  ranked: boolean
}

/* ------------------------------------------------------------------ */

/** One side of the duel head: avatar, name, level chip. */
function Fighter({
  name,
  photoURL,
  level,
  color,
}: {
  name: string
  photoURL: string
  level: number
  color: string
}) {
  const { t } = useLang()
  return (
    <div className="flex min-w-0 flex-col items-center gap-2 text-center">
      {photoURL ? (
        <img
          src={photoURL}
          alt=""
          referrerPolicy="no-referrer"
          className="h-14 w-14 rounded-full object-cover ring-2 ring-surface"
          style={{ boxShadow: `0 0 0 3px color-mix(in srgb, ${color} 35%, transparent)` }}
        />
      ) : (
        <span
          className="grid h-14 w-14 place-items-center rounded-full text-lg font-bold text-white ring-2 ring-surface"
          style={{
            background: `linear-gradient(155deg, ${color} 0%, color-mix(in srgb, ${color} 62%, #17211e) 100%)`,
          }}
        >
          {name.charAt(0).toUpperCase() || '?'}
        </span>
      )}
      <span className="max-w-full truncate text-[13.5px] font-bold text-ink">
        {name}
      </span>
      <span
        className="rounded-full px-2.5 py-0.5 text-[10.5px] font-bold tabular-nums"
        style={{
          color: `color-mix(in srgb, ${color} 82%, #17211e)`,
          background: `color-mix(in srgb, ${color} 14%, var(--color-surface))`,
        }}
      >
        {t(s.battle.levelShort)} {level}
      </span>
    </div>
  )
}

/** The per-question countdown, drawn as a ring that empties as it runs. */
function TimerRing({ seconds }: { seconds: number }) {
  const radius = 14
  const circumference = 2 * Math.PI * radius
  const left = Math.max(0, Math.min(QUESTION_SECONDS, seconds))
  return (
    <div className="relative h-[34px] w-[34px]" aria-hidden>
      <svg width="34" height="34" className="-rotate-90">
        <circle
          cx="17"
          cy="17"
          r={radius}
          fill="none"
          strokeWidth="4"
          stroke="var(--color-line-soft)"
        />
        <circle
          cx="17"
          cy="17"
          r={radius}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          stroke="var(--color-gold)"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - left / QUESTION_SECONDS)}
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-[12px] font-bold tabular-nums text-ink">
        {left}
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ */

export function Battle() {
  const { t } = useLang()
  const session = useSession()
  const profile = useProfile()
  const user = session.user
  const uid = user?.uid ?? null
  const level = levelInfo(profile.xp).level

  const [mode, setMode] = useState<BattleMode>('casual')
  const [phase, setPhase] = useState<Phase>('idle')
  const [matchId, setMatchId] = useState<string | null>(null)
  const [match, setMatch] = useState<BattleMatch | null>(null)
  const [opponent, setOpponent] = useState<BattlePlayer | null>(null)
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(QUESTION_SECONDS)
  const [answers, setAnswers] = useState<(number | null)[]>([])
  const [myXp, setMyXp] = useState(0)
  const [timedOut, setTimedOut] = useState(false)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [board, setBoard] = useState<BattlePlayer[]>([])

  /**
   * Guards the one-time scoring of a finished duel. Kept in a ref rather than
   * read back off the match document: both clients write to that document, so a
   * re-read races and could pay the XP twice.
   */
  const scoredRef = useRef(false)
  const revealRef = useRef(0)

  const meta = useMemo<BattlePlayerMeta>(
    () => ({
      displayName: user?.displayName ?? '',
      photoURL: user?.photoURL ?? '',
      level,
    }),
    [user?.displayName, user?.photoURL, level],
  )

  const myName = meta.displayName || t(s.battle.you)
  const foeName = opponent?.displayName || t(s.battle.opponent)

  const loadBoard = useCallback(() => {
    void fetchWeeklyLeaderboard().then(setBoard)
  }, [])

  /* ---------------------- mirror + weekly board ---------------------- */

  useEffect(() => {
    if (!uid) return
    void syncBattlePlayer(uid, meta).then(loadBoard)
  }, [uid, meta, loadBoard])

  /* --------------------------- matchmaking --------------------------- */

  const openMatch = useCallback((id: string) => {
    scoredRef.current = false
    setMatchId(id)
    setMatch(null)
    setOpponent(null)
    setIndex(0)
    setPicked(null)
    setSecondsLeft(QUESTION_SECONDS)
    setAnswers([])
    setMyXp(0)
    setTimedOut(false)
    setOutcome(null)
    setPhase('duel')
  }, [])

  useEffect(() => {
    if (phase !== 'searching' || !uid) return
    let stopped = false
    const searchStartedAt = Date.now()

    void joinQueue(uid, mode)

    // Someone claimed us: they have already built the match, so its id is ready.
    // A claim stamped before this search began is a leftover from a tab that was
    // closed mid-duel, and must not drop the reader into a dead match.
    const unwatch = watchClaim(uid, (claimedMatchId, createdAt) => {
      if (stopped || createdAt < searchStartedAt - QUEUE_TTL_MS) return
      stopped = true
      openMatch(claimedMatchId)
    })

    // …and in parallel, keep sweeping the queue ourselves. There is no
    // server-side matchmaker, so both sides look for each other.
    const sweep = () => {
      void findMatch(uid, mode).then((foundId) => {
        if (stopped || !foundId) return
        stopped = true
        openMatch(foundId)
      })
    }
    sweep()
    const poll = window.setInterval(sweep, POLL_MS)

    return () => {
      stopped = true
      window.clearInterval(poll)
      unwatch()
      void leaveQueue(uid)
      void clearClaim(uid)
    }
  }, [phase, mode, uid, openMatch])

  /* ---------------------------- live match ---------------------------- */

  useEffect(() => {
    if (!matchId) return
    return watchMatch(matchId, setMatch)
  }, [matchId])

  const slot = match && uid ? slotKeyFor(match, uid) : null
  const foeSlot = match ? (slot === 'p1' ? match.p2 : match.p1) : null
  const foeUid = match && uid ? (match.players.find((id) => id !== uid) ?? null) : null

  useEffect(() => {
    if (!foeUid) return
    let alive = true
    void fetchBattlePlayer(foeUid).then((player) => {
      if (alive) setOpponent(player)
    })
    return () => {
      alive = false
    }
  }, [foeUid])

  // Joined into one string so the memo below re-runs on the match's real
  // question list and not on every snapshot's fresh array identity.
  const questionKey = match ? match.questionIds.join(',') : ''
  const questions = useMemo<QuizQuestion[]>(
    () =>
      questionKey
        ? questionKey
            .split(',')
            .map(battleQuestion)
            .filter((question): question is QuizQuestion => question !== undefined)
        : [],
    [questionKey],
  )

  // The answer list is sized from the match itself, once it has loaded.
  useEffect(() => {
    if (questions.length === 0) return
    setAnswers((prev) =>
      prev.length === questions.length
        ? prev
        : Array.from({ length: questions.length }, () => null),
    )
  }, [questions.length])

  /* ------------------------------ the clock ------------------------------ */

  useEffect(() => {
    if (phase !== 'duel' || picked !== null || questions.length === 0) return
    setSecondsLeft(QUESTION_SECONDS)
    const tick = window.setInterval(
      () => setSecondsLeft((prev) => Math.max(0, prev - 1)),
      1000,
    )
    return () => window.clearInterval(tick)
  }, [phase, index, picked, questions.length])

  const question = questions[index]

  const choose = useCallback(
    (optionIndex: number) => {
      if (!match || !slot || picked !== null || !question) return
      setPicked(optionIndex)

      const correct =
        optionIndex >= 0 && question.options[optionIndex]?.id === question.correctId
      const nextXp = myXp + answerXp(correct, secondsLeft)
      const nextAnswers = answers.length
        ? [...answers]
        : Array.from({ length: questions.length }, () => null)
      nextAnswers[index] = optionIndex
      setMyXp(nextXp)
      setAnswers(nextAnswers)

      const last = index === questions.length - 1
      void pushSlot(match.id, slot, nextAnswers, nextXp, last)

      revealRef.current = window.setTimeout(() => {
        if (last) {
          setPhase('waiting')
          return
        }
        setIndex((prev) => prev + 1)
        setPicked(null)
        setSecondsLeft(QUESTION_SECONDS)
      }, REVEAL_MS)
    },
    [match, slot, picked, question, myXp, secondsLeft, answers, index, questions.length],
  )

  // Running out of time is an answer too — the miss is recorded as `-1`.
  useEffect(() => {
    if (phase !== 'duel' || picked !== null || secondsLeft > 0) return
    choose(-1)
  }, [phase, picked, secondsLeft, choose])

  useEffect(() => () => window.clearTimeout(revealRef.current), [])

  /* ------------------------------- scoring ------------------------------- */

  useEffect(() => {
    if (phase !== 'waiting') return
    const bail = window.setTimeout(() => setTimedOut(true), WAIT_TIMEOUT_MS)
    return () => window.clearTimeout(bail)
  }, [phase])

  useEffect(() => {
    if (!match || !slot || !foeSlot || !uid || scoredRef.current) return
    const mine = slot === 'p1' ? match.p1 : match.p2
    if (mine.doneAt === null) return
    if (foeSlot.doneAt === null && !timedOut) return

    scoredRef.current = true
    const won = mine.xp >= foeSlot.xp
    const ranked = match.mode === 'ranked'

    // Real profile XP either way — a casual duel is worth just as much to the
    // reader's level as a ranked one. Only the rating and the weekly board are
    // held back for ranked.
    recordBattleResult(mine.xp)
    if (ranked) {
      void applyRankedResult(uid, meta, mine.xp, won).then(loadBoard)
    }
    void closeMatch(match.id)

    setOutcome({ myXp: mine.xp, foeXp: foeSlot.xp, won, ranked })
    setPhase('result')
  }, [match, slot, foeSlot, uid, meta, timedOut, loadBoard])

  /* ------------------------------- render ------------------------------- */

  const reset = () => {
    window.clearTimeout(revealRef.current)
    scoredRef.current = false
    setMatchId(null)
    setMatch(null)
    setOpponent(null)
    setOutcome(null)
    setMyXp(0)
    setIndex(0)
    setPicked(null)
    setAnswers([])
    setTimedOut(false)
    setPhase('idle')
  }

  const inDuel = phase === 'duel' || phase === 'waiting' || phase === 'result'
  const foeXp = outcome?.foeXp ?? foeSlot?.xp ?? 0

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="mx-auto max-w-2xl lg:max-w-3xl"
    >
      <motion.div variants={staggerItem} className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-tint">
          <Swords className="h-5 w-5 text-brand" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold tracking-tight text-ink md:text-[28px]">
            {t(s.battle.title)}
          </h1>
          <p className="text-[13.5px] text-ink-soft">{t(s.battle.subtitle)}</p>
        </div>
      </motion.div>

      {/* mode tabs — the third one is the teacher-hosted mode, not built yet */}
      <motion.div
        variants={staggerItem}
        className="rail-scroll -mx-4 mt-5 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6 md:mx-0 md:px-0"
      >
        <FilterChip
          active={mode === 'casual'}
          onClick={() => {
            if (inDuel) return
            setMode('casual')
          }}
          layoutGroup="battle-mode"
        >
          {t(s.battle.modeCasual)}
        </FilterChip>
        <FilterChip
          active={mode === 'ranked'}
          onClick={() => {
            if (inDuel) return
            setMode('ranked')
          }}
          layoutGroup="battle-mode"
        >
          {t(s.battle.modeRanked)}
        </FilterChip>
        <button
          type="button"
          disabled
          className={cn(
            'relative flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2',
            'bg-surface text-sm font-medium text-ink-faint ring-1 ring-line',
            'cursor-default opacity-70',
          )}
        >
          {t(s.battle.modeKahoot)}
          <span className="rounded-full bg-cream-deep px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-ink-faint">
            {t(s.battle.soon)}
          </span>
        </button>
      </motion.div>

      <motion.div
        variants={staggerItem}
        className="mt-4 overflow-hidden rounded-card bg-surface shadow-soft ring-1 ring-line/60"
      >
        {/* duel head + racing bars, once there is a duel to watch */}
        {inDuel && (
          <>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-5 pt-5 pb-4">
              <Fighter
                name={myName}
                photoURL={meta.photoURL}
                level={level}
                color="var(--color-brand)"
              />
              <span className="grid h-9 w-9 place-items-center rounded-full bg-cream-deep text-[13px] font-bold text-ink-faint">
                VS
              </span>
              <Fighter
                name={foeName}
                photoURL={opponent?.photoURL ?? ''}
                level={opponent?.level ?? 1}
                color={FOE_COLOR}
              />
            </div>

            <div className="grid gap-2 px-5 pb-5">
              <div className="grid grid-cols-[46px_1fr_46px] items-center gap-2.5">
                <span className="text-center text-[12.5px] font-bold tabular-nums text-ink">
                  {myXp}
                </span>
                <ProgressBar
                  percent={(myXp / MAX_BATTLE_XP) * 100}
                  height={10}
                  color="var(--color-brand)"
                />
                <span />
              </div>
              <div className="grid grid-cols-[46px_1fr_46px] items-center gap-2.5">
                <span />
                <ProgressBar
                  percent={(foeXp / MAX_BATTLE_XP) * 100}
                  height={10}
                  color={FOE_COLOR}
                  className="-scale-x-100"
                />
                <span className="text-center text-[12.5px] font-bold tabular-nums text-ink">
                  {foeXp}
                </span>
              </div>
            </div>
          </>
        )}

        <div className="px-5 pb-6">
          <AnimatePresence mode="wait">
            {/* ---------------------------- idle ---------------------------- */}
            {phase === 'idle' && (
              <motion.div
                key="idle"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: easeOut }}
                className="py-10 text-center"
              >
                <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-gold-tint">
                  <Swords className="h-7 w-7 text-gold" strokeWidth={1.8} />
                </span>
                <p className="mx-auto mt-4 max-w-sm text-[14.5px] leading-relaxed text-ink-soft">
                  {t(mode === 'ranked' ? s.battle.rankedHint : s.battle.casualHint)}
                </p>
                {isFirebaseReady && user ? (
                  <motion.button
                    type="button"
                    onClick={() => setPhase('searching')}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    transition={springSoft}
                    className="focus-ring mt-5 rounded-full bg-brand px-6 py-3.5 text-[15px] font-semibold text-white shadow-soft hover:bg-brand-dark"
                  >
                    {t(s.battle.find)}
                  </motion.button>
                ) : (
                  <p className="mt-5 text-[13.5px] font-medium text-ink-faint">
                    {t(s.battle.unavailable)}
                  </p>
                )}
              </motion.div>
            )}

            {/* ------------------------- matchmaking ------------------------- */}
            {phase === 'searching' && (
              <motion.div
                key="searching"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: easeOut }}
                className="py-12 text-center"
              >
                <Loader2
                  className="mx-auto h-11 w-11 animate-spin text-brand"
                  strokeWidth={2}
                  aria-hidden
                />
                <p className="mt-4 text-[14.5px] font-semibold text-ink">
                  {t(s.battle.searching)}
                </p>
                <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed text-ink-soft">
                  {t(s.battle.searchingHint)}
                </p>
                <button
                  type="button"
                  onClick={reset}
                  className="focus-ring mt-5 rounded-full bg-surface px-5 py-2.5 text-[14px] font-semibold text-ink-soft ring-1 ring-line hover:text-ink"
                >
                  {t(s.common.cancel)}
                </button>
              </motion.div>
            )}

            {/* --------------------------- question --------------------------- */}
            {phase === 'duel' && question && (
              <motion.div
                key={`q-${index}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.24, ease: easeOut }}
              >
                <div className="mb-3.5 flex items-center justify-between">
                  <span className="text-[12px] font-bold text-ink-faint">
                    {t(s.battle.question)} {index + 1} / {questions.length}
                  </span>
                  <TimerRing seconds={secondsLeft} />
                </div>

                <h2 className="text-[18px] leading-snug font-bold text-ink sm:text-[19px]">
                  {t(question.question)}
                </h2>

                <ul className="mt-4 grid gap-2.5">
                  {question.options.map((option, optionIndex) => {
                    const revealed = picked !== null
                    const isCorrect = option.id === question.correctId
                    const isPicked = picked === optionIndex
                    return (
                      <li key={option.id}>
                        <motion.button
                          type="button"
                          onClick={() => choose(optionIndex)}
                          disabled={revealed}
                          whileHover={revealed ? undefined : { y: -2 }}
                          whileTap={revealed ? undefined : { scale: 0.99 }}
                          transition={springSoft}
                          className={cn(
                            'focus-ring w-full rounded-tile px-4 py-3.5 text-left',
                            'text-[14.5px] font-semibold ring-[1.5px]',
                            'transition-colors duration-200',
                            !revealed &&
                              'bg-cream text-ink ring-line hover:ring-brand/50',
                            revealed &&
                              isCorrect &&
                              'bg-correct-tint text-ink ring-correct/50',
                            revealed &&
                              isPicked &&
                              !isCorrect &&
                              'bg-wrong-tint text-ink ring-wrong/50',
                            revealed &&
                              !isCorrect &&
                              !isPicked &&
                              'bg-cream/60 text-ink-faint ring-line/50',
                          )}
                        >
                          {t(option.label)}
                        </motion.button>
                      </li>
                    )
                  })}
                </ul>
              </motion.div>
            )}

            {/* loading the match document, or waiting on the opponent */}
            {((phase === 'duel' && !question) || phase === 'waiting') && (
              <motion.div
                key="waiting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: easeOut }}
                className="py-10 text-center"
              >
                <Loader2
                  className="mx-auto h-9 w-9 animate-spin text-brand"
                  strokeWidth={2}
                  aria-hidden
                />
                <p className="mt-3.5 text-[14px] font-semibold text-ink-soft">
                  {t(s.battle.waiting)}
                </p>
              </motion.div>
            )}

            {/* ---------------------------- result ---------------------------- */}
            {phase === 'result' && outcome && (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={springSoft}
                className="pt-2 pb-2 text-center"
              >
                <span
                  className="mx-auto grid h-16 w-16 place-items-center rounded-full"
                  style={{
                    background: outcome.won
                      ? 'var(--color-gold-tint)'
                      : `color-mix(in srgb, ${FOE_COLOR} 14%, var(--color-surface))`,
                  }}
                >
                  {outcome.won ? (
                    <Trophy className="h-7 w-7 text-gold" strokeWidth={1.8} />
                  ) : (
                    <Crown
                      className="h-7 w-7"
                      strokeWidth={1.8}
                      style={{ color: FOE_COLOR }}
                    />
                  )}
                </span>
                <h2
                  className="mt-4 text-2xl font-bold tracking-tight"
                  style={{ color: outcome.won ? 'var(--color-brand)' : FOE_COLOR }}
                >
                  {t(outcome.won ? s.battle.win : s.battle.lose)}
                </h2>
                <p className="mt-1.5 text-[14px] text-ink-soft">
                  {t(outcome.won ? s.battle.winText : s.battle.loseText)}
                </p>

                <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  <div className="rounded-tile bg-cream p-4 ring-1 ring-line/60">
                    <p className="text-xl font-bold tabular-nums text-brand">
                      +{outcome.myXp}
                    </p>
                    <p className="mt-1 text-[11.5px] text-ink-faint">
                      {t(s.battle.xpEarned)}
                    </p>
                  </div>
                  <div className="rounded-tile bg-cream p-4 ring-1 ring-line/60">
                    <p className="text-xl font-bold tabular-nums text-ink">
                      {outcome.foeXp}
                    </p>
                    <p className="mt-1 text-[11.5px] text-ink-faint">
                      {t(s.battle.opponentXp)}
                    </p>
                  </div>
                  <div className="col-span-2 rounded-tile bg-cream p-4 ring-1 ring-line/60 sm:col-span-1">
                    <p
                      className="text-xl font-bold tabular-nums"
                      style={{
                        color: !outcome.ranked
                          ? 'var(--color-ink-faint)'
                          : outcome.won
                            ? 'var(--color-brand)'
                            : FOE_COLOR,
                      }}
                    >
                      {outcome.ranked
                        ? outcome.won
                          ? `+${RATING_WIN}`
                          : `−${RATING_LOSS}`
                        : '—'}
                    </p>
                    <p className="mt-1 text-[11.5px] text-ink-faint">
                      {t(outcome.ranked ? s.battle.ratingDelta : s.battle.noRating)}
                    </p>
                  </div>
                </div>

                <motion.button
                  type="button"
                  onClick={reset}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  transition={springSoft}
                  className="focus-ring mt-5 rounded-full bg-brand px-6 py-3.5 text-[15px] font-semibold text-white shadow-soft hover:bg-brand-dark"
                >
                  {t(s.battle.again)}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* --------------------------- weekly board --------------------------- */}

      <motion.div variants={staggerItem} className="mt-7">
        <SectionHeading title={t(s.battle.boardTitle)} />
        <p className="-mt-1.5 mb-3 text-[13px] leading-relaxed text-ink-soft">
          {t(s.battle.boardHint)}
        </p>

        {board.length === 0 ? (
          <p className="rounded-card bg-surface p-5 text-center text-[13.5px] leading-relaxed text-ink-faint shadow-soft ring-1 ring-line/60">
            {t(s.battle.boardEmpty)}
          </p>
        ) : (
          <ul className="overflow-hidden rounded-card bg-surface shadow-soft ring-1 ring-line/60">
            {board.map((player, position) => {
              const isMe = player.uid === uid
              return (
                <li
                  key={player.uid}
                  className={cn(
                    'grid grid-cols-[26px_30px_1fr_auto] items-center gap-3 px-4 py-3',
                    'border-b border-line-soft last:border-b-0',
                    isMe && 'bg-brand-tint',
                  )}
                >
                  <span
                    className={cn(
                      'text-center text-[13px] font-bold tabular-nums',
                      position < 3 ? 'text-gold' : 'text-ink-faint',
                    )}
                  >
                    {position + 1}
                  </span>
                  {player.photoURL ? (
                    <img
                      src={player.photoURL}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="h-[30px] w-[30px] rounded-full object-cover"
                    />
                  ) : (
                    <span
                      className="grid h-[30px] w-[30px] place-items-center rounded-full text-[12px] font-bold text-white"
                      style={{
                        background: isMe ? 'var(--color-brand)' : FOE_COLOR,
                      }}
                    >
                      {(player.displayName || '?').charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="flex items-baseline gap-1.5">
                      <span className="truncate text-[13.5px] font-bold text-ink">
                        {player.displayName || t(s.battle.opponent)}
                      </span>
                      {isMe && (
                        <span className="shrink-0 text-[10.5px] font-bold text-brand">
                          {t(s.battle.boardYou)}
                        </span>
                      )}
                    </span>
                    <span className="block text-[11px] font-semibold tabular-nums text-ink-faint">
                      {t(s.battle.levelShort)} {player.level}
                    </span>
                  </span>
                  <span className="text-[13px] font-bold tabular-nums text-ink">
                    {player.weekXp} {t(s.common.xp)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </motion.div>
    </motion.div>
  )
}
