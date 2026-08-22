/**
 * Рейтинг (`/battle/ranked`): the duel engine, this player's league standing,
 * and — behind one segmented control — either their own match history or the
 * weekly leaderboard.
 *
 * The standing and the board live in `battlePlayers/*` (Firestore), not the
 * local profile store, so they're fetched here and refreshed on `BattleDuel`'s
 * `onRankedResult` callback rather than reacting to `useProfile()`. The
 * personal history is the other way round: it is written locally by
 * `recordRankedDuelResult` (see `src/lib/progress.ts`) and arrives through
 * `useProfile()` on its own.
 *
 * The two lists share one slot on purpose. Stacking a rating card, a duel
 * window, a personal history *and* a ten-row board down one column is what
 * made this screen feel crammed; they answer different questions ("how am I
 * doing" vs "how is everyone doing") and are never read at the same moment.
 */
import { History, Trophy } from 'lucide-react'
import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KahootHeader, PlayerAvatar } from '../components/kahoot'
import {
  EmptyPanel,
  FormDots,
  LeagueCard,
  MatchList,
  MatchRow,
  RatingMove,
  useMyIdentity,
} from '../components/battle'
import { SectionHeading } from '../components/ui'
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
import { springSoft, staggerContainer, staggerItem } from '../lib/motion'
import { useProfile } from '../lib/progress'
import { useSession } from '../lib/session'
import { BattleDuel } from './BattleDuel'

type Tab = 'history' | 'board'

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

/** Two-way switch between the personal history and the weekly board. */
function TabSwitch({
  tab,
  onChange,
  historyLabel,
  boardLabel,
}: {
  tab: Tab
  onChange: (tab: Tab) => void
  historyLabel: string
  boardLabel: string
}) {
  const options: { id: Tab; label: string; Icon: typeof History }[] = [
    { id: 'history', label: historyLabel, Icon: History },
    { id: 'board', label: boardLabel, Icon: Trophy },
  ]
  return (
    <div
      role="tablist"
      className="grid grid-cols-2 gap-1 rounded-full bg-cream-deep p-1"
    >
      {options.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={tab === id}
          onClick={() => onChange(id)}
          className={cn(
            'focus-ring relative flex items-center justify-center gap-1.5 rounded-full px-3 py-2',
            'text-[13px] font-semibold transition-colors duration-200',
            tab === id ? 'text-ink' : 'text-ink-faint hover:text-ink-soft',
          )}
        >
          {tab === id && (
            <motion.span
              layoutId="ranked-tab"
              className="absolute inset-0 rounded-full bg-surface shadow-soft"
              transition={springSoft}
            />
          )}
          <Icon className="relative z-10 h-[15px] w-[15px] shrink-0" strokeWidth={2.2} aria-hidden />
          <span className="relative z-10 truncate">{label}</span>
        </button>
      ))}
    </div>
  )
}

