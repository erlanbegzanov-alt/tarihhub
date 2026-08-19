/**
 * Playing a Кахут game (`/battle/kahoot/play/:code`).
 *
 * A student's client reads the room and writes exactly one document: its own
 * row in `players`. It never learns the answer to a question until the teacher
 * publishes it, which is why the score is worked out at reveal time rather than
 * when the option is tapped — see `submitAnswer` in `src/lib/kahoot.ts`.
 */
import { motion } from 'framer-motion'
import { Check, Loader2, Trophy, Users, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CountdownBar, KahootHeader, LobbyRow, PlayerBoard } from '../components/kahoot'
import { s } from '../i18n/strings'
import { useLang } from '../i18n/useLang'
import { answerXp } from '../lib/battle'
import { cn } from '../lib/cn'
import { isFirebaseReady } from '../lib/firebase'
import {
  KAHOOT_QUESTION_SECONDS,
  fetchSession,
  joinSession,
  normalizeCode,
  pushScore,
  secondsLeft,
  submitAnswer,
  watchPlayers,
  watchSession,
} from '../lib/kahoot'
import type { KahootPlayer, KahootSession } from '../lib/kahoot'
import { easeOut, springSoft, staggerContainer, staggerItem } from '../lib/motion'
import { recordBattleResult, useProfile } from '../lib/progress'
import { resolveRankIdentity } from '../lib/rankIdentity'
import { OWNER_EMAIL } from '../lib/rankStyle'
import { useSession } from '../lib/session'

/** Why this student can't play, when they can't. */
type Blocked = 'notFound' | 'started' | 'failed' | 'gone'

const BLOCKED_TEXT = {
  notFound: s.kahoot.joinNotFound,
  started: s.kahoot.joinStarted,
  failed: s.kahoot.joinFailed,
  gone: s.kahoot.roomGone,
}

/* ------------------------------------------------------------------ */

