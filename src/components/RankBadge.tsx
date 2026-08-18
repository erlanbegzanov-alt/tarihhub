import { motion, useReducedMotion } from 'framer-motion'
import {
  ChevronDown,
  Crown,
  Flame,
  Gem,
  GraduationCap,
  Scale,
  Shield,
  Sparkles,
  Swords,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useState } from 'react'
import type { AvatarGender } from '../data/ranks'
import { cn } from '../lib/cn'
import { springSoft } from '../lib/motion'
import {
  BADGE_SPARKLES,
  OWNER_CYCLE,
  OWNER_RING,
  OWNER_RING_MASK,
  OWNER_TIER_INDEX,
  PILL_SPARKLES,
  tierBackground,
  tierEffect,
  tierTextColor,
} from '../lib/rankStyle'

/** Stand-in per tier, shown until that tier's avatar art exists. */
const TIER_ICONS: LucideIcon[] = [
  GraduationCap,
  Flame,
  Swords,
  Shield,
  Scale,
  Gem,
  Crown,
]

/**
 * The circular rank avatar.
 *
 * Art is served from `public/avatars/{gender}/{tier}.webp` with a 1-based tier
 * (`/avatars/m/1.webp` … `/avatars/f/7.webp`). Nothing needs changing here when a
 * real file is dropped in — until one exists the request 404s and the icon
 * placeholder below takes over.
 *
 * The looping effects are CSS animations (see the `rank-*` keyframes in
 * index.css) rather than framer-motion: an infinite `repeat` does not survive
 * this screen's variant tree, and index.css already neutralises CSS animation
 * under `prefers-reduced-motion`. `useReducedMotion` skips the elements outright.
 */
export function RankBadge({
  tierIndex,
  gender,
  title,
  size = 80,
  className,
}: {
  tierIndex: number
  gender: AvatarGender
  /** Localised rank title, used as the image's alt text. */
  title: string
  /** Badge diameter in px. */
  size?: number
  className?: string
}) {
  const reduce = useReducedMotion()
  const fx = tierEffect(tierIndex)
  const owner = tierIndex === OWNER_TIER_INDEX
  // The owner tier has no art to serve — it isn't part of the avatar set.
  const src = owner ? null : `/avatars/${gender}/${tierIndex + 1}.webp`
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const Icon = owner ? Sparkles : TIER_ICONS[tierIndex]

  const background = tierBackground(tierIndex)
  const iconColor = fx.color
    ? `color-mix(in srgb, ${fx.color} 82%, var(--color-ink))`
    : 'var(--color-ink-soft)'
  const animate = !reduce

  return (
    <motion.div
      className={cn('relative shrink-0', className)}
      style={{ width: size, height: size }}
      initial={reduce ? false : { scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={springSoft}
    >
      <div
        className="relative h-full w-full overflow-hidden rounded-full ring-1 ring-line/60"
        style={{
          background: background ?? 'var(--color-cream-deep)',
          ...(animate && fx.glow
            ? {
                animation: `${fx.glow} ${fx.glowDuration} ease-in-out infinite`,
                ['--tier-glow' as string]: fx.color,
              }
            : null),
        }}
      >
        {/* Owner only: the gold fill drifts through amber, rose and violet.
            Kept on its own layer so the hue filter never touches the icon. */}
        {owner && animate && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background: background ?? undefined,
              animation: `rank-owner-hue ${OWNER_CYCLE} linear infinite`,
            }}
          />
        )}

        {src && failedSrc !== src ? (
          <img
            src={src}
            alt={title}
            loading="lazy"
            decoding="async"
            onError={() => setFailedSrc(src)}
            className="relative h-full w-full object-cover"
          />
        ) : (
          <span
            className="relative grid h-full w-full place-items-center"
            style={{ color: iconColor }}
          >
            <Icon
              style={{ width: size * 0.4, height: size * 0.4 }}
              strokeWidth={1.7}
              aria-hidden
            />
          </span>
        )}

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
      </div>

      {/* Owner only: a colour wheel turning just outside the badge. */}
      {owner && animate && (
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-[3px] rounded-full"
          style={{
            background: OWNER_RING,
            animation: `rank-owner-ring ${OWNER_CYCLE} linear infinite`,
            mask: OWNER_RING_MASK,
            WebkitMask: OWNER_RING_MASK,
          }}
        />
      )}

      {animate &&
        BADGE_SPARKLES.slice(0, fx.sparkles ?? 0).map((sparkle) => (
          <span
            key={sparkle.delay}
            aria-hidden
            className={cn(
              'animate-rank-twinkle pointer-events-none absolute rounded-full bg-gold',
              fx.sparkles && fx.sparkles > 4 ? 'h-2 w-2' : 'h-1.5 w-1.5',
            )}
            style={{
              left: sparkle.left,
              top: sparkle.top,
              animationDelay: `${sparkle.delay}s`,
            }}
          />
        ))}
    </motion.div>
  )
}

