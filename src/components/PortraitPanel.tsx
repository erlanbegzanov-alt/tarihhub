import { eraColor } from '../data/eras'
import type { EraKey, MotifKey, Person } from '../data/types'
import { useLang } from '../i18n/useLang'
import { s } from '../i18n/strings'
import { cn } from '../lib/cn'
import { MotifIcon } from './Motif'

/**
 * A person's portrait.
 *
 * When a freely licensed image exists for the person (`person.portrait`, see
 * `public/portraits/SOURCES.md`) it is rendered as a real `<img>`. Otherwise the
 * original stand-in is used: a soft gradient panel tinted with the person's era
 * colour, their initial set large, and a thin decorative line-icon motif.
 *
 * For an image whose `kind` is `'monument'` — a statue, mausoleum or later artistic
 * depiction rather than a real likeness — a small caption is drawn over the image so
 * the app never implies it is how the person actually looked.
 */
export function PortraitPanel({
  initial,
  eraKey,
  motif,
  portrait,
  name,
  className,
  size = 'md',
}: {
  initial: string
  eraKey: EraKey
  motif: MotifKey
  /** Freely licensed image for this person, when one exists. */
  portrait?: Person['portrait']
  /** Localised person name, used as the image's alt text. */
  name?: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const { t } = useLang()
  const color = eraColor(eraKey)

  if (portrait) {
    const isMonument = portrait.kind === 'monument'
    return (
      <div
        className={cn('relative isolate overflow-hidden', className)}
        style={{ background: `color-mix(in srgb, ${color} 10%, var(--color-surface))` }}
      >
        <img
          src={portrait.src}
          alt={name ?? initial}
          title={isMonument ? t(s.person.portraitDepictionFull) : undefined}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />

        {/* Honest caption — only where there is room for it to be legible. */}
        {isMonument && size !== 'sm' && (
          <span
            className={cn(
              'absolute bottom-2 left-2 z-10 rounded-full px-2 py-0.5',
              'bg-black/45 text-[10.5px] font-medium text-white backdrop-blur-sm',
              size === 'lg' && 'bottom-3 left-3 text-[11.5px]',
            )}
          >
            {t(s.person.portraitDepiction)}
          </span>
        )}

        <span
          className="absolute bottom-0 left-0 z-10 h-[3px] w-full"
          style={{ background: color, opacity: 0.75 }}
        />
      </div>
    )
  }

  const initialSize =
    size === 'lg'
      ? 'text-[clamp(4rem,12vw,7.5rem)]'
      : size === 'md'
        ? 'text-5xl'
        : 'text-2xl'

  return (
    <div
      className={cn(
        'relative isolate overflow-hidden',
        'flex items-center justify-center',
        className,
      )}
      style={{
        background: `linear-gradient(152deg,
          color-mix(in srgb, ${color} 30%, var(--color-surface)) 0%,
          color-mix(in srgb, ${color} 14%, var(--color-surface)) 46%,
          color-mix(in srgb, ${color} 6%, var(--color-surface)) 100%)`,
      }}
      aria-hidden
    >
      {/* Decorative concentric arcs — a steppe "shanyraq" style motif. */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 200 200"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        <g stroke={color} strokeOpacity="0.22" strokeWidth="1">
          <circle cx="100" cy="100" r="42" />
          <circle cx="100" cy="100" r="62" />
          <circle cx="100" cy="100" r="82" />
          <path d="M100 18v164M18 100h164" strokeOpacity="0.12" />
          <path d="M42 42l116 116M158 42L42 158" strokeOpacity="0.09" />
        </g>
      </svg>

      <span
        className={cn(
          'relative z-10 font-semibold leading-none tracking-tight',
          initialSize,
        )}
        style={{ color: `color-mix(in srgb, ${color} 78%, #17211e)` }}
      >
        {initial}
      </span>

      <MotifIcon
        motif={motif}
        className={cn(
          'absolute z-10 opacity-35',
          size === 'lg'
            ? 'bottom-5 right-5 h-12 w-12'
            : size === 'md'
              ? 'bottom-3 right-3 h-6 w-6'
              : 'bottom-1 right-1 h-3.5 w-3.5',
        )}
      />
      <span
        className="absolute bottom-0 left-0 h-[3px] w-full"
        style={{ background: color, opacity: 0.75 }}
      />
    </div>
  )
}
