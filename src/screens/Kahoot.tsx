/**
 * The Кахут entry point (`/battle/kahoot`).
 *
 * Just a fork in the road: a teacher and a student want completely different
 * things here, so each gets its own screen (`/battle/kahoot/teacher`,
 * `/battle/kahoot/student`) rather than a role toggle switching content in
 * place — the same shape as the battle mode picker one level up.
 */
import { GraduationCap, Users } from 'lucide-react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { KahootHeader, RoleOption } from '../components/kahoot'
import { s } from '../i18n/strings'
import { useLang } from '../i18n/useLang'
import { isFirebaseReady } from '../lib/firebase'
import { staggerContainer, staggerItem } from '../lib/motion'
import { useSession } from '../lib/session'

export function Kahoot() {
  const { t } = useLang()
  const navigate = useNavigate()
  const session = useSession()
  const ready = isFirebaseReady && Boolean(session.user)

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
        <motion.div variants={staggerItem} className="mt-5 flex flex-col gap-2.5">
          <RoleOption
            icon={<GraduationCap className="h-5 w-5" strokeWidth={2} />}
            title={t(s.kahoot.roleTeacher)}
            subtitle={t(s.kahoot.roleTeacherSub)}
            onClick={() => navigate('/battle/kahoot/teacher')}
          />
          <RoleOption
            icon={<Users className="h-5 w-5" strokeWidth={2} />}
            title={t(s.kahoot.roleStudent)}
            subtitle={t(s.kahoot.roleStudentSub)}
            onClick={() => navigate('/battle/kahoot/student')}
          />
        </motion.div>
      )}
    </motion.div>
  )
}
