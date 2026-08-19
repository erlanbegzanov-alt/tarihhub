/**
 * The Батл entry point (`/battle`).
 *
 * Just a fork in the road, the same shape as the Кахут picker one level down:
 * Обычный and Рейтинг want completely different content around the same duel
 * engine (see BattleDuel.tsx), so each gets its own screen rather than a mode
 * toggle switching content in place.
 */
import { Swords, Trophy, Users, Zap } from 'lucide-react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { KahootHeader, RoleOption } from '../components/kahoot'
import { s } from '../i18n/strings'
import { useLang } from '../i18n/useLang'
import { staggerContainer, staggerItem } from '../lib/motion'

export function Battle() {
  const { t } = useLang()
  const navigate = useNavigate()

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="mx-auto max-w-2xl lg:max-w-3xl"
    >
      <KahootHeader
        icon={<Swords className="h-5 w-5" strokeWidth={2} />}
        title={t(s.battle.title)}
        subtitle={t(s.battle.subtitle)}
        onBack={() => navigate('/')}
      />

      <motion.div variants={staggerItem} className="mt-5 flex flex-col gap-2.5">
        <RoleOption
          icon={<Zap className="h-5 w-5" strokeWidth={2} />}
          title={t(s.battle.modeCasual)}
          subtitle={t(s.battle.modeCasualSub)}
          onClick={() => navigate('/battle/casual')}
        />
        <RoleOption
          icon={<Trophy className="h-5 w-5" strokeWidth={2} />}
          title={t(s.battle.modeRanked)}
          subtitle={t(s.battle.modeRankedSub)}
          onClick={() => navigate('/battle/ranked')}
        />
        <RoleOption
          icon={<Users className="h-5 w-5" strokeWidth={2} />}
          title={t(s.battle.modeKahoot)}
          subtitle={t(s.battle.modeKahootSub)}
          onClick={() => navigate('/battle/kahoot')}
        />
      </motion.div>
    </motion.div>
  )
}
