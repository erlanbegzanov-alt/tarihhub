import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'
import { Search } from 'lucide-react'
import { eraColor } from '../data/eras'
import type { EraKey } from '../data/types'
import { cn } from '../lib/cn'
import { easeOut, springSoft } from '../lib/motion'

/* ------------------------------------------------------------------ */

export function EraBadge({
  eraKey,
  children,
  className,
}: {
  eraKey: EraKey
  children: ReactNode
  className?: string
}) {
  const color = eraColor(eraKey)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1',
        'text-[11px] font-semibold tracking-wide whitespace-nowrap',
        className,
      )}
      style={{
        color: `color-mix(in srgb, ${color} 82%, #17211e)`,
        background: `color-mix(in srgb, ${color} 14%, var(--color-surface))`,
      }}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: color }}
      />
      {children}
    </span>
  )
}

/* ------------------------------------------------------------------ */

export function ProgressBar({
  percent,
  className,
  color = 'var(--color-brand)',
  height = 6,
}: {
  percent: number
  className?: string
  color?: string
  height?: number
}) {
  const reduce = useReducedMotion()
  const value = Math.max(0, Math.min(100, percent))

  return (
    <div
      className={cn('w-full overflow-hidden rounded-full bg-cream-deep', className)}
      style={{ height }}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={{ width: reduce ? `${value}%` : 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: reduce ? 0 : 0.7, ease: easeOut }}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */

export function FilterChip({
  active,
  onClick,
  children,
  layoutGroup,
  color = 'var(--color-brand)',
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  layoutGroup: string
  color?: string
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
      transition={springSoft}
      aria-pressed={active}
      className={cn(
        'relative shrink-0 rounded-full px-4 py-2 text-sm font-medium',
        'focus-ring transition-colors duration-200',
        active
          ? 'text-white'
          : 'bg-surface text-ink-soft ring-1 ring-line hover:text-ink',
      )}
    >
      {active && (
        <motion.span
          layoutId={layoutGroup}
          className="absolute inset-0 rounded-full"
          style={{ background: color }}
          transition={springSoft}
        />
      )}
      <span className="relative z-10">{children}</span>
    </motion.button>
  )
}

/* ------------------------------------------------------------------ */

export function SearchField({
  value,
  onChange,
  placeholder,
  autoFocus,
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  autoFocus?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-2xl bg-surface px-4 py-3.5',
        'shadow-soft ring-1 ring-line/70',
        'focus-within:ring-2 focus-within:ring-brand/60',
        'transition-shadow duration-200',
        className,
      )}
    >
      <Search className="h-[18px] w-[18px] shrink-0 text-ink-faint" strokeWidth={2} />
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn(
          'min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none',
          'placeholder:text-ink-faint',
          '[&::-webkit-search-cancel-button]:appearance-none',
        )}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */

export function SectionHeading({
  title,
  action,
  className,
}: {
  title: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-3 flex items-baseline justify-between gap-4', className)}>
      <h2 className="text-[17px] font-semibold tracking-tight text-ink md:text-lg">
        {title}
      </h2>
      {action}
    </div>
  )
}

/* ------------------------------------------------------------------ */

export function IconButton({
  label,
  onClick,
  children,
  className,
}: {
  label: string
  onClick?: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.92 }}
      transition={springSoft}
      className={cn(
        'grid h-10 w-10 shrink-0 place-items-center rounded-full',
        'bg-surface text-ink-soft ring-1 ring-line/70 shadow-soft',
        'focus-ring hover:text-ink',
        className,
      )}
    >
      {children}
    </motion.button>
  )
}

/* ------------------------------------------------------------------ */

export function XpPill({ children }: { children: ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-gold-tint px-2.5 py-1 text-xs font-bold"
      style={{ color: 'color-mix(in srgb, var(--color-gold) 78%, #17211e)' }}
    >
      {children}
    </span>
  )
}
