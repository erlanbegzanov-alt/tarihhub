/**
 * The team battle itself — the screen the room's Старт was waiting for.
 *
 * It is not a route. `teamMatches/{code}` shares its id with the room, so
 * `TeamBattle` watches for that document and renders this board in place of the
 * roster the moment it appears: every member follows the captain into the match
 * without anyone being told to press anything, and a refresh mid-match lands
 * back here rather than in an empty room.
 *
 * Everyone answers the same questions at their own pace. A synchronised,
 * Кахут-style match needs one phone to drive the clock for everybody, and a
 * single bad connection then stalls nine other people; here a slow phone only
 * costs that player their own seconds. The live totals at the top are what make
 * it feel like one game anyway — your team's number moves when your teammate
 * answers, which is the whole point of playing as a team.
 *
 * The run resumes from the player's own document (`answered`), not from local
 * state, so closing the tab and coming back continues where they were instead
 * of handing them the questions again for a second helping of points.
 */
import { motion } from 'framer-motion'
import { Check, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { battleQuestion } from '../data/battleQuestions'
import { s } from '../i18n/strings'
import { useLang } from '../i18n/useLang'
import { answerXp } from '../lib/battle'
import { cn } from '../lib/cn'
import { canHover, easeOut, springSoft, staggerContainer, staggerItem } from '../lib/motion'
import type { TeamKey } from '../lib/party'
import {
  TEAM_QUESTION_SECONDS,
  clearTeamMatch,
  everyoneDone,
  joinTeamMatch,
  matchOutcome,
  matchOver,
  recordMatchAnswer,
  teamScores,
  watchMatchPlayers,
} from '../lib/teamMatch'
import type { TeamMatch, TeamMatchPlayer } from '../lib/teamMatch'

/** Same two hues the room uses for its sides, so nobody has to re-learn them. */
const SIDE_COLOR: Record<TeamKey, string> = {
  a: 'var(--color-brand)',
  b: 'var(--color-era-saka)',
}

/** How long the right answer stays on screen before the next question. */
const REVEAL_MS = 1400

/** `picked` when the clock ran out rather than the player choosing. */
const TIMED_OUT = -1

/** The per-question countdown, drawn as a ring that empties as it runs. */
function TimerRing({ seconds }: { seconds: number }) {
  const radius = 14
  const circumference = 2 * Math.PI * radius
  const left = Math.max(0, Math.min(TEAM_QUESTION_SECONDS, seconds))
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
          strokeDashoffset={circumference * (1 - left / TEAM_QUESTION_SECONDS)}
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-[12px] font-bold tabular-nums text-ink">
        {left}
      </span>
    </div>
  )
}

/**
 * The live score, always on screen.
 *
 * Both totals sit on one line with the reader's own side marked, because the
 * question that matters mid-match is "are we ahead", and hunting for which
 * number is yours is exactly the friction that makes a team game feel solo.
 */
function ScoreBar({
  scores,
  mySide,
  labels,
}: {
  scores: { a: number; b: number }
  mySide: TeamKey
  labels: Record<TeamKey, string>
}) {
  return (
    <div className="flex items-center gap-3 rounded-card bg-surface px-4 py-3 shadow-soft ring-1 ring-line/60">
      {(['a', 'b'] as const).map((side) => (
        <div
          key={side}
          className={cn('flex min-w-0 flex-1 flex-col', side === 'b' && 'items-end text-right')}
        >
          <span
            className="truncate text-[11.5px] font-bold tracking-wide uppercase"
            style={{ color: SIDE_COLOR[side] }}
          >
            {labels[side]}
            {side === mySide && ' ·'}
          </span>
          <span className="text-[26px] leading-none font-bold tabular-nums text-ink">
            {scores[side]}
          </span>
        </div>
      ))}
    </div>
  )
}

