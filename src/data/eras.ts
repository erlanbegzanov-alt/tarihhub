import type { EraKey, LocalizedText, PersonCategory, SiteCategory } from './types'

export interface EraMeta {
  key: EraKey
  label: LocalizedText
  /** CSS custom property holding the era colour. */
  color: string
}

export const eras: Record<EraKey, EraMeta> = {
  saka: {
    key: 'saka',
    label: { kz: 'Сақ дәуірі', ru: 'Сакская эпоха' },
    color: 'var(--color-era-saka)',
  },
  turkic: {
    key: 'turkic',
    label: { kz: 'Түрік дәуірі', ru: 'Тюркская эпоха' },
    color: 'var(--color-era-turkic)',
  },
  golden: {
    key: 'golden',
    label: { kz: 'Дала ренессансы', ru: 'Ренессанс степи' },
    color: 'var(--color-era-golden)',
  },
  goldenHorde: {
    key: 'goldenHorde',
    label: { kz: 'Алтын Орда', ru: 'Золотая Орда' },
    color: 'var(--color-era-golden-horde)',
  },
  khanate: {
    key: 'khanate',
    label: { kz: 'Қазақ хандығы', ru: 'Казахское ханство' },
    color: 'var(--color-era-khanate)',
  },
  modern: {
    key: 'modern',
    label: { kz: 'Жаңа заман', ru: 'Новое время' },
    color: 'var(--color-era-modern)',
  },
  alash: {
    key: 'alash',
    label: { kz: 'Алаш қозғалысы', ru: 'Движение Алаш' },
    color: 'var(--color-era-alash)',
  },
  soviet: {
    key: 'soviet',
    label: { kz: 'Кеңес дәуірі', ru: 'Советская эпоха' },
    color: 'var(--color-era-soviet)',
  },
  independence: {
    key: 'independence',
    label: { kz: 'Тәуелсіздік', ru: 'Независимость' },
    color: 'var(--color-era-independence)',
  },
}

export function eraColor(key: EraKey): string {
  return eras[key].color
}

/** Eras offered as filter chips on the timeline screen. */
export const timelineEraKeys: EraKey[] = [
  'saka',
  'turkic',
  'golden',
  'goldenHorde',
  'khanate',
  'modern',
  'alash',
  'soviet',
  'independence',
]

export const personCategories: { key: PersonCategory; label: LocalizedText }[] = [
  { key: 'khans', label: { kz: 'Хандар', ru: 'Ханы' } },
  { key: 'batyrs', label: { kz: 'Батырлар', ru: 'Батыры' } },
  { key: 'biys', label: { kz: 'Билер', ru: 'Бии' } },
  { key: 'scholars', label: { kz: 'Ғалымдар', ru: 'Учёные' } },
  { key: 'akyns', label: { kz: 'Ақындар', ru: 'Акыны' } },
  { key: 'alash', label: { kz: 'Алаш қайраткерлері', ru: 'Деятели Алаш' } },
  { key: 'ww2', label: { kz: 'Соғыс ерлері', ru: 'Герои войны' } },
  { key: 'leaders', label: { kz: 'Мемлекет қайраткерлері', ru: 'Государственные деятели' } },
]

export const siteCategories: { key: SiteCategory; label: LocalizedText }[] = [
  { key: 'history', label: { kz: 'Тарих', ru: 'История' } },
  { key: 'culture', label: { kz: 'Мәдениет', ru: 'Культура' } },
  { key: 'science', label: { kz: 'Ғылым', ru: 'Наука' } },
]
