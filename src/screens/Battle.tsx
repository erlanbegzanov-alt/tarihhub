/**
 * The Батл entry point (`/battle`).
 *
 * Used to be three bare buttons — the section showed nothing at all about the
 * reader until they had already committed to a mode. It is now a standing
 * card first (league, rating, form) and a picker second, and each mode card
 * carries that mode's own record, so "where am I and what happened lately" is
 * answered before anything is clicked.
 *
 * Still only a fork in the road, though: Обычный and Рейтинг want completely
 * different content around the same duel engine (see BattleDuel.tsx), so each
 * keeps its own screen rather than a mode toggle switching content in place.
 */
import { ChevronRight, Swords, Trophy, Users, Zap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KahootHeader } from '../components/kahoot'
import { FormDots, LeagueCrest, ratingTierColor } from '../components/battle'
import { SectionHeading } from '../components/ui'
import { s } from '../i18n/strings'
import { useLang } from '../i18n/useLang'
import { fetchBattlePlayer, ratingTierFor } from '../lib/battle'
import { cn } from '../lib/cn'
import { springSoft, staggerContainer, staggerItem } from '../lib/motion'
import { useProfile } from '../lib/progress'
import { useSession } from '../lib/session'

/**
 * One mode, as a card that already knows how that mode has been going.
 *
 * The chevron row this replaces (`RoleOption`) is still the right shape for
 * Кахут, which has no record to show; the two duel modes get `stat` and
 * `trailing` so the picker itself carries the answer to "how am I doing here".
 */
function ModeCard({
  icon: Icon,
  accent,
  title,
  subtitle,
  stat,
  trailing,
  onClick,
}: {
  icon: LucideIcon
  accent: string
  title: string
  subtitle: string
  /** One line of this mode's own record, or `null` when there is none yet. */
  stat?: string | null
  /** Optional visual — the league crest, the form dots. */
  trailing?: React.ReactNode
  onClick: () => void
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      transition={springSoft}
      className={cn(
        'focus-ring flex w-full items-center gap-3.5 rounded-card px-4 py-4 text-left',
        'bg-surface shadow-soft ring-1 ring-line/60 transition-colors duration-200',
      )}
    >
      <span
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full"
        style={{
          background: `color-mix(in srgb, ${accent} 14%, var(--color-surface))`,
          color: accent,
        }}
      >
        <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
      </span>

      <span className="min-w-0 flex-1">
        <span className="text-[15.5px] font-bold text-ink">{title}</span>
        <span className="mt-0.5 block truncate text-[12.5px] text-ink-soft">
          {subtitle}
        </span>
        {stat && (
          <span className="mt-1 block truncate text-[11.5px] font-semibold text-ink-faint tabular-nums">
            {stat}
          </span>
        )}
      </span>

      {trailing}
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" strokeWidth={2} />
    </motion.button>
  )
}