export function KahootJoin() {
  const { t } = useLang()
  const navigate = useNavigate()
  const params = useParams<{ code: string }>()
  const code = normalizeCode(params.code ?? '')
  const auth = useSession()
  const user = auth.user
  const uid = user?.uid ?? null
  const profile = useProfile()
  const rankIdentity = resolveRankIdentity({
    xp: profile.xp,
    avatarGender: profile.avatarGender,
    displayedAvatarTier: profile.displayedAvatarTier,
    displayedRankTier: profile.displayedRankTier,
    isOwner: user?.email === OWNER_EMAIL,
  })

  const [room, setRoom] = useState<KahootSession | null>(null)
  const [players, setPlayers] = useState<KahootPlayer[]>([])
  const [joined, setJoined] = useState(false)
  const [blocked, setBlocked] = useState<Blocked | null>(null)
  const [picked, setPicked] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [now, setNow] = useState(() => Date.now())

  /** Instant this student's answer landed, for the speed bonus at reveal. */
  const answeredAtRef = useRef<number | null>(null)
  /** The running total, mirrored out of state so scoring stays a pure step. */
  const scoreRef = useRef(0)
  /** Last question index already scored, so a re-render can't pay twice. */
  const scoredIndexRef = useRef(-1)
  /**
   * Guards the one-time XP award, the same way the duel screen's `scoredRef`
   * does — a ref rather than a re-read of anything, because the document this
   * would be read back from keeps changing under other people's writes.
   */
  const xpPaidRef = useRef(false)
  const joinedRef = useRef(false)

  /* ------------------------------ joining ------------------------------ */

  // The room is checked before the player row is written, so a mistyped code or
  // a deep link into a game that already started is answered here rather than
  // leaving an orphan row under a room that isn't there.
  useEffect(() => {
    if (!uid || !user || !code || joinedRef.current) return
    joinedRef.current = true
    void (async () => {
      const target = await fetchSession(code)
      if (!target) {
        setBlocked('notFound')
        return
      }
      if (target.status !== 'lobby') {
        setBlocked('started')
        return
      }
      const ok = await joinSession(code, uid, {
        displayName: user.displayName,
        photoURL: user.photoURL,
        avatarGender: rankIdentity.avatarGender,
        avatarTierIndex: rankIdentity.avatarTierIndex,
        titleTierIndex: rankIdentity.titleTierIndex,
      })
      if (ok) setJoined(true)
      else setBlocked('failed')
    })()
    // Only ever joins once (guarded by `joinedRef`), so `rankIdentity` is read
    // fresh from the closure rather than tracked as a dependency — the room
    // this writes into never needs the identity re-sent after the join.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, user, code])

  useEffect(() => {
    if (!code || !joined) return
    const stopRoom = watchSession(code, (next) => {
      setRoom(next)
      // The room vanishing means the teacher closed it, not that anything
      // failed — say so plainly instead of showing an empty screen.
      if (!next) setBlocked('gone')
    })
    const stopPlayers = watchPlayers(code, setPlayers)
    return () => {
      stopRoom()
      stopPlayers()
    }
  }, [code, joined])

  /* ------------------------------- playing ------------------------------- */

  useEffect(() => {
    if (room?.status !== 'question') return
    const tick = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(tick)
  }, [room?.status])

  // A new question wipes the previous one's answer.
  useEffect(() => {
    if (room?.status !== 'question') return
    setPicked(null)
    answeredAtRef.current = null
  }, [room?.status, room?.questionIndex])

  const left = secondsLeft(room?.questionStartedAt ?? null, now)

  const choose = (index: number) => {
    if (!room || !uid || picked !== null) return
    setPicked(index)
    answeredAtRef.current = Date.now()
    void submitAnswer(code, uid, index)
  }

  // Running out of time counts as an answer too, so the teacher's "ответили"
  // tally is honest about who is still thinking.
  useEffect(() => {
    if (room?.status !== 'question' || picked !== null || left > 0 || !uid) return
    setPicked(-1)
    answeredAtRef.current = Date.now()
    void submitAnswer(code, uid, -1)
  }, [room?.status, picked, left, uid, code])

  /*
   * Scoring, at reveal time. The seconds still on the clock are recovered from
   * when the answer actually landed, not from now — the reveal may arrive long
   * after the question closed, and a slow teacher must not cost anyone points.
   */
  useEffect(() => {
    if (!room || !uid) return
    if (room.status !== 'reveal' || room.revealedCorrectIndex === null) return
    if (scoredIndexRef.current === room.questionIndex) return
    scoredIndexRef.current = room.questionIndex

    const answeredAt = answeredAtRef.current
    if (picked === null || picked < 0 || answeredAt === null) return

    const gained = answerXp(
      picked === room.revealedCorrectIndex,
      secondsLeft(room.questionStartedAt, answeredAt),
    )
    if (gained <= 0) return
    const next = scoreRef.current + gained
    scoreRef.current = next
    setScore(next)
    void pushScore(code, uid, next)
  }, [room, uid, picked, code])

  // Real profile XP, once the game is actually over and the student has seen it.
  useEffect(() => {
    if (room?.status !== 'done' || xpPaidRef.current) return
    xpPaidRef.current = true
    recordBattleResult(score)
  }, [room?.status, score])

  /* ------------------------------- render ------------------------------- */

  const me = players.find((player) => player.uid === uid) ?? null
  const place = me ? players.indexOf(me) + 1 : 0
  const question = room?.currentQuestion ?? null
  const ready = isFirebaseReady && Boolean(uid)

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="mx-auto max-w-2xl lg:max-w-3xl"
    >
      <KahootHeader
        icon={<Users className="h-5 w-5" strokeWidth={2} />}
        title={room?.title || t(s.kahoot.title)}
        subtitle={code}
        onBack={() => navigate('/battle/kahoot/student')}
      />

      {!ready || blocked ? (
        <motion.div variants={staggerItem} className="mt-5">
          <p className="rounded-card bg-surface p-5 text-center text-[13.5px] leading-relaxed text-ink-faint shadow-soft ring-1 ring-line/60">
            {t(blocked ? BLOCKED_TEXT[blocked] : s.battle.unavailable)}
          </p>
          <button
            type="button"
            onClick={() => navigate('/battle/kahoot/student')}
            className="focus-ring mx-auto mt-4 block rounded-full bg-surface px-5 py-2.5 text-[14px] font-semibold text-ink-soft ring-1 ring-line hover:text-ink"
          >
            {t(s.common.back)}
          </button>
        </motion.div>
      ) : !room ? (
        <div className="py-16 text-center">
          <Loader2
            className="mx-auto h-9 w-9 animate-spin text-brand"
            strokeWidth={2}
            aria-hidden
          />
        </div>
      ) : (
        <motion.div
          variants={staggerItem}
          className="mt-5 rounded-card bg-surface p-5 shadow-soft ring-1 ring-line/60"
        >
          {/* ----------------------------- lobby ----------------------------- */}

          {room.status === 'lobby' && (
            <div>
              <p className="mb-3 text-[11.5px] font-bold tracking-wide text-ink-faint">
                {t(s.kahoot.players)}
              </p>
              <ul className="grid gap-2">
                {players.map((player) => (
                  <LobbyRow
                    key={player.uid}
                    player={player}
                    me={player.uid === uid}
                  />
                ))}
              </ul>
              <p className="mt-5 flex items-center justify-center gap-2 text-[13px] font-semibold text-ink-soft">
                <motion.span
                  className="h-[7px] w-[7px] rounded-full bg-brand"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: easeOut }}
                />
                {t(s.kahoot.waitingHost)}
              </p>
            </div>
          )}

          {/* ---------------------------- question ---------------------------- */}

          {(room.status === 'question' || room.status === 'reveal') && question && (
            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-[12px] font-bold text-ink-faint">
                  {t(s.battle.question)} {room.questionIndex + 1} / {room.totalQuestions}
                </span>
                <span className="text-[12px] font-bold tabular-nums text-ink-soft">
                  {t(s.kahoot.yourScore)}: {score}
                </span>
              </div>

              {room.status === 'question' && (
                <div className="mb-4">
                  <CountdownBar seconds={left} total={KAHOOT_QUESTION_SECONDS} />
                </div>
              )}

              {question.photoURL && (
                <img
                  src={question.photoURL}
                  alt=""
                  className="mb-3.5 max-h-64 w-full rounded-tile object-cover ring-1 ring-line"
                />
              )}

              <h2 className="text-[18px] leading-snug font-bold text-ink sm:text-[19px]">
                {question.text}
              </h2>

              <ul className="mt-4 grid gap-2.5">
                {question.options.map((option, index) => {
                  const revealed = room.status === 'reveal'
                  const correct = revealed && room.revealedCorrectIndex === index
                  const wrongPick = revealed && picked === index && !correct
                  return (
                    <li key={index}>
                      <motion.button
                        type="button"
                        onClick={() => choose(index)}
                        disabled={picked !== null || revealed}
                        whileHover={picked !== null ? undefined : { y: -2 }}
                        whileTap={picked !== null ? undefined : { scale: 0.99 }}
                        transition={springSoft}
                        className={cn(
                          'focus-ring flex w-full items-center gap-2.5 rounded-tile px-4 py-3.5',
                          'text-left text-[14.5px] font-semibold ring-[1.5px]',
                          'transition-colors duration-200',
                          correct && 'bg-correct-tint text-ink ring-correct/50',
                          wrongPick && 'bg-wrong-tint text-ink ring-wrong/50',
                          revealed &&
                            !correct &&
                            !wrongPick &&
                            'bg-cream/60 text-ink-faint ring-line/50',
                          !revealed &&
                            picked === index &&
                            'bg-brand-tint text-ink ring-brand/60',
                          !revealed &&
                            picked !== index &&
                            'bg-cream text-ink ring-line hover:ring-brand/50',
                        )}
                      >
                        {correct && (
                          <Check
                            className="h-4 w-4 shrink-0 text-correct"
                            strokeWidth={3}
                          />
                        )}
                        {wrongPick && (
                          <X className="h-4 w-4 shrink-0 text-wrong" strokeWidth={3} />
                        )}
                        {option}
                      </motion.button>
                    </li>
                  )
                })}
              </ul>

              {room.status === 'question' && picked !== null && (
                <p className="mt-4 text-center text-[13px] font-semibold text-ink-soft">
                  {t(picked < 0 ? s.kahoot.timeUp : s.kahoot.answerSent)}
                </p>
              )}

              {room.status === 'reveal' && (
                <>
                  <p
                    className={cn(
                      'mt-4 text-center text-[15px] font-bold',
                      picked !== null && picked === room.revealedCorrectIndex
                        ? 'text-correct'
                        : 'text-wrong',
                    )}
                  >
                    {t(
                      picked !== null && picked === room.revealedCorrectIndex
                        ? s.quiz.correct
                        : s.quiz.wrong,
                    )}
                  </p>
                  <p className="mt-3 flex items-center justify-center gap-2 text-[13px] font-semibold text-ink-soft">
                    <motion.span
                      className="h-[7px] w-[7px] rounded-full bg-brand"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.2, repeat: Infinity, ease: easeOut }}
                    />
                    {t(s.kahoot.waitingNext)}
                  </p>
                </>
              )}
            </div>
          )}

          {/* ----------------------------- result ----------------------------- */}

          {room.status === 'done' && (
            <div>
              <div className="text-center">
                <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-gold-tint">
                  <Trophy className="h-7 w-7 text-gold" strokeWidth={1.8} />
                </span>
                <h2 className="mt-4 text-2xl font-bold tracking-tight text-ink">
                  {t(s.kahoot.finalTitle)}
                </h2>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2.5">
                <div className="rounded-tile bg-cream p-4 text-center ring-1 ring-line/60">
                  <p className="text-xl font-bold tabular-nums text-brand">+{score}</p>
                  <p className="mt-1 text-[11.5px] text-ink-faint">
                    {t(s.kahoot.xpAdded)}
                  </p>
                </div>
                <div className="rounded-tile bg-cream p-4 text-center ring-1 ring-line/60">
                  <p className="text-xl font-bold tabular-nums text-ink">
                    {place > 0 ? place : '—'}
                  </p>
                  <p className="mt-1 text-[11.5px] text-ink-faint">
                    {t(s.kahoot.yourPlace)}
                  </p>
                </div>
              </div>

              {players.length > 0 && (
                <div className="mt-4">
                  <PlayerBoard players={players} myUid={uid} />
                </div>
              )}

              <motion.button
                type="button"
                onClick={() => navigate('/battle/kahoot/student')}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.99 }}
                transition={springSoft}
                className="focus-ring mt-5 w-full rounded-full bg-brand px-6 py-3.5 text-[15px] font-semibold text-white shadow-soft hover:bg-brand-dark"
              >
                {t(s.kahoot.done)}
              </motion.button>
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  )
}
