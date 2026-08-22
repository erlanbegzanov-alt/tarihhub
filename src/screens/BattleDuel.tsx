/**
 * The duel engine itself — matchmaking, the live question-by-question race,
 * and the result screen. Shared by BattleCasual.tsx and BattleRanked.tsx,
 * which each fix `mode` and wrap this with their own header and mode-specific
 * content (stats, the weekly board, …); this component only knows how to run
 * one duel in whichever mode it's told.
 */
import { AnimatePresence, motion } from 'framer-motion'
import { Crown, Loader2, Trophy } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FOE_COLOR,
  LeagueCrest,
  OutcomeAvatar,
  RatingMove,
  ratingTierColor,
} from '../components/battle'
import { PlayerAvatar } from '../components/kahoot'
import { ProgressBar, WeeklyTopBadge } from '../components/ui'
import { battleQuestion } from '../data/battleQuestions'
import type { AvatarGender } from '../data/ranks'
import type { QuizQuestion } from '../data/types'
import { s } from '../i18n/strings'
import { useLang } from '../i18n/useLang'
import {
  MAX_BATTLE_XP,
  QUESTION_SECONDS,
  QUEUE_TTL_MS,
  ROUND_SIZE,
  ROUNDS,
  answerXp,
  applyRankedResult,
  clearClaim,
  closeMatch,
  fetchBattlePlayer,
  fetchWeeklyTopUids,
  findMatch,
  joinQueue,
  leaveQueue,
  pushSlot,
  ratingTierFor,
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
  RatingChange,
} from '../lib/battle'
import { cn } from '../lib/cn'
import { isFirebaseReady } from '../lib/firebase'
import { easeOut, springSoft } from '../lib/motion'
import {
  levelInfo,
  recordBattleResult,
  recordCasualDuelResult,
  recordRankedDuelResult,
  useProfile,
} from '../lib/progress'
import type { DuelOpponent } from '../lib/progress'
import { rankTitleText, resolveRankIdentity } from '../lib/rankIdentity'
import { OWNER_EMAIL } from '../lib/rankStyle'
import { useSession } from '../lib/session'

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
  /**
   * Where the rating landed, once Firestore has confirmed the write.
   *
   * Deliberately filled in *after* the outcome is set rather than awaited
   * before it: the result screen must appear the instant the duel is scored,
   * so a slow (or refused) `applyRankedResult` can never leave the reader
   * staring at a wait screen. Until it arrives the rating block shows a
   * spinner, and on a failed write it simply stays absent.
   */
  rating: RatingChange | null
}

/* ------------------------------------------------------------------ */

/**
 * One side of the duel head: avatar, name, rank title, level chip.
 *
 * The avatar is `PlayerAvatar` — the one rendering the whole app uses for a
 * player (rank art, else the Google photo, else an initial on a disc) — with
 * this side's accent as a ring around it. Once `won` is decided the ring turns
 * into the verdict itself (`OutcomeAvatar`), so the head that ran the duel is
 * also what announces who took it, rather than the result screen restating the
 * same two faces underneath it.
 */
