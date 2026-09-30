import { eraColor } from '../data/eras'
import { eraTerritory } from '../data/eraTerritories'
import { KAZAKHSTAN_ID, centralAsiaCountries, projectLonLat } from '../data/geo'
import { wideEurasiaCountries } from '../data/geoWide'
import type { EraKey, MapMarker } from '../data/types'
import { cn } from '../lib/cn'
import { pathsView } from '../lib/mapView'

/**
 * The map stimulus of a ҰБТ context block — tasks 11–15 of a real variant.
 *
 * This is not the app's explore map wearing a different hat. That one exists to
 * tell you what you are looking at: it labels its sites, highlights on hover
 * and answers a tap. A stimulus has to do the opposite, because the question is
 * *«определите государство под №2»* — so the numbers are all the reader gets,
 * and `marker.label` is deliberately never drawn. The label rides on the data
 * only so the block's own questions and explanations have a name to check
 * themselves against; putting it on the map would answer every task on it.
 *
 * Nothing here is interactive for the same reason: a hover tooltip, a focus
 * ring or a `title` attribute would each hand the answer to whoever tried it.
 */

/** Countries drawn as pale context behind the five Central Asian ones. */
const CENTRAL_ASIA_IDS = new Set(centralAsiaCountries.map((c) => c.id))
const contextCountries = wideEurasiaCountries.filter((c) => !CENTRAL_ASIA_IDS.has(c.id))

export function ExamMapStimulus({
  eraKey,
  markers,
  className,
}: {
  eraKey: EraKey
  markers: MapMarker[]
  className?: string
}) {
  const territory = eraTerritory(eraKey)
  const overlay = eraColor(eraKey)

  // The frame has to hold the era's shapes as well as the modern outlines —
  // several eras reach well past today's borders — and a marker cropped off the
  // edge is a task nobody can answer. Marker positions go in as one-point
  // "paths" so a pin near the edge widens the frame instead of falling out.
  const markerPoints = markers.map((m) => projectLonLat(m.lon, m.lat).join(','))
  const view = pathsView(
    [
      ...centralAsiaCountries.map((c) => c.path),
      ...(territory?.shapes.map((shape) => shape.path) ?? []),
      ...markerPoints,
    ],
    24,
  )

  // Strokes are in user units, so they thicken as the frame narrows unless they
  // are scaled against it. 900 is roughly the Central Asia frame's own width.
  const k = view.width / 900

  return (
    <div className={cn('overflow-hidden rounded-lg bg-cream', className)}>
      <svg
        viewBox={`${view.minX} ${view.minY} ${view.width} ${view.height}`}
        className="h-auto w-full"
        role="img"
        aria-label="Карта"
      >
        {contextCountries.map((country) => (
          <path
            key={country.id}
            d={country.path}
            fill="var(--color-line)"
            fillOpacity={0.35}
            stroke="var(--color-surface)"
            strokeWidth={1 * k}
          />
        ))}

        {centralAsiaCountries.map((country) => (
          <path
            key={country.id}
            d={country.path}
            fill="var(--color-line)"
            fillOpacity={country.id === KAZAKHSTAN_ID ? 0.75 : 0.5}
            stroke="var(--color-surface)"
            strokeWidth={1.5 * k}
          />
        ))}

        {/* The era's extent, drawn over the modern outlines rather than instead
            of them: several tasks turn on where a historical state sat against
            today's territory, so both have to stay readable at once. */}
        {territory?.shapes.map((shape, index) => (
          <path
            key={index}
            d={shape.path}
            fill={overlay}
            fillOpacity={0.22}
            stroke={overlay}
            strokeOpacity={0.55}
            strokeWidth={2 * k}
          />
        ))}

        {markers.map((marker) => {
          const [x, y] = projectLonLat(marker.lon, marker.lat)
          const r = 13 * k
          return (
            <g key={marker.n}>
              <circle
                cx={x}
                cy={y}
                r={r}
                fill="var(--color-surface)"
                stroke="var(--color-ink)"
                strokeWidth={2 * k}
              />
              <text
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                fill="var(--color-ink)"
                fontSize={15 * k}
                fontWeight={700}
              >
                {marker.n}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
