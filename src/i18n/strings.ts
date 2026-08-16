/**
 * Every user-facing UI string, in both languages.
 * Content strings (biographies, questions, …) live in src/data/.
 */
export const s = {
  appName: { kz: 'TarihHub', ru: 'TarihHub' },
  appTagline: { kz: 'Ұлы дала тарихы', ru: 'История Великой степи' },

  nav: {
    home: { kz: 'Басты бет', ru: 'Главная' },
    course: { kz: 'Курс', ru: 'Курс' },
    explore: { kz: 'Іздеу', ru: 'Поиск' },
    ai: { kz: 'AI', ru: 'AI' },
    timeline: { kz: 'Тарих', ru: 'История' },
    profile: { kz: 'Профиль', ru: 'Профиль' },
  },

  common: {
    all: { kz: 'Барлығы', ru: 'Все' },
    back: { kz: 'Артқа', ru: 'Назад' },
    close: { kz: 'Жабу', ru: 'Закрыть' },
    save: { kz: 'Сақтау', ru: 'Сохранить' },
    cancel: { kz: 'Бас тарту', ru: 'Отмена' },
    open: { kz: 'Ашу', ru: 'Открыть' },
    notFound: { kz: 'Ештеңе табылмады', ru: 'Ничего не найдено' },
    notFoundHint: {
      kz: 'Басқа сөзбен іздеп көріңіз немесе сүзгіні өзгертіңіз.',
      ru: 'Попробуйте другой запрос или измените фильтр.',
    },
    seeAll: { kz: 'Барлығын көру', ru: 'Смотреть все' },
    xp: { kz: 'XP', ru: 'XP' },
  },

  home: {
    searchPlaceholder: {
      kz: 'Қазақстан тарихынан іздеу...',
      ru: 'Поиск по истории Казахстана...',
    },
    todayTitle: { kz: 'Тарихи оқиға', ru: 'Историческое событие' },
    popularFigures: { kz: 'Танымал тұлғалар', ru: 'Популярные личности' },
    continueLearning: { kz: 'Оқуды жалғастыру', ru: 'Продолжить обучение' },
    /** Card leading into the full unit-by-unit course. */
    courseTitle: { kz: 'Толық курс', ru: 'Весь курс' },
    courseText: {
      kz: 'Барлық бөлім мен сабақ — ежелгі дәуірден бүгінге дейін, ретімен.',
      ru: 'Все разделы и уроки — от древности до наших дней, по порядку.',
    },
    courseAction: { kz: 'Курсты ашу', ru: 'Открыть курс' },
    greeting: { kz: 'Қайырлы күн', ru: 'Добрый день' },
    complete: { kz: 'аяқталды', ru: 'завершено' },
  },

  person: {
    biography: { kz: 'Өмірбаяны', ru: 'Биография' },
    born: { kz: 'Туған', ru: 'Родился' },
    died: { kz: 'Қайтыс болған', ru: 'Умер' },
    achievements: { kz: 'Ерліктері', ru: 'Достижения' },
    legacyToday: { kz: 'Бүгінде', ru: 'Сегодня' },
    chat: { kz: 'AI-мен сөйлесу', ru: 'Поговорить с AI' },
    quiz: { kz: 'Викторина', ru: 'Викторина' },
    share: { kz: 'Бөлісу', ru: 'Поделиться' },
    bookmark: { kz: 'Сақтау', ru: 'В закладки' },
    missing: { kz: 'Тұлға табылмады', ru: 'Личность не найдена' },
    relatedSites: { kz: 'Байланысты нысандар', ru: 'Связанные места' },
    /** Heading over the "other people from this era" list — the bare era name alone read as a mystery section. */
    sameEra: { kz: 'Осы дәуірден тағы', ru: 'Ещё из этой эпохи' },
    /**
     * Caption for a `portrait.kind === 'monument'` image. Worded to stay accurate for
     * every such case — statues, mausoleums, stamp artwork, miniatures and paintings —
     * so the app never implies a later depiction is a real likeness.
     */
    portraitDepiction: { kz: 'Көркем бейне', ru: 'Худож. изображение' },
    portraitDepictionFull: {
      kz: 'Көркем бейне — тұлғаның нақты бейнесі емес',
      ru: 'Художественное изображение — не прижизненный портрет',
    },
  },

  lesson: {
    missing: { kz: 'Сабақ табылмады', ru: 'Урок не найден' },
    progress: { kz: 'Оқылды', ru: 'Пройдено' },
    /**
     * Honest footnote: the content comes from the project's checked reference,
     * and disputed points stay marked as disputed inside the lesson itself.
     */
    sourceNote: {
      kz: 'Сабақ мәтіні жобаның тексерілген тарихи анықтамалығынан жазылған. Даулы деректер сол күйі даулы деп көрсетілген.',
      ru: 'Текст урока написан по проверенному историческому справочнику проекта. Спорные сведения так и помечены спорными.',
    },
    completedTitle: { kz: 'Сабақ тапсырылды', ru: 'Урок сдан' },
    /** Real best attempt at this lesson's quiz, shown as "4/5". */
    bestScore: { kz: 'Үздік нәтиже', ru: 'Лучший результат' },
    /** Sits above the quiz button: says plainly what completing a lesson takes. */
    gateNote: {
      kz: 'Сабақ тест тапсырғанда ғана есептеледі — оқып шығу жеткіліксіз.',
      ru: 'Урок засчитывается только после сдачи теста — одного прочтения мало.',
    },
    startQuiz: { kz: 'Тест тапсыру', ru: 'Пройти тест' },
    retryQuiz: { kz: 'Тестті қайталау', ru: 'Пройти тест снова' },
    /** Honest state for a lesson whose questions haven't been written yet. */
    quizNotReady: { kz: 'Тест дайындалуда', ru: 'Тест готовится' },
    quizNotReadyText: {
      kz: 'Бұл сабаққа сұрақтар әлі жазылмаған, сондықтан оны әзірге тапсырылды деп белгілеу мүмкін емес. Мәтінді оқи беріңіз — тест қосылған соң қайта кіріңіз.',
      ru: 'Вопросы к этому уроку ещё не написаны, поэтому засчитать его пока нельзя. Читайте материал — тест появится позже.',
    },
    toQuiz: { kz: 'Викторинаға өту', ru: 'Перейти к викторине' },
    toPerson: { kz: 'Тұлғаны ашу', ru: 'Открыть личность' },
    toHome: { kz: 'Басты бетке', ru: 'На главную' },
    nextLesson: { kz: 'Келесі сабақ', ru: 'Следующий урок' },

    /** Inline "check yourself" mini-quiz shown under a lesson section. */
    check: {
      title: { kz: 'Өзіңді тексер', ru: 'Проверь себя' },
      /** e.g. "Сұрақ 2 / 3" — progress inside this section's own mini-quiz. */
      counter: { kz: 'Сұрақ', ru: 'Вопрос' },
      next: { kz: 'Келесі', ru: 'Далее' },
      /** Shown once every question in this section's check has been answered. */
      done: { kz: 'Осы бөлім тексерілді', ru: 'Часть проверена' },
      /** e.g. "2 / 3 дұрыс" after finishing this section's check. */
      score: { kz: 'дұрыс', ru: 'верно' },
      retry: { kz: 'Қайталау', ru: 'Пройти ещё раз' },
    },
  },

  /** Unit-by-unit course outline (`/course`) and the lesson rows inside it. */
  course: {
    title: { kz: 'Курс бағдарламасы', ru: 'Программа курса' },
    subtitle: {
      kz: 'Бөлімдер мен сабақтар — ежелгі дәуірден бүгінге дейін',
      ru: 'Разделы и уроки — от древности до наших дней',
    },
    /** Course-wide counter under the big "7 / 62". */
    lessonsPassed: { kz: 'сабақ тапсырылды', ru: 'уроков сдано' },
    /** Per-unit counter, kept short enough to sit beside the "3 / 7". */
    unitPassed: { kz: 'тапсырылды', ru: 'сдано' },
    /**
     * Unit ordinal, wrapped around the unit number so both languages keep their
     * own word order: kz "4-бөлім", ru "Раздел 4".
     */
    unitBefore: { kz: '', ru: 'Раздел ' },
    unitAfter: { kz: '-бөлім', ru: '' },
    /** A unit whose lessons are still being written. */
    unitEmpty: {
      kz: 'Бұл бөлімнің сабақтары әзірленіп жатыр.',
      ru: 'Уроки этого раздела ещё готовятся.',
    },
    statusNew: { kz: 'Басталмаған', ru: 'Не начат' },
    statusStarted: { kz: 'Оқылып жатыр', ru: 'В процессе' },
    statusPassed: { kz: 'Тапсырылды', ru: 'Сдан' },
  },

  quiz: {
    title: { kz: 'Викторина', ru: 'Викторина' },
    counter: { kz: 'сұрақ', ru: 'вопрос' },
    next: { kz: 'Келесі сұрақ', ru: 'Следующий вопрос' },
    finish: { kz: 'Аяқтау', ru: 'Завершить' },
    correct: { kz: 'Дұрыс!', ru: 'Верно!' },
    wrong: { kz: 'Қате', ru: 'Неверно' },
    resultTitle: { kz: 'Викторина аяқталды', ru: 'Викторина завершена' },
    resultScore: { kz: 'Дұрыс жауап', ru: 'Правильных ответов' },
    xpEarned: { kz: 'XP жинадыңыз', ru: 'XP заработано' },
    toProfile: { kz: 'Профильге қайту', ru: 'Вернуться в профиль' },
    retry: { kz: 'Қайта тапсыру', ru: 'Пройти заново' },
    perfect: {
      kz: 'Керемет! Барлық сұраққа дұрыс жауап бердіңіз.',
      ru: 'Отлично! Вы ответили верно на все вопросы.',
    },
    good: {
      kz: 'Жақсы нәтиже. Тағы аздап оқысаңыз — бәрі шығады.',
      ru: 'Хороший результат. Ещё немного практики — и будет идеально.',
    },
    poor: {
      kz: 'Бастамасы жаман емес. Өмірбаяндарды оқып, қайта көріңіз.',
      ru: 'Неплохое начало. Прочитайте биографии и попробуйте снова.',
    },

    /* ---- lesson mode: the quiz that decides whether a lesson is passed ---- */

    /** Pass mark for the lesson quiz, e.g. "Өту шегі — 4/5". */
    passMark: { kz: 'Өту шегі', ru: 'Проходной балл' },
    lessonPassedTitle: { kz: 'Сабақ есептелді', ru: 'Урок засчитан' },
    lessonPassedText: {
      kz: 'Тестті тапсырдыңыз — сабақ курс бойынша өтілді деп белгіленді.',
      ru: 'Тест сдан — урок отмечен в курсе как пройденный.',
    },
    /** Failure framing: not shame, just "the mark wasn't reached yet". */
    lessonFailedTitle: { kz: 'Әзірге өту шегіне жетпеді', ru: 'Пока не хватило до проходного' },
    lessonFailedText: {
      kz: 'Талпыныс саны шектелмеген. Сабақ мәтініне оралып, әлсіз тұстарды қайта қараңыз да, тестті қайталаңыз.',
      ru: 'Попыток сколько угодно. Вернитесь к уроку, перечитайте слабые места и пройдите тест снова.',
    },
    toLesson: { kz: 'Сабаққа қайту', ru: 'Вернуться к уроку' },
    toCourse: { kz: 'Курсқа қайту', ru: 'Вернуться к курсу' },
    /** Guard for a lesson quiz with no questions written yet. */
    notReadyTitle: { kz: 'Тест әлі дайын емес', ru: 'Тест ещё не готов' },
    notReadyText: {
      kz: 'Бұл сабақтың сұрақтары әлі жазылмаған. Дайын болған соң осы жерден тапсыра аласыз.',
      ru: 'Вопросы к этому уроку ещё не написаны. Как только они появятся, тест можно будет пройти здесь.',
    },
  },

  explore: {
    title: { kz: 'Іздеу', ru: 'Поиск' },
    placeholder: {
      kz: 'Тұлға немесе оқиға іздеу...',
      ru: 'Найти личность или событие...',
    },
    resultsFound: { kz: 'нәтиже табылды', ru: 'результатов найдено' },
  },

  ai: {
    title: { kz: 'AI-мен сөйлесу', ru: 'Разговор с AI' },
    subtitle: {
      kz: 'Тарихи тұлғамен тікелей сөйлесіңіз',
      ru: 'Поговорите с исторической личностью напрямую',
    },
    choosePersona: { kz: 'Кіммен сөйлесесіз?', ru: 'С кем поговорим?' },
    inputPlaceholder: { kz: 'Сұрағыңызды жазыңыз...', ru: 'Напишите вопрос...' },
    send: { kz: 'Жіберу', ru: 'Отправить' },
    typing: { kz: 'жазып жатыр', ru: 'печатает' },
    changePersona: { kz: 'Тұлғаны ауыстыру', ru: 'Сменить личность' },
    settings: { kz: 'Баптаулар', ru: 'Настройки' },
    keyTitle: { kz: 'Gemini API кілті', ru: 'Ключ Gemini API' },
    keyDescription: {
      kz: 'Кілт тек осы браузердің жадында сақталады және Google Gemini API-ына ғана жіберіледі. Кілт болмаса, чат дайын жауаптармен жұмыс істейді.',
      ru: 'Ключ хранится только в памяти этого браузера и отправляется только в Google Gemini API. Без ключа чат работает на заранее подготовленных ответах.',
    },
    keyLink: {
      kz: 'Google AI Studio-да тегін кілт алу',
      ru: 'Получить бесплатный ключ в Google AI Studio',
    },
    keyPlaceholder: { kz: 'AIza...', ru: 'AIza...' },
    keySaved: { kz: 'Кілт сақталды', ru: 'Ключ сохранён' },
    keyRemove: { kz: 'Кілтті өшіру', ru: 'Удалить ключ' },
    offlineMode: { kz: 'Демо режим', ru: 'Демо-режим' },
    liveMode: { kz: 'Gemini қосулы', ru: 'Gemini подключён' },
    suggestions: [
      { kz: 'Өміріңіз туралы айтып беріңіз', ru: 'Расскажите о своей жизни' },
      { kz: 'Қандай қиындықтар болды?', ru: 'Какие были трудности?' },
      { kz: 'Сізден кейін не қалды?', ru: 'Что осталось после вас?' },
      { kz: 'Бүгінгі жастарға не айтасыз?', ru: 'Что скажете молодёжи сегодня?' },
    ],
    intro: {
      kz: 'Сұрағыңызды қойыңыз — жауап бірінші жақтан, тарихи деректерге сүйеніп беріледі.',
      ru: 'Задайте вопрос — ответ будет от первого лица и опираться на исторические факты.',
    },
  },

  timeline: {
    title: { kz: 'Уақыт сызығы', ru: 'Лента времени' },
    subtitle: { kz: 'Ұлы даланың 27 ғасыры', ru: '27 веков Великой степи' },
    openMap: { kz: 'Картаны ашу', ru: 'Открыть карту' },
    events: { kz: 'оқиға', ru: 'событий' },
  },

  map: {
    title: { kz: 'Қазақстан картасы', ru: 'Карта Казахстана' },
    sites: { kz: 'тарихи нысан', ru: 'исторических объектов' },
    note: {
      kz: 'Негізгі карта — қазіргі мемлекеттік шекаралар; нысандар нақты координаталары бойынша қойылған.',
      ru: 'Основа карты — современные государственные границы; объекты нанесены по реальным координатам.',
    },
    openPerson: { kz: 'Тұлғаны ашу', ru: 'Открыть личность' },
    backToTimeline: { kz: 'Уақыт сызығы', ru: 'Лента времени' },
    eraOverlay: { kz: 'Дәуір аумағы', ru: 'Территория эпохи' },
    noEra: { kz: 'Дәуірсіз', ru: 'Без эпохи' },
    approx: {
      kz: 'Шамамен: тарихи шекаралар нақты сызық болған емес.',
      ru: 'Приблизительно: исторические границы не были точными линиями.',
    },
    noTerritory: {
      kz: 'Бұл дәуір — мемлекет емес, мәдени кезең, сондықтан оның аумағы картада көрсетілмейді.',
      ru: 'Эта эпоха — культурный период, а не государство, поэтому её территория на карте не показывается.',
    },
  },

  profile: {
    title: { kz: 'Профиль', ru: 'Профиль' },
    userName: { kz: 'Ерлан', ru: 'Ерлан' },
    role: { kz: 'Тарих зерттеушісі', ru: 'Исследователь истории' },
    level: { kz: 'деңгей', ru: 'уровень' },
    levelShort: { kz: '-деңгей', ru: '-й уровень' },
    toNextLevel: { kz: '-деңгейге дейін', ru: '-го уровня осталось' },
    streak: { kz: 'күн серия', ru: 'дней подряд' },
    quizzes: { kz: 'викторина', ru: 'викторин' },
    achievements: { kz: 'жетістік', ru: 'достижений' },
    peopleExplored: { kz: 'тұлға зерттелді', ru: 'личностей изучено' },
    badgesTitle: { kz: 'Жетістіктер', ru: 'Достижения' },
    locked: { kz: 'Ашылмаған', ru: 'Не открыто' },
    settingsTitle: { kz: 'Баптаулар', ru: 'Настройки' },
    language: { kz: 'Тіл', ru: 'Язык' },
    theme: { kz: 'Тема', ru: 'Тема' },
    themeLight: { kz: 'Ашық', ru: 'Светлая' },
    themeDark: { kz: 'Қараңғы', ru: 'Тёмная' },
    /** Follows the device's own light/dark setting. */
    themeSystem: { kz: 'Жүйе', ru: 'Система' },
    account: { kz: 'Аккаунт', ru: 'Аккаунт' },
    editName: { kz: 'Атын өзгерту', ru: 'Изменить имя' },
    namePlaceholder: { kz: 'Атыңызды жазыңыз', ru: 'Введите имя' },
    save: { kz: 'Сақтау', ru: 'Сохранить' },
  },

  /** First-launch intro tour, shown once per browser before the sign-in screen. */
  onboarding: {
    skip: { kz: 'Өткізу', ru: 'Пропустить' },
    next: { kz: 'Әрі қарай', ru: 'Далее' },
    start: { kz: 'Бастау', ru: 'Начать' },
    enter: { kz: 'Кіру', ru: 'Войти' },
    slideLabel: { kz: 'Слайд', ru: 'Слайд' },

    heroTagline: {
      kz: 'Қазақстан тарихын жаңа қырынан таныңыз',
      ru: 'Откройте историю Казахстана с новой стороны',
    },
    heroCaption: {
      kz: 'AI негізіндегі тарихи білім платформасы',
      ru: 'Образовательная платформа по истории на основе AI',
    },

    exploreTitle: { kz: 'Тарихты бірге зерттейік', ru: 'Изучаем историю вместе' },
    exploreText: {
      kz: 'Қазақстанның ұлы тұлғалары мен маңызды оқиғаларын жаңа форматта үйреніңіз',
      ru: 'Изучайте великих личностей и ключевые события Казахстана в новом формате',
    },

    aiTitle: { kz: 'AI арқылы сөйлесіңіз', ru: 'Общайтесь через AI' },
    aiText: {
      kz: 'Тарихи тұлғалармен сұхбаттасып, олардың өмірі жайлы сұрақтар қойыңыз',
      ru: 'Беседуйте с историческими личностями и задавайте вопросы об их жизни',
    },
    aiBubbleUser: { kz: 'Сәлеметсіз бе, Абай!', ru: 'Здравствуйте, Абай!' },
    aiBubbleReply: {
      kz: 'Сұрағыңызды қойыңыз, шырағым.',
      ru: 'Задавай свой вопрос, дитя моё.',
    },

    learnTitle: { kz: 'Интерактивті оқыту', ru: 'Интерактивное обучение' },
    learnText: {
      kz: 'Карталар, уақыт сызығы, викториналар және қызықты тапсырмалар',
      ru: 'Карты, лента времени, викторины и увлекательные задания',
    },
    learnMap: { kz: 'Карта', ru: 'Карта' },
    learnTimeline: { kz: 'Уақыт сызығы', ru: 'Лента времени' },
    learnQuiz: { kz: 'Викторина', ru: 'Викторина' },
    learnBadges: { kz: 'Жетістіктер', ru: 'Достижения' },
  },

  /** Google sign-in screen and the account row in the profile. */
  auth: {
    title: { kz: 'TarihHub-қа кіру', ru: 'Вход в TarihHub' },
    subtitle: {
      kz: 'Кірсеңіз, прогресіңіз барлық құрылғыда сақталады.',
      ru: 'После входа ваш прогресс сохраняется на всех устройствах.',
    },
    signingIn: { kz: 'Кіру жүріп жатыр…', ru: 'Выполняется вход…' },
    notConfigured: {
      kz: 'Google арқылы кіру әзірге қолжетімсіз: Firebase кілттері енгізілмеген. Қосылған соң қайта кіріп көріңіз.',
      ru: 'Вход через Google пока недоступен: ключи Firebase не заданы. Попробуйте войти после их подключения.',
    },
    failed: {
      kz: 'Кіру сәтсіз аяқталды. Қайталап көріңіз.',
      ru: 'Не удалось войти. Попробуйте ещё раз.',
    },
    loading: { kz: 'Жүктелуде…', ru: 'Загрузка…' },
    signedInAs: { kz: 'Кірген аккаунт', ru: 'Вы вошли как' },
    syncOn: {
      kz: 'Прогресс бұлтта сақталады',
      ru: 'Прогресс сохраняется в облаке',
    },
    signOut: { kz: 'Шығу', ru: 'Выйти' },
  },

  /** "Add to Home Screen" install banner. */
  pwa: {
    installTitle: { kz: 'Қолданбаны орнату', ru: 'Установить приложение' },
    installText: {
      kz: 'TarihHub-ты негізгі экранға қосып, жылдам ашыңыз.',
      ru: 'Добавьте TarihHub на главный экран для быстрого доступа.',
    },
    installAction: { kz: 'Орнату', ru: 'Установить' },
    iosText: {
      kz: 'Орнату үшін: Бөлісу түймесін басып, «Негізгі экранға қосу» дегенді таңдаңыз.',
      ru: 'Чтобы установить: нажмите «Поделиться» и выберите «На экран «Домой»».',
    },
    dismiss: { kz: 'Жабу', ru: 'Скрыть' },
  },
}
