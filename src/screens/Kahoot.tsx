/**
 * The Кахут entry point (`/battle/kahoot`).
 *
 * One screen with two doors, the way the approved design has it: a teacher
 * lands on their own list of games, a student on a six-box code field. Nothing
 * live happens here — hosting and playing each get their own screen, because
 * both hold a Firestore listener open and neither should stay mounted behind
 * the other.
 */
import { motion } from 'framer-motion'
import { Loader2, Pencil, Play, Plus, Trash2, Users } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KahootHeader } from '../components/kahoot'
import { SectionHeading } from '../components/ui'
import { s } from '../i18n/strings'
import { useLang } from '../i18n/useLang'
import { cn } from '../lib/cn'
import { isFirebaseReady } from '../lib/firebase'
import {
  KAHOOT_CODE_LENGTH,
  deleteGame,
  fetchMyGames,
  fetchSession,
  normalizeCode,
} from '../lib/kahoot'
import type { KahootGame } from '../lib/kahoot'
import { springSoft, staggerContainer, staggerItem } from '../lib/motion'
import { useSession } from '../lib/session'

type Role = 'teacher' | 'student'

/** The two role pills, in the FilterChip shape used across the app. */
function RoleTab({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.96 }}
      transition={springSoft}
      aria-pressed={active}
      className={cn(
        'focus-ring rounded-full px-4 py-2 text-[13px] font-bold',
        'ring-[1.5px] transition-colors duration-200',
        active
          ? 'bg-brand-tint text-brand ring-brand/60'
          : 'bg-surface text-ink-soft ring-line hover:text-ink',
      )}
    >
      {label}
    </motion.button>
  )
}

/* ------------------------------------------------------------------ */