function Fighter({
  name,
  photoURL,
  level,
  color,
  me,
  avatarGender,
  avatarTierIndex,
  rankTitle,
  isWeeklyTop,
  won,
}: {
  name: string
  photoURL: string
  level: number
  color: string
  me: boolean
  avatarGender: AvatarGender | null
  avatarTierIndex: number
  rankTitle: string
  isWeeklyTop: boolean
  /** `null` until the duel is scored. */
  won: boolean | null
}) {
  const { t } = useLang()
  return (
    <div className="flex min-w-0 flex-col items-center gap-2 text-center">
      <div className="relative">
        {won === null ? (
          <span
            className="inline-flex rounded-full"
            style={{ boxShadow: `0 0 0 3px color-mix(in srgb, ${color} 35%, transparent)` }}
          >
            <PlayerAvatar
              name={name}
              photoURL={photoURL}
              size={56}
              me={me}
              avatarGender={avatarGender}
              avatarTierIndex={avatarTierIndex}
            />
          </span>
        ) : (
          <OutcomeAvatar
            name={name}
            photoURL={photoURL}
            won={won}
            size={56}
            me={me}
            avatarGender={avatarGender}
            avatarTierIndex={avatarTierIndex}
          />
        )}
        {/* Top-right, so it can never collide with the verdict badge the
            avatar grows in its bottom-right corner once a duel is scored. */}
        {isWeeklyTop && (
          <WeeklyTopBadge
            label={t(s.battle.weeklyTopBadge)}
            compact
            className="absolute -top-1 -right-1 ring-2 ring-surface"
          />
        )}
      </div>
      <span className="max-w-full truncate text-[13.5px] font-bold text-ink">
        {name}
      </span>
      {avatarGender && (
        <span className="max-w-full truncate text-[11px] font-semibold text-ink-faint">
          {rankTitle}
        </span>
      )}
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

export function BattleDuel({
  mode,
  onRankedResult,
  ratingTierIndex,
}: {
  mode: BattleMode
  /** Fired once a ranked duel is scored, so the Ranked screen can refresh its
   *  rating card and the weekly board — data that lives in Firestore, not in
   *  the local profile store, so it can't just react to `useProfile()`. */
  onRankedResult?: () => void
  /** The caller's league (`BattleRanked` reads it off its own rating card) —
   *  biases which difficulty pool each round draws from. Unused in casual. */
  ratingTierIndex?: number
}) {
  const { t } = useLang()
  const session = useSession()
  const profile = useProfile()
  const user = session.user
  const uid = user?.uid ?? null
  const level = levelInfo(profile.xp).level

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
  const [weeklyTopUids, setWeeklyTopUids] = useState<Set<string>>(() => new Set())
  /** The round number to flash centre-screen, or `null` when nothing's showing. */
  const [roundBanner, setRoundBanner] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetchWeeklyTopUids().then((uids) => {
      if (!cancelled) setWeeklyTopUids(uids)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Flashes "Round N — difficulty" the instant a new round's first question
  // loads (index 0, ROUND_SIZE, 2*ROUND_SIZE, …), then clears itself — the
  // banner is purely a beat between rounds, never something to dismiss by hand.
  //
  // The teardown clears the banner as well as the timer: answering the round's
  // first question in under 1400ms moves `index` on (or ends the duel), which
  // re-runs this effect, cancels the pending timeout, and then returns early
  // because the new index no longer starts a round. Without the reset here
  // that leaves the banner up for good — the dimmed overlay ends up sitting
  // over the next question, or over the whole result screen.
  useEffect(() => {
    if (phase !== 'duel' || index % ROUND_SIZE !== 0) return
    setRoundBanner(index / ROUND_SIZE + 1)
    const timer = window.setTimeout(() => setRoundBanner(null), 1400)
    return () => {
      window.clearTimeout(timer)
      setRoundBanner(null)
    }
  }, [phase, index])

  /**
   * Guards the one-time scoring of a finished duel. Kept in a ref rather than
   * read back off the match document: both clients write to that document, so a
   * re-read races and could pay the XP twice.
   */
  const scoredRef = useRef(false)
  const revealRef = useRef(0)

  const rankIdentity = useMemo(
    () =>
      resolveRankIdentity({
        xp: profile.xp,
        avatarGender: profile.avatarGender,
        displayedAvatarTier: profile.displayedAvatarTier,
        displayedRankTier: profile.displayedRankTier,
        isOwner: user?.email === OWNER_EMAIL,
      }),
    [
      profile.xp,
      profile.avatarGender,
      profile.displayedAvatarTier,
      profile.displayedRankTier,
      user?.email,
    ],
  )

  const meta = useMemo<BattlePlayerMeta>(
    () => ({
      displayName: user?.displayName ?? '',
      photoURL: user?.photoURL ?? '',
      level,
      avatarGender: rankIdentity.avatarGender,
      avatarTierIndex: rankIdentity.avatarTierIndex,
      titleTierIndex: rankIdentity.titleTierIndex,
    }),
    [user?.displayName, user?.photoURL, level, rankIdentity],
  )

  const myName = meta.displayName || t(s.battle.you)
  const foeName = opponent?.displayName || t(s.battle.opponent)
  const myRankTitle = t(rankIdentity.titleText)
  const foeRankTitle = opponent
    ? t(rankTitleText(opponent.avatarGender, opponent.titleTierIndex))
    : ''

  /* ---------------------------- identity mirror ---------------------------- */

  useEffect(() => {
    if (!uid) return
    void syncBattlePlayer(uid, meta)
  }, [uid, meta])

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
      void findMatch(uid, mode, ratingTierIndex ?? null).then((foundId) => {
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
  }, [phase, mode, uid, openMatch, ratingTierIndex])

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
          // The scoring effect below may already have raced ahead of this
          // timer — if the opponent had already finished, our own `doneAt`
          // write can round-trip through `watchMatch`'s snapshot listener
          // and score the match (phase 'result') before this fixed
          // `REVEAL_MS` delay elapses. Only fall into 'waiting' if we are
          // still actually mid-duel, so this stale timeout can never stomp
          // an already-scored result back into a wait screen with no way out.
          setPhase((prev) => (prev === 'duel' ? 'waiting' : prev))
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

    // The face across the board, captured as it was at match end. Stored on
    // the history record rather than looked up later, so a history row can
    // draw the same avatar the duel head just showed (see `DuelOpponent`).
    const duelOpponent: DuelOpponent = {
      opponentName: foeName,
      opponentPhotoURL: opponent?.photoURL ?? '',
      opponentAvatarGender: opponent?.avatarGender ?? null,
      opponentAvatarTierIndex: opponent?.avatarTierIndex ?? 0,
    }

    // Real profile XP either way — a casual duel is worth just as much to the
    // reader's level as a ranked one. Only the rating and the weekly board are
    // held back for ranked; each mode keeps its own stats and history.
    recordBattleResult(mine.xp)
    if (ranked) {
      void applyRankedResult(uid, meta, mine.xp, won).then((rating) => {
        onRankedResult?.()
        if (!rating) return
        recordRankedDuelResult({
          opponent: duelOpponent,
          won,
          xpEarned: mine.xp,
          foeXp: foeSlot.xp,
          ratingBefore: rating.before,
          ratingAfter: rating.after,
        })
        // Fills in the rating block the result screen already rendered a
        // placeholder for. Guarded on the outcome still being *this* duel's,
        // so a rematch started before the write landed can't inherit it.
        setOutcome((prev) => (prev && prev.rating === null ? { ...prev, rating } : prev))
      })
    } else {
      recordCasualDuelResult(duelOpponent, won, mine.xp, foeSlot.xp)
    }
    void closeMatch(match.id)

    setOutcome({ myXp: mine.xp, foeXp: foeSlot.xp, won, ranked, rating: null })
    setPhase('result')
  }, [match, slot, foeSlot, uid, meta, timedOut, foeName, opponent, onRankedResult])

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

  /* ---------------------- the rating, as a movement ---------------------- */

  const ratingChange = outcome?.rating ?? null
  const oldTier = ratingTierFor(ratingChange?.before ?? 0)
  const newTier = ratingTierFor(ratingChange?.after ?? 0)
  const oldTierColor = ratingTierColor(oldTier.index)
  const newTierColor = ratingTierColor(newTier.index)
  const leagueUp = ratingChange !== null && newTier.index > oldTier.index

  /**
   * The league bar is animated in two beats so it reads as the rating *moving*
   * rather than as a bar that was always at its new value: it lands on where
   * the rating stood before the duel, then travels to where it stands now.
   *
   * A duel that crossed a tier boundary is the exception — the new tier's
   * progress restarts near zero, so animating to it would show the bar sliding
   * *backwards* on a promotion. Those fill to the top of the tier just left
   * instead, and the promotion itself is carried by the banner above.
   */
  const [barPercent, setBarPercent] = useState(0)
  useEffect(() => {
    if (!ratingChange) return
    const before = ratingTierFor(ratingChange.before).progress
    const after = ratingTierFor(ratingChange.after)
    setBarPercent(before)
    const timer = window.setTimeout(
      () =>
        setBarPercent(
          after.index > ratingTierFor(ratingChange.before).index ? 100 : after.progress,
        ),
      750,
    )
    return () => window.clearTimeout(timer)
  }, [ratingChange])

  const roundDifficultyLabel = [s.battle.roundLight, s.battle.roundMedium, s.battle.roundHard][
    Math.min((roundBanner ?? 1) - 1, 2)
  ]

  return (
    <div className="relative overflow-hidden rounded-card bg-surface shadow-soft ring-1 ring-line/60">
      {/* the beat between rounds — appears the instant a new round's first
          question loads, then clears itself; nothing to dismiss by hand */}
      <AnimatePresence>
        {roundBanner !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: easeOut }}
            className="absolute inset-0 z-20 grid place-items-center bg-ink/55 backdrop-blur-[2px]"
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={springSoft}
              className="rounded-card bg-surface px-7 py-5 text-center shadow-lift"
            >
              <p className="text-[12.5px] font-bold tracking-wide text-ink-faint uppercase">
                {t(s.battle.roundLabel)} {roundBanner} / {ROUNDS}
              </p>
              <p className="mt-1 text-[19px] font-bold text-ink">
                {t(roundDifficultyLabel)}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* duel head + racing bars, once there is a duel to watch */}
      {inDuel && (
        <>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-5 pt-5 pb-4">
            <Fighter
              name={myName}
              photoURL={meta.photoURL}
              level={level}
              color="var(--color-brand)"
              me
              avatarGender={rankIdentity.avatarGender}
              avatarTierIndex={rankIdentity.avatarTierIndex}
              rankTitle={myRankTitle}
              isWeeklyTop={uid !== null && weeklyTopUids.has(uid)}
              won={outcome ? outcome.won : null}
            />
            <span className="grid h-9 w-9 place-items-center rounded-full bg-cream-deep text-[13px] font-bold text-ink-faint">
              VS
            </span>
            <Fighter
              name={foeName}
              photoURL={opponent?.photoURL ?? ''}
              level={opponent?.level ?? 1}
              color={FOE_COLOR}
              me={false}
              avatarGender={opponent?.avatarGender ?? null}
              avatarTierIndex={opponent?.avatarTierIndex ?? 0}
              rankTitle={foeRankTitle}
              isWeeklyTop={opponent !== null && weeklyTopUids.has(opponent.uid)}
              won={outcome ? !outcome.won : null}
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
                <Trophy className="h-7 w-7 text-gold" strokeWidth={1.8} />
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

              {/* The moment the league effects in `LeagueCrest` were written
                  for and never previously had: a rating that just crossed a
                  tier boundary, called out on its own. */}
              <AnimatePresence>
                {leagueUp && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={springSoft}
                    className="mt-5 flex items-center gap-3.5 rounded-tile p-4 text-left ring-1"
                    style={{
                      background: `color-mix(in srgb, ${newTierColor} 12%, var(--color-surface))`,
                      borderColor: 'transparent',
                      ['--tw-ring-color' as string]: `color-mix(in srgb, ${newTierColor} 40%, transparent)`,
                    }}
                  >
                    <LeagueCrest tierIndex={newTier.index} size={46} celebrate />
                    <div className="min-w-0">
                      <p
                        className="text-[15px] font-bold"
                        style={{ color: newTierColor }}
                      >
                        {t(s.battle.leagueUp)} · {t(newTier.tier.name)}
                      </p>
                      <p className="mt-0.5 text-[12.5px] leading-snug text-ink-soft">
                        {t(s.battle.leagueUpText)}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="mt-5 grid grid-cols-2 gap-2.5">
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
              </div>

              {/* Ranked: the rating as a movement with the ladder it moved on,
                  rather than a bare signed number with nothing to read it
                  against. Casual: said plainly that nothing moved. */}
              {outcome.ranked ? (
                <div className="mt-2.5 rounded-tile bg-cream p-4 text-left ring-1 ring-line/60">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11.5px] font-semibold tracking-wide text-ink-faint uppercase">
                      {t(s.battle.ratingMoved)}
                    </span>
                    {outcome.rating ? (
                      <RatingMove
                        before={outcome.rating.before}
                        after={outcome.rating.after}
                      />
                    ) : (
                      <Loader2
                        className="h-4 w-4 animate-spin text-ink-faint"
                        strokeWidth={2}
                        aria-hidden
                      />
                    )}
                  </div>

                  {outcome.rating && (
                    <div className="mt-3.5 flex items-center gap-3">
                      <LeagueCrest
                        tierIndex={leagueUp ? oldTier.index : newTier.index}
                        size={34}
                      />
                      <div className="min-w-0 flex-1">
                        <ProgressBar
                          percent={barPercent}
                          height={8}
                          color={leagueUp ? oldTierColor : newTierColor}
                        />
                        {/* On a promotion the bar and crest belong to the tier
                            just filled, so the caption names the step taken
                            rather than the next target — which the banner
                            above has already announced. */}
                        <p className="mt-1.5 text-[11.5px] text-ink-faint">
                          {leagueUp
                            ? `${t(oldTier.tier.name)} → ${t(newTier.tier.name)}`
                            : newTier.next
                              ? `${t(s.battle.nextTier)} ${t(newTier.next.name)}: ${
                                  newTier.next.min - outcome.rating.after
                                } ${t(s.battle.ratingPoints)}`
                              : t(s.battle.maxTier)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-2.5 text-[12.5px] text-ink-faint">
                  {t(s.battle.noRating)}
                </p>
              )}

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
    </div>
  )
}
