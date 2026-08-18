import { KAZAKHSTAN_ID, centralAsiaCountries, projectLonLat } from './geo'
import type { EraKey, LocalizedText } from './types'

/**
 * Approximate territorial extent per era, for the map overlay.
 *
 * IMPORTANT — these are teaching aids, not cartography. Every pre-modern polity
 * here was nomadic or semi-nomadic and had no fixed linear borders: what sources
 * describe are shifting zones of control, tribute and seasonal migration. Each
 * shape below is a closed polygon through the landmark points that historians
 * actually name for that era, so the outline is indicative only. The UI must
 * always show the "approximate" caption alongside an overlay (see s.map.approx).
 *
 * `golden` deliberately has no entry: it is the 9th–12th c. steppe renaissance
 * (al-Farabi, Balasaguni, Kashgari, Yasawi) — a curated cultural grouping, not a
 * polity, so it has no territory to draw.
 *
 * `goldenHorde` (Алтын Орда, 13th–15th c.: the Mongol conquest, Ulus Jochi/Batu,
 * and the Ak Orda successor state) is a real polity and a separate `EraKey` from
 * `golden` — see `people.ts` (zhoshy-khan, batu-khan) and `timeline.ts`. It draws
 * two shapes: a `soft` outer one for Ulus Jochi at its 14th-c. height (Urals to
 * the Danube, Black Sea to the Caucasus, capital Sarai on the Volga — sourced via
 * Britannica's "Golden Horde" overview), and the solid inner one for the Ak Orda
 * (White Horde), the eastern wing whose territory is described in sources as most
 * of present Kazakhstan except Zhetysu, east of the Ural, north of the Aral Sea
 * and the Syr Darya — anchored on Saraishyq, Sygnak (capital) and the Syr Darya
 * cities, all of which are already-sourced pins in `mapSites.ts`. `projectLonLat`
 * itself has no bounding box — it's a fixed linear formula — so the outer shape
 * can reach west past `geo.ts`'s own pre-baked country outlines (clipped to
 * 42–100°E) into territory only `geoWide.ts` draws (clipped to 25–115°E,
 * `KazakhstanMap.tsx`'s `contextCountries`), the same way the `turkic` shape
 * below already reaches the Black Sea.
 */

