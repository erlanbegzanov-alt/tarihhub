/**
 * Обычный (`/battle/casual`): the duel engine plus this player's own casual
 * stats and recent-opponents history — numbers nothing else in the app
 * tracks, kept purely local/per-device (see `recordCasualDuelResult` in
 * `src/lib/progress.ts`) since a casual duel never touches Firestore beyond
 * the match itself.
 */
import { Zap } from 'lucide-react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { KahootHeader } from '../components/kahoot'
import { SectionHeading, StatTile } from '../components/ui'
import { s } from '../i18n/strings'
import { useLang } from '../i18n/useLang'
import { cn } from '../lib/cn'
import { staggerContainer, staggerItem } from '../lib/motion'
import { useProfile } from '../lib/progress'
import { BattleDuel } from './BattleDuel'

export function BattleCasual() {
  const { t } = useLang()
  const navigate = useNavigate()
  const profile = useProfile()

  const winRate =
    profile.casualDuels > 0
      ? Math.round((profile.casualWins / profile.casualDuels) * 100)
      : 0

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="mx-auto max-w-2xl lg:max-w-3xl"
    >
      <KahootHeader
        icon={<Zap className="h-5 w-5" strokeWidth={2} />}
        title={t(s.battle.modeCasual)}
        subtitle={t(s.battle.modeCasualSub)}
        onBack={() => navigate('/battle')}
      />

      <motion.div variants={staggerItem} className="mt-5 grid grid-cols-3 gap-2.5">
        <StatTile value={profile.casualDuels} label={t(s.battle.statDuels)} />
        <StatTile value={`${winRate}%`} label={t(s.battle.statWinRate)} />
        <StatTile value={profile.casualStreak} label={t(s.battle.statStreak)} />
      </motion.div>

      <motion.div variants={staggerItem} className="mt-4">
        <BattleDuel mode="casual" />
      </motion.div>

      <motion.div variants={staggerItem} className="mt-7">
        <SectionHeading title={t(s.battle.recentTitle)} />

        {profile.recentCasualDuels.length === 0 ? (
          <p className="rounded-card bg-surface p-5 text-center text-[13.5px] leading-relaxed text-ink-faint shadow-soft ring-1 ring-line/60">
            {t(s.battle.recentEmpty)}
          </p>
        ) : (
          <ul className="overflow-hidden rounded-card bg-surface shadow-soft ring-1 ring-line/60">
            {profile.recentCasualDuels.map((entry) => (
              <li
                key={entry.at}
                className={cn(
                  'grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3',
                  'border-b border-line-soft last:border-b-0',
                )}
              >
                <span
                  className={cn(
                    'rounded-full px-2.5 py-1 text-[11px] font-bold',
                    entry.won
                      ? 'bg-correct-tint text-correct'
                      : 'bg-wrong-tint text-wrong',
                  )}
                >
                  {t(entry.won ? s.battle.recentWin : s.battle.recentLose)}
                </span>
                <span className="min-w-0 truncate text-[13.5px] font-bold text-ink">
                  {entry.opponentName || t(s.battle.opponent)}
                </span>
                <span className="text-[13px] font-bold tabular-nums text-brand">
                  +{entry.xp} {t(s.common.xp)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </motion.div>
    </motion.div>
  )
}
