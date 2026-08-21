import type { EraKey, LocalizedText } from './types'

/**
 * Approximate territorial extent per era, for the map overlay.
 *
 * Emptied out at the user's request — every hand-drawn shape kept missing the
 * mark against their own reference maps across several rounds of redrawing.
 *
 * `goldenHorde`'s shape is traced from the user's own reference illustration
 * rather than eyeballed or pulled from a third-party dataset: the yellow
 * territory fill was isolated with OpenCV (color threshold + contour
 * extraction) directly from the source image, so the polygon's vertices are
 * the actual pixel outline of that map, not a hand-drawn approximation. Those
 * pixel coordinates were then converted to real lon/lat via an affine
 * transform fitted (least squares) against ~12 labelled cities on the same
 * image whose real coordinates are known (Moscow, Kazan, Kiev, Otrar,
 * Tashkent, Derbent, etc. — max residual ~2.8°), and finally run through the
 * same `projectLonLat` used everywhere else on this map. So this border is
 * the reference image's own outline, just moved into real coordinate space
 * instead of staying locked in one bitmap. Re-populate the rest of
 * `eraTerritories` below, keyed by `EraKey`, to bring a shape back for
 * another era.
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
        path: 'M661.2,-32.9L622.4,-97.7L490.3,-114.7L313.4,-67.5L231.3,15.8L186.6,16.1L166.6,-32.2L101.1,7.2L-47.1,10.8L-67.3,52.6L-134.4,72.0L-146.9,121.0L-228.0,105.3L-278.6,170.7L-237.2,272.8L-275.2,289.2L-269.4,314.2L-161.2,266.2L-137.4,331.2L-111.1,328.8L-130.8,295.0L-34.3,261.0L-48.4,342.3L80.6,397.7L80.5,319.3L163.3,264.9L216.0,338.5L165.7,339.9L161.9,375.6L219.0,416.4L227.6,440.8L202.6,448.7L226.1,473.1L266.3,453.4L276.6,381.6L320.6,378.5L401.2,327.4L446.1,263.2L606.8,184.4L619.4,135.3L682.0,96.6Z',
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