/**
 * One drawn region. An era can have several: two adjacent governments (`alash`),
 * or an earlier border shown alongside the later one (`soviet`).
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

/** Close a ring of real [lon, lat] landmarks into an SVG path in the geo space. */
function ringPath(points: [number, number][]): string {
  const d = points
    .map(([lon, lat], i) => {
      const [x, y] = projectLonLat(lon, lat)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join('')
  return `${d}Z`
}

const kazakhstanPath =
  centralAsiaCountries.find((c) => c.id === KAZAKHSTAN_ID)?.path ?? ''

/**
 * Three shapes below are the real Kazakhstan/Uzbekistan/Kyrgyzstan borders
 * (the same Natural Earth source as `geo.ts`, so they line up exactly with
 * `kazakhstanPath` and the country outlines already on the map) clipped
 * against a rough historical claim zone — Shapely intersection/difference,
 * run once offline and pasted here as a static path, the same "real source
 * data, simplified once" pipeline `geo.ts`'s own header describes for every
 * country path in this app. This is far more accurate than a hand-picked
 * lon/lat point list for a polity whose extent really is "the modern country,
 * minus/plus one named region": Ak Orda and the Kazakh Khanate below were
 * previously drawn as crude 15-point polygons that undershot the real
 * Kazakhstan coastline everywhere, which is what prompted redrawing them
 * this way.
 */
/** `kazakhstanPath` minus the Zhetysu / Almaty corner (south-east) — see `goldenHorde`. */
const akOrdaPath =
  'M514.1,357.9L539.3,365.4L555.3,348.0L577.6,350.9L577.6,271.1L706.1,271.1L710.2,254.8L737.8,263.3L752.8,253.4L754.3,226.6L781.4,210.0L769.1,197.8L745.0,196.6L713.1,165.3L680.5,171.2L670.3,158.4L655.0,170.4L590.9,87.0L559.5,102.5L501.6,89.3L495.5,63.4L465.2,61.5L399.3,85.8L333.3,93.1L326.6,134.8L311.6,141.9L333.8,154.6L334.3,168.3L307.1,174.9L282.1,163.6L249.8,164.6L237.9,174.5L214.1,170.2L195.5,153.7L151.6,147.8L117.4,174.5L110.9,192.6L91.9,182.2L80.3,226.1L105.3,241.6L124.7,274.9L158.3,256.7L192.6,267.1L181.6,297.0L162.4,298.0L152.8,315.2L160.3,342.3L182.8,359.3L180.9,382.4L209.0,369.2L241.0,393.2L241.0,306.7L285.5,293.3L344.7,342.1L395.0,336.9L415.5,353.9L414.0,377.2L422.4,377.4L427.8,397.5L447.2,396.1L453.3,408.8Z'
/** `kazakhstanPath` minus the south (Syr Darya cities + Zhetysu) strip — see `alash`. */
const alashNorthPath =
  'M710.2,254.8L737.8,263.3L752.8,253.4L754.3,226.6L781.4,210.0L769.1,197.8L745.0,196.6L713.1,165.3L680.5,171.2L670.3,158.4L655.0,170.4L590.9,87.0L559.5,102.5L501.6,89.3L495.5,63.4L465.2,61.5L399.3,85.8L333.3,93.1L326.6,134.8L311.6,141.9L333.8,154.6L334.3,168.3L307.1,174.9L282.1,163.6L249.8,164.6L237.9,174.5L214.1,170.2L195.5,153.7L151.6,147.8L117.4,174.5L110.9,192.6L91.9,182.2L80.3,226.1L105.3,241.6L124.7,274.9L158.3,256.7L192.6,267.1L181.6,297.0L158.3,305.3L241.0,307.8L285.5,293.3L305.4,309.7L517.2,318.3L637.9,292.3L700.7,292.3Z'
/** That south strip, plus Uzbekistan and Kyrgyzstan, minus Khiva and Bukhara — see `alash`. */
const turkestanAutonomyPath =
  'M697.9,303.6L700.7,292.3L637.9,292.3L517.2,318.3L362.1,312.0L362.1,400.8L448.3,400.8L448.3,434.0L456.2,435.2L459.5,420.1L490.3,400.3L489.3,413.7L499.3,418.7L482.2,419.6L469.5,430.0L475.9,434.5L545.3,437.3L551.6,423.4L579.0,410.0L594.5,413.7L600.3,401.2L622.8,398.9L658.8,372.7L668.8,349.8L656.2,306.2Z'

export const eraTerritories: Partial<Record<EraKey, EraTerritory>> = {
  /**
   * Saka horizon, 1st millennium BCE. Drawn over most of the modern country:
   * Caspian and Ustyurt in the west, the north Kazakh steppe, the Altai (Berel,
   * Shilikty) in the north-east, Zhetysu and Esik in the south-east, the Syr
   * Darya (Chirik-Rabat) in the south. This is an archaeological horizon —
   * related burial and metalwork traditions — not one state with one border.
   */
  saka: {
    shapes: [
      {
        path: ringPath([
          [51.5, 45.2],
          [50.3, 47.5],
          [51.5, 50.6],
          [57, 52.8],
          [68, 53.8],
          [76.9, 52.5],
          [84, 50.6],
          [88, 49.3],
          [85.5, 46.5],
          [81, 44.3],
          [77.5, 43],
          [71.5, 42.7],
          [68.3, 43.2],
          [63, 43.5],
          [58, 44.5],
        ]),
      },
    ],
    label: {
      kz: 'Сақ тайпаларының б.з.д. I мыңжылдықтағы шамамен таралу аймағы — Каспийден Алтайға дейін. Бұл — бір мемлекеттің шекарасы емес, туыстас археологиялық мәдениеттердің аясы.',
      ru: 'Примерная зона расселения сакских племён, I тыс. до н.э. — от Каспия до Алтая. Это не граница одного государства, а ареал родственных археологических культур.',
    },
    places: [
      {
        id: 'saka-name',
        name: { kz: 'Сақтар', ru: 'Саки' },
        lon: 67,
        lat: 48.5,
        kind: 'region',
      },
      {
        id: 'saka-persia',
        name: { kz: 'Парсы патшалығы', ru: 'Персия' },
        lon: 54,
        lat: 35,
        kind: 'region',
      },
      {
        id: 'saka-shilikty',
        name: { kz: 'Шілікті', ru: 'Шиликты' },
        lon: 84,
        lat: 47.3,
        kind: 'city',
      },
      {
        id: 'saka-chirik-rabat',
        name: { kz: 'Шірік-Рабат', ru: 'Чирик-Рабат' },
        lon: 62.4,
        lat: 44.5,
        kind: 'city',
      },
    ],
  },

  /**
   * Turkic Khaganate at its short-lived maximum, 552–603: the steppe corridor
   * from the Black Sea and Derbent in the west to the Orkhon valley and the
   * Khingan in the east. It split in 603 into an Eastern and a Western khaganate;
   * the Western one (Suyab, Zhetysu, the Syr Darya cities) is the part that leads
   * on towards the Kazakh Khanate.
   */
  turkic: {
    shapes: [
      {
        path: ringPath([
          [35.5, 46.8],
          [44, 49.5],
          [54, 52.5],
          [66, 54.5],
          [80, 54],
          [92, 53.5],
          [104, 52],
          [113, 49.5],
          [114.5, 44],
          [107, 41],
          [98, 40],
          [89, 41.5],
          [80, 41],
          [72.5, 40.2],
          [66, 39.5],
          [60, 40.5],
          [54, 41.5],
          [48.5, 42],
          [42, 44],
        ]),
      },
    ],
    label: {
      kz: 'Түрік қағанатының 552–603 жылдардағы ең кең шегі — Қара теңізден Орхонға дейін. 603 жылы қағанат екіге бөлінді; Қазақ хандығына апаратын тізбек — Батыс Түрік қағанаты (603–704): Жетісу, Шу, Талас, Іле және Сырдария қалалары.',
      ru: 'Наибольшие пределы Тюркского каганата в 552–603 годах — от Чёрного моря до Орхона. В 603 году каганат распался надвое; к Казахскому ханству ведёт линия Западнотюркского каганата (603–704): Жетысу, Чу, Талас, Или и города Сырдарьи.',
    },
    places: [
      {
        id: 'turkic-west',
        name: { kz: 'Батыс Түрік қағанаты', ru: 'Западный каганат' },
        lon: 62,
        lat: 47,
        kind: 'region',
      },
      {
        id: 'turkic-east',
        name: { kz: 'Шығыс Түрік қағанаты', ru: 'Восточный каганат' },
        lon: 98,
        lat: 51.5,
        kind: 'region',
      },
      {
        id: 'turkic-suyab',
        name: { kz: 'Суяб', ru: 'Суяб' },
        lon: 75.2,
        lat: 42.82,
        kind: 'capital',
      },
      {
        id: 'turkic-orkhon',
        name: { kz: 'Орхон алқабы', ru: 'Орхонская долина' },
        lon: 102.8,
        lat: 47.4,
        kind: 'capital',
      },
      {
        id: 'turkic-derbent',
        name: { kz: 'Дербент', ru: 'Дербент' },
        lon: 48.3,
        lat: 42.06,
        kind: 'city',
      },
    ],
  },

  /**
   * Two shapes, drawn outer-first so the solid one reads on top:
   *
   * 1. `soft` — Ulus Jochi (Golden Horde) at its 14th-c. height under Uzbeg
   *    Khan: the Urals to the Danube, the Black Sea to the Caucasus, capital
   *    Sarai on the Volga. Anchored on real named cities — Sarai, Bulgar
   *    (Volga Bulgaria), Crimea, Azaq/Azov, Derbent, Urgench (Khwarezm) — the
   *    same "landmark points, not a precise line" spirit as every other shape
   *    in this file (see the module doc comment above).
   * 2. Solid — Ak Orda (White Horde), 13th–early 15th c.: the eastern wing of
   *    Ulus Jochi. By the 14th century its territory covered most of present
   *    Kazakhstan except Zhetysu — east of the Ural (Saraishyq), north of the
   *    Aral Sea and Syr Darya (Sygnak, its capital, and the other Syr Darya
   *    cities), stopping short of Lake Balkhash and the Zhetysu/Mogulistan
   *    lands to the south-east. It is the direct predecessor of the Kazakh
   *    Khanate (1465) drawn next. Drawn with `akOrdaPath` (real Kazakhstan
   *    border, minus the Zhetysu corner — see the module doc comment above)
   *    rather than a hand-picked point list, so it actually hugs the coastline
   *    and the Altai/Tarbagatai border instead of a rough hexagon.
   */
  goldenHorde: {
    shapes: [
      {
        variant: 'soft',
        path: ringPath([
          [49.03, 54.98],
          [58, 56],
          [68, 54.5],
          [78, 48.5],
          [77, 44.8],
          [66.96, 44.16],
          [60.63, 41.55],
          [51, 43.5],
          [48.3, 42.06],
          [34.4, 45.2],
          [29, 46.5],
          [39.4, 47.1],
        ]),
      },
      { path: akOrdaPath },
    ],
    label: {
      kz: 'Ашық түс — Алтын Орданың (Жошы ұлысы) Өзбек хан тұсындағы (XIV ғ.) ең кең шегі: Оралдан Дунайға, Қара теңізден Кавказға дейін, астанасы — Еділдегі Сарай. Қанық түс — оның шығыс қанаты, Ақ Орда: қазіргі Қазақстанның Жетісудан басқа дерлік барлық аумағы, астанасы Сығанақ. Ақ Орда — 1465 жылғы Қазақ хандығының тікелей алдындағы мемлекет.',
      ru: 'Бледная заливка — наибольшие пределы Золотой Орды (Улуса Джучи) при хане Узбеке (XIV в.): от Урала до Дуная, от Чёрного моря до Кавказа, столица — Сарай на Волге. Насыщенная заливка — её восточное крыло, Ак-Орда: почти вся территория современного Казахстана, кроме Жетысу, столица Сыгнак. Ак-Орда — непосредственный предшественник Казахского ханства 1465 года.',
    },
    places: [
      {
        id: 'goldenhorde-akorda',
        name: { kz: 'Ақ Орда', ru: 'Ак-Орда' },
        lon: 60,
        lat: 48,
        kind: 'region',
      },
      {
        id: 'goldenhorde-bulgar',
        name: { kz: 'Болғар', ru: 'Булгар' },
        lon: 49.03,
        lat: 54.98,
        kind: 'city',
      },
      {
        id: 'goldenhorde-crimea',
        name: { kz: 'Қырым', ru: 'Крым' },
        lon: 34.4,
        lat: 45.2,
        kind: 'region',
      },
      {
        id: 'goldenhorde-sarai',
        name: { kz: 'Сарай (Алтын Орда астанасы)', ru: 'Сарай (столица Золотой Орды)' },
        lon: 47.43,
        lat: 47.18,
        kind: 'capital',
      },
      {
        id: 'goldenhorde-kayalyk',
        name: { kz: 'Қаялық', ru: 'Каялык' },
        lon: 80.26,
        lat: 45.66,
        kind: 'city',
      },
    ],
  },

  /**
   * Kazakh Khanate at its maximum under Kasym Khan (1511–1521): Yaik and
   * Saraishyq in the north-west, Mangystau and the Adai in the south-west,
   * Ulytau and the Irtysh in the north, Tarbagatai and Zhetysu in the east, the
   * Syr Darya cities and Sayram in the south. By 1822–1824 no khanate territory
   * remained in law. Drawn with `kazakhstanPath` (the real modern border) rather
   * than a hand-picked point list — at this khanate's own greatest extent it
   * tracked essentially the whole of modern Kazakhstan, the same "почти вся
   * территория" already said of Ak Orda above, so the real coastline is a more
   * accurate stand-in than a rough hexagon ever was.
   */
  khanate: {
    shapes: [{ path: kazakhstanPath }],
    label: {
      kz: 'Қасым хан тұсындағы ең кең шек (1511–1521), үш жүздің шамамен орналасуымен. 1822–1824 жылдары хан билігі жойылды.',
      ru: 'Наибольшие пределы при Касым хане (1511–1521), с примерным расположением трёх жузов. В 1822–1824 годах ханская власть была упразднена.',
    },
    places: [
      {
        id: 'khanate-kishi',
        name: { kz: 'Кіші жүз', ru: 'Младший жуз' },
        lon: 55,
        lat: 47.5,
        kind: 'region',
      },
      {
        id: 'khanate-orta',
        name: { kz: 'Орта жүз', ru: 'Средний жуз' },
        lon: 70,
        lat: 49.8,
        kind: 'region',
      },
      {
        id: 'khanate-uly',
        name: { kz: 'Ұлы жүз', ru: 'Старший жуз' },
        lon: 78.5,
        lat: 44.8,
        kind: 'region',
      },
      {
        id: 'khanate-adai',
        name: { kz: 'Адайлар', ru: 'Адаи' },
        lon: 53.2,
        lat: 44.3,
        kind: 'region',
      },
      {
        id: 'khanate-jungar',
        name: { kz: 'Жоңғар хандығы', ru: 'Джунгарское ханство' },
        lon: 84,
        lat: 46.3,
        kind: 'region',
      },
      {
        id: 'khanate-orda-bazar',
        name: { kz: 'Орда-Базар', ru: 'Орда-Базар' },
        lon: 65.5,
        lat: 48.5,
        kind: 'city',
      },
      {
        id: 'khanate-sozak',
        name: { kz: 'Созақ', ru: 'Созак' },
        lon: 68.47,
        lat: 44.15,
        kind: 'city',
      },
      {
        id: 'khanate-tashkent',
        name: { kz: 'Ташкент', ru: 'Ташкент' },
        lon: 69.24,
        lat: 41.31,
        kind: 'city',
      },
    ],
  },

  /**
   * 1917–1918: TWO adjacent autonomous governments, not one.
   *
   * `Alash Autonomy` (Alash-Orda, capital Alash / Semipalatinsk) in the north,
   * declared December 1917, and the `Turkestan Autonomy` (usually called the
   * Kokand Autonomy, capital Kokand) in the south, declared November 1917 and
   * crushed by force in February 1918. They adjoined around Türkistan/Sayram.
   * Neither ever controlled its claimed area — these are claims on paper.
   * Khiva and Bukhara stayed separate states and are not drawn.
   *
   * Both shapes are `alashNorthPath` / `turkestanAutonomyPath` (real Kazakh,
   * Uzbek and Kyrgyz borders, split roughly along that Türkistan/Sayram
   * boundary — see the module doc comment above) rather than a hand-picked
   * point list, so Alash Autonomy actually stops at Kazakhstan's own real
   * north-west border instead of a straight line that used to cut deep into
   * Russia.
   */
  alash: {
    shapes: [
      { path: alashNorthPath },
      {
        // Turkestan (Kokand) Autonomy — south. Lighter, so the two adjoining
        // governments do not read as one region.
        variant: 'soft',
        path: turkestanAutonomyPath,
      },
    ],
    label: {
      kz: '1917–1918 жылдары қатар өмір сүрген екі автономия: солтүстікте Алаш автономиясы (астанасы — Алаш/Семей), оңтүстікте Түркістан (Қоқан) автономиясы (астанасы — Қоқан). Екеуі де мәлімдеген аумағын нақты бақыламады; Хиуа мен Бұхара бөлек мемлекет болып қала берді.',
      ru: 'Две автономии, существовавшие рядом в 1917–1918 годах: на севере автономия Алаш (столица — Алаш/Семипалатинск), на юге Туркестанская (Кокандская) автономия (столица — Коканд). Ни одна из них не контролировала заявленную территорию; Хива и Бухара оставались отдельными государствами.',
    },
    places: [
      {
        id: 'alash-north',
        name: { kz: 'Алаш автономиясы', ru: 'Автономия Алаш' },
        lon: 63,
        lat: 50.5,
        kind: 'region',
      },
      {
        id: 'alash-turkestan',
        name: { kz: 'Түркістан автономиясы', ru: 'Туркестанская автономия' },
        lon: 71,
        lat: 41.8,
        kind: 'region',
      },
      {
        id: 'alash-kokand',
        name: { kz: 'Қоқан', ru: 'Коканд' },
        lon: 70.94,
        lat: 40.53,
        kind: 'capital',
      },
      {
        id: 'alash-oral',
        name: { kz: 'Орал', ru: 'Уральск' },
        lon: 51.37,
        lat: 51.23,
        kind: 'city',
      },
      {
        id: 'alash-akmola',
        name: { kz: 'Ақмола', ru: 'Акмолинск' },
        lon: 71.43,
        lat: 51.16,
        kind: 'city',
      },
      {
        id: 'alash-pishpek',
        name: { kz: 'Пішпек', ru: 'Пишпек' },
        lon: 74.6,
        lat: 42.87,
        kind: 'city',
      },
    ],
  },

  /**
   * Two Soviet-era borders, because they were very different.
   *
   * Filled shape — the Kazakh SSR of 1936–1991, which is the modern outline.
   * Outlined shape — the Kirgiz (Kazakh) ASSR of 1920–1924: capital Orenburg,
   * reaching north past Petropavlovsk and Omsk-ward, but with NO Zhetysu
   * (Almaty, Pishpek) and none of the Syr Darya oblast cities in the south.
   * Zhetysu and the south came in with the 1924–1925 national delimitation.
   * The outlined shape is traced from a published boundary map, so it is
   * cruder than the modern outline next to it.
   */
  soviet: {
    shapes: [
      { path: kazakhstanPath },
      {
        variant: 'outline',
        path: ringPath([
          [51.9, 47.1],
          [50.8, 51.5],
          [55.5, 52.3],
          [61, 54],
          [69.2, 55.1],
          [76, 54],
          [82.6, 50.3],
          [81.5, 48],
          [75, 46],
          [68.5, 45],
          [65.5, 44.9],
          [60, 44.5],
          [54.5, 44.5],
          [50.3, 44.5],
        ]),
      },
    ],
    label: {
      kz: 'Тұтас боялған аумақ — Қазақ КСР-нің 1936–1991 жылдардағы шекарасы (бүгінгімен бірдей). Ішіндегі сызық — 1920–1924 жылдардағы Қазақ (Қырғыз) АКСР: астанасы Орынбор, Жетісу мен Сырдария қалалары әлі кірмеген. Оңтүстік 1924–1925 жылдардағы межелеуден кейін қосылды.',
      ru: 'Сплошная заливка — границы Казахской ССР 1936–1991 годов (совпадают с современными). Линия внутри — Казахская (Киргизская) АССР 1920–1924 годов: столица Оренбург, без Жетысу и без городов Сырдарьи. Юг вошёл после национального размежевания 1924–1925 годов.',
    },
    places: [
      {
        id: 'soviet-orenburg',
        name: { kz: 'Орынбор', ru: 'Оренбург' },
        lon: 55.1,
        lat: 51.77,
        kind: 'capital',
      },
      {
        id: 'soviet-akmeshit',
        name: { kz: 'Ақмешіт', ru: 'Ак-Мечеть' },
        lon: 65.51,
        lat: 44.85,
        kind: 'capital',
      },
      {
        id: 'soviet-almaata',
        name: { kz: 'Алма-Ата', ru: 'Алма-Ата' },
        lon: 76.89,
        lat: 43.24,
        kind: 'capital',
      },
      {
        id: 'soviet-1920',
        name: { kz: 'ҚАКСР шекарасы, 1920–1924', ru: 'Граница КазАССР, 1920–1924' },
        lon: 60,
        lat: 53.6,
        kind: 'region',
      },
    ],
  },

  independence: {
    shapes: [{ path: kazakhstanPath }],
    label: {
      kz: 'Қазақстан Республикасының бүгінгі шекарасы — 1936–1991 жылдардағы шекарамен іс жүзінде бірдей.',
      ru: 'Современные границы Республики Казахстан — практически те же, что и в 1936–1991 годах.',
    },
    // No callouts: every city worth naming here is already a permanent map pin.
  },
}

export function eraTerritory(key: EraKey): EraTerritory | null {
  return eraTerritories[key] ?? null
}
