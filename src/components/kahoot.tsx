/**
 * The pieces every Кахут screen shares: the screen header, a player's avatar,
 * and the live board. Kept here rather than duplicated four times because the
 * lobby, the reveal step and the final result all draw the same row.
 */
import { motion } from 'framer-motion'
import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { s } from '../i18n/strings'
import { useLang } from '../i18n/useLang'
import { cn } from '../lib/cn'
import type { KahootPlayer } from '../lib/kahoot'
import { staggerItem } from '../lib/motion'
import { IconButton } from './ui'

/** Back button, round icon and title — the top of every Кахут screen. */
export function KahootHeader({
  icon,
  title,
  subtitle,
  onBack,
  action,
}: {
  icon: ReactNode
  title: string
  subtitle: string
  onBack: () => void
  action?: ReactNode
}) {
  const { t } = useLang()
  return (
    <motion.div variants={staggerItem} className="flex items-center gap-3">
      <IconButton label={t(s.common.back)} onClick={onBack}>
        <ChevronLeft className="h-5 w-5" strokeWidth={2} />
      </IconButton>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-tint text-brand">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-bold tracking-tight text-ink md:text-2xl">
          {title}
        </h1>
        <p className="truncate text-[13px] text-ink-soft">{subtitle}</p>
      </div>
      {action}
    </motion.div>
  )
}

/**
 * A player's Google avatar, or their initial on a coloured disc when there
 * isn't one. `me` paints the reader's own disc in the brand green so they can
 * find themselves in a class-sized list at a glance.
 */
export function PlayerAvatar({
  name,
  photoURL,
  size = 30,
  me = false,
}: {
  name: string
  photoURL: string
  size?: number
  me?: boolean
}) {
  if (photoURL) {
    return (
      <img
        src={photoURL}
        alt=""
        referrerPolicy="no-referrer"
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-bold text-white"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.4),
        background: me ? 'var(--color-brand)' : 'var(--color-era-alash)',
      }}
    >
      {(name || '?').charAt(0).toUpperCase()}
    </span>
  )
}

/** One waiting player in the lobby. */
export function LobbyRow({
  player,
  me,
}: {
  player: KahootPlayer
  me: boolean
}) {
  const { t } = useLang()
  return (
    <li className="flex items-center gap-2.5 rounded-tile bg-cream px-3 py-2.5">
      <PlayerAvatar
        name={player.displayName}
        photoURL={player.photoURL}
        size={26}
        me={me}
      />
      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">
        {player.displayName || t(s.battle.opponent)}
      </span>
      {me && (
        <span className="shrink-0 text-[10.5px] font-bold text-brand">
          {t(s.battle.boardYou)}
        </span>
      )}
    </li>
  )
}

/** The score table, in the same shape the weekly battle board already uses. */
export function PlayerBoard({
  players,
  myUid,
}: {
  players: KahootPlayer[]
  myUid: string | null
}) {
  const { t } = useLang()
  return (
    <ul className="overflow-hidden rounded-tile ring-1 ring-line/60">
      {players.map((player, position) => {
        const isMe = player.uid === myUid
        return (
          <li
            key={player.uid}
            className={cn(
              'grid grid-cols-[24px_28px_1fr_auto] items-center gap-3 px-3.5 py-2.5',
              'border-b border-line-soft last:border-b-0',
              isMe ? 'bg-brand-tint' : 'bg-surface',
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
              name={player.displayName}
              photoURL={player.photoURL}
              size={28}
              me={isMe}
            />
            <span className="flex min-w-0 items-baseline gap-1.5">
              <span className="truncate text-[13.5px] font-bold text-ink">
                {player.displayName || t(s.battle.opponent)}
              </span>
              {isMe && (
                <span className="shrink-0 text-[10.5px] font-bold text-brand">
                  {t(s.battle.boardYou)}
                </span>
              )}
            </span>
            <span className="text-[13px] font-bold tabular-nums text-ink">
              {player.score} {t(s.common.xp)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * The countdown, drawn as a bar that empties over the answer window. A bar
 * rather than the duel's ring: it is read from across a classroom, off a
 * projector, and the seconds are spelled out beside it.
 */
export function CountdownBar({
  seconds,
  total,
}: {
  seconds: number
  total: number
}) {
  const percent = Math.max(0, Math.min(100, (seconds / total) * 100))
  const low = seconds <= 5
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-cream-deep">
        <div
          className="h-full rounded-full"
          style={{
            width: `${percent}%`,
            background: low ? 'var(--color-wrong)' : 'var(--color-gold)',
            transition: 'width 0.25s linear',
          }}
        />
      </div>
      <span
        className={cn(
          'w-7 text-right text-[13px] font-bold tabular-nums',
          low ? 'text-wrong' : 'text-ink',
        )}
      >
        {Math.ceil(seconds)}
      </span>
    </div>
  )
}
