/**
 * The duel engine itself — matchmaking, the live question-by-question race,
 * and the result screen.
 *
 * Mounted by `BattleDuelScreen.tsx` alone, on its own route
 * (`/battle/casual/duel`, `/battle/ranked/duel`), with nothing else on the
 * page. It used to sit inline under each mode screen's rating card, league
 * board and history list, which is exactly what got in the way of a duel being
 * played; the decision to search is now made *before* this mounts, so there is
 * no idle state here at all — it starts searching the moment it appears and
 * hands control back through `onExit`.
 *
 * With no server-side matchmaker, an empty queue means an indefinite wait, so a
 * casual search that finds nobody offers a bot duel instead — entirely local,
 * always labelled, and never in ranked (see `src/lib/battleBot.ts`).
 */
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Crown, Loader2, Trophy, UserX } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BotChip,
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
  PRESENCE_AFK_CONFIRM_MS,
  PRESENCE_GRACE_MS,
  PRESENCE_PING_MS,
  PRESENCE_STALE_MS,
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
  pingPresence,
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
import { BOT_UID, botAnswerXp, createBotDuel, isBotMatchId } from '../lib/battleBot'
import type { BotAnswer, BotDuel } from '../lib/battleBot'
import { cn } from '../lib/cn'
import { isFirebaseReady } from '../lib/firebase'
import { canHover, easeOut, springSoft } from '../lib/motion'
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
/**
 * How long a casual search runs before the bot is offered, and how long after
 * that before it simply starts.
 *
 * The offer comes early enough that the spinner never feels like a dead end,
 * and the auto-start is the answer to the real complaint behind this: on a
 * quiet evening there is nobody in the queue at all, and the reader should end
 * up in a duel rather than staring at a loader. A real opponent still wins the
 * race — the queue keeps being swept the whole time, and whoever lands first
 * opens the match.
 */
const BOT_OFFER_MS = 8_000
const BOT_AUTO_MS = 20_000

/**
 * How often the AFK check re-evaluates. Staleness is a clock reading, not an
 * event: once the opponent stops writing, no snapshot arrives to notice it
 * with, so something local has to keep looking.
 */
const AFK_CHECK_MS = 1_000

type Phase = 'searching' | 'duel' | 'waiting' | 'result' | 'ended'

