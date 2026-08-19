/**
 * Рейтинг (`/battle/ranked`): the duel engine plus this player's league
 * standing and the weekly leaderboard — both live in `battlePlayers/*`
 * (Firestore), not the local profile store, so they're fetched here and
 * refreshed on `BattleDuel`'s `onRankedResult` callback rather than reacting
 * to `useProfile()` the way BattleCasual.tsx's stats do.
 */
import { Award, Crown, Gem, Medal, Shield, Trophy } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KahootHeader } from '../components/kahoot'
import { RankBadge } from '../components/RankBadge'
import { ProgressBar, SectionHeading } from '../components/ui'
import { s } from '../i18n/strings'
import { useLang } from '../i18n/useLang'
import {
  fetchBattlePlayer,
  fetchWeeklyLeaderboard,
  isoWeekStart,
  ratingTierFor,
} from '../lib/battle'
import type { BattlePlayer } from '../lib/battle'
import { cn } from '../lib/cn'
import { staggerContainer, staggerItem } from '../lib/motion'
import { useSession } from '../lib/session'
import { BattleDuel } from './BattleDuel'

/** One icon per `RATING_TIERS` entry, in ascending order of prestige. */
const TIER_ICONS: LucideIcon[] = [Shield, Medal, Award, Gem, Crown]
/** Matching accent per tier — the same bronze→violet ladder RankBadge uses,
 *  plus gold for "Алтын" since the tier's own name demands it. */
const TIER_COLORS = [
  'var(--tier-2)',
  'var(--tier-3)',
  'var(--color-gold)',
  'var(--tier-4)',
  'var(--tier-6)',
]

/** The instant the current week's board resets — a week after its start. */
function nextWeekStart(): Date {
  const [year, month, day] = isoWeekStart().split('-').map(Number)
  const start = new Date(year, month - 1, day)
  start.setDate(start.getDate() + 7)
  return start
}

function formatCountdown(ms: number, dayLabel: string, hourLabel: string): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000))
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  return `${days} ${dayLabel} ${hours} ${hourLabel}`
}

