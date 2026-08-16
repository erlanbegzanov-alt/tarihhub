import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ChevronDown, ChevronRight, MapPin } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { KazakhstanMap } from '../components/KazakhstanMap'
import { SITE_ICONS, siteColor } from '../components/siteMeta'
import { FilterChip, IconButton } from '../components/ui'
import { eraColor, eras, siteCategories, timelineEraKeys } from '../data/eras'
import { eraTerritory } from '../data/eraTerritories'
import { mapSites } from '../data/mapSites'
import { getPerson } from '../data/people'
import type { EraKey, MapSite, SiteCategory } from '../data/types'
import { s } from '../i18n/strings'
import { useLang } from '../i18n/useLang'
import { cn } from '../lib/cn'
import { easeOut, springSoft, staggerContainer, staggerItem } from '../lib/motion'

type Filter = SiteCategory | 'all'

// Collapsed length of the site list before it needs its own expand toggle —
// past this, scrolling through all 26+ real-world sites on every visit was
// the friction the "ограничения как в меню курса" request was about.
const SITES_COLLAPSED = 6

function SiteDetail({ site, onClose }: { site: MapSite; onClose: () => void }) {
  const { t } = useLang()
  const person = getPerson(site.personId)
  const Icon = SITE_ICONS[site.category]
  const color = siteColor(site.category)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.25, ease: easeOut }}
      className="rounded-card bg-surface p-4 shadow-soft ring-1 ring-line/60 sm:p-5"
    >
      <div className="flex items-start gap-3.5">
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full"
          style={{ background: `color-mix(in srgb, ${color} 14%, var(--color-surface))` }}
        >
          <Icon className="h-5 w-5" strokeWidth={2} style={{ color }} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[17px] font-semibold text-ink">{t(site.name)}</h3>
          <p className="mt-1.5 text-[14px] leading-relaxed text-ink-soft">
            {t(site.description)}
          </p>
          {person && (
            <Link
              to={`/person/${person.id}`}
              className="focus-ring mt-3 inline-flex items-center gap-1 rounded-lg text-[13.5px] font-semibold text-brand"
            >
              {t(person.name)}
              <ChevronRight className="h-4 w-4" />
            </Link>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="focus-ring -mt-1 -mr-1 rounded-full p-2 text-ink-faint hover:text-ink"
          aria-label={t(s.common.close)}
        >
          <ArrowLeft className="h-4 w-4 rotate-90" strokeWidth={2} />
        </button>
      </div>
    </motion.div>
  )
}

