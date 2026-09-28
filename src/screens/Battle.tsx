/**
 * The Батл entry point (`/battle`).
 *
 * It was a flat list of five identical rows — same shape, same weight, one
 * coloured circle each — so nothing on the screen said what to do first. It is
 * now a standing first and a picker second: the league card carries the one
 * primary action (play a ranked duel), and everything else sits below it as
 * tiles, which are read at a glance rather than one line at a time.
 *
 * The hierarchy is the design, not the paint: every colour here comes from the
 * theme tokens, so the same screen holds up in light and dark. Erlan picked the
 * layout from a dark mock; hard-coding those darks would have broken the screen
 * for everyone on the light theme.
 *
 * The ҰБТ mock used to head the list. It lives at `/exam` now (see
 * `navItems.ts`): it is what the course prepares for, and standing it beside
 * Кахут and the duels said it was one game among several.
 */
import { Flame, Swords, Trophy, UserPlus, Users, Zap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KahootHeader } from '../components/kahoot'
import { FormDots, LeagueCrest } from '../components/battle'
import { SectionHeading } from '../components/ui'
import { s } from '../i18n/strings'
import { useLang } from '../i18n/useLang'
import { useAlerts } from '../lib/alerts'
import { fetchBattlePlayer, ratingTierFor } from '../lib/battle'
import { FEATURE_TEAM_BATTLE } from '../lib/environment'
import { canHover, springSoft, staggerContainer, staggerItem } from '../lib/motion'
import { useProfile } from '../lib/progress'
import { useSession } from '../lib/session'

/**
 * One mode, as a tile.
 *
 * Module-level so the subtree survives a re-render, and a flex column so a tile
 * whose subtitle wraps to two lines does not pull its neighbour out of line —
 * the grid stretches both to the taller of the row either way.
 */