export function TeamMatchBoard({
  match,
  uid,
  onLeave,
}: {
  match: TeamMatch
  uid: string
  /** Called when the reader should be back in the room — the captain cleared
   *  the match, so there is nothing here to show any more. */
  onLeave: () => void
}) {
  const { t } = useLang()

  /** Which side wrote this player into the match. */
  const mySide: TeamKey = match.teams.a.includes(uid) ? 'a' : 'b'
  /**
   * Somebody who walked into the room after the captain started.
   *
   * The match copied its roster in at creation and the rules pin every player
   * document to those sides, so this person's writes would be refused. Better
   * to say so than to hand them a board that silently scores nothing.
   */
  const inMatch = match.members.includes(uid)

  const [players, setPlayers] = useState<TeamMatchPlayer[]>([])
  useEffect(
    () => watchMatchPlayers(match.code, match.startedAt, setPlayers),
    [match.code, match.startedAt],
  )

  const me = players.find((player) => player.uid === uid) ?? null

  /**
   * The questions this match was dealt.
   *
   * An id the bank no longer has is dropped rather than rendered as a blank
   * question; `done` is what ends a run, not a count, so a shorter list still
   * finishes cleanly for everyone.
   */
  const questions = useMemo(
    () =>
      match.questionIds
        .map((id) => battleQuestion(id))
        .filter((question): question is NonNullable<typeof question> => question !== undefined),
    [match.questionIds],
  )

  /* ------------------------------ my own run ------------------------------ */

  // Seated once, so the others see this player has arrived instead of reading
  // an absent document as "still coming" for the whole match.
  const seated = useRef(false)
  useEffect(() => {
    if (seated.current || !inMatch) return
    seated.current = true
    void joinTeamMatch(match.code, uid, mySide, match.startedAt)
  }, [match.code, match.startedAt, uid, mySide, inMatch])

  // `null` until the player's own document has landed: where they are in the
  // run is stored, not local, so a reload resumes rather than restarts.
  const [index, setIndex] = useState<number | null>(null)
  useEffect(() => {
    if (index !== null || !me) return
    setIndex(Math.min(me.answered, questions.length))
  }, [me, index, questions.length])

  const [picked, setPicked] = useState<number | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(TEAM_QUESTION_SECONDS)

  const question = index !== null ? questions[index] : undefined
  const playing = question !== undefined && inMatch

  /** Cleared on unmount so a reveal cannot advance a board nobody is on. */
  const advanceTimer = useRef<number | null>(null)
  useEffect(
    () => () => {
      if (advanceTimer.current !== null) window.clearTimeout(advanceTimer.current)
    },
    [],
  )

  const choose = useCallback(
    (optionIndex: number) => {
      if (index === null || picked !== null || !question) return
      const chosen = optionIndex === TIMED_OUT ? null : question.options[optionIndex]
      const correct = chosen?.id === question.correctId
      setPicked(optionIndex)
      const last = index + 1 >= questions.length
      void recordMatchAnswer(
        match.code,
        uid,
        mySide,
        match.startedAt,
        // A wrong answer is worth nothing, however fast it was: `answerXp` pays
        // for speed only on top of a correct one.
        answerXp(correct, correct ? secondsLeft : 0, TEAM_QUESTION_SECONDS),
        last,
      )
      advanceTimer.current = window.setTimeout(() => {
        setPicked(null)
        setSecondsLeft(TEAM_QUESTION_SECONDS)
        setIndex(index + 1)
      }, REVEAL_MS)
    },
    [index, picked, question, questions.length, match.code, match.startedAt, uid, mySide, secondsLeft],
  )

  // The clock, one question at a time. It stops the moment an answer is picked,
  // so the reveal does not keep counting down behind the coloured options.
  useEffect(() => {
    if (!playing || picked !== null) return
    const tick = window.setInterval(() => {
      setSecondsLeft((left) => Math.max(0, left - 1))
    }, 1000)
    return () => window.clearInterval(tick)
  }, [playing, picked, index])

  // Running out of time is an answer worth nothing, not a stuck screen.
  useEffect(() => {
    if (!playing || picked !== null || secondsLeft > 0) return
    choose(TIMED_OUT)
  }, [playing, picked, secondsLeft, choose])

  /* ------------------------------- the room ------------------------------- */

  const scores = teamScores(players)
  // Ticks only while the match is still open, so the stall cap can be crossed
  // without anybody touching the screen — a room waiting on somebody who has
  // closed their tab gets its result without a reload — and stops the moment it
  // is over rather than re-rendering the result page once a second for ever.
  const [now, setNow] = useState(() => Date.now())
  const over = matchOver(match, players, now)
  useEffect(() => {
    if (over) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [over])
  /** True when the cap ended it rather than the last player finishing. */
  const endedOnStall = over && !everyoneDone(match, players)
  const outcome = matchOutcome(scores)
  const stillPlaying = match.members.filter(
    (member) => players.find((player) => player.uid === member)?.done !== true,
  ).length

  const labels: Record<TeamKey, string> = { a: t(s.team.sideA), b: t(s.team.sideB) }
  const isLeader = match.leader === uid

  const playAgain = async () => {
    const cleared = await clearTeamMatch(match.code, uid, match)
    // The listener in `TeamBattle` normally brings everyone back on its own;
    // this covers the caller's own screen if that snapshot is slow.
    if (cleared) onLeave()
  }

  /* -------------------------------- render -------------------------------- */

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="mt-5">
      <motion.div variants={staggerItem}>
        <ScoreBar scores={scores} mySide={mySide} labels={labels} />
      </motion.div>

      {/* ----------------------------- finished ----------------------------- */}
      {over ? (
        <motion.section
          variants={staggerItem}
          className="mt-4 rounded-card bg-surface p-6 text-center shadow-soft ring-1 ring-line/60"
        >
          <p
            className="text-[24px] leading-tight font-bold"
            style={{ color: outcome === 'draw' ? 'var(--color-ink)' : SIDE_COLOR[outcome] }}
          >
            {outcome === 'draw'
              ? t(s.team.matchDraw)
              : outcome === mySide
                ? t(s.battle.recentWin)
                : t(s.battle.recentLose)}
          </p>
          <p className="mt-2 text-[14px] font-semibold tabular-nums text-ink-soft">
            {labels.a} {scores.a} — {scores.b} {labels.b}
          </p>
          {me && (
            <p className="mt-3 text-[13px] tabular-nums text-ink-faint">
              {t(s.team.matchYourScore)}: {me.score}
            </p>
          )}
          {endedOnStall && (
            <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
              {t(s.team.matchEndedOnStall)}
            </p>
          )}
          <p className="mt-4 text-[12.5px] leading-relaxed text-ink-faint">
            {t(s.team.matchNoRating)}
          </p>

          {isLeader ? (
            <button
              type="button"
              onClick={() => void playAgain()}
              className="focus-ring mt-5 flex w-full items-center justify-center gap-2 rounded-tile bg-brand px-5 py-3.5 text-[15px] font-bold text-white transition-colors hover:bg-brand-dark"
            >
              <RotateCcw className="h-[17px] w-[17px]" strokeWidth={2.2} />
              {t(s.team.matchAgain)}
            </button>
          ) : (
            <p className="mt-5 text-[13px] text-ink-soft">{t(s.team.matchWaitingLeader)}</p>
          )}
        </motion.section>
      ) : !inMatch ? (
        /* -------------------- arrived after the start -------------------- */
        <motion.p
          variants={staggerItem}
          className="mt-4 rounded-card bg-surface px-4 py-6 text-center text-[13.5px] leading-relaxed text-ink-soft shadow-soft ring-1 ring-line/60"
        >
          {t(s.team.matchNotIn)}
        </motion.p>
      ) : question ? (
        /* ----------------------------- playing ----------------------------- */
        <motion.section
          variants={staggerItem}
          className="mt-4 rounded-card bg-surface p-5 shadow-soft ring-1 ring-line/60"
        >
          <div className="mb-3.5 flex items-center justify-between">
            <span className="text-[12px] font-bold text-ink-faint">
              {t(s.battle.question)} {(index ?? 0) + 1} / {questions.length}
            </span>
            <TimerRing seconds={secondsLeft} />
          </div>

          <motion.h2
            key={`q-${index}`}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.24, ease: easeOut }}
            className="text-[18px] leading-snug font-bold text-ink sm:text-[19px]"
          >
            {t(question.question)}
          </motion.h2>

          <ul className="mt-4 grid gap-2.5">
            {question.options.map((option, optionIndex) => {
              const revealed = picked !== null
              const isCorrect = option.id === question.correctId
              const isPicked = picked === optionIndex
              return (
                <li key={option.id}>
                  <motion.button
                    type="button"
                    // Not `disabled`: a focused button that becomes disabled drops focus
                    // to <body>, and answering with the keyboard then meant tabbing from
                    // the top of the page again. The handler refuses a second answer.
                    onClick={() => {
                      if (!(revealed)) choose(optionIndex)
                    }}
                    aria-disabled={revealed}
                    whileHover={canHover && !revealed ? { y: -2 } : undefined}
                    whileTap={revealed ? undefined : { scale: 0.99 }}
                    transition={springSoft}
                    className={cn(
                      'focus-ring w-full rounded-tile px-4 py-3.5 text-left',
                      'text-[14.5px] font-semibold ring-[1.5px] transition-colors duration-200',
                      !revealed && 'bg-cream text-ink ring-line hover:ring-brand/50',
                      revealed && isCorrect && 'bg-correct-tint text-ink ring-correct/50',
                      revealed && isPicked && !isCorrect && 'bg-wrong-tint text-ink ring-wrong/50',
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
        </motion.section>
      ) : index === null ? (
        /* ------------ the player's own document has not landed ------------ */
        <motion.p
          variants={staggerItem}
          className="mt-4 rounded-card bg-surface px-4 py-8 text-center text-[13.5px] text-ink-soft shadow-soft ring-1 ring-line/60"
        >
          {t(s.team.matchLoading)}
        </motion.p>
      ) : (
        /* --------------------- done, others still going --------------------- */
        <motion.section
          variants={staggerItem}
          className="mt-4 rounded-card bg-surface p-6 text-center shadow-soft ring-1 ring-line/60"
        >
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand-tint text-brand">
            <Check className="h-6 w-6" strokeWidth={2.4} aria-hidden />
          </span>
          <p className="mt-3 text-[15px] font-bold text-ink">{t(s.team.matchYouDone)}</p>
          {me && (
            <p className="mt-1.5 text-[13px] tabular-nums text-ink-soft">
              {t(s.team.matchYourScore)}: {me.score}
            </p>
          )}
          <p className="mt-4 text-[12.5px] tabular-nums text-ink-faint">
            {stillPlaying} {t(s.team.matchStillPlaying)}
          </p>
        </motion.section>
      )}
    </motion.div>
  )
}
