import type { EraKey, LocalizedText } from './types'

/**
 * Approximate territorial extent per era, for the map overlay.
 *
 * Emptied out at the user's request — every hand-drawn shape kept missing the
 * mark against their own reference maps across several rounds of redrawing.
 * `goldenHorde` is repopulated below, this time from a real georeferenced
 * source instead of freehand: the polygon comes from aourednik's
 * historical-basemaps `world_1300.geojson` ("Khanate of the Golden Horde"),
 * simplified with Ramer–Douglas–Peucker and run through the same
 * `projectLonLat` used everywhere else on this map, so it lands in the exact
 * same coordinate space as the real country borders — not eyeballed against
 * a screenshot. Re-populate the rest of `eraTerritories` below, keyed by
 * `EraKey`, to bring a shape back for another era.
 */

/**
 * One drawn region. An era can have several: two adjacent governments, or an
 * earlier border shown alongside a later one.
 */
export interface TerritoryShape {
  /** SVG path `d` in the geo.ts coordinate space (see projectLonLat). */
  path: string
  /**
   * How to draw it. Default (omitted) is a solid saturated fill.
   * `soft` — the same colour at a lighter fill, so a second region touching the
   * first one still reads as a separate government rather than one blob.
   * `outline` — boundary line only, for an earlier border that sits inside the
   * main filled one and would otherwise be invisible under it.
   */
  variant?: 'soft' | 'outline'
}

/**
 * A named point called out while this era's overlay is active: an ancient city,
 * a capital, or a floating region name (zhuz, neighbouring khanate).
 *
 * These deliberately do NOT repeat what `mapSites.ts` already pins — Türkistan,
 * Sauran, Syganaq, Saraishyq, Taraz, Sayram, Esik, Berel, Besshatyr, Ulytau,
 * Semey and Kyzylorda are already on the map at all times, so listing them again
 * here would just print every name twice.
 */
export interface TerritoryPlace {
  id: string
  name: LocalizedText
  /** Real longitude in degrees east. */
  lon: number
  /** Real latitude in degrees north. */
  lat: number
  /**
   * `city` — dot + name. `capital` — accented dot + name. `region` — name only,
   * floating over an area (a zhuz, an autonomy, a neighbouring state).
   */
  kind: 'city' | 'capital' | 'region'
}

export interface EraTerritory {
  shapes: TerritoryShape[]
  /** Exactly what these shapes approximate — shown under the map. */
  label: LocalizedText
  /** Key places named on the reference maps for this era. */
  places?: TerritoryPlace[]
}

export const eraTerritories: Partial<Record<EraKey, EraTerritory>> = {
  goldenHorde: {
    label: {
      kz: 'Алтын Орданың шамамен аумағы, шамамен 1300 жыл шамасында — Дунайдан Сібірге дейін.',
      ru: 'Приблизительная территория Золотой Орды около 1300 года — от Дуная до Сибири.',
    },
    shapes: [
      {
        path: 'M-213.3,288.8L-211.9,300.4L-241.1,299.0L-242.2,324.1L-285.0,336.5L-328.9,334.9L-336.7,321.1L-252.3,274.9L-251.2,250.3L-216.3,227.1L-209.5,205.6L-126.2,222.5L-85.7,194.8L-66.5,197.9L-64.3,167.1L-22.6,165.6L28.1,136.3L19.1,77.8L64.1,64.0L68.4,6.3L280.9,-10.0L494.6,-107.0L604.1,-93.7L742.8,-3.9L896.1,26.1L827.6,186.9L753.1,181.3L641.0,202.6L491.4,185.5L310.8,368.7L254.6,392.0L208.1,450.3L186.7,413.3L190.6,399.5L214.1,408.8L219.9,397.5L202.3,374.0L190.8,376.5L189.1,397.5L185.6,359.4L143.5,321.4L165.1,317.0L156.9,309.3L164.0,297.7L194.6,298.7L187.0,294.5L190.1,261.2L157.2,257.8L97.0,289.2L82.9,317.4L95.2,341.6L98.9,333.3L100.8,362.6L56.2,366.9L-24.9,350.2L-78.0,313.7L-86.9,301.1L-61.1,281.0L-73.2,268.7L-49.0,253.0L-140.7,278.3L-119.6,298.5L-94.5,297.3L-137.7,318.4L-163.7,296.0L-146.1,279.7L-168.9,278.9L-173.3,262.5L-213.3,288.8Z',
      },
    ],
    places: [
      { id: 'golden-horde-title', name: { kz: 'Алтын Орда', ru: 'Золотая Орда' }, lon: 55, lat: 50.5, kind: 'region' },
      { id: 'saray', name: { kz: 'Сарай', ru: 'Сарай' }, lon: 47.86, lat: 46.66, kind: 'capital' },
      { id: 'kazan', name: { kz: 'Қазан', ru: 'Казань' }, lon: 49.12, lat: 55.79, kind: 'city' },
      { id: 'moscow', name: { kz: 'Мәскеу', ru: 'Москва' }, lon: 37.62, lat: 55.75, kind: 'city' },
      { id: 'crimea', name: { kz: 'Қырым', ru: 'Крым' }, lon: 34.4, lat: 45.3, kind: 'region' },
      { id: 'sibir-khanate', name: { kz: 'Сібір хандығы', ru: 'Сибирское ханство' }, lon: 68.26, lat: 58.2, kind: 'region' },
    ],
  },
}

export function eraTerritory(key: EraKey): EraTerritory | null {
  return eraTerritories[key] ?? null
}