/**
 * The rank title as it reads in the identity card: a tinted pill carrying the
 * same tier treatment as the badge, plus a chevron, opening the tier sheet.
 */
export function RankStatusPill({
  tierIndex,
  title,
  expanded,
  onClick,
}: {
  tierIndex: number
  title: string
  expanded: boolean
  onClick: () => void
}) {
  const reduce = useReducedMotion()
  const fx = tierEffect(tierIndex)
  const owner = tierIndex === OWNER_TIER_INDEX
  const background = tierBackground(tierIndex)
  const animate = !reduce

  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      className="focus-ring mt-1 inline-flex max-w-full items-center gap-1.5 rounded-full transition-opacity hover:opacity-85"
    >
      <span className="relative inline-flex min-w-0">
        <span
          className={cn(
            'relative inline-flex items-center overflow-hidden rounded-full',
            background ? 'px-2.5 py-0.5' : '',
          )}
          style={{
            background: background ?? undefined,
            ...(animate && fx.glow
              ? {
                  animation: `${fx.glow} ${fx.glowDuration} ease-in-out infinite`,
                  ['--tier-glow' as string]: fx.color,
                }
              : null),
          }}
        >
          {owner && animate && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background: background ?? undefined,
                animation: `rank-owner-hue ${OWNER_CYCLE} linear infinite`,
              }}
            />
          )}

          <span
            className="relative z-10 truncate text-[15.5px] font-bold tracking-[-0.005em]"
            style={{ color: tierTextColor(tierIndex) ?? 'var(--color-ink-soft)' }}
          >
            {title}
          </span>

          {animate && fx.shimmer && (
            <span
              aria-hidden
              className={cn(
                'animate-rank-shimmer pointer-events-none absolute inset-y-0 left-0',
                fx.shimmer === 'rich' ? 'w-[65%]' : 'w-[55%]',
              )}
              style={{
                background:
                  'linear-gradient(90deg, transparent 0%, rgb(255 255 255 / 0.6) 50%, transparent 100%)',
                ...(fx.shimmer === 'rich' ? { animationDuration: '2.7s' } : null),
              }}
            />
          )}
        </span>

        {animate &&
          PILL_SPARKLES.slice(0, fx.sparkles ?? 0).map((sparkle) => (
            <span
              key={sparkle.delay}
              aria-hidden
              className={cn(
                'animate-rank-twinkle pointer-events-none absolute rounded-full bg-gold',
                fx.sparkles && fx.sparkles > 4 ? 'h-[7px] w-[7px]' : 'h-[5px] w-[5px]',
              )}
              style={{
                left: sparkle.left,
                top: sparkle.top,
                animationDelay: `${sparkle.delay}s`,
              }}
            />
          ))}
      </span>

      <ChevronDown
        className={cn(
          'h-[13px] w-[13px] shrink-0 text-ink-faint transition-transform duration-150',
          expanded && 'rotate-180',
        )}
        strokeWidth={2.6}
        aria-hidden
      />
    </button>
  )
}
