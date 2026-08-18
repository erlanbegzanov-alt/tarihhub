import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useMemo } from 'react'
import { eraColor, eras } from '../data/eras'
import { eraTerritory } from '../data/eraTerritories'
import type { EraTerritory, TerritoryPlace } from '../data/eraTerritories'
import { KAZAKHSTAN_ID, centralAsiaCountries, projectLonLat } from '../data/geo'
import { wideEurasiaCountries } from '../data/geoWide'
import type { EraKey, MapSite } from '../data/types'
import { s } from '../i18n/strings'
import { useLang } from '../i18n/useLang'
import { cn } from '../lib/cn'
import { springSoft } from '../lib/motion'
import { SITE_ICONS, siteColor } from './siteMeta'

interface View {
  minX: number
  minY: number
  width: number
  height: number
}

const COORD_RE = /(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g

function pathsView(paths: string[], pad: number): View {
  const points = paths.flatMap((path) => [...path.matchAll(COORD_RE)])
  const xs = points.map((m) => Number(m[1]))
  const ys = points.map((m) => Number(m[2]))
  const minX = Math.min(...xs) - pad
  const minY = Math.min(...ys) - pad
  return {
    minX,
    minY,
    width: Math.max(...xs) + pad - minX,
    height: Math.max(...ys) + pad - minY,
  }
}

/**
 * The shared geo coordinate space (see geo.ts / geoWide.ts) is far wider than
 * Kazakhstan, so the default frame is cropped to the five Central Asian
 * countries. When an era overlay reaches past that — the Turkic corridor runs
 * from the Black Sea to the Orkhon — the frame widens to fit it instead.
 */
const BASE_VIEW = pathsView(
  centralAsiaCountries.map((c) => c.path),
  14,
)

/** Countries drawn purely as context; the five 'stans have finer paths of their own. */
const CENTRAL_ASIA_IDS = new Set(centralAsiaCountries.map((c) => c.id))
const contextCountries = wideEurasiaCountries.filter(
  (c) => !CENTRAL_ASIA_IDS.has(c.id),
)

/**
 * Pre-made illustrated maps, one per era, dropped in whole rather than drawn
 * from `eraTerritories.ts` — the procedural SVG overlay kept missing the mark
 * against real reference maps across several rounds of redrawing (see git
 * history), so eras with a real reference image here just show it directly.
 * Not geo-referenced to `projectLonLat`, so no site pins are overlaid on top.
 */
export const ERA_MAP_IMAGES: Partial<Record<EraKey, string>> = {
  goldenHorde: '/era-maps/goldenHorde.webp',
}

function unionView(territory: EraTerritory | null): View {
  if (!territory) return BASE_VIEW
  // Callout coordinates count too, or a label outside the shapes gets cropped.
  const placePoints = (territory.places ?? []).map((p) =>
    projectLonLat(p.lon, p.lat).join(','),
  )
  const t = pathsView(
    [...territory.shapes.map((shape) => shape.path), ...placePoints],
    36,
  )
  const minX = Math.min(BASE_VIEW.minX, t.minX)
  const minY = Math.min(BASE_VIEW.minY, t.minY)
  return {
    minX,
    minY,
    width: Math.max(BASE_VIEW.minX + BASE_VIEW.width, t.minX + t.width) - minX,
    height: Math.max(BASE_VIEW.minY + BASE_VIEW.height, t.minY + t.height) - minY,
  }
}

/** Real coordinates → percentage of the current frame, for CSS-positioned pins. */
function position(view: View, lon: number, lat: number) {
  const [x, y] = projectLonLat(lon, lat)
  return {
    left: `${((x - view.minX) / view.width) * 100}%`,
    top: `${((y - view.minY) / view.height) * 100}%`,
  }
}

function PlaceCallout({
  place,
  color,
  view,
}: {
  place: TerritoryPlace
  color: string
  view: View
}) {
  const { t } = useLang()
  const reduce = useReducedMotion()
  const { left, top } = position(view, place.lon, place.lat)
  const isRegion = place.kind === 'region'

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.3, ease: 'easeOut' }}
      className={cn(
        'pointer-events-none absolute z-[9] flex flex-col items-center',
        '-translate-x-1/2 -translate-y-full',
      )}
      style={{ left, top }}
    >
      <span
        className={cn(
          'rounded px-1 py-px whitespace-nowrap',
          isRegion
            ? 'text-[9px] font-bold tracking-wide uppercase sm:text-[11px]'
            : 'text-[8.5px] font-semibold sm:text-[10px]',
        )}
        style={{
          color: `color-mix(in srgb, ${color} 82%, #17211e)`,
          textShadow:
            '0 0 3px #fff, 0 0 3px #fff, 0 1px 2px #fff, 0 -1px 2px #fff',
        }}
      >
        {t(place.name)}
      </span>
      {!isRegion && (
        <span
          className={cn(
            'mb-[-3px] shrink-0 rounded-full ring-1 ring-white',
            place.kind === 'capital' ? 'h-[7px] w-[7px]' : 'h-[5px] w-[5px]',
          )}
          style={{
            background: place.kind === 'capital' ? color : 'var(--color-surface)',
            border: place.kind === 'capital' ? undefined : `1.5px solid ${color}`,
          }}
        />
      )}
    </motion.div>
  )
}