export function MapScreen() {
  const { t } = useLang()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>('all')
  const [eraKey, setEraKey] = useState<EraKey | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [showAllSites, setShowAllSites] = useState(false)

  const territory = eraKey ? eraTerritory(eraKey) : null

  const sites = useMemo(
    () =>
      filter === 'all'
        ? mapSites
        : mapSites.filter((site) => site.category === filter),
    [filter],
  )

  // A fresh filter starts collapsed again — otherwise switching from "all"
  // (expanded) to a small category leaves an orphaned expand state.
  useEffect(() => setShowAllSites(false), [filter, eraKey])

  const visibleSites = showAllSites ? sites : sites.slice(0, SITES_COLLAPSED)

  const active = sites.find((site) => site.id === activeId) ?? null

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      <motion.div variants={staggerItem} className="flex items-center gap-3">
        <IconButton label={t(s.common.back)} onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </IconButton>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold tracking-tight text-ink md:text-[28px]">
            {t(s.map.title)}
          </h1>
          <p className="text-[13.5px] text-ink-soft">
            {sites.length} {t(s.map.sites)}
          </p>
        </div>
      </motion.div>

      <motion.div
        variants={staggerItem}
        className="rail-scroll -mx-4 mt-5 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6 md:mx-0 md:flex-wrap md:px-0"
      >
        <FilterChip
          active={filter === 'all'}
          onClick={() => setFilter('all')}
          layoutGroup="map-filter"
        >
          {t(s.common.all)}
        </FilterChip>
        {siteCategories.map((category) => (
          <FilterChip
            key={category.key}
            active={filter === category.key}
            onClick={() => setFilter(category.key)}
            layoutGroup="map-filter"
            color={siteColor(category.key)}
          >
            {t(category.label)}
          </FilterChip>
        ))}
      </motion.div>

      <motion.div variants={staggerItem} className="mt-4">
        <p className="px-1 text-[12.5px] font-semibold text-ink-faint">
          {t(s.map.eraOverlay)}
        </p>
        <div className="rail-scroll -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6 md:mx-0 md:flex-wrap md:px-0">
          <FilterChip
            active={eraKey === null}
            onClick={() => setEraKey(null)}
            layoutGroup="map-era"
          >
            {t(s.map.noEra)}
          </FilterChip>
          {timelineEraKeys.map((key) => (
            <FilterChip
              key={key}
              active={eraKey === key}
              onClick={() => setEraKey((prev) => (prev === key ? null : key))}
              layoutGroup="map-era"
              color={eraColor(key)}
            >
              {t(eras[key].label)}
            </FilterChip>
          ))}
        </div>
      </motion.div>

      {/* map beside the site list on laptop */}
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:items-start">
        <motion.div variants={staggerItem}>
          <KazakhstanMap
            sites={sites}
            activeId={activeId}
            onSelect={(site) =>
              setActiveId((prev) => (prev === site.id ? null : site.id))
            }
            activeEraKey={eraKey}
          />
          {eraKey && (
            <p
              className="mt-2.5 px-1 text-[12.5px] leading-relaxed font-medium"
              style={{ color: `color-mix(in srgb, ${eraColor(eraKey)} 78%, #17211e)` }}
            >
              {territory ? t(territory.label) : t(s.map.noTerritory)}
            </p>
          )}
          <p className="mt-2.5 px-1 text-[12px] leading-relaxed text-ink-faint">
            {t(s.map.note)}
          </p>
        </motion.div>

        <motion.div variants={staggerItem} className="flex flex-col gap-3">
          <AnimatePresence mode="wait">
            {active && (
              <SiteDetail
                key={active.id}
                site={active}
                onClose={() => setActiveId(null)}
              />
            )}
          </AnimatePresence>

          <motion.ul
            key={filter}
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1"
          >
            {visibleSites.map((site) => {
              const Icon = SITE_ICONS[site.category]
              const color = siteColor(site.category)
              const isActive = activeId === site.id
              return (
                <motion.li key={site.id} variants={staggerItem}>
                  <motion.button
                    type="button"
                    onClick={() =>
                      setActiveId((prev) => (prev === site.id ? null : site.id))
                    }
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.99 }}
                    transition={springSoft}
                    className={cn(
                      'focus-ring flex w-full items-center gap-3 rounded-tile px-3.5 py-3 text-left',
                      'bg-surface shadow-soft ring-1 transition-colors duration-200',
                      isActive ? 'ring-brand/45' : 'ring-line/60',
                    )}
                  >
                    <span
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
                      style={{
                        background: `color-mix(in srgb, ${color} 14%, var(--color-surface))`,
                      }}
                    >
                      <Icon className="h-4 w-4" strokeWidth={2.1} style={{ color }} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] font-semibold text-ink">
                        {t(site.name)}
                      </span>
                      <span className="block truncate text-[12px] text-ink-faint">
                        {t(site.description)}
                      </span>
                    </span>
                    <MapPin
                      className="h-4 w-4 shrink-0"
                      strokeWidth={2}
                      style={{ color: isActive ? color : 'var(--color-ink-faint)' }}
                    />
                  </motion.button>
                </motion.li>
              )
            })}
          </motion.ul>

          {!showAllSites && sites.length > SITES_COLLAPSED && (
            <button
              type="button"
              onClick={() => setShowAllSites(true)}
              className="focus-ring flex w-full items-center justify-center gap-0.5 rounded-lg py-1.5 text-[13px] font-semibold text-brand"
            >
              {t(s.common.seeAll)}
              <ChevronDown className="h-4 w-4" />
            </button>
          )}
        </motion.div>
      </div>
    </motion.div>
  )
}
