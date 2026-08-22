import { motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Person } from '../data/types'
import { useLang } from '../i18n/useLang'
import { cn } from '../lib/cn'
import { canHover, springSoft, staggerItem } from '../lib/motion'
import { PortraitPanel } from './PortraitPanel'
import { EraBadge } from './ui'

/**
 * The subset of `Person` this card actually renders — accepting just this
 * (rather than the full `Person`) lets Home pass the lightweight `PersonMeta`
 * summary instead of pulling in every figure's full bio/achievements/AI
 * persona data just to show a name and portrait.
 */
type PersonCardData = Pick<
  Person,
  'id' | 'initial' | 'eraKey' | 'motif' | 'portrait' | 'name' | 'eraBadge' | 'role'
>

/** Portrait card used in the home rail and the desktop figure grid. */
export function PersonCard({ person, className }: { person: PersonCardData; className?: string }) {
  const { t } = useLang()

  return (
    <motion.div variants={staggerItem} className={cn('h-full', className)}>
      <motion.div
        whileHover={canHover ? { y: -4 } : undefined}
        whileTap={{ scale: 0.98 }}
        transition={springSoft}
        className="h-full"
      >
        <Link
          to={`/person/${person.id}`}
          className={cn(
            'focus-ring flex h-full flex-col overflow-hidden rounded-card',
            'bg-surface shadow-soft ring-1 ring-line/60',
            'transition-shadow duration-300 hover:shadow-lift',
          )}
        >
          <PortraitPanel
            initial={person.initial}
            eraKey={person.eraKey}
            motif={person.motif}
            portrait={person.portrait}
            name={t(person.name)}
            className="aspect-4/5 w-full"
          />
          <div className="flex flex-1 flex-col gap-1.5 p-3.5">
            <EraBadge eraKey={person.eraKey} className="self-start">
              {t(person.eraBadge)}
            </EraBadge>
            <h3 className="mt-0.5 text-[15px] leading-snug font-semibold text-ink">
              {t(person.name)}
            </h3>
            <p className="text-[13px] leading-snug text-ink-soft">{t(person.role)}</p>
          </div>
        </Link>
      </motion.div>
    </motion.div>
  )
}

/** Horizontal result row used on the explore screen. */
export function PersonRow({ person }: { person: Person }) {
  const { t } = useLang()

  return (
    <motion.div variants={staggerItem}>
      <motion.div
        whileHover={canHover ? { y: -2 } : undefined}
        whileTap={{ scale: 0.99 }}
        transition={springSoft}
      >
        <Link
          to={`/person/${person.id}`}
          className={cn(
            'focus-ring group flex items-center gap-3.5 rounded-card p-3',
            'bg-surface shadow-soft ring-1 ring-line/60',
            'transition-shadow duration-300 hover:shadow-lift sm:gap-4 sm:p-4',
          )}
        >
          <PortraitPanel
            initial={person.initial}
            eraKey={person.eraKey}
            motif={person.motif}
            portrait={person.portrait}
            name={t(person.name)}
            size="sm"
            className="h-16 w-14 shrink-0 rounded-tile sm:h-[72px] sm:w-16"
          />
          <div className="min-w-0 flex-1">
            <EraBadge eraKey={person.eraKey}>{t(person.eraBadge)}</EraBadge>
            <h3 className="mt-1.5 truncate text-[15px] font-semibold text-ink">
              {t(person.name)}
            </h3>
            <p className="truncate text-[13px] text-brand">{t(person.role)}</p>
            <p className="mt-0.5 line-clamp-1 text-[12.5px] text-ink-faint">
              {t(person.tagline)}
            </p>
          </div>
          <ChevronRight
            className="h-5 w-5 shrink-0 text-ink-faint transition-transform duration-200 group-hover:translate-x-0.5"
            strokeWidth={2}
          />
        </Link>
      </motion.div>
    </motion.div>
  )
}
