/**
 * Running a Кахут game (`/battle/kahoot/host/:gameId`).
 *
 * This screen *is* the server. Every transition — opening a question, revealing
 * its answer, ending the game — is a write only the host is allowed to make,
 * and it is what every student's screen is watching. The teacher paces all of
 * it by hand: the answer clock runs out on its own, but nothing advances until
 * the button is pressed, so a class that needs another moment gets one.
 */
import { motion } from 'framer-motion'
import { Check, Loader2, Trophy, Users } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CountdownBar,
  KahootHeader,
  LobbyRow,
  PlayerBoard,
} from '../components/kahoot'
import { s } from '../i18n/strings'
import { useLang } from '../i18n/useLang'
import { cn } from '../lib/cn'
import { isFirebaseReady } from '../lib/firebase'
import {
  KAHOOT_QUESTION_SECONDS,
  closeSession,
  createSession,
  fetchGame,
  fetchSession,
  finishSession,
  hasAnswered,
  openQuestion,
  revealAnswer,
  secondsLeft,
  watchPlayers,
  watchSession,
} from '../lib/kahoot'
import type { KahootGame, KahootPlayer, KahootSession } from '../lib/kahoot'
import { canHover, easeOut, springSoft, staggerContainer, staggerItem } from '../lib/motion'
import { useSession } from '../lib/session'

/**
 * Where a live room's code is remembered for the tab that opened it.
 *
 * A teacher who reloads mid-game must come back to the *same* room — a fresh
 * code would strand a class that has already typed the old one in. Only this
 * tab needs to know, and only until it closes, so `sessionStorage` is exactly
 * the right lifetime.
 */
const CODE_KEY = 'tarihhub_kahoot_host'

function rememberCode(gameId: string, code: string): void {
  try {
    window.sessionStorage.setItem(`${CODE_KEY}_${gameId}`, code)
  } catch {
    /* storage unavailable — a reload will simply open a new room */
  }
}

function recallCode(gameId: string): string | null {
  try {
    return window.sessionStorage.getItem(`${CODE_KEY}_${gameId}`)
  } catch {
    return null
  }
}

function forgetCode(gameId: string): void {
  try {
    window.sessionStorage.removeItem(`${CODE_KEY}_${gameId}`)
  } catch {
    /* nothing to clean up */
  }
}

/** The primary action at the bottom of every stage. */
function HostButton({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={canHover ? { y: -2 } : undefined}
      whileTap={{ scale: 0.99 }}
      transition={springSoft}
      className="focus-ring mt-5 w-full rounded-full bg-brand px-6 py-3.5 text-[15px] font-semibold text-white shadow-soft hover:bg-brand-dark"
    >
      {label}
    </motion.button>
  )
}

/* ------------------------------------------------------------------ */

