/**
 * Обычный (`/battle/casual`): the duel engine plus this player's own casual
 * record and match history — numbers nothing else in the app tracks, kept
 * purely local/per-device (see `recordCasualDuelResult` in
 * `src/lib/progress.ts`) since a casual duel never touches Firestore beyond
 * the match itself.
 *
 * Deliberately has no weekly leaderboard: casual is practice, it pays no
 * rating and no week XP, and a ranking widget here would only imply otherwise.
 * The board belongs to Рейтинг alone.
 */
import { Zap } from 'lucide-react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { KahootHeader } from '../components/kahoot'
import {
  EmptyPanel,
  FormDots,
  MatchList,
  MatchRow,
  useMyIdentity,
} from '../components/battle'
import { SectionHeading, XpPill } from '../components/ui'
import { s } from '../i18n/strings'
import { useLang } from '../i18n/useLang'
import { staggerContainer, staggerItem } from '../lib/motion'
import { useProfile } from '../lib/progress'
import { BattleDuel } from './BattleDuel'

export function BattleCasual() {
  const { t } = useLang()
  const navigate = useNavigate()
  const profile = useProfile()
  const me = useMyIdentity()

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

      {/* One record card rather than three loose tiles: the three numbers only
          mean anything read together, and the form strip below them turns the
          same history into a shape before it is a list. */}
      <motion.section
        variants={staggerItem}
        className="mt-5 overflow-hidden rounded-card bg-surface shadow-soft ring-1 ring-line/60"
      >
        <div className="grid grid-cols-3 divide-x divide-line-soft">
          <div className="px-3 py-4 text-center">
            <p className="text-2xl leading-none font-bold tabular-nums text-ink">
              {profile.casualDuels}
            </p>
            <p className="mt-1.5 text-[11px] leading-tight text-ink-faint">
              {t(s.battle.statDuels)}
            </p>
          </div>
          <div className="px-3 py-4 text-center">
            <p className="text-2xl leading-none font-bold tabular-nums text-brand">
              {winRate}%
            </p>
            <p className="mt-1.5 text-[11px] leading-tight text-ink-faint">
              {t(s.battle.statWinRate)}
            </p>
          </div>
          <div className="px-3 py-4 text-center">
            <p className="text-2xl leading-none font-bold tabular-nums text-gold">
              {profile.casualStreak}
            </p>
            <p className="mt-1.5 text-[11px] leading-tight text-ink-faint">
              {t(s.battle.statStreak)}
            </p>
          </div>
        </div>

        {profile.recentCasualDuels.length > 0 && (
          <div className="flex items-center justify-between gap-3 border-t border-line-soft bg-cream/50 px-5 py-3">
            <span className="text-[11.5px] font-semibold tracking-wide text-ink-faint uppercase">
              {t(s.battle.formTitle)}
            </span>
            <FormDots results={profile.recentCasualDuels.map((duel) => duel.won)} />
          </div>
        )}
      </motion.section>

      <motion.div variants={staggerItem} className="mt-4">
        <BattleDuel mode="casual" />
      </motion.div>

      <motion.div variants={staggerItem} className="mt-7">
        <SectionHeading title={t(s.battle.recentTitle)} />

        {profile.recentCasualDuels.length === 0 ? (
          <EmptyPanel>{t(s.battle.recentEmpty)}</EmptyPanel>
        ) : (
          <MatchList>
            {profile.recentCasualDuels.map((duel) => (
              <MatchRow
                key={duel.at}
                me={me}
                duel={duel}
                // Casual pays real profile XP and nothing else, so the XP is
                // the whole payout — there is no rating line to put beside it.
                meta={
                  <XpPill>
                    +{duel.xp} {t(s.common.xp)}
                  </XpPill>
                }
              />
            ))}
          </MatchList>
        )}
      </motion.div>
    </motion.div>
  )
}
