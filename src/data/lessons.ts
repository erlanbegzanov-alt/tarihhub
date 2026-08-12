import type { Badge, Lesson } from './types'

/** "Оқуды жалғастыру" — lessons already started. */
export const continueLessons: Lesson[] = [
  {
    id: 'khanate-birth',
    title: {
      kz: 'Қазақ хандығының құрылуы',
      ru: 'Образование Казахского ханства',
    },
    meta: { kz: '3-сабақ · 7-бөлім', ru: 'Урок 3 · Раздел 7' },
    eraKey: 'khanate',
    progress: 62,
    duration: { kz: '14 мин', ru: '14 мин' },
    isNew: false,
  },
  {
    id: 'silk-road',
    title: { kz: 'Ұлы Жібек жолы', ru: 'Великий Шёлковый путь' },
    meta: { kz: '2-сабақ · 5-бөлім', ru: 'Урок 2 · Раздел 5' },
    eraKey: 'turkic',
    progress: 35,
    duration: { kz: '10 мин', ru: '10 мин' },
    isNew: false,
  },
  {
    id: 'abylai-era',
    title: { kz: 'Абылай хан дәуірі', ru: 'Эпоха Абылай хана' },
    meta: { kz: '4-сабақ · 6-бөлім', ru: 'Урок 4 · Раздел 6' },
    eraKey: 'khanate',
    progress: 80,
    duration: { kz: '12 мин', ru: '12 мин' },
    isNew: false,
  },
]

/** "Жаңа сабақтар" — freshly published lessons. */
export const newLessons: Lesson[] = [
  {
    id: 'golden-man-lesson',
    title: {
      kz: 'Алтын адам және сақ мәдениеті',
      ru: '«Золотой человек» и сакская культура',
    },
    meta: { kz: 'Сақ дәуірі', ru: 'Сакская эпоха' },
    eraKey: 'saka',
    progress: 0,
    duration: { kz: '12 мин · 4 бөлім', ru: '12 мин · 4 раздела' },
    isNew: true,
  },
  {
    id: 'otyrar-library',
    title: {
      kz: 'Әл-Фараби және Отырар кітапханасы',
      ru: 'Аль-Фараби и Отрарская библиотека',
    },
    meta: { kz: 'Дала ренессансы', ru: 'Ренессанс степи' },
    eraKey: 'golden',
    progress: 0,
    duration: { kz: '9 мин · 3 бөлім', ru: '9 мин · 3 раздела' },
    isNew: true,
  },
  {
    id: 'abai-words',
    title: { kz: 'Абайдың қара сөздері', ru: 'Слова назидания Абая' },
    meta: { kz: 'Жаңа заман', ru: 'Новое время' },
    eraKey: 'modern',
    progress: 0,
    duration: { kz: '15 мин · 5 бөлім', ru: '15 мин · 5 разделов' },
    isNew: true,
  },
  {
    id: 'road-to-1991',
    title: {
      kz: '1991: Тәуелсіздік жолы',
      ru: '1991: путь к независимости',
    },
    meta: { kz: 'Тәуелсіздік', ru: 'Независимость' },
    eraKey: 'independence',
    progress: 0,
    duration: { kz: '11 мин · 4 бөлім', ru: '11 мин · 4 раздела' },
    isNew: true,
  },
]

export const badges: Badge[] = [
  {
    id: 'diplomat',
    title: { kz: 'Дипломат', ru: 'Дипломат' },
    description: {
      kz: 'Абылай ханмен сөйлестіңіз',
      ru: 'Поговорили с Абылай ханом',
    },
    motif: 'crown',
    eraKey: 'khanate',
    unlocked: false,
  },
  {
    id: 'strategist',
    title: { kz: 'Стратег', ru: 'Стратег' },
    description: {
      kz: '5 викторинаны аяқтадыңыз',
      ru: 'Завершили 5 викторин',
    },
    motif: 'sword',
    eraKey: 'saka',
    unlocked: false,
  },
  {
    id: 'chronicler',
    title: { kz: 'Жылнамашы', ru: 'Летописец' },
    description: {
      kz: 'Уақыт сызығын толық қарадыңыз',
      ru: 'Просмотрели всю ленту времени',
    },
    motif: 'scroll',
    eraKey: 'golden',
    unlocked: false,
  },
  {
    id: 'explorer',
    title: { kz: 'Ізденуші', ru: 'Исследователь' },
    description: {
      kz: '10 тұлғаның өмірбаянын оқыдыңыз',
      ru: 'Прочитали биографии 10 личностей',
    },
    motif: 'compass',
    eraKey: 'turkic',
    unlocked: false,
  },
  {
    id: 'sage',
    title: { kz: 'Дала данасы', ru: 'Мудрец степи' },
    description: {
      kz: 'Викторинада 5/5 нәтиже алдыңыз',
      ru: 'Набрали 5 из 5 в викторине',
    },
    motif: 'feather',
    eraKey: 'modern',
    unlocked: false,
  },
  {
    id: 'flame',
    title: { kz: 'Отты жүрек', ru: 'Пламенное сердце' },
    description: {
      kz: '7 күн үзіліссіз оқыдыңыз',
      ru: 'Учились 7 дней подряд',
    },
    motif: 'star',
    eraKey: 'independence',
    unlocked: false,
  },
]
