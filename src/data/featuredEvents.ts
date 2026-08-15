import type { EraKey, LocalizedText } from './types'

/**
 * Featured historical-event cards shown on Home, one per era. Rotates daily
 * (see `todaysFeaturedEvent`) so a returning visitor sees a different era
 * every day rather than the same fixed card forever — with 10 entries, it
 * takes 10 days to repeat.
 *
 * Every `title`/`text` pair is copied verbatim from the matching entry in
 * `src/data/timeline.ts` (see the `sourceId` comment on each) rather than
 * written fresh, so nothing here says anything the rest of the app doesn't
 * already stand behind. The image is an AI-generated scene illustration —
 * none of these eras have surviving photography of the moment itself, so
 * every card carries the same honest "artistic depiction" label already
 * used for person portraits of this kind (see `PortraitPanel`).
 */
export interface FeaturedEvent {
  id: string
  eraKey: EraKey
  badge: LocalizedText
  title: LocalizedText
  text: LocalizedText
  /** Path under `public/`. */
  image: string
}

export const featuredEvents: FeaturedEvent[] = [
  {
    id: 'botai-settlement', // sourceId: timeline.ts
    eraKey: 'ancient',
    badge: { kz: 'б.з.д. 3700–3100', ru: '3700–3100 до н.э.' },
    title: { kz: 'Ботай қонысы', ru: 'Поселение Ботай' },
    text: {
      kz: 'Солтүстік Қазақстандағы Иманбұрлық өзені бойындағы қоныс — жер бетіндегі жылқыны қолға үйретудің ең ерте айғағы, шамамен 5500–6000 жыл бұрын.',
      ru: 'Поселение на реке Иман-Бурлук в Северном Казахстане — древнейшее на Земле свидетельство одомашнивания лошади, около 5500–6000 лет назад.',
    },
    image: '/history-events/ancient.webp',
  },
  {
    id: 'golden-man', // sourceId: timeline.ts
    eraKey: 'saka',
    badge: { kz: 'б.з.д. V–IV ғ.', ru: 'V–IV вв. до н.э.' },
    title: { kz: '«Алтын адам»', ru: '«Золотой человек»' },
    text: {
      kz: 'Есік қорғаны әлемге әйгілі «Алтын адамды» — 4000 алтын пластинадан жасалған сауыттағы жауынгерді сыйлады.',
      ru: 'Курган Иссык дал миру знаменитого «Золотого человека» — воина в доспехах из 4000 золотых пластин.',
    },
    image: '/history-events/saka.webp',
  },
  {
    id: 'turkic-kaganate', // sourceId: timeline.ts
    eraKey: 'turkic',
    badge: { kz: '552', ru: '552' },
    title: { kz: 'Түрік қағанаты', ru: 'Тюркский каганат' },
    text: {
      kz: 'Бумын қаған бастаған Түрік қағанаты құрылып, дала жолдары біріктірілді.',
      ru: 'Бумын-каган основал Тюркский каганат, объединивший степные пути от Алтая до Каспия.',
    },
    image: '/history-events/turkic.webp',
  },
  {
    id: 'karakhanid-islam', // sourceId: timeline.ts
    eraKey: 'golden',
    badge: { kz: '942/960', ru: '942/960' },
    title: {
      kz: 'Қарахан мемлекеті және ислам',
      ru: 'Караханидское государство и ислам',
    },
    text: {
      kz: 'Сатұқ Боғрахан 942 жылы Баласағұнды алып, қаған атанды. Ұлы Мұса тұсында, 960 жылы, ислам мемлекеттік дін болып жарияланды.',
      ru: 'Сатук Богра-хан в 942 году взял Баласагун и провозгласил себя каганом. При его сыне Мусе, в 960 году, ислам был объявлен государственной религией.',
    },
    image: '/history-events/golden.webp',
  },
  {
    id: 'ulus-jochi-1243', // sourceId: timeline.ts
    eraKey: 'goldenHorde',
    badge: { kz: '1243', ru: '1243' },
    title: { kz: 'Жошы ұлысы (Алтын Орда)', ru: 'Улус Джучи (Золотая Орда)' },
    text: {
      kz: 'Бату Еділдің төменгі ағысында мемлекет құрды. Ертістің жоғарғы ағысынан Алакөлге, батысында Іле мен Сырдарияға дейінгі дала оның құрамына кірді — кейінгі қазақ мемлекеттілігінің іргетасы.',
      ru: 'Бату основал государство в низовьях Волги. Степи от верхнего Иртыша до Алаколя и на запад до Или и Сырдарьи вошли в его состав — основа будущей казахской государственности.',
    },
    image: '/history-events/goldenHorde.webp',
  },
  {
    id: 'khanate-1465', // sourceId: timeline.ts
    eraKey: 'khanate',
    badge: { kz: '1465', ru: '1465' },
    title: { kz: 'Қазақ хандығы', ru: 'Казахское ханство' },
    text: {
      kz: 'Керей мен Жәнібек Шу аңғарында хандық құрды — қазақ мемлекеттілігінің бастауы.',
      ru: 'Керей и Жанибек основали ханство в долине Чу — точка отсчёта казахской государственности.',
    },
    image: '/history-events/khanate.webp',
  },
  {
    id: 'junior-zhuz-1731', // sourceId: timeline.ts
    eraKey: 'modern',
    badge: { kz: '1731', ru: '1731' },
    title: {
      kz: 'Кіші жүздің Ресей қол астына өтуі',
      ru: 'Младший жуз под властью России',
    },
    text: {
      kz: 'Анна Иоанновна 19 ақпанда (2 наурызда) грамотаға қол қойды, ал 10 (21) қазанда Әбілқайыр мен Кіші жүз ақсақалдарының көпшілігі ант берді — Ресей империясының құрамына енудің басы.',
      ru: 'Анна Иоанновна подписала грамоту 19 февраля (2 марта), а 10 (21) октября Абулхаир и большинство старшин Младшего жуза принесли присягу — начало вхождения в состав Российской империи.',
    },
    image: '/history-events/modern.webp',
  },
  {
    id: 'alash-autonomy-1917', // sourceId: timeline.ts
    eraKey: 'alash',
    badge: { kz: '1917 ж. 5–13 желтоқсан', ru: '5–13 декабря 1917' },
    title: { kz: 'Алаш автономиясы', ru: 'Алашская автономия' },
    text: {
      kz: 'Орынбордағы Екінші жалпықазақ съезі Алаш автономиясын жариялап, Әлихан Бөкейхан бастаған Алашорда үкіметін құрды.',
      ru: 'Второй Всеказахский съезд в Оренбурге провозгласил автономию Алаш и сформировал правительство Алашорда во главе с Алиханом Бокейханом.',
    },
    image: '/history-events/alash.webp',
  },
  {
    id: 'virgin-lands-1954', // sourceId: timeline.ts
    eraKey: 'soviet',
    badge: { kz: '1954–1960', ru: '1954–1960' },
    title: { kz: 'Тың игеру', ru: 'Освоение целины' },
    text: {
      kz: '1954 жылғы 2 наурыздағы КОКП пленумының қаулысы тың даланы жыртуды бастады. Тек Қазақстанда 25 миллион гектардан астам жер игерілді.',
      ru: 'Постановление пленума ЦК КПСС от 2 марта 1954 года начало распашку целинных степей. Только в Казахстане подняли более 25 миллионов гектаров.',
    },
    image: '/history-events/soviet.webp',
  },
  {
    id: 'independence-1991', // sourceId: timeline.ts
    eraKey: 'independence',
    badge: { kz: '16.12.1991', ru: '16.12.1991' },
    title: { kz: 'Қазақстанның тәуелсіздігі', ru: 'Независимость Казахстана' },
    text: {
      kz: 'Қазақстан — тәуелсіздігін жариялаған КСРО-ның соңғы республикасы.',
      ru: 'Казахстан — последняя республика СССР, провозгласившая независимость.',
    },
    image: '/history-events/independence.webp',
  },
]

/**
 * Deterministic daily rotation: every visitor sees the same card on the same
 * calendar day (no per-load randomness), and it takes `featuredEvents.length`
 * days to loop back to a repeat.
 */
export function todaysFeaturedEvent(date: Date = new Date()): FeaturedEvent {
  const start = new Date(date.getFullYear(), 0, 0)
  const dayOfYear = Math.floor((date.getTime() - start.getTime()) / 86_400_000)
  return featuredEvents[dayOfYear % featuredEvents.length]
}
