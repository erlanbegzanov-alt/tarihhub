/**
 * The pieces the four Батл screens share.
 *
 * Battle used to be three screens that each drew their own version of the same
 * ideas — a league crest here, a text-only result row there, a rating that
 * moved by an unexplained "+18". Everything that appears on more than one of
 * `Battle.tsx`, `BattleCasual.tsx`, `BattleRanked.tsx` and `BattleDuel.tsx`
 * lives here instead, so the hub, the two mode screens and the result screen
 * all say the same thing the same way.
 *
 * Nothing here invents styling: colours are the app's own tokens, the avatar is
 * `PlayerAvatar` from `kahoot.tsx` (the same rank art Profile and a live duel
 * show), the bar is `ProgressBar`, and the motion comes from `lib/motion.ts`.
 */
import { motion, useReducedMotion } from 'framer-motion'
import { Award, Bot, Check, Crown, Gem, Medal, Shield, Trophy, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import type { AvatarGender } from '../data/ranks'
import { s } from '../i18n/strings'
import { useLang } from '../i18n/useLang'
import type { LanguageValue } from '../i18n/context'
import { RATING_LOSS, RATING_WIN, ratingTierFor } from '../lib/battle'
import type { BattleMode } from '../lib/battle'
import { cn } from '../lib/cn'
import { isFirebaseReady } from '../lib/firebase'
import { canHover, easeOut, springSoft } from '../lib/motion'
import { levelInfo, useProfile } from '../lib/progress'
import { resolveRankIdentity } from '../lib/rankIdentity'
import { BADGE_SPARKLES, OWNER_EMAIL } from '../lib/rankStyle'
import { useSession } from '../lib/session'
import { PlayerAvatar } from './kahoot'
import { ProgressBar } from './ui'

/** The opponent's accent, kept apart from the brand green the reader owns.
 *  Same value `BattleDuel.tsx` paints the opposing racing bar with. */
export const FOE_COLOR = 'var(--color-era-alash)'

/* ------------------------------------------------------------------ */
/*                            who the reader is                        */
/* ------------------------------------------------------------------ */

/** Everything the section needs to draw the reader's own face and name. */
export interface MyIdentity {
  name: string
  photoURL: string
  avatarGender: AvatarGender | null
  avatarTierIndex: number
  level: number
}

/**
 * The reader's own battle identity — the same one `BattleDuel.tsx` publishes to
 * `battlePlayers/{uid}` and shows above the racing bars, resolved the same way
 * (`resolveRankIdentity`), so a history row shows the exact face that fought
 * the duel rather than a second, subtly different rendering of it.
 */
export function useMyIdentity(): MyIdentity {
  const { t } = useLang()
  const profile = useProfile()
  const user = useSession().user

  const identity = resolveRankIdentity({
    xp: profile.xp,
    avatarGender: profile.avatarGender,
    displayedAvatarTier: profile.displayedAvatarTier,
    displayedRankTier: profile.displayedRankTier,
    isOwner: user?.email === OWNER_EMAIL,
  })

  return {
    name: user?.displayName || t(s.battle.you),
    photoURL: user?.photoURL ?? '',
    avatarGender: identity.avatarGender,
    avatarTierIndex: identity.avatarTierIndex,
    level: levelInfo(profile.xp).level,
  }
}

/* ------------------------------------------------------------------ */
/*                            the league ladder                        */
/* ------------------------------------------------------------------ */

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

export function ratingTierColor(index: number): string {
  return TIER_COLORS[Math.max(0, Math.min(TIER_COLORS.length - 1, index))]
}

/**
 * Same escalating glow/shimmer/sparkle language `TIER_EFFECTS` gives the
 * Profile rank badges (see `src/lib/rankStyle.ts`), recalibrated for this
 * ladder's 5 rungs instead of 8: Қола stays plain, and the spectacle builds
 * up to Алмас. The keyframes themselves already exist globally (index.css) —
 * this only decides which tier gets how much of them.
 */
interface RatingTierEffect {
  glow?: 'rank-glow-soft' | 'rank-glow' | 'rank-glow-rich'
  glowDuration?: string
  shimmer?: 'plain' | 'rich'
  sparkles?: number
}

const RATING_TIER_EFFECTS: RatingTierEffect[] = [
  {},
  { glow: 'rank-glow-soft', glowDuration: '4.4s' },
  { glow: 'rank-glow', glowDuration: '3s', shimmer: 'plain' },
  { glow: 'rank-glow', glowDuration: '2.6s', shimmer: 'plain', sparkles: 2 },
  { glow: 'rank-glow-rich', glowDuration: '2.2s', shimmer: 'rich', sparkles: 4 },
]

/**
 * The league crest: the tier's icon on a tinted disc, carrying that tier's
 * share of the glow/shimmer/sparkle ladder above.
 *
 * `celebrate` is the one moment the top of that ladder is borrowed regardless
 * of tier — a duel that just moved the player up a league gets Алмас-grade
 * treatment for as long as the result screen is open, which is exactly the
 * beat these effects were written for and never previously had.
 */
export function LeagueCrest({
  tierIndex,
  size = 56,
  celebrate = false,
  className,
}: {
  tierIndex: number
  size?: number
  celebrate?: boolean
  className?: string
}) {
  const reduce = useReducedMotion()
  const index = Math.max(0, Math.min(TIER_ICONS.length - 1, tierIndex))
  const Icon = TIER_ICONS[index]
  const color = TIER_COLORS[index]
  const fx = celebrate
    ? RATING_TIER_EFFECTS[RATING_TIER_EFFECTS.length - 1]
    : RATING_TIER_EFFECTS[index]
  const animate = !reduce

  return (
    <span
      className={cn(
        'relative grid shrink-0 place-items-center overflow-hidden rounded-full',
        className,
      )}
      style={{
        width: size,
        height: size,
        background: `color-mix(in srgb, ${color} 16%, var(--color-surface))`,
        ...(animate && fx.glow
          ? {
              animation: `${fx.glow} ${fx.glowDuration} ease-in-out infinite`,
              ['--tier-glow' as string]: color,
            }
          : null),
      }}
    >
      <Icon
        className="relative z-10"
        style={{ width: size * 0.42, height: size * 0.42, color }}
        strokeWidth={1.8}
        aria-hidden
      />
      {animate && fx.shimmer && (
        <span
          aria-hidden
          className={cn(
            'animate-rank-shimmer pointer-events-none absolute inset-y-0 left-0',
            fx.shimmer === 'rich' ? 'w-[65%]' : 'w-1/2',
          )}
          style={{
            background: `linear-gradient(90deg, transparent 0%, rgb(255 255 255 / ${
              fx.shimmer === 'rich' ? 0.85 : 0.55
            }) 50%, transparent 100%)`,
            ...(fx.shimmer === 'rich' ? { animationDuration: '2.7s' } : null),
          }}
        />
      )}
      {animate &&
        BADGE_SPARKLES.slice(0, fx.sparkles ?? 0).map((sparkle) => (
          <span
            key={sparkle.delay}
            aria-hidden
            className="animate-rank-twinkle pointer-events-none absolute h-1.5 w-1.5 rounded-full bg-gold"
            style={{
              left: sparkle.left,
              top: sparkle.top,
              animationDelay: `${sparkle.delay}s`,
            }}
          />
        ))}
    </span>
  )
}

/**
 * The rating, as a card that explains itself.
 *
 * The old version showed a league name, a number and a bar — a rating that
 * moved by an unexplained amount after every duel. `rules` adds the two
 * numbers that actually drive it (`RATING_WIN` / `RATING_LOSS`, read straight
 * off `lib/battle.ts` so the card can never drift from the real scoring) plus
 * the floor at zero, which is the only reason a loss sometimes costs less than
 * it says.
 */
export function LeagueCard({
  rating,
  rules = false,
  action,
  className,
}: {
  rating: number
  /** Spell out how the rating moves. Off on the hub, where space is tighter. */
  rules?: boolean
  /** Optional trailing control — the ranked screen's "play" affordance. */
  action?: ReactNode
  className?: string
}) {
  const { t } = useLang()
  const info = ratingTierFor(rating)
  const color = ratingTierColor(info.index)

  return (
    <div
      className={cn(
        'rounded-card bg-surface p-5 shadow-soft ring-1 ring-line/60',
        className,
      )}
    >
      <div className="flex items-center gap-4">
        <LeagueCrest tierIndex={info.index} size={56} />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold tracking-wide text-ink-faint uppercase">
            {t(s.battle.leagueLabel)}
          </p>
          <p className="truncate text-xl font-bold text-ink">{t(info.tier.name)}</p>
          <p className="text-[13px] font-semibold tabular-nums text-ink-soft">
            {rating} {t(s.battle.ratingPoints)}
          </p>
        </div>
        {action}
      </div>

      <div className="mt-4">
        <ProgressBar percent={info.progress} height={8} color={color} />
        <p className="mt-1.5 flex items-baseline justify-between gap-3 text-[11.5px] text-ink-faint">
          <span>
            {info.next
              ? `${t(s.battle.nextTier)}: ${info.next.min - rating} ${t(s.battle.ratingPoints)}`
              : t(s.battle.maxTier)}
          </span>
          {info.next && (
            <span className="shrink-0 font-semibold" style={{ color }}>
              {t(info.next.name)}
            </span>
          )}
        </p>
      </div>

      {rules && (
        <div className="mt-4 border-t border-line-soft pt-3.5">
          <p className="text-[11.5px] font-semibold tracking-wide text-ink-faint uppercase">
            {t(s.battle.ratingHow)}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <span className="inline-flex items-baseline gap-1.5 text-[12.5px] text-ink-soft">
              <span className="text-[14px] font-bold tabular-nums text-correct">
                +{RATING_WIN}
              </span>
              {t(s.battle.ratingPerWin)}
            </span>
            <span className="inline-flex items-baseline gap-1.5 text-[12.5px] text-ink-soft">
              <span className="text-[14px] font-bold tabular-nums text-wrong">
                −{RATING_LOSS}
              </span>
              {t(s.battle.ratingPerLoss)}
            </span>
          </div>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-faint">
            {t(s.battle.ratingFloor)}
          </p>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*                            the practice bot                         */
/* ------------------------------------------------------------------ */

/**
 * "Бот" — the one label that keeps a practice duel honest.
 *
 * Shown on the bot's side of the duel head, on the result screen and on the
 * stored history row, so a bot match can never be mistaken for a win or a loss
 * against a person, either while it is running or months later.
 */
export function BotChip({ className }: { className?: string }) {
  const { t } = useLang()
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-cream-deep px-2 py-0.5',
        'text-[10.5px] font-bold whitespace-nowrap text-ink-faint',
        className,
      )}
    >
      <Bot className="h-3 w-3" strokeWidth={2.4} aria-hidden />
      {t(s.battle.botLabel)}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/*                        the way into a duel                          */
/* ------------------------------------------------------------------ */

/**
 * The call to action each mode screen carries in place of the duel itself.
 *
 * The duel now runs on its own route (`/battle/casual/duel`, `/battle/ranked/duel`)
 * so nothing — a rating card, a league board, a history list — sits around it
 * while it is being played. This is what stays behind on the summary screen:
 * the same trophy, hint and button the duel window used to open with, so the
 * way in looks exactly as it did before the duel moved.
 */
export function FindMatchCard({
  mode,
  onFind,
}: {
  mode: BattleMode
  onFind: () => void
}) {
  const { t } = useLang()
  const user = useSession().user

  return (
    <div className="rounded-card bg-surface px-5 py-9 text-center shadow-soft ring-1 ring-line/60">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-gold-tint">
        <Trophy className="h-7 w-7 text-gold" strokeWidth={1.8} />
      </span>
      <p className="mx-auto mt-4 max-w-sm text-[14.5px] leading-relaxed text-ink-soft">
        {t(mode === 'ranked' ? s.battle.rankedHint : s.battle.casualHint)}
      </p>
      {isFirebaseReady && user ? (
        <motion.button
          type="button"
          onClick={onFind}
          whileHover={canHover ? { y: -2 } : undefined}
          whileTap={{ scale: 0.97 }}
          transition={springSoft}
          className="focus-ring mt-5 rounded-full bg-brand px-6 py-3.5 text-[15px] font-semibold text-white shadow-soft hover:bg-brand-dark"
        >
          {t(s.battle.find)}
        </motion.button>
      ) : (
        <p className="mt-5 text-[13.5px] font-medium text-ink-faint">
          {t(s.battle.unavailable)}
        </p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*                          win / loss vocabulary                      */
/* ------------------------------------------------------------------ */

/**
 * The one place the app decides what a win and a loss *look* like, so every
 * screen in the section agrees. Deliberately never colour alone: each outcome
 * carries its own icon too, which is what makes the history row readable
 * without reading it (and to anyone who can't tell the two hues apart).
 */
function outcomeStyle(won: boolean) {
  return {
    Icon: won ? Check : X,
    color: won ? 'var(--color-correct)' : 'var(--color-wrong)',
    tint: won ? 'var(--color-correct-tint)' : 'var(--color-wrong-tint)',
  }
}

/**
 * A player's avatar with the duel's verdict attached: a ring in the outcome's
 * colour and a check/cross badge notched into the corner.
 *
 * The avatar itself is `PlayerAvatar` — the same component the Кахут lobby and
 * board use, which resolves to the reader's real rank art, their Google photo,
 * or an initial on a coloured disc, in that order. Only the verdict is added
 * here; nothing about avatar rendering is re-invented.
 */
export function OutcomeAvatar({
  name,
  photoURL,
  won,
  size = 44,
  me = false,
  avatarGender = null,
  avatarTierIndex = 0,
}: {
  name: string
  photoURL: string
  won: boolean
  size?: number
  me?: boolean
  avatarGender?: AvatarGender | null
  avatarTierIndex?: number
}) {
  const { t } = useLang()
  const { Icon, color, tint } = outcomeStyle(won)
  const badge = Math.max(16, Math.round(size * 0.4))

  return (
    <span
      className="relative inline-flex shrink-0"
      title={t(won ? s.battle.recentWin : s.battle.recentLose)}
    >
      <span
        className="rounded-full"
        style={{ boxShadow: `0 0 0 2.5px ${color}` }}
      >
        <PlayerAvatar
          name={name}
          photoURL={photoURL}
          size={size}
          me={me}
          avatarGender={avatarGender}
          avatarTierIndex={avatarTierIndex}
        />
      </span>
      <span
        className="absolute -right-1 -bottom-1 grid place-items-center rounded-full ring-2 ring-surface"
        style={{ width: badge, height: badge, background: tint, color }}
        aria-hidden
      >
        <Icon style={{ width: badge * 0.62, height: badge * 0.62 }} strokeWidth={3.2} />
      </span>
    </span>
  )
}

/**
 * The rating as a movement rather than a number: where it stood, where it
 * stands now.
 *
 * This is the direct answer to a bare "+18" that told the reader nothing about
 * what it was added to. The delta is derived from the pair rather than passed
 * in, so it is always the movement that was actually committed — a loss that
 * hit the floor at zero costs less than `RATING_LOSS`, and this shows that
 * honestly instead of quoting the nominal figure.
 */
export function RatingMove({
  before,
  after,
  className,
}: {
  before: number
  after: number
  className?: string
}) {
  const delta = after - before
  const color =
    delta > 0 ? 'var(--color-correct)' : delta < 0 ? 'var(--color-wrong)' : 'var(--color-ink-faint)'

  return (
    <span
      className={cn(
        'inline-flex items-baseline gap-1.5 rounded-full bg-cream-deep px-2.5 py-1',
        'text-[11.5px] font-bold whitespace-nowrap tabular-nums',
        className,
      )}
    >
      <span className="text-ink-faint">{before}</span>
      <span className="text-ink-faint" aria-hidden>
        →
      </span>
      <span style={{ color }}>{after}</span>
      <span style={{ color }}>
        ({delta > 0 ? '+' : delta < 0 ? '−' : '±'}
        {Math.abs(delta)})
      </span>
    </span>
  )
}

/**
 * Recent results as a row of dots, newest on the right — the shape a league
 * table uses for form, which reads as a shape long before it reads as data.
 */
export function FormDots({
  results,
  max = 8,
}: {
  /** Newest first, the order both duel logs are stored in. */
  results: boolean[]
  max?: number
}) {
  const { t } = useLang()
  const shown = results.slice(0, max).reverse()
  if (shown.length === 0) return null

  return (
    <div className="flex items-center gap-1.5">
      {shown.map((won, index) => {
        const { Icon, color, tint } = outcomeStyle(won)
        return (
          <motion.span
            // Position in a fixed-length recent list — these rows have no id,
            // and the list is replaced wholesale on every new duel.
            key={index}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ ...springSoft, delay: index * 0.035 }}
            title={t(won ? s.battle.recentWin : s.battle.recentLose)}
            className="grid h-[19px] w-[19px] shrink-0 place-items-center rounded-full"
            style={{ background: tint, color }}
          >
            <Icon className="h-[11px] w-[11px]" strokeWidth={3.4} aria-hidden />
          </motion.span>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*                              history row                            */
/* ------------------------------------------------------------------ */

/** "только что" / "5 мин назад" / "2 ч назад" / "3 дн назад". */
export function relativeTime(at: number, t: LanguageValue['t']): string {
  const minutes = Math.floor((Date.now() - at) / 60_000)
  if (minutes < 1) return t(s.battle.timeNow)
  if (minutes < 60) return `${minutes} ${t(s.battle.minShort)} ${t(s.battle.timeAgo)}`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ${t(s.battle.hourShort)} ${t(s.battle.timeAgo)}`
  return `${Math.floor(hours / 24)} ${t(s.battle.dayShort)} ${t(s.battle.timeAgo)}`
}

/**
 * One finished duel, as the owner asked for it: your face, VS, their face, and
 * no ambiguity about who won.
 *
 * The verdict is carried three separate ways — a ring and a badge on each
 * avatar, the winning score in full-strength ink against the loser's muted
 * ink, and a worded chip — because the row this replaces relied on a single
 * word of coloured text and read as nothing at a glance. Everything the duel
 * actually paid out is on the row too (`meta`), so a result never has to be
 * taken on faith.
 */
export function MatchRow({
  me,
  duel,
  meta,
}: {
  me: MyIdentity
  /** The stored duel — either log's record satisfies this shape. */
  duel: {
    opponentName: string
    opponentPhotoURL: string
    opponentAvatarGender: AvatarGender | null
    opponentAvatarTierIndex: number
    opponentIsBot: boolean
    won: boolean
    xp: number
    foeXp: number
    at: number
  }
  /** Mode-specific payout — the XP pill for casual, the rating pair for ranked. */
  meta?: ReactNode
}) {
  const { t } = useLang()
  const { won, xp: myXp, foeXp, at } = duel
  const { color, tint } = outcomeStyle(won)
  const opponentName = duel.opponentName || t(s.battle.opponent)

  return (
    <li
      className="border-b border-line-soft px-4 py-3.5 last:border-b-0"
      aria-label={`${t(s.battle.historyRowLabel)}: ${t(won ? s.battle.recentWin : s.battle.recentLose)}`}
    >
      {/* Capped and centred rather than edge-to-edge: on a desktop-width card
          the two avatars would otherwise sit a screen apart with the score
          marooned between them, and the confrontation the row is built around
          stops reading as one. Wider than any phone, so mobile is untouched. */}
      <div className="mx-auto flex max-w-lg items-center gap-3">
        <OutcomeAvatar
          name={me.name}
          photoURL={me.photoURL}
          won={won}
          me
          size={44}
          avatarGender={me.avatarGender}
          avatarTierIndex={me.avatarTierIndex}
        />

        <div className="min-w-0 flex-1 text-center">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <span
              className={cn(
                'text-right text-[15px] tabular-nums',
                won ? 'font-bold text-ink' : 'font-semibold text-ink-faint',
              )}
            >
              {myXp}
            </span>
            <span className="rounded-full bg-cream-deep px-2 py-0.5 text-[10px] font-bold tracking-wide text-ink-faint">
              VS
            </span>
            <span
              className={cn(
                'text-left text-[15px] tabular-nums',
                won ? 'font-semibold text-ink-faint' : 'font-bold text-ink',
              )}
            >
              {foeXp}
            </span>
          </div>
          <p className="mt-0.5 flex items-center justify-center gap-1.5 text-[12px] font-semibold text-ink-soft">
            <span className="truncate">{opponentName}</span>
            {duel.opponentIsBot && <BotChip />}
          </p>
        </div>

        <OutcomeAvatar
          name={opponentName}
          photoURL={duel.opponentPhotoURL}
          won={!won}
          size={44}
          avatarGender={duel.opponentAvatarGender}
          avatarTierIndex={duel.opponentAvatarTierIndex}
        />
      </div>

      <div className="mx-auto mt-2.5 flex max-w-lg flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <span
          className="rounded-full px-2.5 py-1 text-[11px] font-bold"
          style={{ background: tint, color }}
        >
          {t(won ? s.battle.recentWin : s.battle.recentLose)}
        </span>
        <span className="flex items-center gap-2.5">
          {meta}
          <span className="text-[11px] whitespace-nowrap text-ink-faint">
            {relativeTime(at, t)}
          </span>
        </span>
      </div>
    </li>
  )
}

/** The shell every history / board list in the section is drawn in. */
export function MatchList({ children }: { children: ReactNode }) {
  return (
    <motion.ul
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: easeOut }}
      className="overflow-hidden rounded-card bg-surface shadow-soft ring-1 ring-line/60"
    >
      {children}
    </motion.ul>
  )
}

/** Matching empty state, so "nothing yet" still looks like part of the list. */
export function EmptyPanel({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-card bg-surface p-5 text-center text-[13.5px] leading-relaxed text-ink-faint shadow-soft ring-1 ring-line/60">
      {children}
    </p>
  )
}
