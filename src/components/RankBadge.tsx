import { motion, useReducedMotion } from 'framer-motion'
import {
  Crown,
  Flame,
  Gem,
  GraduationCap,
  Scale,
  Shield,
  Swords,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useState } from 'react'
import type { AvatarGender } from '../data/ranks'
import { cn } from '../lib/cn'
import { springSoft } from '../lib/motion'

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
 * Tier index from which the badge is animated. Everything below it stays flat:
 * only the last three ranks are rare enough to be worth the attention.
 */
const FIRST_ANIMATED_TIER = 4

/** Twinkle accents for the top tier: position on the badge, plus a start offset. */
const SPARKLES = [
  { left: '84%', top: '2%', delay: 0 },
  { left: '-3%', top: '36%', delay: 0.7 },
  { left: '66%', top: '86%', delay: 1.3 },
]

/**
 * The circular rank avatar.
 *
 * Art is served from `public/avatars/{gender}/{tier}.png` with a 1-based tier
 * (`/avatars/m/1.png` … `/avatars/f/7.png`). Nothing needs changing here when a
 * real file is dropped in — until one exists the request 404s and the icon
 * placeholder below takes over.
 *
 * The three looping effects are CSS animations (see `rank-*` in index.css)
 * rather than framer-motion: an infinite `repeat` does not survive this screen's
 * variant tree, and index.css already neutralises CSS animation under
 * `prefers-reduced-motion`. `useReducedMotion` skips the elements outright.
 */
export function RankBadge({
  tierIndex,
  gender,
  title,
  className,
}: {
  tierIndex: number
  gender: AvatarGender
  /** Localised rank title, used as the image's alt text. */
  title: string
  className?: string
}) {
  const reduce = useReducedMotion()
  const src = `/avatars/${gender}/${tierIndex + 1}.png`
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const Icon = TIER_ICONS[tierIndex]

  const animated = tierIndex >= FIRST_ANIMATED_TIER && !reduce
  const shimmering = animated && tierIndex >= FIRST_ANIMATED_TIER + 1
  const sparkling = animated && tierIndex >= FIRST_ANIMATED_TIER + 2

  const color =
    tierIndex >= FIRST_ANIMATED_TIER ? 'var(--color-gold)' : 'var(--color-brand)'

  return (
    <motion.div
      className={cn('relative h-20 w-20 shrink-0', className)}
      initial={reduce ? false : { scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={springSoft}
    >
      <div
        className={cn(
          'relative h-full w-full overflow-hidden rounded-full ring-1 ring-line/60',
          animated && 'animate-rank-glow',
        )}
        style={{
          background: `linear-gradient(140deg,
            color-mix(in srgb, ${color} 38%, var(--color-surface)) 0%,
            color-mix(in srgb, ${color} 14%, var(--color-surface)) 100%)`,
        }}
      >
        {failedSrc === src ? (
          <span
            className="grid h-full w-full place-items-center"
            style={{ color: `color-mix(in srgb, ${color} 82%, #17211e)` }}
          >
            <Icon className="h-8 w-8" strokeWidth={1.7} aria-hidden />
          </span>
        ) : (
          <img
            src={src}
            alt={title}
            loading="lazy"
            decoding="async"
            onError={() => setFailedSrc(src)}
            className="h-full w-full object-cover"
          />
        )}

        {shimmering && (
          <span
            aria-hidden
            className="animate-rank-shimmer pointer-events-none absolute inset-y-0 left-0 w-1/2"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, rgb(255 255 255 / 0.55) 50%, transparent 100%)',
            }}
          />
        )}
      </div>

      {sparkling &&
        SPARKLES.map((sparkle) => (
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
    </motion.div>
  )
}