interface Outcome {
  myXp: number
  foeXp: number
  won: boolean
  ranked: boolean
  /** The duel was closed out early because the opponent stopped answering. */
  afk: boolean
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
  isBot = false,
  afk = false,
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
  /** Marks the practice bot, so its side of the head says so throughout. */
  isBot?: boolean
  /** This side has stopped sending heartbeats — stamp them. */
  afk?: boolean
  /** `null` until the duel is scored. */
  won: boolean | null
}) {
  const { t } = useLang()
  const reduce = useReducedMotion()
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

        {/* The rubber stamp: it should land, not appear. The mark comes in
            oversized, over-rotated and transparent, and an under-damped spring
            drives it down onto the face with a visible overshoot, while a ring
            snaps outward from the point of impact and dies. Both are the app's
            own `--color-wrong`, and both collapse to the settled state when the
            reader has asked for reduced motion. */}
        <AnimatePresence>
          {afk && (
            <motion.span
              key="afk"
              aria-hidden
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="pointer-events-none absolute -inset-0.5 z-10 grid place-items-center rounded-full"
              style={{
                background: 'color-mix(in srgb, var(--color-ink) 42%, transparent)',
              }}
            >
              {!reduce && (
                <motion.span
                  className="absolute inset-0 rounded-full"
                  initial={{ opacity: 0.7, scale: 0.85 }}
                  animate={{ opacity: 0, scale: 2 }}
                  transition={{ duration: 0.55, ease: easeOut }}
                  style={{ boxShadow: '0 0 0 3px var(--color-wrong)' }}
                />
              )}
              <motion.span
                initial={
                  reduce
                    ? { opacity: 1, scale: 1, rotate: -18 }
                    : { opacity: 0, scale: 2.9, rotate: -48 }
                }
                animate={{ opacity: 1, scale: 1, rotate: -18 }}
                transition={
                  reduce
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 900, damping: 15, mass: 1.15 }
                }
                className="rounded-[3px] px-1.5 py-px text-[12px] leading-tight font-black tracking-[0.14em] whitespace-nowrap uppercase"
                style={{
                  color: 'var(--color-wrong)',
                  border: '2.5px solid var(--color-wrong)',
                  background: 'color-mix(in srgb, var(--color-surface) 86%, transparent)',
                }}
              >
                {t(s.battle.afkStamp)}
              </motion.span>
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <span className="max-w-full truncate text-[13.5px] font-bold text-ink">
        {name}
      </span>
      {isBot && <BotChip />}
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
  onExit,
  onRankedResult,
  ratingTierIndex,
}: {
  mode: BattleMode
  /** Leaves the duel screen — cancelling the search, or done with the result.
   *  The mode screen it returns to refetches its own numbers on mount, so the
   *  record and the history are already up to date when the reader lands. */
  onExit: () => void
  /** Fired once a ranked duel is scored, so the duel screen can refresh the
   *  rating it derives `ratingTierIndex` from — a rematch started from the
   *  result screen then draws its questions from the league just reached. */
  onRankedResult?: () => void
  /** The caller's league (`BattleDuelScreen` reads it off `battlePlayers/*`) —
   *  biases which difficulty pool each round draws from. Unused in casual. */
  ratingTierIndex?: number
}) {
  const { t } = useLang()
  const session = useSession()
  const profile = useProfile()
  const user = session.user
  const uid = user?.uid ?? null
  const level = levelInfo(profile.xp).level

  // Searching from the first frame: this screen is only ever reached by
  // pressing "найти соперника" on the mode screen, so an idle state here would
  // just be that same decision asked a second time.
  const [phase, setPhase] = useState<Phase>('searching')
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
  /** True once the search has run long enough to offer the bot (casual only). */
  const [botOffered, setBotOffered] = useState(false)
  /**
   * The opponent's heartbeat has gone quiet. Flagging is not the same as
   * ending: this only raises the stamp and the offer, and clears itself again
   * if they come back — a hiccup shouldn't pull anyone out of a live duel.
   */
  const [foeAfk, setFoeAfk] = useState(false)
  /** The reader took that offer: score this duel where it stands. */
  const [afkResolved, setAfkResolved] = useState(false)

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
  /** This bot duel's whole script, or `null` when the opponent is a person. */
  const botPlanRef = useRef<BotAnswer[] | null>(null)

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

  /**
   * Opens a duel. A real match arrives as a bare id — its document then streams
   * in over `watchMatch` — while a bot duel arrives whole, because there is no
   * document to stream: its match, its opponent and its script are all built
   * client-side and simply handed over here.
   */
  const openMatch = useCallback((id: string, bot?: BotDuel) => {
    scoredRef.current = false
    botPlanRef.current = bot?.answers ?? null
    setMatchId(id)
    setMatch(bot?.match ?? null)
    setOpponent(bot?.opponent ?? null)
    setIndex(0)
    setPicked(null)
    setSecondsLeft(QUESTION_SECONDS)
    setAnswers([])
    setMyXp(0)
    setTimedOut(false)
    setFoeAfk(false)
    setAfkResolved(false)
    setOutcome(null)
    setPhase('duel')
  }, [])

  const startBotDuel = useCallback(() => {
    if (!uid) return
    const duel = createBotDuel(uid)
    openMatch(duel.match.id, duel)
  }, [uid, openMatch])

  /**
   * The bot fallback, casual only.
   *
   * Two timers on the same search: the offer, and — if the reader neither
   * accepts it nor gets matched — the duel starting on its own. Ranked is left
   * out deliberately: a rating that can be climbed against a script would stop
   * meaning anything, so an empty ranked queue stays an honest wait.
   */
  useEffect(() => {
    if (phase !== 'searching' || mode !== 'casual' || !uid) return
    setBotOffered(false)
    const offer = window.setTimeout(() => setBotOffered(true), BOT_OFFER_MS)
    const auto = window.setTimeout(startBotDuel, BOT_AUTO_MS)
    return () => {
      window.clearTimeout(offer)
      window.clearTimeout(auto)
    }
  }, [phase, mode, uid, startBotDuel])

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

  /** A bot duel has no match document, so nothing here may reach Firestore. */
  const vsBot = matchId !== null && isBotMatchId(matchId)

  useEffect(() => {
    if (!matchId || vsBot) return
    return watchMatch(matchId, setMatch)
  }, [matchId, vsBot])

  const slot = match && uid ? slotKeyFor(match, uid) : null
  const foeSlot = match ? (slot === 'p1' ? match.p2 : match.p1) : null
  const foeUid = match && uid ? (match.players.find((id) => id !== uid) ?? null) : null

  // The bot has no mirror to read — `openMatch` was handed its card already.
  useEffect(() => {
    if (!foeUid || foeUid === BOT_UID) return
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
      if (vsBot) {
        // No document to push to — the same numbers go straight into the local
        // match instead. `doneAt` is deliberately *not* stamped here: against a
        // bot the scoring effect would fire the instant it lands and replace
        // the last question's reveal with the result screen, so the stamp waits
        // for the reveal below, the way a Firestore round-trip does naturally.
        setMatch((prev) =>
          prev ? { ...prev, p1: { ...prev.p1, answers: nextAnswers, xp: nextXp } } : prev,
        )
      } else {
        void pushSlot(match.id, slot, nextAnswers, nextXp, last)
      }

      revealRef.current = window.setTimeout(() => {
        if (last) {
          if (vsBot) {
            setMatch((prev) =>
              prev ? { ...prev, p1: { ...prev.p1, doneAt: Date.now() } } : prev,
            )
          }
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
    [
      match,
      slot,
      picked,
      question,
      myXp,
      secondsLeft,
      answers,
      index,
      questions.length,
      vsBot,
    ],
  )

  /* ------------------------------ the bot ------------------------------ */

  /**
   * Plays the bot's side of a bot duel: one planned answer at a time, its XP
   * added to `p2` exactly as a real opponent's would arrive over the snapshot
   * listener, so the racing bar, the wait screen and the scoring all work on
   * the code they already had.
   *
   * Keyed off the match rather than the phase on purpose — the reader finishing
   * first moves the phase to 'waiting', and the bot has to keep playing through
   * that, which is the whole point of the wait.
   */
  useEffect(() => {
    const plan = botPlanRef.current
    if (!vsBot || !matchId || !plan) return
    let step = 0
    let timer = 0

    const play = () => {
      const answer = plan[step]
      if (!answer) return
      timer = window.setTimeout(() => {
        const last = step === plan.length - 1
        const gained = botAnswerXp(answer)
        setMatch((prev) =>
          prev
            ? {
                ...prev,
                p2: {
                  ...prev.p2,
                  xp: prev.p2.xp + gained,
                  doneAt: last ? Date.now() : prev.p2.doneAt,
                },
              }
            : prev,
        )
        step += 1
        if (!last) timer = window.setTimeout(play, REVEAL_MS)
      }, answer.afterMs)
    }
    play()

    return () => window.clearTimeout(timer)
  }, [vsBot, matchId])

  // Running out of time is an answer too — the miss is recorded as `-1`.
  useEffect(() => {
    if (phase !== 'duel' || picked !== null || secondsLeft > 0) return
    choose(-1)
  }, [phase, picked, secondsLeft, choose])

  useEffect(() => () => window.clearTimeout(revealRef.current), [])

  /* ------------------------------ presence ------------------------------ */

  /*
   * The complaint this answers: backing out the instant a match is found is
   * easy to do by accident, and it used to leave the other player alone with
   * nine questions, no sign anything was wrong, and no consequence for the one
   * who left. There is no server to notice that, so the two clients tell each
   * other directly — see the presence block in `src/lib/battle.ts`.
   */

  /** "Still here", for as long as this player has a real duel open. */
  useEffect(() => {
    if (vsBot || !matchId || !slot) return
    if (phase !== 'duel' && phase !== 'waiting') return
    void pingPresence(matchId, slot)
    const beat = window.setInterval(
      () => void pingPresence(matchId, slot),
      PRESENCE_PING_MS,
    )
    return () => window.clearInterval(beat)
  }, [vsBot, matchId, slot, phase])

  /**
   * Drops the current duel and goes back to the search screen — no stamp, no
   * forfeit, no rating touched. Shared by the rematch button and by the
   * never-joined branch below, which needs the exact same reset.
   */
  const returnToSearch = useCallback(() => {
    window.clearTimeout(revealRef.current)
    scoredRef.current = false
    botPlanRef.current = null
    setMatchId(null)
    setMatch(null)
    setOpponent(null)
    setOutcome(null)
    setMyXp(0)
    setIndex(0)
    setPicked(null)
    setAnswers([])
    setTimedOut(false)
    setFoeAfk(false)
    setAfkResolved(false)
    setBotOffered(false)
    setPhase('searching')
  }, [])

  /**
   * Closes the duel where it stands once the opponent's silence is confirmed:
   * the final slot is pushed with `done` first, so the player who walked away
   * comes back to a match that agrees it is over rather than one they can
   * keep answering into.
   */
  const endAgainstAfk = useCallback(() => {
    if (!match || !slot || scoredRef.current || afkResolved) return
    window.clearTimeout(revealRef.current)
    void pushSlot(
      match.id,
      slot,
      answers.length ? answers : Array.from({ length: questions.length }, () => null),
      myXp,
      true,
    )
    setAfkResolved(true)
  }, [match, slot, afkResolved, answers, questions.length, myXp])

  /**
   * …and reading the other side of it. Deliberately on a local interval rather
   * than on the snapshot listener: the whole signal here is a write that *stops*
   * arriving, so nothing would ever fire to notice it.
   *
   * Three things keep this from crying wolf. A grace period from match creation,
   * so a first heartbeat still in flight is never mistaken for an empty chair.
   * A `doneAt` check, because a player who has finished their nine questions has
   * every right to close the tab. And `lastSeenAt === 0`, which means a match
   * document written before presence existed at all — no signal, not absence.
   * Bot duels are excluded outright: the script has no presence to report.
   *
   * The stamp and the forfeit fire at two different points on the same clock:
   * `PRESENCE_STALE_MS` just raises the stamp, so the reader sees something is
   * wrong; only past `PRESENCE_AFK_CONFIRM_MS` — plenty of room for an ordinary
   * hiccup to catch back up on its own — does this close the duel and hand the
   * win to whoever is still here, with no click required.
   */
  useEffect(() => {
    if (vsBot || !match || !foeSlot || afkResolved) return
    if (phase !== 'duel' && phase !== 'waiting') return
    if (foeSlot.doneAt !== null || foeSlot.lastSeenAt === 0) {
      setFoeAfk(false)
      return
    }
    // `lastSeenAt` starts out seeded to the match's own `createdAt` (see
    // `emptySlot`) and only ever moves forward once its owner's client
    // actually opens this duel and starts pinging. If it's still sitting at
    // that seed when staleness would otherwise fire, the other side never
    // opened this match at all — most often "играть снова" pairing against a
    // leftover queue entry from the duel that just ended. That's a failed
    // pairing, not a walkout: no stamp, no forfeit, just a quiet re-search.
    const neverJoined = foeSlot.lastSeenAt <= match.createdAt
    const check = () => {
      const now = Date.now()
      if (now - match.createdAt < PRESENCE_GRACE_MS) return
      const silence = now - foeSlot.lastSeenAt
      const stale = silence > PRESENCE_STALE_MS
      if (stale && neverJoined) {
        returnToSearch()
        return
      }
      setFoeAfk(stale)
      if (stale && silence > PRESENCE_AFK_CONFIRM_MS) {
        endAgainstAfk()
      }
    }
    check()
    const timer = window.setInterval(check, AFK_CHECK_MS)
    return () => window.clearInterval(timer)
  }, [vsBot, match, foeSlot, phase, afkResolved, returnToSearch, endAgainstAfk])

  /**
   * The other end of the same story: the player who left, coming back to a duel
   * the other side has already closed. Only ever from 'duel' — a reader sitting
   * in 'waiting' has already finished and is owed their result screen, which
   * `WAIT_TIMEOUT_MS` gets them either way.
   */
  useEffect(() => {
    if (vsBot || !match || scoredRef.current || afkResolved) return
    if (phase !== 'duel' || match.status !== 'done') return
    window.clearTimeout(revealRef.current)
    setPhase('ended')
  }, [vsBot, match, phase, afkResolved])

  /* ------------------------------- scoring ------------------------------- */

  useEffect(() => {
    if (phase !== 'waiting') return
    const bail = window.setTimeout(() => setTimedOut(true), WAIT_TIMEOUT_MS)
    return () => window.clearTimeout(bail)
  }, [phase])

  useEffect(() => {
    if (!match || !slot || !foeSlot || !uid || scoredRef.current) return
    const mine = slot === 'p1' ? match.p1 : match.p2
    // An abandoned duel is a variant ending, not a second scoring flow: it
    // simply satisfies both gates on its own, and everything below — the profile
    // XP, the ranked write, the history row, `closeMatch` — runs unchanged.
    if (!afkResolved) {
      if (mine.doneAt === null) return
      if (foeSlot.doneAt === null && !timedOut) return
    }

    scoredRef.current = true
    // On an abandonment the local tally is the authoritative one: the `doneAt`
    // push that ended the duel may not have round-tripped through the snapshot
    // listener yet, so `mine.xp` can still be a question behind.
    const myScore = afkResolved ? Math.max(myXp, mine.xp) : mine.xp
    // The consequence the owner asked for. A player who walks out forfeits —
    // the win goes to whoever was still there, and the row records exactly how
    // it was won so it can never pass for an ordinary one.
    const won = afkResolved || myScore >= foeSlot.xp
    const ranked = match.mode === 'ranked'

    // The face across the board, captured as it was at match end. Stored on
    // the history record rather than looked up later, so a history row can
    // draw the same avatar the duel head just showed (see `DuelOpponent`).
    const duelOpponent: DuelOpponent = {
      opponentName: foeName,
      opponentPhotoURL: opponent?.photoURL ?? '',
      opponentAvatarGender: opponent?.avatarGender ?? null,
      opponentAvatarTierIndex: opponent?.avatarTierIndex ?? 0,
      opponentIsBot: vsBot,
    }

    // Real profile XP either way — a casual duel is worth just as much to the
    // reader's level as a ranked one. Only the rating and the weekly board are
    // held back for ranked; each mode keeps its own stats and history.
    recordBattleResult(myScore)
    if (ranked) {
      void applyRankedResult(uid, meta, myScore, won).then((rating) => {
        onRankedResult?.()
        if (!rating) return
        recordRankedDuelResult({
          opponent: duelOpponent,
          won,
          xpEarned: myScore,
          foeXp: foeSlot.xp,
          ratingBefore: rating.before,
          ratingAfter: rating.after,
          opponentWasAfk: afkResolved,
        })
        // Fills in the rating block the result screen already rendered a
        // placeholder for. Guarded on the outcome still being *this* duel's,
        // so a rematch started before the write landed can't inherit it.
        setOutcome((prev) => (prev && prev.rating === null ? { ...prev, rating } : prev))
      })
    } else {
      recordCasualDuelResult(duelOpponent, won, myScore, foeSlot.xp, afkResolved)
    }
    // A bot duel has no document to close — it never had one.
    if (!vsBot) void closeMatch(match.id)

    setOutcome({
      myXp: myScore,
      foeXp: foeSlot.xp,
      won,
      ranked,
      afk: afkResolved,
      rating: null,
    })
    setPhase('result')
  }, [
    match,
    slot,
    foeSlot,
    uid,
    meta,
    timedOut,
    foeName,
    opponent,
    onRankedResult,
    vsBot,
    afkResolved,
    myXp,
  ])

  /* ------------------------------- render ------------------------------- */

  /** "Ещё раунд": drops this duel and starts looking for the next opponent. */
  const rematch = returnToSearch

  const inDuel =
    phase === 'duel' || phase === 'waiting' || phase === 'result' || phase === 'ended'
  const foeXp = outcome?.foeXp ?? foeSlot?.xp ?? 0
  /** The stamp stands only while the duel is still open — once it is scored the
   *  head belongs to the verdict, which `OutcomeAvatar` draws in the same spot. */
  const showAfk = foeAfk && !outcome && (phase === 'duel' || phase === 'waiting')

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
              isBot={vsBot}
              afk={showAfk}
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

          {/* Purely informational: a stalled opponent might be back in three
              seconds, so nothing is decided the moment this shows. It just
              tells the reader what's happening — the duel resolves itself,
              with no click needed, once the silence is confirmed. */}
          <AnimatePresence>
            {showAfk && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.24, ease: easeOut }}
                className="overflow-hidden"
              >
                <div
                  className="mx-5 mb-5 rounded-tile p-4 text-center ring-1"
                  style={{
                    background: 'var(--color-wrong-tint)',
                    ['--tw-ring-color' as string]:
                      'color-mix(in srgb, var(--color-wrong) 35%, transparent)',
                  }}
                >
                  <p
                    className="flex items-center justify-center gap-1.5 text-[14px] font-bold"
                    style={{ color: 'var(--color-wrong)' }}
                  >
                    <UserX className="h-4 w-4" strokeWidth={2.4} aria-hidden />
                    {t(s.battle.afkTitle)}
                  </p>
                  <p className="mx-auto mt-1.5 max-w-sm text-[12.5px] leading-relaxed text-ink-soft">
                    {t(s.battle.afkText)}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      <div className="px-5 pb-6">
        <AnimatePresence mode="wait">
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
              {isFirebaseReady && user ? (
                <>
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

                  {/* Casual only, and only once the queue has proved empty for
                      long enough that waiting on in it is the worse option. */}
                  <AnimatePresence>
                    {botOffered && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={springSoft}
                        className="mx-auto mt-6 max-w-sm rounded-tile bg-cream p-4 ring-1 ring-line/60"
                      >
                        <p className="flex items-center justify-center gap-2 text-[13.5px] font-bold text-ink">
                          {t(s.battle.botOfferTitle)}
                          <BotChip />
                        </p>
                        <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">
                          {t(s.battle.botOfferText)}
                        </p>
                        <motion.button
                          type="button"
                          onClick={startBotDuel}
                          whileHover={canHover ? { y: -2 } : undefined}
                          whileTap={{ scale: 0.97 }}
                          transition={springSoft}
                          className="focus-ring mt-3.5 rounded-full bg-brand px-5 py-2.5 text-[14px] font-semibold text-white shadow-soft hover:bg-brand-dark"
                        >
                          {t(s.battle.botOfferAction)}
                        </motion.button>
                        <p className="mt-2.5 text-[11.5px] text-ink-faint">
                          {t(s.battle.botOfferAuto)}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button
                    type="button"
                    onClick={onExit}
                    className="focus-ring mt-5 rounded-full bg-surface px-5 py-2.5 text-[14px] font-semibold text-ink-soft ring-1 ring-line hover:text-ink"
                  >
                    {t(s.common.cancel)}
                  </button>
                </>
              ) : (
                <p className="text-[13.5px] font-medium text-ink-faint">
                  {t(s.battle.unavailable)}
                </p>
              )}
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
                        whileHover={canHover && !revealed ? { y: -2 } : undefined}
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

          {/* The duel the reader walked away from, closed by the other side
              while they were gone. Nothing to score — they never finished —
              so this is only an honest dead end with a way out of it, rather
              than a board they can keep answering into. */}
          {phase === 'ended' && (
            <motion.div
              key="ended"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: easeOut }}
              className="py-8 text-center"
            >
              <span
                className="mx-auto grid h-14 w-14 place-items-center rounded-full"
                style={{ background: 'var(--color-wrong-tint)' }}
              >
                <UserX
                  className="h-6 w-6"
                  strokeWidth={1.9}
                  style={{ color: 'var(--color-wrong)' }}
                  aria-hidden
                />
              </span>
              <h2 className="mt-3.5 text-[17px] font-bold text-ink">
                {t(s.battle.afkEndedTitle)}
              </h2>
              <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed text-ink-soft">
                {t(s.battle.afkEndedText)}
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
                <motion.button
                  type="button"
                  onClick={rematch}
                  whileHover={canHover ? { y: -2 } : undefined}
                  whileTap={{ scale: 0.97 }}
                  transition={springSoft}
                  className="focus-ring rounded-full bg-brand px-6 py-3.5 text-[15px] font-semibold text-white shadow-soft hover:bg-brand-dark"
                >
                  {t(s.battle.again)}
                </motion.button>
                <button
                  type="button"
                  onClick={onExit}
                  className="focus-ring rounded-full bg-surface px-5 py-3.5 text-[14px] font-semibold text-ink-soft ring-1 ring-line hover:text-ink"
                >
                  {t(s.common.back)}
                </button>
              </div>
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

              {/* Said outright, not implied by a chip somewhere: a result the
                  reader would read differently once they found out is a result
                  they were misled about. */}
              {vsBot && (
                <p className="mx-auto mt-3 flex max-w-sm items-center justify-center gap-2 rounded-tile bg-cream px-3.5 py-2.5 text-[12.5px] leading-snug text-ink-soft ring-1 ring-line/60">
                  <BotChip />
                  {t(s.battle.botResultNote)}
                </p>
              )}

              {/* Same principle for a duel that ended because the other side
                  left: said outright on the screen that announces the win, not
                  only on the history row it will leave behind. */}
              {outcome.afk && (
                <p
                  className="mx-auto mt-3 flex max-w-sm items-center justify-center gap-2 rounded-tile px-3.5 py-2.5 text-[12.5px] leading-snug text-ink-soft ring-1"
                  style={{
                    background: 'var(--color-wrong-tint)',
                    ['--tw-ring-color' as string]:
                      'color-mix(in srgb, var(--color-wrong) 30%, transparent)',
                  }}
                >
                  <UserX
                    className="h-4 w-4 shrink-0"
                    strokeWidth={2.4}
                    style={{ color: 'var(--color-wrong)' }}
                    aria-hidden
                  />
                  {t(s.battle.afkResultNote)}
                </p>
              )}

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

              {/* Two ways on, both explicit: straight into the next search, or
                  back to the mode screen — which refetches its own record on
                  mount, so this duel is already counted when it lands. */}
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
                <motion.button
                  type="button"
                  onClick={rematch}
                  whileHover={canHover ? { y: -2 } : undefined}
                  whileTap={{ scale: 0.97 }}
                  transition={springSoft}
                  className="focus-ring rounded-full bg-brand px-6 py-3.5 text-[15px] font-semibold text-white shadow-soft hover:bg-brand-dark"
                >
                  {t(s.battle.again)}
                </motion.button>
                <button
                  type="button"
                  onClick={onExit}
                  className="focus-ring rounded-full bg-surface px-5 py-3.5 text-[14px] font-semibold text-ink-soft ring-1 ring-line hover:text-ink"
                >
                  {t(s.common.back)}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