function ModeTile({
  icon: Icon,
  accent,
  title,
  subtitle,
  stat,
  alert = false,
  onClick,
}: {
  icon: LucideIcon
  accent: string
  title: string
  subtitle: string
  /** One line of this mode's own record, or `null` when there is none yet. */
  stat?: string | null
  /**
   * The stat is something waiting on the reader, not a record — a room
   * invitation, a friend request. It turns red and the icon gets a dot, because
   * a count in the same faint grey as "Дуэлей: 7" reads as trivia, and Erlan's
   * point was that these have to be impossible to walk past.
   */
  alert?: boolean
  onClick: () => void
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={canHover ? { y: -2 } : undefined}
      whileTap={{ scale: 0.99 }}
      transition={springSoft}
      className="focus-ring flex flex-col rounded-card bg-surface p-4 text-left shadow-soft ring-1 ring-line/60 transition-colors duration-200"
    >
      <span className="relative">
        <span
          className="grid h-10 w-10 place-items-center rounded-xl"
          style={{
            background: `color-mix(in srgb, ${accent} 14%, var(--color-surface))`,
            color: accent,
          }}
        >
          <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
        </span>
        {alert && (
          <span
            aria-hidden
            className="absolute -top-1 -right-1 h-[11px] w-[11px] rounded-full bg-wrong ring-2 ring-surface"
          />
        )}
      </span>
      <span className="mt-3 text-[15.5px] font-bold text-ink">{title}</span>
      <span className="mt-1 text-[12px] leading-snug text-ink-soft">{subtitle}</span>
      {stat &&
        (alert ? (
          <span className="mt-2 self-start rounded-full bg-wrong px-2 py-0.5 text-[11px] font-bold text-white tabular-nums">
            {stat}
          </span>
        ) : (
          <span className="mt-1.5 text-[11.5px] font-semibold text-ink-faint tabular-nums">
            {stat}
          </span>
        ))}
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

  // What is waiting on the reader — a room invitation, a friend request. Both
  // arrive from other people and neither used to be visible until you went
  // looking, so the same counts drive the dot on the nav rail (see
  // `src/lib/alerts.ts`) and the numbers on the tiles below.
  const alerts = useAlerts()

  const tier = ratingTierFor(rating ?? 0)

  // The card is about the ranked ladder specifically — its crest, its rating,
  // its button — so the record beside it counts ranked duels only. Mixing the
  // casual ones in would put a number next to a crest it did not earn.
  const rankedRate =
    profile.rankedDuels > 0 ? Math.round((profile.rankedWins / profile.rankedDuels) * 100) : 0
  const playedRanked = profile.rankedDuels > 0
  const playedAnything = profile.casualDuels + profile.rankedDuels > 0

  /** How many points short of the next league, or `null` at the top. */
  const toNext = tier.next ? Math.max(0, tier.next.min - (rating ?? 0)) : null

  /**
   * "Дуэлей: 7 · 57% побед" — or nothing at all.
   *
   * It used to fall back to «ещё не играли», which put a third small grey line
   * on a tile that had nothing to report. Erlan's complaint about too many tiny
   * fonts is mostly made of lines like that one, and an absent record already
   * says "ещё не играли" by being absent.
   */
  const modeRecord = (duels: number, wins: number): string | null =>
    duels > 0
      ? `${t(s.battle.hubDuelsLabel)}: ${duels} · ${Math.round((wins / duels) * 100)}% ${t(s.battle.hubWinsLabel)}`
      : null

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="mx-auto max-w-2xl lg:max-w-3xl"
    >
      <KahootHeader
        icon={<Flame className="h-5 w-5" strokeWidth={2} />}
        title={t(s.battle.title)}
        subtitle={t(s.battle.subtitle)}
        onBack={() => navigate('/')}
      />

      {/* Standing, and the one thing worth doing about it. */}
      <motion.section
        variants={staggerItem}
        className="mt-5 overflow-hidden rounded-card bg-surface shadow-soft ring-1 ring-line/60"
      >
        <div className="p-5">
          <div className="flex items-center gap-4">
            <LeagueCrest tierIndex={tier.index} size={54} />
            <div className="min-w-0 flex-1">
              <p className="text-[11.5px] font-bold tracking-wide text-ink-faint uppercase">
                {t(s.battle.leagueLabel)}
              </p>
              <p className="truncate text-[19px] leading-tight font-bold text-ink">
                {t(tier.tier.name)}
              </p>
              <p className="text-[12.5px] font-semibold tabular-nums text-ink-soft">
                {rating ?? 0} {t(s.battle.ratingPoints)}
              </p>
            </div>
            {/* A bare "0 / 0%" would read as a scoreboard for a ladder never
                climbed, so the record only appears once there is one. */}
            {playedRanked && (
              <div className="shrink-0 text-right">
                <p className="text-[22px] leading-none font-bold tabular-nums text-ink">
                  {rankedRate}
                  <span className="text-[13px] text-ink-faint">%</span>
                </p>
                <p className="mt-1 text-[11px] text-ink-faint tabular-nums">
                  {profile.rankedWins} / {profile.rankedDuels}
                </p>
              </div>
            )}
          </div>

          {/* Only while there is a league above: at the top the bar would sit
              full with nothing left to say. */}
          {toNext !== null && (
            <div className="mt-4">
              <div className="h-1.5 overflow-hidden rounded-full bg-cream-deep">
                <div
                  className="h-1.5 rounded-full bg-brand"
                  style={{ width: `${Math.max(2, tier.progress)}%` }}
                />
              </div>
              <p className="mt-2 text-[11.5px] font-semibold tabular-nums text-ink-faint">
                {t(s.battle.nextTier)} — {toNext} {t(s.battle.ratingPoints)}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={() => navigate('/battle/ranked')}
            className="focus-ring mt-4 flex w-full items-center justify-center gap-2 rounded-tile bg-brand px-5 py-3.5 text-[15px] font-bold text-white transition-colors duration-200 hover:bg-brand-dark"
          >
            <Trophy className="h-[18px] w-[18px]" strokeWidth={2.2} aria-hidden />
            {t(s.battle.hubPlayRanked)}
          </button>
        </div>

        {playedRanked ? (
          <div className="flex items-center justify-between gap-3 border-t border-line-soft bg-cream/50 px-5 py-3">
            <span className="text-[11.5px] font-semibold tracking-wide text-ink-faint uppercase">
              {t(s.battle.formTitle)}
            </span>
            <FormDots results={profile.recentRankedDuels.map((duel) => duel.won)} />
          </div>
        ) : (
          !playedAnything && (
            <p className="border-t border-line-soft bg-cream/50 px-5 py-3 text-[12.5px] leading-relaxed text-ink-soft">
              {t(s.battle.hubNoPlay)}
            </p>
          )
        )}
      </motion.section>

      <motion.div variants={staggerItem} className="mt-7">
        <SectionHeading title={t(s.battle.hubModes)} />
      </motion.div>

      <motion.div variants={staggerItem} className="grid grid-cols-2 gap-2.5">
        <ModeTile
          icon={Zap}
          accent="var(--color-brand)"
          title={t(s.battle.modeCasual)}
          subtitle={t(s.battle.modeCasualSub)}
          stat={modeRecord(profile.casualDuels, profile.casualWins)}
          onClick={() => navigate('/battle/casual')}
        />
        {/* Unfinished — test site only until team battle ships. Crossed swords
            rather than the group-of-people glyph it shared with Кахут: it is the
            one mode where two sides face each other, and the icon was doing
            nothing to say so. */}
        {FEATURE_TEAM_BATTLE && (
          <ModeTile
            icon={Swords}
            accent="var(--color-era-saka)"
            title={t(s.team.title)}
            subtitle={t(s.team.hubSub)}
            stat={
              alerts.partyInvites > 0
                ? `${alerts.partyInvites} ${t(s.team.inviteWaiting)}`
                : null
            }
            alert={alerts.partyInvites > 0}
            onClick={() => navigate('/battle/team')}
          />
        )}
        <ModeTile
          icon={Users}
          accent="var(--color-era-modern)"
          title={t(s.battle.modeKahoot)}
          subtitle={t(s.battle.modeKahootSub)}
          onClick={() => navigate('/battle/kahoot')}
        />
        {FEATURE_TEAM_BATTLE && (
          <ModeTile
            icon={UserPlus}
            accent="var(--color-era-turkic)"
            title={t(s.friends.title)}
            subtitle={t(s.friends.hubSub)}
            stat={
              alerts.friendRequests > 0
                ? `${alerts.friendRequests} ${t(s.friends.requestsWaiting)}`
                : null
            }
            alert={alerts.friendRequests > 0}
            onClick={() => navigate('/battle/friends')}
          />
        )}
      </motion.div>
    </motion.div>
  )
}
