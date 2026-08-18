import type { EraKey, LocalizedText } from './types'

/**
 * Approximate territorial extent per era, for the map overlay.
 *
 * Emptied out at the user's request — every hand-drawn (and later,
 * real-border-derived) shape kept missing the mark against their own
 * reference maps across several rounds of redrawing, so the overlay feature
 * is switched off for every era rather than shipping another approximation.
 * The era tabs on the map screen still work and still show the real base map
 * and permanent site pins; they just no longer paint a historical-extent
 * shape on top. Re-populate `eraTerritories` below, keyed by `EraKey`, to
 * bring a shape back for a given era.
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

export const eraTerritories: Partial<Record<EraKey, EraTerritory>> = {}

export function eraTerritory(key: EraKey): EraTerritory | null {
  return eraTerritories[key] ?? null
}