export function Kahoot() {
  const { t } = useLang()
  const navigate = useNavigate()
  const session = useSession()
  const uid = session.user?.uid ?? null

  const [role, setRole] = useState<Role>('teacher')
  const [games, setGames] = useState<KahootGame[] | null>(null)
  const [code, setCode] = useState('')
  const [joinError, setJoinError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  const loadGames = useCallback(() => {
    if (!uid) return
    void fetchMyGames(uid).then(setGames)
  }, [uid])

  useEffect(loadGames, [loadGames])

  const removeGame = async (gameId: string) => {
    setGames((prev) => prev?.filter((game) => game.id !== gameId) ?? prev)
    await deleteGame(gameId)
  }

  /**
   * Looks the code up before leaving this screen, so a typo or a game that has
   * already started is answered right here instead of on a play screen that
   * would have nothing to show.
   */
  const join = async () => {
    if (code.length !== KAHOOT_CODE_LENGTH) {
      setJoinError(t(s.kahoot.joinShort))
      return
    }
    setChecking(true)
    setJoinError(null)
    const room = await fetchSession(code)
    setChecking(false)
    if (!room) {
      setJoinError(t(s.kahoot.joinNotFound))
      return
    }
    if (room.status !== 'lobby') {
      setJoinError(t(s.kahoot.joinStarted))
      return
    }
    navigate(`/battle/kahoot/play/${code}`)
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
        title={t(s.kahoot.title)}
        subtitle={t(s.kahoot.subtitle)}
        onBack={() => navigate('/battle')}
      />

      {!ready ? (
        <motion.p
          variants={staggerItem}
          className="mt-5 rounded-card bg-surface p-5 text-center text-[13.5px] leading-relaxed text-ink-faint shadow-soft ring-1 ring-line/60"
        >
          {t(s.battle.unavailable)}
        </motion.p>
      ) : (
        <>
          <motion.div variants={staggerItem} className="mt-5 flex gap-2">
            <RoleTab
              active={role === 'teacher'}
              label={t(s.kahoot.roleTeacher)}
              onClick={() => setRole('teacher')}
            />
            <RoleTab
              active={role === 'student'}
              label={t(s.kahoot.roleStudent)}
              onClick={() => setRole('student')}
            />
          </motion.div>

          {/* ---------------------------- teacher ---------------------------- */}

          {role === 'teacher' && (
            <motion.div variants={staggerItem} className="mt-5">
              <SectionHeading title={t(s.kahoot.myGames)} />

              <motion.button
                type="button"
                onClick={() => navigate('/battle/kahoot/create')}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.99 }}
                transition={springSoft}
                className="focus-ring flex w-full items-center justify-center gap-2 rounded-card bg-brand px-5 py-3.5 text-[15px] font-semibold text-white shadow-soft hover:bg-brand-dark"
              >
                <Plus className="h-[18px] w-[18px]" strokeWidth={2.4} />
                {t(s.kahoot.newGame)}
              </motion.button>

              {games === null ? (
                <div className="py-10 text-center">
                  <Loader2
                    className="mx-auto h-8 w-8 animate-spin text-brand"
                    strokeWidth={2}
                    aria-hidden
                  />
                </div>
              ) : games.length === 0 ? (
                <p className="mt-3 rounded-card bg-surface p-5 text-center text-[13.5px] leading-relaxed text-ink-faint shadow-soft ring-1 ring-line/60">
                  {t(s.kahoot.gamesEmpty)}
                </p>
              ) : (
                <ul className="mt-3 grid gap-2.5">
                  {games.map((game) => (
                    <li
                      key={game.id}
                      className="rounded-card bg-surface p-4 shadow-soft ring-1 ring-line/60"
                    >
                      <p className="truncate text-[15px] font-bold text-ink">
                        {game.title}
                      </p>
                      <p className="mt-0.5 text-[12.5px] text-ink-faint">
                        {game.questions.length} {t(s.kahoot.questionsCount)}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => navigate(`/battle/kahoot/host/${game.id}`)}
                          disabled={game.questions.length === 0}
                          className={cn(
                            'focus-ring flex items-center gap-1.5 rounded-full px-4 py-2',
                            'text-[13px] font-semibold text-white',
                            game.questions.length === 0
                              ? 'cursor-default bg-ink-faint'
                              : 'bg-brand hover:bg-brand-dark',
                          )}
                        >
                          <Play className="h-3.5 w-3.5" strokeWidth={2.4} />
                          {t(s.kahoot.launch)}
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate(`/battle/kahoot/edit/${game.id}`)}
                          className="focus-ring flex items-center gap-1.5 rounded-full bg-surface px-4 py-2 text-[13px] font-semibold text-ink-soft ring-1 ring-line hover:text-ink"
                        >
                          <Pencil className="h-3.5 w-3.5" strokeWidth={2.2} />
                          {t(s.kahoot.edit)}
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeGame(game.id)}
                          aria-label={t(s.kahoot.remove)}
                          className="focus-ring ml-auto grid h-9 w-9 place-items-center rounded-full bg-surface text-ink-faint ring-1 ring-line hover:text-wrong"
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={2} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          )}

          {/* ---------------------------- student ---------------------------- */}

          {role === 'student' && (
            <motion.div
              variants={staggerItem}
              className="mt-5 rounded-card bg-surface p-5 shadow-soft ring-1 ring-line/60"
            >
              <p className="text-center text-[11.5px] font-bold tracking-wide text-ink-faint">
                {t(s.kahoot.codeEntryLabel)}
              </p>

              {/* Six boxes with one real field laid invisibly over them: the
                  caret and the keyboard belong to a normal input, the look
                  belongs to the design. */}
              <div className="relative mx-auto mt-3 w-fit">
                <div className="flex gap-2">
                  {Array.from({ length: KAHOOT_CODE_LENGTH }, (_, index) => (
                    <span
                      key={index}
                      className={cn(
                        'grid h-12 w-10 place-items-center rounded-tile bg-cream',
                        'text-[18px] font-bold text-ink ring-[1.5px]',
                        index === code.length ? 'ring-brand' : 'ring-line',
                      )}
                    >
                      {code[index] ?? ''}
                    </span>
                  ))}
                </div>
                <input
                  value={code}
                  onChange={(event) => {
                    setCode(normalizeCode(event.target.value))
                    setJoinError(null)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void join()
                  }}
                  inputMode="text"
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  aria-label={t(s.kahoot.codeEntryLabel)}
                  className="focus-ring absolute inset-0 w-full rounded-tile bg-transparent text-transparent caret-transparent outline-none"
                />
              </div>

              <p className="mt-2.5 text-center text-[12.5px] text-ink-faint">
                {t(s.kahoot.codeEntryHint)}
              </p>

              {joinError && (
                <p className="mt-3 rounded-tile bg-wrong-tint px-4 py-2.5 text-center text-[13px] font-semibold text-wrong">
                  {joinError}
                </p>
              )}

              <motion.button
                type="button"
                onClick={() => void join()}
                disabled={checking}
                whileHover={checking ? undefined : { y: -2 }}
                whileTap={checking ? undefined : { scale: 0.98 }}
                transition={springSoft}
                className={cn(
                  'focus-ring mt-4 flex w-full items-center justify-center gap-2 rounded-full',
                  'px-6 py-3.5 text-[15px] font-semibold text-white shadow-soft',
                  checking ? 'cursor-default bg-ink-faint' : 'bg-brand hover:bg-brand-dark',
                )}
              >
                {checking && (
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.4} aria-hidden />
                )}
                {t(s.kahoot.join)}
              </motion.button>
            </motion.div>
          )}
        </>
      )}
    </motion.div>
  )
}
