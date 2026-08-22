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
    battle: { kz: 'Батл', ru: 'Батл' },
    profile: { kz: 'Профиль', ru: 'Профиль' },
    openMenu: { kz: 'Мәзірді ашу', ru: 'Открыть меню' },
    closeMenu: { kz: 'Мәзірді жабу', ru: 'Закрыть меню' },
    menuTitle: { kz: 'Негізгі мәзір', ru: 'Главное меню' },
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
    seeLess: { kz: 'Жасыру', ru: 'Свернуть' },
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
    /** Step between parts inside one lesson — not the previous/next lesson. */
    prevPart: { kz: 'Алдыңғы', ru: 'Назад' },
    nextPart: { kz: 'Келесі', ru: 'Далее' },
    /** The stepper's extra last chip — a flag icon, not a number, on purpose. */
    finalStep: { kz: 'Қорытынды тест', ru: 'Итоговый тест' },

    /** The in-lesson "explain simpler" AI hint — see src/lib/ai.ts's explainSection. */
    explainButton: { kz: 'Түсіндіріп бер', ru: 'Объясни проще' },
    explainLoading: { kz: 'Түсіндіріп жатыр…', ru: 'Объясняю…' },
    explainLabel: { kz: 'ИИ түсіндірмесі', ru: 'Объяснение ИИ' },
    explainError: {
      kz: 'Түсіндіріп болмады. Тағы байқап көріңіз.',
      ru: 'Не получилось объяснить. Попробуйте ещё раз.',
    },
    explainClose: { kz: 'Жасыру', ru: 'Скрыть' },

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

  /** 1v1 duels (`/battle`) — casual, ranked, and the weekly board under them. */
  battle: {
    title: { kz: 'Батл', ru: 'Батл' },
    subtitle: {
      kz: 'Қазақстан тарихынан 1×1 жекпе-жек',
      ru: 'Дуэль 1×1 по истории Казахстана',
    },

    modeCasual: { kz: 'Қарапайым', ru: 'Обычный' },
    modeCasualSub: {
      kz: 'Жаттығу, рейтингке әсер етпейді',
      ru: 'Тренировка, без риска для рейтинга',
    },
    modeRanked: { kz: 'Рейтинг', ru: 'Рейтинг' },
    modeRankedSub: {
      kz: 'Нәтиже рейтингіңді өзгертеді',
      ru: 'Результат меняет твой рейтинг',
    },
    modeKahoot: { kz: 'Кахут', ru: 'Кахут' },
    modeKahootSub: {
      kz: 'Мұғалім өз сұрақтарын жасайды',
      ru: 'Учитель создаёт свою игру',
    },

    casualHint: {
      kz: '3 раунд, 9 сұрақ. Дұрыс әрі жылдам жауап — көбірек XP. Рейтингке әсер етпейді.',
      ru: '3 раунда, 9 вопросов. За правильный и быстрый ответ — больше XP. Без риска для рейтинга.',
    },
    rankedHint: {
      kz: '3 раунд, 9 сұрақ. Нәтиже рейтингіңді өзгертеді және апталық кестеге түседі.',
      ru: '3 раунда, 9 вопросов. Результат меняет твой рейтинг и попадает в недельную таблицу.',
    },

    find: { kz: 'Қарсылас табу', ru: 'Найти соперника' },
    searching: { kz: 'Кезектен қарсылас іздеудеміз…', ru: 'Ищем соперника в очереди…' },
    searchingHint: {
      kz: 'Дәл қазір ешкім кезекте болмаса, күте тұрыңыз — біреу қосылғанда бірден бастаймыз.',
      ru: 'Если сейчас в очереди никого нет — подождите: как только кто-то зайдёт, батл начнётся сразу.',
    },
    /* --------------------------- the bot opponent --------------------------- */

    /** Chip on the bot's own side of the duel head, its result and its history
     *  row. Short on purpose — it has to fit under a name without wrapping. */
    botLabel: { kz: 'Бот', ru: 'Бот' },
    /** Offered from the casual search once the queue turns out to be empty. */
    botOfferTitle: { kz: 'Кезекте әзірге ешкім жоқ', ru: 'В очереди пока никого нет' },
    botOfferText: {
      kz: 'Ботпен ойнауға болады. Ол — нағыз ойыншы емес, бірақ сұрақтар мен XP нағыз.',
      ru: 'Можно сыграть с ботом. Это не живой игрок, но вопросы и XP настоящие.',
    },
    botOfferAction: { kz: 'Ботпен ойнау', ru: 'Играть с ботом' },
    /** Says plainly that waiting longer will start the bot duel by itself. */
    botOfferAuto: {
      kz: 'Ешкім табылмаса, бот ойыны өзі басталады.',
      ru: 'Если никто не найдётся, бой с ботом начнётся сам.',
    },
    /** On the result screen, so a win or a loss is never mistaken for a real one. */
    botResultNote: {
      kz: 'Бұл бот — нағыз ойыншы емес. Рейтингке әсер етпейді.',
      ru: 'Это был бот, а не живой игрок. На рейтинг не влияет.',
    },

    /* ------------------------ the opponent who left ------------------------ */

    /**
     * The stamp slammed over the opponent's face once their heartbeat has gone
     * quiet (see `PRESENCE_STALE_MS` in `src/lib/battle.ts`). Left in Latin in
     * both languages on purpose: "AFK" is what players of this age already read
     * it as, and it is short enough to sit inside a 56px avatar.
     */
    afkStamp: { kz: 'AFK', ru: 'AFK' },
    afkTitle: { kz: 'Қарсылас жауап бермей тұр', ru: 'Соперник не отвечает' },
    afkText: {
      kz: 'Ол бірнеше секунд бойы белгі бермеді. Егер оралмаса, ұрыс жуық арада өзі аяқталады да, жеңіс сізге беріледі.',
      ru: 'Он не подаёт признаков жизни уже несколько секунд. Если не вернётся, бой скоро завершится сам, и победа будет засчитана вам.',
    },
    /** On the result screen, so the win is never taken for an ordinary one. */
    afkResultNote: {
      kz: 'Қарсылас ұрысты тастап кетті, сондықтан жекпе-жек мерзімінен бұрын аяқталды.',
      ru: 'Соперник покинул бой, поэтому дуэль была завершена досрочно.',
    },
    /** Replaces the "Победа" chip on the history row this duel leaves behind. */
    afkHistoryLabel: { kz: 'Қарсылас жауап бермеді', ru: 'Соперник не отвечал' },
    /** What the player who walked away sees if they come back to a closed duel. */
    afkEndedTitle: { kz: 'Бұл ұрыс аяқталған', ru: 'Этот бой уже завершён' },
    afkEndedText: {
      kz: 'Сіз жауап бермей тұрғанда қарсылас ұрысты жапты. Жаңа қарсылас іздеп көріңіз.',
      ru: 'Пока вы не отвечали, соперник закрыл бой. Попробуйте найти нового соперника.',
    },

    /** Neutral label for the player themselves, above their own avatar. */
    you: { kz: 'Сен', ru: 'Ты' },
    opponent: { kz: 'Қарсылас', ru: 'Соперник' },
    /** Short level chip, e.g. "Дең. 23" / "Ур. 23". */
    levelShort: { kz: 'Дең.', ru: 'Ур.' },
    question: { kz: 'Сұрақ', ru: 'Вопрос' },
    /** Shown while this player has finished but the opponent hasn't. */
    waiting: { kz: 'Қарсылас аяқтағанша күтудеміз…', ru: 'Ждём, пока соперник закончит…' },

    win: { kz: 'Жеңіс', ru: 'Победа' },
    lose: { kz: 'Жеңіліс', ru: 'Поражение' },
    winText: {
      kz: 'Қарсыласыңнан көп XP жинадың.',
      ru: 'Ты набрал больше XP, чем соперник.',
    },
    loseText: {
      kz: 'Бұл жолы қарсылас жылдамырақ болды.',
      ru: 'В этот раз соперник оказался быстрее.',
    },
    xpEarned: { kz: 'XP жиналды', ru: 'XP получено' },
    opponentXp: { kz: 'қарсыластың XP', ru: 'XP соперника' },
    ratingDelta: { kz: 'батл рейтингі', ru: 'рейтинг батла' },
    noRating: { kz: 'рейтингсіз', ru: 'без рейтинга' },
    again: { kz: 'Тағы бір раунд', ru: 'Ещё раунд' },

    boardTitle: { kz: 'Апталық рейтинг', ru: 'Рейтинг недели' },
    boardHint: {
      kz: 'Тек рейтингтік батлдардың XP-і. Дүйсенбіде нөлден басталады.',
      ru: 'Только XP рейтинговых батлов. Обнуляется каждый понедельник.',
    },
    boardEmpty: {
      kz: 'Бұл аптада әзірге ешкім рейтингтік батл ойнаған жоқ. Бірінші болыңыз.',
      ru: 'На этой неделе рейтинговых батлов ещё не было. Станьте первым.',
    },
    boardYou: { kz: 'бұл сен', ru: 'это ты' },
    boardPosition: { kz: 'Сенің орның', ru: 'Твоя позиция' },
    boardPositionHint: {
      kz: 'Топ-10-ға кіру үшін көбірек рейтингтік батл ұтыңыз.',
      ru: 'Выигрывай больше рейтинговых батлов, чтобы попасть в топ-10.',
    },
    weekEndsIn: { kz: 'Апта аяқталады:', ru: 'Неделя заканчивается:' },
    dayShort: { kz: 'күн', ru: 'дн' },
    hourShort: { kz: 'сағ', ru: 'ч' },

    weeklyTopBadge: { kz: 'Апта топ-10', ru: 'Топ-10 недели' },
    weeklyTopBadgeHint: {
      kz: 'Осы апта рейтингтік батлда топ-10-дасың — апта сайын қайта есептеледі.',
      ru: 'Ты в топ-10 рейтинговых батлов на этой неделе — обновляется каждую неделю.',
    },

    roundLabel: { kz: 'Раунд', ru: 'Раунд' },
    roundLight: { kz: 'Жеңіл', ru: 'Лёгкий' },
    roundMedium: { kz: 'Орташа', ru: 'Средний' },
    roundHard: { kz: 'ЕНТ деңгейі', ru: 'Уровень ЕНТ' },

    statDuels: { kz: 'Дуэль', ru: 'Дуэли' },
    statWinRate: { kz: 'Жеңіс %', ru: '% побед' },
    statStreak: { kz: 'Серия', ru: 'Серия побед' },

    recentTitle: { kz: 'Соңғы дуэльдер', ru: 'Последние дуэли' },
    recentEmpty: {
      kz: 'Әзірге дуэль болған жоқ. Бірінші ұрысты бастаңыз!',
      ru: 'Дуэлей ещё не было. Начните первый бой!',
    },
    recentWin: { kz: 'Жеңіс', ru: 'Победа' },
    recentLose: { kz: 'Жеңіліс', ru: 'Поражение' },

    ratingLabel: { kz: 'Батл рейтингі', ru: 'Боевой рейтинг' },
    ratingPoints: { kz: 'ұпай', ru: 'очков' },
    nextTier: { kz: 'Келесі дәрежеге дейін', ru: 'До следующей лиги' },
    maxTier: { kz: 'Ең жоғарғы дәреже!', ru: 'Высшая лига!' },

    /* ------------------------ the hub (`/battle`) ------------------------ */

    /** Sits over the mode picker once there is real standing to show above it. */
    hubModes: { kz: 'Режимді таңдаңыз', ru: 'Выберите режим' },
    /** Empty state on the hub for an account that has never duelled. */
    hubNoPlay: {
      kz: 'Әзірге бірде-бір батл өткізген жоқсыз. Қарапайымнан бастаңыз — рейтингке әсер етпейді.',
      ru: 'Вы ещё не провели ни одного батла. Начните с обычного — он не влияет на рейтинг.',
    },
    /**
     * Per-mode summary line on the hub's mode cards, read as
     * "Дуэлей: 7 · 57% побед". Deliberately a label followed by the number
     * rather than a number followed by a noun: Russian would need three
     * plural forms for the latter ("1 дуэль", "2 дуэли", "5 дуэлей"), and
     * this reads correctly for every count in both languages.
     */
    hubDuelsLabel: { kz: 'Дуэль', ru: 'Дуэлей' },
    hubWinsLabel: { kz: 'жеңіс', ru: 'побед' },
    hubNeverPlayed: { kz: 'әлі ойналмаған', ru: 'ещё не играли' },

    /* --------------------- the rating, explained --------------------- */

    /** Heading over the plain-language rating rules on the league card. */
    ratingHow: { kz: 'Рейтинг қалай саналады', ru: 'Как считается рейтинг' },
    /** Follows the `+18` / `−9` numbers, so both read as one sentence. */
    ratingPerWin: { kz: 'жеңіске', ru: 'за победу' },
    ratingPerLoss: { kz: 'жеңіліске', ru: 'за поражение' },
    /** Says plainly that the rating cannot go negative. */
    ratingFloor: {
      kz: 'Рейтинг ешқашан нөлден төмен түспейді.',
      ru: 'Рейтинг никогда не опускается ниже нуля.',
    },
    /** Тhe league the rating currently sits in. */
    leagueLabel: { kz: 'Лига', ru: 'Лига' },
    /** Celebration on the result screen when the duel moved the player up a league. */
    leagueUp: { kz: 'Жаңа лига!', ru: 'Новая лига!' },
    leagueUpText: {
      kz: 'Рейтингіңіз келесі лигаға жетті.',
      ru: 'Ваш рейтинг дорос до следующей лиги.',
    },
    /** Label under the was → is rating pair on the result screen. */
    ratingMoved: { kz: 'Рейтинг', ru: 'Рейтинг' },
    ratingUnchanged: { kz: 'өзгерген жоқ', ru: 'без изменений' },

    /* ------------------ personal history / the two boards ------------------ */

    /** Segmented control over the ranked screen's two lists. */
    tabHistory: { kz: 'Менің матчтарым', ru: 'Мои матчи' },
    tabBoard: { kz: 'Апта кестесі', ru: 'Таблица недели' },
    historyEmpty: {
      kz: 'Рейтингтік матчтар әлі жоқ. Бірінші дуэльден кейін осында тарихыңыз шығады.',
      ru: 'Рейтинговых матчей пока нет. После первой дуэли здесь появится ваша история.',
    },
    /** Screen-reader name for the avatar-vs-avatar history row. */
    historyRowLabel: { kz: 'Дуэль нәтижесі', ru: 'Результат дуэли' },
    /** Heading over the win/loss dots. */
    formTitle: { kz: 'Соңғы нәтижелер', ru: 'Последние результаты' },
    /** The score line between the two avatars, e.g. "324 : 288". */
    scoreLabel: { kz: 'Есеп', ru: 'Счёт' },

    /* --------------------------- relative time --------------------------- */

    timeNow: { kz: 'жаңа ғана', ru: 'только что' },
    /** Follows a number + unit, e.g. "2 сағ бұрын" / "2 ч назад". */
    timeAgo: { kz: 'бұрын', ru: 'назад' },
    minShort: { kz: 'мин', ru: 'мин' },

    unavailable: {
      kz: 'Батл әзірге қолжетімсіз: желі немесе сервер қосылымы жоқ.',
      ru: 'Батл сейчас недоступен: нет подключения к серверу.',
    },
  },

  /**
   * The teacher-hosted live quiz (`/battle/kahoot`): a teacher writes their own
   * questions, publishes the game, reads out the join code, and the whole class
   * answers together. See src/lib/kahoot.ts.
   */
  kahoot: {
    title: { kz: 'Кахут', ru: 'Кахут' },
    subtitle: {
      kz: 'Мұғалім ойын жасайды, оқушылар кодпен қосылады',
      ru: 'Учитель создаёт игру, ученики заходят по коду',
    },
    roleTeacher: { kz: 'Мен мұғаліммін', ru: 'Я учитель' },
    roleTeacherSub: {
      kz: 'Ойын жаса, сыныпқа кодпен ұсын',
      ru: 'Создаёшь игру, запускаешь для класса',
    },
    roleStudent: { kz: 'Мен оқушымын', ru: 'Я ученик' },
    roleStudentSub: {
      kz: 'Кодпен қосыл, ойында ойна',
      ru: 'Вводишь код, играешь вместе с классом',
    },

    /* ------------------------- the teacher's games ------------------------- */

    myGames: { kz: 'Менің ойындарым', ru: 'Мои игры' },
    newGame: { kz: 'Ойын жасау', ru: 'Создать игру' },
    gamesEmpty: {
      kz: 'Әзірге ойын жоқ. Бірінші ойыныңызды жасаңыз.',
      ru: 'Игр пока нет. Создайте первую.',
    },
    /** Follows a number, e.g. "5 сұрақ" / "5 вопросов". */
    questionsCount: { kz: 'сұрақ', ru: 'вопросов' },
    edit: { kz: 'Өңдеу', ru: 'Изменить' },
    remove: { kz: 'Өшіру', ru: 'Удалить' },
    launch: { kz: 'Ойынды бастау', ru: 'Запустить игру' },

    /* ---------------------------- writing a game ---------------------------- */

    createTitle: { kz: 'Жаңа ойын', ru: 'Новая игра' },
    editTitle: { kz: 'Ойынды өңдеу', ru: 'Редактирование игры' },
    gameTitleLabel: { kz: 'Ойын атауы', ru: 'Название игры' },
    gameTitlePlaceholder: {
      kz: 'Мысалы: Алтын Орда — 7 сынып',
      ru: 'Например: Алтын Орда — 7 класс',
    },
    questionsLabel: { kz: 'Сұрақтар', ru: 'Вопросы' },
    questionPlaceholder: { kz: 'Сұрақ мәтіні', ru: 'Текст вопроса' },
    /** Follows a number, e.g. "Нұсқа 3" / "Вариант 3". */
    optionLabel: { kz: 'Нұсқа', ru: 'Вариант' },
    correctHint: { kz: 'Дұрыс жауапты белгілеңіз', ru: 'Отметьте правильный ответ' },
    /** Screen-reader label on the radio that marks an option correct. */
    markCorrect: { kz: 'Дұрыс жауап деп белгілеу', ru: 'Отметить как правильный' },
    addQuestion: { kz: 'Сұрақ қосу', ru: 'Добавить вопрос' },
    removeQuestion: { kz: 'Сұрақты өшіру', ru: 'Удалить вопрос' },
    photoAdd: { kz: 'Фото', ru: 'Фото' },
    photoRemove: { kz: 'Фотоны өшіру', ru: 'Удалить фото' },
    photoFailed: {
      kz: 'Фото жүктелмеді. Сұрақты фотосыз да сақтауға болады.',
      ru: 'Фото не загрузилось. Вопрос можно сохранить и без него.',
    },
    photoTooBig: {
      kz: 'Фото тым үлкен — 5 МБ дейін болсын.',
      ru: 'Фото слишком большое — до 5 МБ.',
    },
    /** Under the empty photo square — the click-to-browse picker also takes a drag or a paste. */
    photoDropHint: {
      kz: 'Немесе фотоны осы жерге сүйреңіз, не Ctrl+V арқылы қойыңыз',
      ru: 'Или перетащи фото сюда, или вставь через Ctrl+V',
    },
    publish: { kz: 'Жариялау', ru: 'Опубликовать' },
    saveFailed: {
      kz: 'Ойын сақталмады. Қайталап көріңіз.',
      ru: 'Игру не удалось сохранить. Попробуйте ещё раз.',
    },

    /**
     * Why a game can't be published yet. The per-question ones are shown after
     * the question's own number, e.g. "Сұрақ 2: сұрақ мәтінін жазыңыз".
     */
    flawTitle: { kz: 'Ойын атауын жазыңыз', ru: 'Впишите название игры' },
    flawNoQuestions: {
      kz: 'Кемінде бір сұрақ қосыңыз',
      ru: 'Добавьте хотя бы один вопрос',
    },
    flawText: { kz: 'сұрақ мәтінін жазыңыз', ru: 'впишите текст вопроса' },
    flawOptions: {
      kz: 'төрт нұсқаны да толтырыңыз',
      ru: 'заполните все четыре варианта',
    },
    flawCorrect: { kz: 'дұрыс жауапты белгілеңіз', ru: 'отметьте правильный ответ' },

    /* ------------------------------- hosting ------------------------------- */

    hostTitle: { kz: 'Ойынды жүргізу', ru: 'Ведём игру' },
    codeLabel: { kz: 'Ойын коды', ru: 'Код игры' },
    codeHint: {
      kz: 'Кодты тақтаға жазыңыз — оқушылар осы кодпен кіреді.',
      ru: 'Напишите код на доске — ученики заходят по нему.',
    },
    /** Rendered as "Қосылған оқушылар: 12" / "Подключилось учеников: 12". */
    joinedLabel: { kz: 'Қосылған оқушылар', ru: 'Подключилось учеников' },
    lobbyEmpty: { kz: 'Оқушыларды күтудеміз…', ru: 'Ждём учеников…' },
    start: { kz: 'Бастау', ru: 'Начать' },
    /** Rendered as "Жауап берді: 8 / 12" / "Ответили: 8 / 12". */
    answeredLabel: { kz: 'Жауап берді', ru: 'Ответили' },
    showAnswer: { kz: 'Жауапты көрсету', ru: 'Показать ответ' },
    next: { kz: 'Әрі қарай', ru: 'Дальше' },
    finish: { kz: 'Аяқтау', ru: 'Завершить' },
    leaderboard: { kz: 'Кесте', ru: 'Таблица' },
    finalTitle: { kz: 'Ойын аяқталды', ru: 'Игра окончена' },
    done: { kz: 'Дайын', ru: 'Готово' },
    hostNoXp: {
      kz: 'Жүргізушіге XP берілмейді — сіз жарысқа қатыспайсыз.',
      ru: 'Ведущему XP не начисляется — вы не участвуете в игре.',
    },
    roomFailed: {
      kz: 'Бөлме ашылмады. Қайталап көріңіз.',
      ru: 'Не удалось открыть комнату. Попробуйте ещё раз.',
    },

    /* ------------------------------- joining ------------------------------- */

    codeEntryLabel: { kz: 'Мұғалімнен алған код', ru: 'Код от учителя' },
    codeEntryHint: {
      kz: '6 таңбадан тұратын кодты жазыңыз.',
      ru: 'Введите код из 6 символов.',
    },
    join: { kz: 'Қосылу', ru: 'Войти' },
    joinShort: { kz: 'Код 6 таңбадан тұрады', ru: 'В коде 6 символов' },
    joinNotFound: {
      kz: 'Мұндай кодпен ойын табылмады',
      ru: 'Игра с таким кодом не найдена',
    },
    joinStarted: {
      kz: 'Ойын басталып кетті — кіру мүмкін емес',
      ru: 'Игра уже началась — войти нельзя',
    },
    joinFailed: {
      kz: 'Ойынға кіру мүмкін болмады. Қайталап көріңіз.',
      ru: 'Не удалось войти в игру. Попробуйте ещё раз.',
    },
    roomGone: {
      kz: 'Мұғалім ойынды жауып тастады.',
      ru: 'Учитель закрыл игру.',
    },

    /* ------------------------------- playing ------------------------------- */

    players: { kz: 'Ойыншылар', ru: 'Игроки' },
    waitingHost: {
      kz: 'Мұғалім бастағанша күтудеміз…',
      ru: 'Ждём, когда учитель начнёт игру…',
    },
    waitingNext: {
      kz: 'Келесі сұрақты күтудеміз…',
      ru: 'Ждём следующий вопрос…',
    },
    answerSent: { kz: 'Жауабың қабылданды', ru: 'Ответ принят' },
    timeUp: { kz: 'Уақыт бітті', ru: 'Время вышло' },
    yourScore: { kz: 'Ұпайың', ru: 'Твои очки' },
    yourPlace: { kz: 'Орның', ru: 'Твоё место' },
    xpAdded: { kz: 'XP профиліңе қосылды', ru: 'XP добавлены в профиль' },
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

    /**
     * Rank titles (see src/data/ranks.ts) — a coarser, gendered progression
     * that runs alongside `level`, on the same XP, rather than replacing it.
     */
    rankTitle: { kz: 'Атақ', ru: 'Звание' },
    rankPickTitle: { kz: 'Атақ жолын таңдаңыз', ru: 'Выберите линию званий' },
    rankMale: { kz: 'Ер', ru: 'Мужская' },
    rankFemale: { kz: 'Әйел', ru: 'Женская' },
    rankStep: { kz: 'Дәреже', ru: 'Ступень' },
    rankNext: { kz: 'Келесі атақ', ru: 'Следующее звание' },
    rankMax: { kz: 'Ең жоғары атақ', ru: 'Высшее звание' },
    rankOpensAt: { kz: 'Ашылады:', ru: 'Откроется:' },
    rankSheetTitle: { kz: 'Атақтар', ru: 'Звания' },
    rankSheetModeAvatar: { kz: 'Аватар', ru: 'Аватар' },
    rankSheetModeTitle: { kz: 'Атақ', ru: 'Звание' },
    /** Marks the tier XP has actually reached, when a lower one is on display. */
    rankReached: { kz: 'Қазір жеткен дәрежең', ru: 'Твоя текущая ступень' },
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

    genderTitle: { kz: 'Кім боласыз?', ru: 'Кем вы будете?' },
    genderText: {
      kz: 'Атақ пен аватар осыған қарай өседі — кейін профильде ауыстыруға болады',
      ru: 'От этого зависит ваш титул и аватар — образ можно будет сменить позже в профиле',
    },
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
      kz: 'Кіру әзірге қолжетімсіз: Firebase кілттері енгізілмеген. Қосылған соң қайта кіріп көріңіз.',
      ru: 'Вход пока недоступен: ключи Firebase не заданы. Попробуйте войти после их подключения.',
    },
    failed: {
      kz: 'Кіру сәтсіз аяқталды. Қайталап көріңіз.',
      ru: 'Не удалось войти. Попробуйте ещё раз.',
    },

    /* ---- the two ways in ---- */
    tabSignIn: { kz: 'Кіру', ru: 'Войти' },
    tabSignUp: { kz: 'Тіркелу', ru: 'Регистрация' },
    google: { kz: 'Google арқылы жалғастыру', ru: 'Продолжить с Google' },
    or: { kz: 'немесе', ru: 'или' },

    /* ---- email + password form ---- */
    emailLabel: { kz: 'Email', ru: 'Email' },
    emailPlaceholder: { kz: 'pochta@example.com', ru: 'pochta@example.com' },
    passwordLabel: { kz: 'Құпия сөз', ru: 'Пароль' },
    passwordPlaceholder: { kz: 'Кемінде 6 таңба', ru: 'Минимум 6 символов' },
    submitSignIn: { kz: 'Кіру', ru: 'Войти' },
    submitSignUp: { kz: 'Тіркелу', ru: 'Зарегистрироваться' },
    signingUp: { kz: 'Аккаунт жасалуда…', ru: 'Создаём аккаунт…' },

    /* ---- password reset ---- */
    forgot: {
      kz: 'Құпия сөзді ұмыттыңыз ба?',
      ru: 'Забыли пароль?',
    },
    resetHint: {
      kz: 'Поштаңызды жазыңыз — қалпына келтіру сілтемесін жібереміз.',
      ru: 'Укажите почту — пришлём ссылку для восстановления.',
    },
    resetSend: { kz: 'Сілтеме жіберу', ru: 'Отправить ссылку' },
    /* Firebase answers the same way whether or not the address has an account,
       and so does this line — it must not confirm that one exists. */
    resetSent: {
      kz: 'Егер мұндай мекенжай тіркелген болса, хат жіберілді.',
      ru: 'Письмо отправлено, если такой адрес зарегистрирован.',
    },

    /* ---- Firebase error codes, in friendly form ---- */
    errInvalidEmail: {
      kz: 'Email дұрыс жазылмаған.',
      ru: 'Неверный формат email.',
    },
    errWeakPassword: {
      kz: 'Құпия сөз кемінде 6 таңбадан тұруы керек.',
      ru: 'Пароль должен быть не короче 6 символов.',
    },
    errEmailInUse: {
      kz: 'Бұл email тіркеліп қойған. «Кіру» бөліміне өтіңіз.',
      ru: 'Этот email уже зарегистрирован. Перейдите во вкладку «Войти».',
    },
    errUserNotFound: {
      kz: 'Мұндай аккаунт табылмады. Алдымен тіркеліңіз.',
      ru: 'Аккаунт не найден. Сначала зарегистрируйтесь.',
    },
    errWrongPassword: {
      kz: 'Email не құпия сөз дұрыс емес.',
      ru: 'Неверный email или пароль.',
    },
    errTooManyRequests: {
      kz: 'Тым көп әрекет жасалды. Сәл кейінірек қайталаңыз.',
      ru: 'Слишком много попыток. Повторите чуть позже.',
    },
    /* Not the visitor's mistake: the provider is still switched off in the
       Firebase console, so say that plainly instead of blaming the input. */
    errNotAllowed: {
      kz: 'Email арқылы кіру әзірге қосылмаған.',
      ru: 'Вход по email пока не включён.',
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
