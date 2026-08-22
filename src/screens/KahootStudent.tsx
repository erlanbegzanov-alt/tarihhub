/**
 * Joining a game by code (`/battle/kahoot/student`).
 *
 * Split out of the old combined hub screen — see `Kahoot.tsx` for the picker
 * that sends a student here and `KahootTeacher.tsx` for its teacher-side twin.
 */
import { motion } from 'framer-motion'
import { Loader2, Users } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KahootHeader } from '../components/kahoot'
import { s } from '../i18n/strings'
import { useLang } from '../i18n/useLang'
import { cn } from '../lib/cn'
import { isFirebaseReady } from '../lib/firebase'
import { KAHOOT_CODE_LENGTH, fetchSession, normalizeCode } from '../lib/kahoot'
import { canHover, springSoft, staggerContainer, staggerItem } from '../lib/motion'
import { useSession } from '../lib/session'

export function KahootStudent() {
  const { t } = useLang()
  const navigate = useNavigate()
  const session = useSession()
  const ready = isFirebaseReady && Boolean(session.user)

  const [code, setCode] = useState('')
  const [joinError, setJoinError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

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

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="mx-auto max-w-2xl lg:max-w-3xl"
    >
      <KahootHeader
        icon={<Users className="h-5 w-5" strokeWidth={2} />}
        title={t(s.kahoot.roleStudent)}
        subtitle={t(s.kahoot.roleStudentSub)}
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
        <motion.div
          variants={staggerItem}
          className="mt-5 rounded-card bg-surface p-5 shadow-soft ring-1 ring-line/60"
        >
          <p className="text-center text-[11.5px] font-bold tracking-wide text-ink-faint">
            {t(s.kahoot.codeEntryLabel)}
          </p>

          {/* Six boxes with one real field laid invisibly over them: the caret
              and the keyboard belong to a normal input, the look belongs to
              the design. */}
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
            whileHover={canHover && !checking ? { y: -2 } : undefined}
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
    </motion.div>
  )
}