export function KazakhstanMap({
  sites,
  activeId,
  onSelect,
  activeEraKey,
  className,
}: {
  sites: MapSite[]
  activeId: string | null
  onSelect: (site: MapSite) => void
  /** When set, draws that era's approximate territorial extent over the base map. */
  activeEraKey?: EraKey | null
  className?: string
}) {
  const { t } = useLang()
  const reduce = useReducedMotion()

  const territory = activeEraKey ? eraTerritory(activeEraKey) : null
  const overlayColor = activeEraKey ? eraColor(activeEraKey) : null
  const view = useMemo(() => unionView(territory), [territory])
  const eraImage = activeEraKey ? ERA_MAP_IMAGES[activeEraKey] : null

  /** Zoomed far enough out that a full pin chip per site would be unreadable. */
  const isWide = view.width > BASE_VIEW.width * 1.35
  const strokeScale = view.width / BASE_VIEW.width

  if (eraImage) {
    return (
      <div
        className={cn(
          'relative w-full overflow-hidden rounded-card bg-surface p-3 shadow-soft ring-1 ring-line/60 sm:p-5',
          className,
        )}
      >
        <div className="relative w-full overflow-hidden rounded-tile" style={{ aspectRatio: '1400 / 912' }}>
          <img
            src={eraImage}
            alt={t(eras[activeEraKey as EraKey].label)}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'relative w-full overflow-hidden rounded-card bg-surface p-3 shadow-soft ring-1 ring-line/60 sm:p-5',
        className,
      )}
    >
      <div
        className="relative w-full"
        style={{ aspectRatio: `${view.width} / ${view.height}` }}
      >
        <svg
          viewBox={`${view.minX} ${view.minY} ${view.width} ${view.height}`}
          className="absolute inset-0 h-full w-full"
          fill="none"
          aria-hidden
        >
          <defs>
            <linearGradient id="kz-fill" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--color-brand)" stopOpacity="0.16" />
              <stop offset="100%" stopColor="var(--color-brand)" stopOpacity="0.06" />
            </linearGradient>
          </defs>

          {/* faint graticule for depth */}
          <g
            stroke="var(--color-line)"
            strokeWidth={1.2 * strokeScale}
            strokeOpacity="0.7"
          >
            {[0.2, 0.4, 0.6, 0.8].map((f) => (
              <line
                key={`h${f}`}
                x1={view.minX}
                y1={view.minY + view.height * f}
                x2={view.minX + view.width}
                y2={view.minY + view.height * f}
              />
            ))}
            {[0.2, 0.4, 0.6, 0.8].map((f) => (
              <line
                key={`v${f}`}
                x1={view.minX + view.width * f}
                y1={view.minY}
                x2={view.minX + view.width * f}
                y2={view.minY + view.height}
              />
            ))}
          </g>

          {/* present-day borders — the base layer every overlay sits on */}
          <g
            fill="var(--color-line)"
            fillOpacity="0.2"
            stroke="var(--color-line)"
            strokeWidth={1.2 * strokeScale}
            strokeLinejoin="round"
          >
            {contextCountries.map((country) => (
              <path key={country.id} d={country.path} />
            ))}
          </g>

          {/* neighbouring 'stans next, so Kazakhstan draws on top of them */}
          {centralAsiaCountries
            .filter((country) => country.id !== KAZAKHSTAN_ID)
            .map((country) => (
              <motion.path
                key={country.id}
                d={country.path}
                fill="var(--color-line)"
                fillOpacity="0.28"
                stroke="var(--color-line)"
                strokeWidth={1.4 * strokeScale}
                strokeLinejoin="round"
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: reduce ? 0 : 0.7, ease: 'easeOut' }}
              />
            ))}

          {centralAsiaCountries
            .filter((country) => country.id === KAZAKHSTAN_ID)
            .map((country) => (
              <motion.path
                key={country.id}
                d={country.path}
                fill="url(#kz-fill)"
                stroke="var(--color-brand)"
                strokeWidth={2.4 * strokeScale}
                strokeLinejoin="round"
                initial={reduce ? false : { pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: reduce ? 0 : 1.1, ease: 'easeInOut' }}
              />
            ))}

          {/* approximate historical extent — solid region, see eraTerritories.ts */}
          <AnimatePresence>
            {territory && overlayColor && (
              <motion.g
                key={activeEraKey}
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.45, ease: 'easeOut' }}
              >
                {territory.shapes.map((shape, i) => {
                  const isOutline = shape.variant === 'outline'
                  return (
                    <path
                      key={i}
                      d={shape.path}
                      fill={isOutline ? 'none' : overlayColor}
                      fillOpacity={
                        isOutline ? undefined : shape.variant === 'soft' ? 0.34 : 0.62
                      }
                      stroke={overlayColor}
                      strokeWidth={(isOutline ? 3.4 : 2) * strokeScale}
                      strokeLinejoin="round"
                    />
                  )
                })}
              </motion.g>
            )}
          </AnimatePresence>

          {/* re-stroke the modern borders on top, so they read through the fill */}
          {territory && (
            <g
              fill="none"
              stroke="var(--color-surface)"
              strokeOpacity="0.6"
              strokeWidth={1.1 * strokeScale}
              strokeLinejoin="round"
            >
              {contextCountries.map((country) => (
                <path key={country.id} d={country.path} />
              ))}
              {centralAsiaCountries.map((country) => (
                <path key={country.id} d={country.path} />
              ))}
            </g>
          )}
        </svg>

        {sites.map((site) => {
          const Icon = SITE_ICONS[site.category]
          const color = siteColor(site.category)
          const isActive = activeId === site.id
          const { left, top } = position(view, site.lon, site.lat)
          return (
            <motion.button
              key={site.id}
              type="button"
              onClick={() => onSelect(site)}
              initial={reduce ? false : { opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ ...springSoft, delay: reduce ? 0 : 0.35 }}
              whileHover={{ scale: 1.06, zIndex: 20 }}
              whileTap={{ scale: 0.94 }}
              aria-pressed={isActive}
              aria-label={t(site.name)}
              className={cn(
                'focus-ring absolute z-10 flex -translate-x-1/2 -translate-y-1/2',
                'items-center gap-1 rounded-full py-0.5 pr-1.5 pl-0.5',
                'text-[9px] font-semibold whitespace-nowrap sm:text-[10.5px]',
                'border transition-colors duration-200',
                isWide && 'gap-0 p-0',
                isActive ? 'text-white' : 'bg-surface text-ink',
              )}
              style={{
                left,
                top,
                background: isActive ? color : undefined,
                borderColor: isActive
                  ? color
                  : `color-mix(in srgb, ${color} 28%, var(--color-line))`,
                boxShadow: isActive
                  ? `0 6px 18px -6px ${color}`
                  : '0 1px 2px rgb(23 33 30 / 0.06), 0 6px 16px -10px rgb(23 33 30 / 0.3)',
              }}
            >
              <span
                className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full sm:h-4 sm:w-4"
                style={{
                  background: isActive
                    ? 'rgba(255,255,255,0.24)'
                    : `color-mix(in srgb, ${color} 16%, var(--color-surface))`,
                }}
              >
                <Icon
                  className="h-2 w-2 shrink-0 sm:h-2.5 sm:w-2.5"
                  strokeWidth={2.2}
                  style={{ color: isActive ? '#fff' : color }}
                />
              </span>
              {/* zoomed out to continental scale the names collide — dots only */}
              {!isWide && t(site.name)}
            </motion.button>
          )
        })}

        {/* era place callouts — ancient cities, capitals, zhuz and neighbour names */}
        {overlayColor &&
          territory?.places?.map((place) => (
            <PlaceCallout
              key={place.id}
              place={place}
              color={overlayColor}
              view={view}
            />
          ))}

        {/* honesty badge — never let an overlay read as a precise border */}
        {territory && (
          <p
            className={cn(
              'pointer-events-none absolute bottom-1 left-1 z-20 max-w-[92%] rounded-full',
              'bg-surface/90 px-2.5 py-1 text-[9.5px] leading-tight font-medium text-ink-soft',
              'ring-1 ring-line/70 backdrop-blur-sm sm:text-[11px]',
            )}
          >
            {t(s.map.approx)}
          </p>
        )}
      </div>
    </div>
  )
}