export function BattleRanked() {
  const { t } = useLang()
  const navigate = useNavigate()
  const session = useSession()
  const uid = session.user?.uid ?? null

  const [me, setMe] = useState<BattlePlayer | null>(null)
  const [board, setBoard] = useState<BattlePlayer[]>([])
  const [now, setNow] = useState(() => Date.now())

  const refresh = useCallback(() => {
    if (uid) void fetchBattlePlayer(uid).then(setMe)
    void fetchWeeklyLeaderboard().then(setBoard)
  }, [uid])

  useEffect(refresh, [refresh])

  // The countdown only needs minute precision, so a slow tick is enough.
  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(tick)
  }, [])

  const rating = me?.rating ?? 0
  const tierInfo = useMemo(() => ratingTierFor(rating), [rating])
  const TierIcon = TIER_ICONS[tierInfo.index]
  const tierColor = TIER_COLORS[tierInfo.index]

  const countdown = useMemo(
    () => formatCountdown(nextWeekStart().getTime() - now, t(s.battle.dayShort), t(s.battle.hourShort)),
    [now, t],
  )

  const myPosition = board.findIndex((player) => player.uid === uid)

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="mx-auto max-w-2xl lg:max-w-3xl"
    >
      <KahootHeader
        icon={<Trophy className="h-5 w-5" strokeWidth={2} />}
        title={t(s.battle.modeRanked)}
        subtitle={t(s.battle.modeRankedSub)}
        onBack={() => navigate('/battle')}
      />

      <motion.div
        variants={staggerItem}
        className="mt-5 rounded-card bg-surface p-5 shadow-soft ring-1 ring-line/60"
      >
        <div className="flex items-center gap-4">
          <span
            className="grid h-14 w-14 shrink-0 place-items-center rounded-full"
            style={{ background: `color-mix(in srgb, ${tierColor} 16%, var(--color-surface))` }}
          >
            <TierIcon className="h-6 w-6" strokeWidth={1.8} style={{ color: tierColor }} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-semibold text-ink-faint">
              {t(s.battle.ratingLabel)}
            </p>
            <p className="truncate text-xl font-bold text-ink">
              {t(tierInfo.tier.name)} · {rating} {t(s.battle.ratingPoints)}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <ProgressBar percent={tierInfo.progress} height={8} color={tierColor} />
          <p className="mt-1.5 text-[11.5px] text-ink-faint">
            {tierInfo.next
              ? `${t(s.battle.nextTier)}: ${tierInfo.next.min - rating} ${t(s.battle.ratingPoints)}`
              : t(s.battle.maxTier)}
          </p>
        </div>
      </motion.div>

      <motion.div variants={staggerItem} className="mt-4">
        <BattleDuel mode="ranked" onRankedResult={refresh} />
      </motion.div>

      <motion.div variants={staggerItem} className="mt-7">
        <SectionHeading
          title={t(s.battle.boardTitle)}
          action={
            myPosition >= 0 ? (
              <span className="shrink-0 rounded-full bg-brand-tint px-2.5 py-1 text-[11px] font-bold text-brand">
                {t(s.battle.boardPosition)}: #{myPosition + 1}
              </span>
            ) : undefined
          }
        />
        <p className="-mt-1.5 mb-1 text-[13px] leading-relaxed text-ink-soft">
          {t(s.battle.boardHint)}
        </p>
        <p className="mb-3 text-[12px] font-semibold text-ink-faint">
          {t(s.battle.weekEndsIn)} {countdown}
        </p>

        {board.length === 0 ? (
          <p className="rounded-card bg-surface p-5 text-center text-[13.5px] leading-relaxed text-ink-faint shadow-soft ring-1 ring-line/60">
            {t(s.battle.boardEmpty)}
          </p>
        ) : (
          <>
            <ul className="overflow-hidden rounded-card bg-surface shadow-soft ring-1 ring-line/60">
              {board.map((player, position) => {
                const isMe = player.uid === uid
                return (
                  <li
                    key={player.uid}
                    className={cn(
                      'grid grid-cols-[26px_30px_1fr_auto] items-center gap-3 px-4 py-3',
                      'border-b border-line-soft last:border-b-0',
                      isMe && 'bg-brand-tint',
                    )}
                  >
                    <span
                      className={cn(
                        'text-center text-[13px] font-bold tabular-nums',
                        position < 3 ? 'text-gold' : 'text-ink-faint',
                      )}
                    >
                      {position + 1}
                    </span>
                    {player.avatarGender ? (
                      <RankBadge
                        tierIndex={player.avatarTierIndex}
                        gender={player.avatarGender}
                        title={player.displayName || t(s.battle.opponent)}
                        size={30}
                      />
                    ) : player.photoURL ? (
                      <img
                        src={player.photoURL}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="h-[30px] w-[30px] rounded-full object-cover"
                      />
                    ) : (
                      <span
                        className="grid h-[30px] w-[30px] place-items-center rounded-full text-[12px] font-bold text-white"
                        style={{
                          background: isMe ? 'var(--color-brand)' : 'var(--color-era-alash)',
                        }}
                      >
                        {(player.displayName || '?').charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="flex items-baseline gap-1.5">
                        <span className="truncate text-[13.5px] font-bold text-ink">
                          {player.displayName || t(s.battle.opponent)}
                        </span>
                        {isMe && (
                          <span className="shrink-0 text-[10.5px] font-bold text-brand">
                            {t(s.battle.boardYou)}
                          </span>
                        )}
                      </span>
                      <span className="block text-[11px] font-semibold tabular-nums text-ink-faint">
                        {t(s.battle.levelShort)} {player.level}
                      </span>
                    </span>
                    <span className="text-[13px] font-bold tabular-nums text-ink">
                      {player.weekXp} {t(s.common.xp)}
                    </span>
                  </li>
                )
              })}
            </ul>
            {myPosition < 0 && (
              <p className="mt-2.5 text-center text-[12px] leading-relaxed text-ink-faint">
                {t(s.battle.boardPositionHint)}
              </p>
            )}
          </>
        )}
      </motion.div>
    </motion.div>
  )
}
