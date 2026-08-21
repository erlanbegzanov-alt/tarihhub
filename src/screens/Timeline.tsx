import { motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { MotifIcon } from '../components/Motif'
import { FilterChip } from '../components/ui'
import { eraColor, eras, timelineEraKeys } from '../data/eras'
import { timeline } from '../data/timeline'
import type { EraKey } from '../data/types'
import { s } from '../i18n/strings'
import { useLang } from '../i18n/useLang'
import { cn } from '../lib/cn'
import { springSoft, staggerContainer, staggerItem } from '../lib/motion'
import { recordTimelineViewed } from '../lib/progress'

type Filter = EraKey | 'all'

export function Timeline() {
  const { t } = useLang()
  const [filter, setFilter] = useState<Filter>('all')

  // The page renders every entry at once (no pagination) — opening it
  // genuinely means the whole timeline has been viewed.
  useEffect(() => {
    recordTimelineViewed()
  }, [])

  const entries = useMemo(
    () =>
      filter === 'all'
        ? timeline
        : timeline.filter((entry) => entry.eraKey === filter),
    [filter],
  )

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      <motion.div variants={staggerItem}>
        <h1 className="text-2xl font-bold tracking-tight text-ink md:text-[28px]">
          {t(s.timeline.title)}
        </h1>
        <p className="mt-1.5 text-[14.5px] text-ink-soft">
          {t(s.timeline.subtitle)}
        </p>
      </motion.div>

      <motion.div
        variants={staggerItem}
        className="rail-scroll -mx-4 mt-5 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6 md:mx-0 md:flex-wrap md:px-0"
      >
        <FilterChip
          active={filter === 'all'}
          onClick={() => setFilter('all')}
          layoutGroup="timeline-filter"
        >
          {t(s.common.all)}
        </FilterChip>
        {timelineEraKeys.map((key) => (
          <FilterChip
            key={key}
            active={filter === key}
            onClick={() => setFilter(key)}
            layoutGroup="timeline-filter"
            color={eraColor(key)}
          >
            {t(eras[key].label)}
          </FilterChip>
        ))}
      </motion.div>

      <motion.p
        variants={staggerItem}
        className="mt-5 text-[13px] font-medium text-ink-faint"
      >
        {entries.length} {t(s.timeline.events)}
      </motion.p>

      {/* vertical rail */}
      <motion.ol
        key={filter}
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="relative mt-4 pl-[26px] sm:pl-[34px] lg:mx-auto lg:max-w-4xl"
      >
        <span
          className="absolute top-2 bottom-2 left-[7px] w-px bg-line sm:left-[11px]"
          aria-hidden
        />

        {entries.map((entry) => {
          const color = eraColor(entry.eraKey)
          return (
            <motion.li key={entry.id} variants={staggerItem} className="relative pb-4">
              {/* dot */}
              <span
                className="absolute top-[26px] -left-[26px] grid h-[15px] w-[15px] place-items-center rounded-full ring-4 ring-cream sm:-left-[34px]"
                style={{ background: color }}
                aria-hidden
              >
                <span className="h-1.5 w-1.5 rounded-full bg-white/70" />
              </span>

              <motion.div
                whileHover={{ y: -2 }}
                transition={springSoft}
                className={cn(
                  'rounded-card bg-surface p-4 shadow-soft ring-1 ring-line/60',
                  'transition-shadow duration-300 hover:shadow-lift sm:p-5',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p
                      className="text-[13px] font-bold tracking-wide"
                      style={{ color }}
                    >
                      {t(entry.year)}
                    </p>
                    <span
                      className="mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                      style={{
                        color: `color-mix(in srgb, ${color} 82%, #17211e)`,
                        background: `color-mix(in srgb, ${color} 13%, var(--color-surface))`,
                      }}
                    >
                      {t(eras[entry.eraKey].label)}
                    </span>
                  </div>
                  <MotifIcon
                    motif={entry.motif}
                    className="h-5 w-5 shrink-0 opacity-45"
                    strokeWidth={1.7}
                  />
                </div>

                <h3 className="mt-3 text-[17px] leading-snug font-semibold text-ink">
                  {t(entry.title)}
                </h3>
                <p className="mt-1.5 max-w-prose text-[14px] leading-relaxed text-ink-soft">
                  {t(entry.description)}
                </p>
              </motion.div>
            </motion.li>
          )
        })}
      </motion.ol>
    </motion.div>
  )
}
