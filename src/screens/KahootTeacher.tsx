/**
 * A teacher's own games (`/battle/kahoot/teacher`).
 *
 * Split out of the old combined hub screen so a teacher and a student each
 * land on a page that is entirely theirs — see `Kahoot.tsx` for the picker
 * that sends them here.
 */
import { motion } from 'framer-motion'
import { GraduationCap, Loader2, Pencil, Play, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KahootHeader } from '../components/kahoot'
import { SectionHeading } from '../components/ui'
import { s } from '../i18n/strings'
import { useLang } from '../i18n/useLang'
import { cn } from '../lib/cn'
import { isFirebaseReady } from '../lib/firebase'
import { deleteGame, fetchMyGames } from '../lib/kahoot'
import type { KahootGame } from '../lib/kahoot'
import { springSoft, staggerContainer, staggerItem } from '../lib/motion'
import { useSession } from '../lib/session'

export function KahootTeacher() {
  const { t } = useLang()
  const navigate = useNavigate()
  const session = useSession()
  const uid = session.user?.uid ?? null

  const [games, setGames] = useState<KahootGame[] | null>(null)

  const loadGames = useCallback(() => {
    if (!uid) return
    void fetchMyGames(uid).then(setGames)
  }, [uid])

  useEffect(loadGames, [loadGames])

  const removeGame = async (gameId: string) => {
    setGames((prev) => prev?.filter((game) => game.id !== gameId) ?? prev)
    await deleteGame(gameId)
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
        icon={<GraduationCap className="h-5 w-5" strokeWidth={2} />}
        title={t(s.kahoot.roleTeacher)}
        subtitle={t(s.kahoot.roleTeacherSub)}
        onBack={() => navigate('/battle/kahoot')}
      />

      {!ready ? (
        <motion.p
          variants={staggerItem}
          className="mt-5 rounded-card bg-surface p-5 text-center text-[13.5px] leading-relaxed text-ink-faint shadow-soft ring-1 ring-line/60"
        >
          {t(s.battle.unavailable)}
        </motion.p>
      ) : (
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
                  <p className="truncate text-[15px] font-bold text-ink">{game.title}</p>
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
    </motion.div>
  )
}