export function BattleRanked() {
  const { t } = useLang()
  const navigate = useNavigate()
  const session = useSession()
  const uid = session.user?.uid ?? null
  const profile = useProfile()
  const me = useMyIdentity()

  const [player, setPlayer] = useState<BattlePlayer | null>(null)
  const [board, setBoard] = useState<BattlePlayer[]>([])
  const [now, setNow] = useState(() => Date.now())
  const [tab, setTab] = useState<Tab>('history')

  const refresh = useCallback(() => {
    if (uid) void fetchBattlePlayer(uid).then(setPlayer)
    void fetchWeeklyLeaderboard().then(setBoard)
  }, [uid])

  useEffect(refresh, [refresh])

  // The countdown only needs minute precision, so a slow tick is enough.
  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(tick)
  }, [])

  const rating = player?.rating ?? 0
  const tierIndex = useMemo(() => ratingTierFor(rating).index, [rating])

  const countdown = useMemo(
    () =>
      formatCountdown(
        nextWeekStart().getTime() - now,
        t(s.battle.dayShort),
        t(s.battle.hourShort),
      ),
    [now, t],
  )

  const myPosition = board.findIndex((entry) => entry.uid === uid)
  const history = profile.recentRankedDuels

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

      <motion.div variants={staggerItem} className="mt-5">
        <LeagueCard rating={rating} rules />
      </motion.div>

      {/* Ranked-only record strip. Kept out of the league card so the card
          stays about the ladder and this stays about recent form. */}
      {profile.rankedDuels > 0 && (
        <motion.div
          variants={staggerItem}
          className="mt-2.5 flex items-center justify-between gap-3 rounded-card bg-surface px-5 py-3 shadow-soft ring-1 ring-line/60"
        >
          <span className="min-w-0 text-[12px] font-semibold text-ink-soft tabular-nums">
            {profile.rankedWins} / {profile.rankedDuels}
            <span className="ml-2 text-ink-faint">
              {t(s.battle.statStreak)}: {profile.rankedStreak}
            </span>
          </span>
          <FormDots results={history.map((duel) => duel.won)} max={6} />
        </motion.div>
      )}

      <motion.div variants={staggerItem} className="mt-4">
        <BattleDuel mode="ranked" onRankedResult={refresh} ratingTierIndex={tierIndex} />
      </motion.div>

      <motion.div variants={staggerItem} className="mt-7">
        <TabSwitch
          tab={tab}
          onChange={setTab}
          historyLabel={t(s.battle.tabHistory)}
          boardLabel={t(s.battle.tabBoard)}
        />
      </motion.div>

      {tab === 'history' ? (
        <motion.div variants={staggerItem} className="mt-4">
          {history.length === 0 ? (
            <EmptyPanel>{t(s.battle.historyEmpty)}</EmptyPanel>
          ) : (
            <MatchList>
              {history.map((duel) => (
                <MatchRow
                  key={duel.at}
                  me={me}
                  duel={duel}
                  meta={
                    <RatingMove before={duel.ratingBefore} after={duel.ratingAfter} />
                  }
                />
              ))}
            </MatchList>
          )}
        </motion.div>
      ) : (
        <motion.div variants={staggerItem} className="mt-4">
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
            <EmptyPanel>{t(s.battle.boardEmpty)}</EmptyPanel>
          ) : (
            <>
              <MatchList>
                {board.map((entry, position) => {
                  const isMe = entry.uid === uid
                  return (
                    <li
                      key={entry.uid}
                      className={cn(
                        'grid grid-cols-[26px_32px_1fr_auto] items-center gap-3 px-4 py-3',
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
                      <PlayerAvatar
                        name={entry.displayName || t(s.battle.opponent)}
                        photoURL={entry.photoURL}
                        size={32}
                        me={isMe}
                        avatarGender={entry.avatarGender}
                        avatarTierIndex={entry.avatarTierIndex}
                      />
                      <span className="min-w-0">
                        <span className="flex items-baseline gap-1.5">
                          <span className="truncate text-[13.5px] font-bold text-ink">
                            {entry.displayName || t(s.battle.opponent)}
                          </span>
                          {isMe && (
                            <span className="shrink-0 text-[10.5px] font-bold text-brand">
                              {t(s.battle.boardYou)}
                            </span>
                          )}
                        </span>
                        <span className="block text-[11px] font-semibold tabular-nums text-ink-faint">
                          {t(s.battle.levelShort)} {entry.level}
                        </span>
                      </span>
                      <span className="text-[13px] font-bold tabular-nums text-ink">
                        {entry.weekXp} {t(s.common.xp)}
                      </span>
                    </li>
                  )
                })}
              </MatchList>
              {myPosition < 0 && (
                <p className="mt-2.5 text-center text-[12px] leading-relaxed text-ink-faint">
                  {t(s.battle.boardPositionHint)}
                </p>
              )}
            </>
          )}
        </motion.div>
      )}
    </motion.div>
  )
}