export function Battle() {
  const { t } = useLang()
  const navigate = useNavigate()
  const profile = useProfile()
  const uid = useSession().user?.uid ?? null

  // The rating lives in Firestore, not the local profile store, so the hub has
  // to fetch it the same way the Рейтинг screen does. `null` until it lands —
  // and for an account that has never played a ranked duel at all.
  const [rating, setRating] = useState<number | null>(null)
  useEffect(() => {
    if (!uid) return
    let alive = true
    void fetchBattlePlayer(uid).then((player) => {
      if (alive) setRating(player?.rating ?? 0)
    })
    return () => {
      alive = false
    }
  }, [uid])

  const totalDuels = profile.casualDuels + profile.rankedDuels
  const totalWins = profile.casualWins + profile.rankedWins
  const winRate = totalDuels > 0 ? Math.round((totalWins / totalDuels) * 100) : 0

  // Newest first, both modes interleaved — the hub's form strip is about the
  // reader's recent play as a whole, not either ladder in isolation.
  const recentForm = [...profile.recentRankedDuels, ...profile.recentCasualDuels]
    .sort((a, b) => b.at - a.at)
    .slice(0, 8)
    .map((duel) => duel.won)

  const tier = ratingTierFor(rating ?? 0)
  const tierColor = ratingTierColor(tier.index)
  const played = totalDuels > 0

  /** "Дуэлей: 7 · 57% побед", or the never-played line. */
  const modeRecord = (duels: number, wins: number): string =>
    duels > 0
      ? `${t(s.battle.hubDuelsLabel)}: ${duels} · ${Math.round((wins / duels) * 100)}% ${t(s.battle.hubWinsLabel)}`
      : t(s.battle.hubNeverPlayed)

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

      {/* Standing at a glance: league, rating, lifetime record, recent form. */}
      <motion.section
        variants={staggerItem}
        className="mt-5 overflow-hidden rounded-card bg-surface shadow-soft ring-1 ring-line/60"
      >
        <div className="flex items-center gap-4 p-5">
          <LeagueCrest tierIndex={tier.index} size={54} />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold tracking-wide text-ink-faint uppercase">
              {t(s.battle.leagueLabel)}
            </p>
            <p className="truncate text-[19px] leading-tight font-bold text-ink">
              {t(tier.tier.name)}
            </p>
            <p className="text-[12.5px] font-semibold tabular-nums text-ink-soft">
              {rating ?? 0} {t(s.battle.ratingPoints)}
            </p>
          </div>
          {/* A bare "0 / 0%" would read as a scoreboard for a game never
              played, so the record only appears once there is one. */}
          {played && (
            <div className="shrink-0 text-right">
              <p className="text-[22px] leading-none font-bold tabular-nums text-ink">
                {winRate}
                <span className="text-[13px] text-ink-faint">%</span>
              </p>
              <p className="mt-1 text-[11px] text-ink-faint tabular-nums">
                {totalWins} / {totalDuels}
              </p>
            </div>
          )}
        </div>

        {played ? (
          <div className="flex items-center justify-between gap-3 border-t border-line-soft bg-cream/50 px-5 py-3">
            <span className="text-[11.5px] font-semibold tracking-wide text-ink-faint uppercase">
              {t(s.battle.formTitle)}
            </span>
            <FormDots results={recentForm} />
          </div>
        ) : (
          <p className="border-t border-line-soft bg-cream/50 px-5 py-3 text-[12.5px] leading-relaxed text-ink-soft">
            {t(s.battle.hubNoPlay)}
          </p>
        )}
      </motion.section>

      <motion.div variants={staggerItem} className="mt-7">
        <SectionHeading title={t(s.battle.hubModes)} />
      </motion.div>

      <motion.div variants={staggerItem} className="flex flex-col gap-2.5">
        <ModeCard
          icon={Zap}
          accent="var(--color-brand)"
          title={t(s.battle.modeCasual)}
          subtitle={t(s.battle.modeCasualSub)}
          stat={modeRecord(profile.casualDuels, profile.casualWins)}
          trailing={
            profile.recentCasualDuels.length > 0 ? (
              <span className="hidden sm:block">
                <FormDots
                  results={profile.recentCasualDuels.map((duel) => duel.won)}
                  max={5}
                />
              </span>
            ) : undefined
          }
          onClick={() => navigate('/battle/casual')}
        />
        <ModeCard
          icon={Trophy}
          accent={tierColor}
          title={t(s.battle.modeRanked)}
          subtitle={t(s.battle.modeRankedSub)}
          stat={modeRecord(profile.rankedDuels, profile.rankedWins)}
          trailing={
            profile.recentRankedDuels.length > 0 ? (
              <span className="hidden sm:block">
                <FormDots
                  results={profile.recentRankedDuels.map((duel) => duel.won)}
                  max={5}
                />
              </span>
            ) : undefined
          }
          onClick={() => navigate('/battle/ranked')}
        />
        <ModeCard
          icon={Users}
          accent="var(--color-era-modern)"
          title={t(s.battle.modeKahoot)}
          subtitle={t(s.battle.modeKahootSub)}
          onClick={() => navigate('/battle/kahoot')}
        />
      </motion.div>
    </motion.div>
  )
}
