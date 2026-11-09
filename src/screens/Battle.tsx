/**
 * The Батл entry point (`/battle`).
 *
 * A standing first and a picker second: the league card carries the one
 * primary action (play a ranked duel), and the modes sit below it.
 *
 * Drawn in the «Ойын» direction Erlan picked off the design canvas: solid
 * colour blocks with a ledge under them and Unbounded for the names. The era
 * illustrations they carried at first moved to the course's unit cards, at
 * Erlan's request (2026-11-09). The modes are deliberately not four
 * equal tiles — Қарапайым, the one most people open, is the big one — because
 * a grid of identical boxes was what read as boring.
 *
 * The blocks keep fixed colours in both themes (`src/data/battlePaint.ts`); the ground, the
 * header and the section heading around them still follow the theme tokens.
 *
 * The ҰБТ mock used to head the list. It lives at `/exam` now (see
 * `navItems.ts`): it is what the course prepares for, and standing it beside
 * Кахут and the duels said it was one game among several.
 */
import { Flame, Lock, Swords, Trophy, UserPlus, Users, Zap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KahootHeader } from '../components/kahoot'
import { FormDots, ratingTierIcon } from '../components/battle'
import { SectionHeading } from '../components/ui'
import { ALERT_RED, LEAGUE_PAINT, MODE_PAINT } from '../data/battlePaint'
import type { LeaguePaint } from '../data/battlePaint'
import { s } from '../i18n/strings'
import { useLang } from '../i18n/useLang'
import { useAlerts } from '../lib/alerts'
import { RATING_TIERS, fetchBattlePlayer, ratingTierFor } from '../lib/battle'
import { cn } from '../lib/cn'
import { FEATURE_TEAM_BATTLE } from '../lib/environment'
import { canHover, springSoft, staggerContainer, staggerItem } from '../lib/motion'
import { useProfile } from '../lib/progress'
import { useSession } from '../lib/session'

/**
 * One mode, as a colour block with its picture fading into the colour at the
 * bottom, where the name sits.
 *
 * No subtitle: Erlan had the one-line descriptions taken off, the name, icon
 * and picture say enough. Pressing it sinks it onto its ledge.
 */
