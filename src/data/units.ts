import type { LocalizedText } from './types'

/**
 * Course units, in study order — the Khan Academy-style backbone for the
 * lesson system. Source: CURRICULUM_PLAN.md (already source-checked against
 * history-reference/*.md before any lesson content was written).
 *
 * A unit has no `eraKey` of its own: the Course screen borrows an accent
 * colour from the existing `eras` palette by position, purely for visual
 * variety — it isn't a claim that the whole unit belongs to that era (Unit 0
 * predates the Saka era it borrows its colour from, for instance).
 */
export interface Unit {
  id: string
  order: number
  title: LocalizedText
  summary: LocalizedText
}

export const units: Unit[] = [
  {
    id: 'unit-0',
    order: 0,
    title: { kz: 'Тас және қола дәуірі', ru: 'Каменный и бронзовый век' },
    summary: {
      kz: 'Саки пайда болғанға дейінгі Қазақстан жері: тас дәуірінің тұрақтары, Ботай мәдениеті, қола дәуірінің тайпалары.',
      ru: 'Территория Казахстана до появления саков: стоянки каменного века, Ботайская культура, племена бронзового века.',
    },
  },
  {
    id: 'unit-1',
    order: 1,
    title: { kz: 'Сақ дәуірі', ru: 'Сакская эпоха' },
    summary: {
      kz: 'Б.з.д. VIII–II ғасырлар: сақ тайпалары, аң стилі, Алтын адам, Томирис аңызы.',
      ru: 'VIII–II века до н. э.: сакские племена, звериный стиль, Золотой человек, легенда о Томирис.',
    },
  },
  {
    id: 'unit-2',
    order: 2,
    title: { kz: 'Ғұндар мен Түрік қағанаты', ru: 'Гунны и Тюркский каганат' },
    summary: {
      kz: 'Б.з.д. III ғ. — б.з. VIII ғ.: ғұндар, Түрік қағанатының құрылуы, Орхон ескерткіштері.',
      ru: 'III в. до н. э. — VIII в. н. э.: гунны, основание Тюркского каганата, Орхонские памятники.',
    },
  },
  {
    id: 'unit-3',
    order: 3,
    title: { kz: 'Дала ренессансы', ru: 'Ренессанс степи' },
    summary: {
      kz: 'IX–XIV ғасырлар: Ұлы Жібек жолы, әл-Фараби, Ясауи, мемлекеттер ауысуы, монғол шапқыншылығы, Алтын Орда.',
      ru: 'IX–XIV века: Великий Шёлковый путь, аль-Фараби, Ясави, смена государств, монгольское нашествие, Золотая Орда.',
    },
  },
  {
    id: 'unit-4',
    order: 4,
    title: { kz: 'Қазақ хандығы', ru: 'Казахское ханство' },
    summary: {
      kz: '1465 — XVIII ғасыр: хандықтың құрылуы, Тәуке хан, үш жүз, Жоңғар шапқыншылығы, Абылай хан.',
      ru: '1465 — XVIII век: образование ханства, Тауке хан, три жуза, джунгарское нашествие, Абылай хан.',
    },
  },
  {
    id: 'unit-5',
    order: 5,
    title: { kz: 'Жаңа заман', ru: 'Новое время' },
    summary: {
      kz: 'XVIII–XIX ғасырлар: Ресей империясының құрамына кіру, көтерілістер, отарлау саясаты, ағартушылық.',
      ru: 'XVIII–XIX века: вхождение в состав Российской империи, восстания, колониальная политика, просветительство.',
    },
  },
  {
    id: 'unit-6',
    order: 6,
    title: { kz: 'Алаш қозғалысы', ru: 'Движение Алаш' },
    summary: {
      kz: 'XX ғасыр басы: 1916 жылғы көтеріліс, Алаш партиясы, Алашорда үкіметі.',
      ru: 'Начало XX века: восстание 1916 года, партия Алаш, правительство Алашорды.',
    },
  },
  {
    id: 'unit-7',
    order: 7,
    title: { kz: 'Кеңес дәуірі', ru: 'Советская эпоха' },
    summary: {
      kz: '1920-1991: индустрияландыру, ұжымдастыру мен ашаршылық, соғыс, тың игеру, Желтоқсан көтерілісі.',
      ru: '1920–1991: индустриализация, коллективизация и голод, война, целина, Желтоксанское восстание.',
    },
  },
  {
    id: 'unit-8',
    order: 8,
    title: { kz: 'Тәуелсіздік', ru: 'Независимость' },
    summary: {
      kz: '1991 — біздің күндер: тәуелсіздік жариялануы, Конституция, жаңа астана, қазіргі Қазақстан.',
      ru: '1991 — наши дни: провозглашение независимости, Конституция, новая столица, современный Казахстан.',
    },
  },
]

export function getUnit(id: string | undefined): Unit | undefined {
  return units.find((unit) => unit.id === id)
}