export function KahootHost() {
  const { t } = useLang()
  const navigate = useNavigate()
  const { gameId } = useParams<{ gameId: string }>()
  const auth = useSession()
  const uid = auth.user?.uid ?? null

  const [game, setGame] = useState<KahootGame | null>(null)
  const [code, setCode] = useState<string | null>(null)
  const [room, setRoom] = useState<KahootSession | null>(null)
  const [players, setPlayers] = useState<KahootPlayer[]>([])
  const [failed, setFailed] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  /** Opening a room is a write; this makes sure it happens exactly once. */
  const openedRef = useRef(false)

  useEffect(() => {
    if (!gameId) return
    let alive = true
    void fetchGame(gameId).then((found) => {
      if (alive) setGame(found)
    })
    return () => {
      alive = false
    }
  }, [gameId])

  // Reuse the room this tab already opened for this game, if it is still
  // there; otherwise open a new one.
  useEffect(() => {
    if (!game || !uid || openedRef.current) return
    if (game.hostUid !== uid || game.questions.length === 0) {
      setFailed(true)
      return
    }
    openedRef.current = true
    void (async () => {
      const remembered = recallCode(game.id)
      if (remembered) {
        const existing = await fetchSession(remembered)
        if (existing && existing.hostUid === uid && existing.status !== 'done') {
          setCode(remembered)
          return
        }
        forgetCode(game.id)
      }
      const fresh = await createSession(game)
      if (!fresh) {
        setFailed(true)
        return
      }
      rememberCode(game.id, fresh)
      setCode(fresh)
    })()
  }, [game, uid])

  useEffect(() => {
    if (!code) return
    const stopRoom = watchSession(code, setRoom)
    const stopPlayers = watchPlayers(code, setPlayers)
    return () => {
      stopRoom()
      stopPlayers()
    }
  }, [code])

  // Only the open-question stage needs a ticking clock.
  useEffect(() => {
    if (room?.status !== 'question') return
    const tick = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(tick)
  }, [room?.status])

  const question = game && room ? game.questions[room.questionIndex] : undefined
  const left = secondsLeft(room?.questionStartedAt ?? null, now)
  const answered = room
    ? players.filter((player) => hasAnswered(player, room.questionStartedAt)).length
    : 0
  const isLast = game && room ? room.questionIndex >= game.questions.length - 1 : false

  const advance = () => {
    if (!game || !room || !code) return
    const next = room.questionIndex + 1
    if (next >= game.questions.length) {
      void finishSession(code)
      return
    }
    void openQuestion(code, game.questions[next], next)
  }

  const close = () => {
    if (code) void closeSession(code)
    if (gameId) forgetCode(gameId)
    navigate('/battle/kahoot/teacher')
  }

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
        title={game?.title || t(s.kahoot.hostTitle)}
        subtitle={t(s.kahoot.hostTitle)}
        onBack={() => navigate('/battle/kahoot/teacher')}
      />

      {!ready || failed ? (
        <motion.p
          variants={staggerItem}
          className="mt-5 rounded-card bg-surface p-5 text-center text-[13.5px] leading-relaxed text-ink-faint shadow-soft ring-1 ring-line/60"
        >
          {t(ready ? s.kahoot.roomFailed : s.battle.unavailable)}
        </motion.p>
      ) : !room || !code ? (
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
              <div className="rounded-tile bg-gold-tint px-5 py-4 text-center ring-1 ring-gold/40">
                <p className="text-[11.5px] font-bold tracking-wide text-ink-faint">
                  {t(s.kahoot.codeLabel)}
                </p>
                <p className="my-1.5 text-[30px] font-bold tracking-[0.14em] text-ink">
                  {code}
                </p>
                <p className="text-[12.5px] font-semibold text-ink-soft">
                  {t(s.kahoot.joinedLabel)}: {players.length}
                </p>
              </div>
              <p className="mt-2.5 text-center text-[12.5px] leading-relaxed text-ink-faint">
                {t(s.kahoot.codeHint)}
              </p>

              {players.length === 0 ? (
                <p className="mt-4 flex items-center justify-center gap-2 text-[13px] font-semibold text-ink-soft">
                  <motion.span
                    className="h-[7px] w-[7px] rounded-full bg-brand"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: easeOut }}
                  />
                  {t(s.kahoot.lobbyEmpty)}
                </p>
              ) : (
                <ul className="mt-4 grid gap-2">
                  {players.map((player) => (
                    <LobbyRow key={player.uid} player={player} me={false} />
                  ))}
                </ul>
              )}

              <p className="mt-4 text-center text-[12px] leading-relaxed text-ink-faint">
                {t(s.kahoot.hostNoXp)}
              </p>

              <HostButton label={t(s.kahoot.start)} onClick={() => {
                if (game) void openQuestion(code, game.questions[0], 0)
              }} />
            </div>
          )}

          {/* -------------------- question and its reveal -------------------- */}

          {(room.status === 'question' || room.status === 'reveal') && question && (
            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-[12px] font-bold text-ink-faint">
                  {t(s.battle.question)} {room.questionIndex + 1} /{' '}
                  {game?.questions.length ?? room.totalQuestions}
                </span>
                <span className="text-[12px] font-bold tabular-nums text-ink-soft">
                  {t(s.kahoot.answeredLabel)}: {answered} / {players.length}
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
                  const correct = index === question.correctIndex
                  const shown = room.status === 'reveal'
                  return (
                    <li
                      key={index}
                      className={cn(
                        'flex items-center gap-2.5 rounded-tile px-4 py-3.5',
                        'text-[14.5px] font-semibold ring-[1.5px]',
                        correct
                          ? 'bg-correct-tint text-ink ring-correct/50'
                          : shown
                            ? 'bg-cream/60 text-ink-faint ring-line/50'
                            : 'bg-cream text-ink ring-line',
                      )}
                    >
                      {correct && (
                        <Check className="h-4 w-4 shrink-0 text-correct" strokeWidth={3} />
                      )}
                      {option}
                    </li>
                  )
                })}
              </ul>

              {room.status === 'reveal' && players.length > 0 && (
                <div className="mt-5">
                  <p className="mb-2 text-[11.5px] font-bold tracking-wide text-ink-faint">
                    {t(s.kahoot.leaderboard)}
                  </p>
                  <PlayerBoard players={players} myUid={null} />
                </div>
              )}

              {room.status === 'question' ? (
                <HostButton
                  label={t(s.kahoot.showAnswer)}
                  onClick={() => void revealAnswer(code, question.correctIndex)}
                />
              ) : (
                <HostButton
                  label={t(isLast ? s.kahoot.finish : s.kahoot.next)}
                  onClick={advance}
                />
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

              {players.length > 0 && (
                <div className="mt-5">
                  <PlayerBoard players={players} myUid={null} />
                </div>
              )}

              <HostButton label={t(s.kahoot.done)} onClick={close} />
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  )
}