function ModeBlock({
  paint,
  icon: Icon,
  title,
  stat,
  alert = false,
  onClick,
  className,
}: {
  paint: LeaguePaint
  icon: LucideIcon
  title: string
  /** One line of this mode's own record, or `null` when there is none yet. */
  stat?: string | null
  /**
   * The stat is something waiting on the reader, not a record — a room
   * invitation, a friend request. It becomes a red badge in the corner, because
   * Erlan's point was that these have to be impossible to walk past.
   */
  alert?: boolean
  onClick: () => void
  className?: string
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={canHover ? { y: -2 } : undefined}
      whileTap={{ y: 3 }}
      transition={springSoft}
      className={cn('focus-ring relative overflow-hidden rounded-[24px] text-left', className)}
      style={{ background: paint.bg, boxShadow: `0 5px 0 0 ${paint.ledge}` }}
    >
      <img
        src={paint.image}
        alt=""
        aria-hidden
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover object-[center_30%]"
      />
      <span
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `linear-gradient(to top, ${paint.bg} 8%, color-mix(in srgb, ${paint.bg} 60%, transparent) 42%, color-mix(in srgb, ${paint.bg} 5%, transparent) 85%), linear-gradient(to right, color-mix(in srgb, ${paint.bg} 45%, transparent), transparent 55%)`,
        }}
      />
      {stat && alert && (
        <span
          className="absolute top-3 right-3 rounded-full px-2.5 py-1 text-[12px] font-bold text-white tabular-nums"
          style={{ background: ALERT_RED }}
        >
          {stat}
        </span>
      )}
      <span className="absolute inset-x-4 bottom-4 flex flex-col gap-2 [text-shadow:0_1px_3px_rgb(0_0_0/0.4)] lg:inset-x-5 lg:bottom-5">
        <Icon className="h-[22px] w-[22px] text-white" strokeWidth={2} aria-hidden />
        <span className="font-display text-[16px] leading-tight font-bold text-white lg:text-[20px]">
          {title}
        </span>
        {stat && !alert && (
          <span className="text-[12.5px] font-semibold text-white/90 tabular-nums">{stat}</span>
        )}
      </span>
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
  // `src/lib/alerts.ts`) and the badges on the blocks below.
  const alerts = useAlerts()

  const tier = ratingTierFor(rating ?? 0)
  const league = LEAGUE_PAINT[Math.min(tier.index, LEAGUE_PAINT.length - 1)]
  const TierIcon = ratingTierIcon(tier.index)

  // The card is about the ranked ladder specifically — its crest, its rating,
  // its button — so the record beside it counts ranked duels only. Mixing the
  // casual ones in would put a number next to a crest it did not earn.
  const rankedRate =
    profile.rankedDuels > 0 ? Math.round((profile.rankedWins / profile.rankedDuels) * 100) : 0
  const playedRanked = profile.rankedDuels > 0

  /** How many points short of the next league, or `null` at the top. */
  const toNext = tier.next ? Math.max(0, tier.next.min - (rating ?? 0)) : null

  /** "Дуэлей: 7 · 57% побед" — or nothing at all, which already says "not yet". */
  const modeRecord = (duels: number, wins: number): string | null =>
    duels > 0
      ? `${t(s.battle.hubDuelsLabel)}: ${duels} · ${Math.round((wins / duels) * 100)}% ${t(s.battle.hubWinsLabel)}`
      : null

  // Team battle and Достар are test-site only. Without them the two remaining
  // modes share the row evenly instead of leaving holes in the mosaic.
  const teamOn = FEATURE_TEAM_BATTLE

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="mx-auto max-w-2xl pb-4 lg:max-w-5xl"
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
        className="relative mt-5 overflow-hidden rounded-[26px] lg:h-[220px]"
        style={{ background: league.bg, boxShadow: `0 6px 0 0 ${league.ledge}` }}
      >
        {/* Each league has its own picture, and the picture grows with it: the
            eagle is a speck over the Қола steppe and fills the sky at Алмас.
            Every picture is painted in its league's colour with the subject on
            the right, so the veil only has to settle the left half for the type. */}
        <img
          src={league.image}
          alt=""
          aria-hidden
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover object-right"
        />
        <span
          aria-hidden
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to right, ${league.bg} 18%, color-mix(in srgb, ${league.bg} 55%, transparent) 50%, color-mix(in srgb, ${league.bg} 10%, transparent) 85%), linear-gradient(to top, rgb(0 0 0 / 0.28), transparent 60%), linear-gradient(to bottom, rgb(0 0 0 / 0.26), transparent 45%)`,
          }}
        />

        <div className="relative flex flex-col gap-5 p-5 [text-shadow:0_1px_3px_rgb(0_0_0/0.35)] lg:h-full lg:justify-between lg:p-7">
          <div className="flex items-center gap-3.5 lg:gap-4">
            <span className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-2xl bg-white/20 lg:h-16 lg:w-16">
              <TierIcon className="h-7 w-7 text-white lg:h-8 lg:w-8" strokeWidth={2} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display truncate text-[22px] leading-tight font-bold text-white lg:text-[30px]">
                {t(tier.tier.name)}
              </p>
              <p className="text-[14px] font-semibold text-white/90 tabular-nums">
                {rating ?? 0} {t(s.battle.ratingPoints)}
              </p>
            </div>
            {/* A bare "0 / 0%" would read as a scoreboard for a ladder never
                climbed, so the record only appears once there is one. */}
            {playedRanked && (
              <div className="shrink-0 text-right text-white">
                <p className="font-display text-[22px] leading-none font-bold tabular-nums lg:text-[26px]">
                  {rankedRate}
                  <span className="text-[13px] text-white/85">%</span>
                </p>
                <p className="mt-1 text-[12px] text-white/90 tabular-nums">
                  {profile.rankedWins} / {profile.rankedDuels}
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
            {/* Only while there is a league above: at the top the bar would sit
                full with nothing left to say. */}
            {tier.next && toNext !== null && (
              <div className="max-w-[320px] lg:max-w-[440px] lg:flex-1">
                <div className="h-2 overflow-hidden rounded-full bg-white/25">
                  <div
                    className="h-2 rounded-full bg-white"
                    style={{ width: `${Math.max(2, tier.progress)}%` }}
                  />
                </div>
                <p className="mt-1.5 flex justify-between gap-3 text-[13px] font-semibold text-white/90 tabular-nums">
                  <span>
                    {t(s.battle.nextTier)} — {toNext} {t(s.battle.ratingPoints)}
                  </span>
                  <span className="shrink-0 text-white">{t(tier.next.name)}</span>
                </p>
              </div>
            )}
            <motion.button
              type="button"
              onClick={() => navigate('/battle/ranked')}
              whileTap={{ y: 3 }}
              transition={springSoft}
              className="focus-ring flex items-center gap-2 self-start rounded-full bg-white px-5 py-3 text-[15px] font-bold lg:self-auto lg:px-6 lg:py-3.5 lg:text-[16px]"
              style={{ color: league.ledge, boxShadow: `0 4px 0 0 ${league.ledge}` }}
            >
              <Trophy className="h-[18px] w-[18px]" strokeWidth={2.2} aria-hidden />
              {t(s.battle.hubPlayRanked)}
            </motion.button>
          </div>
        </div>
      </motion.section>

      {/* The whole ladder, so the next league's picture is something to climb
          toward: the reader's own is lit, the ones above are dimmed and say
          what they cost. Scrolls sideways on a phone, one row on a wide screen. */}
      <motion.section variants={staggerItem} className="mt-6">
        <h2 className="font-display text-[15px] font-bold text-ink">{t(s.battle.leaguesTitle)}</h2>
        <ol className="-mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-5 lg:overflow-visible lg:px-0">
          {RATING_TIERS.map((rt, i) => {
            const paint = LEAGUE_PAINT[i]
            const reached = i <= tier.index
            const current = i === tier.index
            return (
              <li
                key={rt.min}
                aria-current={current ? 'true' : undefined}
                className={cn(
                  'relative h-[118px] w-[150px] shrink-0 snap-start overflow-hidden rounded-[18px] lg:w-auto',
                  current && 'ring-[3px] ring-offset-2 ring-offset-cream',
                )}
                style={{
                  background: paint.bg,
                  boxShadow: `0 4px 0 0 ${paint.ledge}`,
                  ...(current ? { ['--tw-ring-color' as string]: paint.bg } : {}),
                }}
              >
                <img
                  src={paint.image}
                  alt=""
                  aria-hidden
                  loading="lazy"
                  decoding="async"
                  className={cn(
                    'absolute inset-0 h-full w-full object-cover object-right',
                    !reached && 'grayscale-[60%]',
                  )}
                />
                <span
                  aria-hidden
                  className="absolute inset-0"
                  style={{
                    background: reached
                      ? `linear-gradient(to top, ${paint.bg} 10%, color-mix(in srgb, ${paint.bg} 30%, transparent) 60%, transparent)`
                      : `linear-gradient(to top, ${paint.bg} 10%, color-mix(in srgb, ${paint.bg} 70%, transparent) 60%, color-mix(in srgb, ${paint.bg} 45%, transparent))`,
                  }}
                />
                {!reached && (
                  <Lock
                    className="absolute top-2.5 right-2.5 h-4 w-4 text-white/90"
                    strokeWidth={2.4}
                    aria-hidden
                  />
                )}
                <span className="absolute inset-x-3 bottom-2.5 text-white [text-shadow:0_1px_3px_rgb(0_0_0/0.45)]">
                  <span className="font-display block text-[15px] leading-tight font-bold">
                    {t(rt.name)}
                  </span>
                  <span className="block text-[12px] font-semibold text-white/90 tabular-nums">
                    {current ? `${rating ?? 0} ${t(s.battle.ratingPoints)}` : `${rt.min}+ ${t(s.battle.ratingPoints)}`}
                  </span>
                </span>
              </li>
            )
          })}
        </ol>
      </motion.section>

      {playedRanked && (
        <motion.div
          variants={staggerItem}
          className="mt-4 flex items-center justify-between gap-3 px-1"
        >
          <span className="text-[12.5px] font-semibold text-ink-soft">{t(s.battle.formTitle)}</span>
          <FormDots results={profile.recentRankedDuels.map((duel) => duel.won)} />
        </motion.div>
      )}

      <motion.div variants={staggerItem} className="mt-7">
        <SectionHeading title={t(s.battle.hubModes)} />
      </motion.div>

      {/* A mosaic, not four equal tiles. Phone: Қарапайым across the top, the
          two group modes side by side, Достар across the bottom. Desktop:
          Қарапайым tall on the left, the rest to its right. */}
      <motion.div
        variants={staggerItem}
        className={cn(
          'grid grid-cols-2 gap-3 lg:gap-[18px]',
          teamOn ? 'lg:grid-cols-[10fr_7fr_7fr] lg:grid-rows-[150px_150px]' : 'lg:h-[230px]',
        )}
      >
        <ModeBlock
          paint={MODE_PAINT.casual}
          icon={Zap}
          title={t(s.battle.modeCasual)}
          stat={modeRecord(profile.casualDuels, profile.casualWins)}
          onClick={() => navigate('/battle/casual')}
          className={cn('col-span-2 h-[112px] lg:col-span-1 lg:h-auto', teamOn && 'lg:row-span-2')}
        />
        {teamOn && (
          <ModeBlock
            paint={MODE_PAINT.team}
            icon={Swords}
            title={t(s.team.title)}
            stat={
              alerts.partyInvites > 0 ? `${alerts.partyInvites} ${t(s.team.inviteWaiting)}` : null
            }
            alert={alerts.partyInvites > 0}
            onClick={() => navigate('/battle/team')}
            className="h-[150px] lg:col-span-2 lg:h-auto"
          />
        )}
        <ModeBlock
          paint={MODE_PAINT.kahoot}
          icon={Users}
          title={t(s.battle.modeKahoot)}
          onClick={() => navigate('/battle/kahoot')}
          className={teamOn ? 'h-[150px] lg:h-auto' : 'col-span-2 h-[112px] lg:col-span-1 lg:h-auto'}
        />
        {teamOn && (
          <ModeBlock
            paint={MODE_PAINT.friends}
            icon={UserPlus}
            title={t(s.friends.title)}
            stat={
              alerts.friendRequests > 0
                ? `${alerts.friendRequests} ${t(s.friends.requestsWaiting)}`
                : null
            }
            alert={alerts.friendRequests > 0}
            onClick={() => navigate('/battle/friends')}
            className="col-span-2 h-[96px] lg:col-span-1 lg:h-auto"
          />
        )}
      </motion.div>
    </motion.div>
  )
}
