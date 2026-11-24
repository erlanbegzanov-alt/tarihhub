import { contextBlocks } from '../contextBlocks'
import { entQuestions } from '../entQuestions'
import type { ContextBlock, QuizQuestion, SchoolVariant } from '../types'

/**
 * School mock booklet № 93502, carried over as a fixed variant.
 *
 * The booklet came without an answer key; every key below was set here and
 * confirmed in the Esenov textbook (page in the comment above each task).
 *
 * Changes against the paper, each one deliberate:
 * - №2–7 are bank questions instead of the booklet's own, because the paper's
 *   tasks repeat booklets already on the shelf: №2 = 93504-4 (1365 battle),
 *   №3 = 93504-6 (the «Ақтабан шұбырынды» khan), №4 = 93506-2 (Sygnak 1510),
 *   №5 = 93504-7 (backing Bekmakhanov), №6 = 93006-3 (the Qarakum
 *   commander), №7 = 93504-10 (1960–70s genetics). Two of the planned picks
 *   were swapped for the slot's other candidate: №4 takes `ent-lvlc-7`
 *   because `ent-turk-7` dates the Karakitai state 1128–1213 while Esenov
 *   pp. 25–26 gives 1128–1212; №7 takes `ent-late20-1` because Esenov p. 172
 *   states the first Semey test, but nowhere the Baikonur region that
 *   `ent-late20-6` asks for.
 * - №8 and №9: the stems are motion-blurred on this scan; their text is taken
 *   from the same items printed cleanly in booklet 93503 (№2, №3).
 *   №9 option A is a misprint, «В.Левшин»; the scholar is А. И. Левшин.
 * - №10: the paper asked for «the city of the first new-method schools»
 *   without a territory, and Ufa and Tashkent had such schools too. The stem
 *   now says «Қазақстан аумағында»; the key (Түркістан) is Esenov's own,
 *   p. 268 №14. Options unchanged.
 * - Context 1 (№11–15) was three photos, the same context with the same five
 *   tasks as 93504's context 2; it is replaced by `ctx-zhargy` (Тәуке and the
 *   council of biys), ids re-stamped to this booklet's task numbers.
 * - Context 2 (№16–20) was Бақытжан Қаратаев, the same context and tasks as
 *   93506's context 2; it is replaced by a NEW person block of three people
 *   with numbered descriptions: 1 Амангелді Иманов, 2 Тұрар Рысқұлов,
 *   3 Қайрат Рысқұлбеков. All three have our real-likeness picture beside
 *   their description. No task repeats `ctx-1916` (93710), Қаратаев's famine
 *   item (93506-19) or the cause of December 1986.
 */

const CATEGORY = {
  kz: 'Қазақстан тарихы',
  ru: 'История Казахстана',
}

const bank = (id: string): QuizQuestion => {
  const q = entQuestions.find((x) => x.id === id)
  if (!q) throw new Error(id)
  return q
}

const block = (id: string): ContextBlock => {
  const b = contextBlocks.find((x) => x.id === id)
  if (!b) throw new Error(id)
  return b
}

const standalone: QuizQuestion[] = [
  // Esenov p. 221: the Saka queen Zarina waged war and founded several
  // cities; Tomiris led the war against the Persians. p. 26: Tabuyan, widow
  // of Yelü Dashi, took power among the Karakitai after 1143.
  {
    id: 'sch-93502-1',
    topicId: 2,
    level: 'A',
    pattern: 'P2',
    category: CATEGORY,
    question: {
      kz: 'Жаулап алушылықпен қатар жаңа қалалардың негізін қалаған:',
      ru: 'Наряду с завоеваниями основание новых городов связано с именем:',
    },
    options: [
      { id: 'a', label: { kz: 'Зарина', ru: 'Зарина' } },
      { id: 'b', label: { kz: 'Иле', ru: 'Иле' } },
      { id: 'c', label: { kz: 'Томирис', ru: 'Томирис' } },
      { id: 'd', label: { kz: 'Табуян', ru: 'Табуян' } },
    ],
    correctId: 'a',
    explanation: {
      kz: 'Аңыздар бойынша сақ патшайымы Зарина қарсыластарымен соғысып қана қоймай, бірнеше қаланың негізін қалаған. Тұзақ — Томирис: ол да сақ патшайымы, бірақ парсыларға қарсы соғысымен белгілі; Табуян — XII ғасырдағы қарақытай билеушісі, Елюй Даши қайтыс болған соң билікті алған жесірі.',
      ru: 'По преданиям, сакская царица Зарина не только воевала с противниками, но и основала несколько городов. Ловушка — Томирис: тоже сакская царица, но известна войной против персов; Табуян — правительница каракитаев XII в., вдова Елюя Даши, взявшая власть после его смерти.',
    },
  },
  // Booklet №2 (1365 battle) repeats 93504-4. Key: Esenov p. 51 (Құндызша
  // 1391, Terek 1395).
  { ...bank('ent-med-5'), id: 'sch-93502-2' },
  // Booklet №3 (the «Ақтабан шұбырынды» khan) repeats 93504-6. Key: Esenov
  // p. 80 (the declared and the real purpose of the Irtysh forts, Konshin).
  { ...bank('ent-lvlc-16'), id: 'sch-93502-3' },
  // Booklet №4 (Sygnak 1510) repeats 93506-2. Key: Esenov p. 41 (Balasagun
  // opened its gates in 1218 and was called «Қайырымды қала»).
  { ...bank('ent-lvlc-7'), id: 'sch-93502-4' },
  // Booklet №5 (backing Bekmakhanov) repeats 93504-7. Key: Esenov pp. 154–155
  // (ALZHIR at Akmola, the camp for the wives of «traitors»).
  { ...bank('ent-early20-8'), id: 'sch-93502-5' },
  // Booklet №6 (the Qarakum commander) repeats 93006-3. Key: Esenov
  // pp. 96–97 (Isatai Taimanuly and Makhambet, 1836–1838).
  { ...bank('ent-xix-4'), id: 'sch-93502-6' },
  // Booklet №7 (1960–70s genetics) repeats 93504-10. Key: Esenov p. 172
  // (first test at the Semey site in 1949).
  { ...bank('ent-late20-1'), id: 'sch-93502-7' },
  // Esenov p. 64: in 1549 Haqnazar first made his name in a battle with the
  // Turkmen; the Moghuls he beat back in 1555, the Nogai Horde he raided in
  // the 1560s–70s (p. 63).
  {
    id: 'sch-93502-8',
    topicId: 13,
    level: 'A',
    pattern: 'P1',
    category: CATEGORY,
    question: {
      kz: '1549 ж. Хақназар хан соғысты:',
      ru: 'В 1549 г. хан Хакназар воевал:',
    },
    options: [
      { id: 'a', label: { kz: 'моғолдармен', ru: 'с моголами' } },
      { id: 'b', label: { kz: 'ноғайлармен', ru: 'с ногайцами' } },
      { id: 'c', label: { kz: 'түрікмендермен', ru: 'с туркменами' } },
      { id: 'd', label: { kz: 'шайбанилермен', ru: 'с шайбанидами' } },
    ],
    correctId: 'c',
    explanation: {
      kz: 'Хақназар 1549 жылы түрікмендерге қарсы шайқаста алғаш рет танылды. Тұзақ — моғолдар мен ноғайлар: олармен де соғысты, бірақ кейінірек — моғолдардың шабуылын 1555 жылы тойтарды, ал Ноғай Ордасына жорықтарды XVI ғасырдың 60–70-жылдары жасады (1549 жылы ол әлі батыстағы ноғайлардың қамқорлығында еді).',
      ru: 'В 1549 г. Хакназар впервые проявил себя в сражении с туркменами. Ловушка — моголы и ногайцы: с ними он тоже воевал, но позже — набег моголов отразил в 1555 г., а походы на Ногайскую Орду совершал в 60–70-х гг. XVI в. (в 1549 г. он ещё жил под покровительством ногайцев на западе).',
    },
  },
  // Esenov p. 100: L. Meyer, a Russian researcher of the mid-19th century,
  // wrote these words about Kenesary.
  {
    id: 'sch-93502-9',
    topicId: 27,
    level: 'A',
    pattern: 'P2',
    category: CATEGORY,
    question: {
      kz: 'XIX ғ. орта кезінде «Кенесарыға көзсіз ерлік тән еді», – деп жазған орыс зерттеушісі:',
      ru: 'Русский исследователь, написавший в середине XIX в.: «Кенесары была присуща безоглядная отвага»:',
    },
    options: [
      { id: 'a', label: { kz: 'А. Левшин', ru: 'А. Левшин' } },
      { id: 'b', label: { kz: 'П. Рычков', ru: 'П. Рычков' } },
      { id: 'c', label: { kz: 'Л. Мейер', ru: 'Л. Мейер' } },
      { id: 'd', label: { kz: 'И. Георги', ru: 'И. Георги' } },
    ],
    correctId: 'c',
    explanation: {
      kz: 'Кенесары туралы бұл сөзді XIX ғасырдың ортасындағы орыс зерттеушісі Л. Мейер жазған; ол қазақ жасағының қырғыздармен болған соңғы шайқасын да сипаттады. Тұзақ — басқа орыс авторлары: П. Рычков пен И. Георги XVIII ғасырда жазды, ал А. Левшиннің қазақ даласы туралы еңбегі 1832 жылы — көтеріліс басталмай тұрып шықты.',
      ru: 'Эти слова о Кенесары написал русский исследователь середины XIX в. Л. Мейер; он же описал последний бой казахского войска с кыргызами. Ловушка — другие русские авторы: П. Рычков и И. Георги писали в XVIII в., а труд А. Левшина о казахской степи вышел в 1832 г. — ещё до начала восстания.',
    },
  },
  // Esenov p. 117: the jadid movement and new-method schools (Gasprinsky's
  // method) appeared in the early 20th century; p. 268 №14 names Turkestan.
  {
    id: 'sch-93502-10',
    topicId: 51,
    level: 'A',
    pattern: 'P4',
    category: CATEGORY,
    question: {
      kz: 'Қазақстан аумағында алғашқы жаңа әдістемелік мектептер ашылған қала:',
      ru: 'Город, в котором открылись первые на территории Казахстана новометодные школы:',
    },
    options: [
      { id: 'a', label: { kz: 'Ташкент', ru: 'Ташкент' } },
      { id: 'b', label: { kz: 'Алматы', ru: 'Алматы' } },
      { id: 'c', label: { kz: 'Түркістан', ru: 'Туркестан' } },
      { id: 'd', label: { kz: 'Уфа', ru: 'Уфа' } },
    ],
    correctId: 'c',
    explanation: {
      kz: 'XX ғасыр басында мұсылман мектептерін реформалау қозғалысы — жәдидшілдік басталып, әдісінің негізін И. Гаспринский қалаған жаңа әдістемелік мектептер пайда болды; Қазақстан аумағында олардың алғашқылары Түркістанда ашылды. Тұзақ — Уфа мен Ташкент: жәдид мектептері онда да болды, бірақ бұл қалалар Қазақстан аумағынан тыс.',
      ru: 'В начале XX в. началось движение за реформу мусульманских школ — джадидизм, и появились новометодные школы, основы метода которых заложил И. Гаспринский; на территории Казахстана первые из них открылись в Туркестане. Ловушка — Уфа и Ташкент: джадидские школы были и там, но эти города лежат за пределами Казахстана.',
    },
  },
]

/* Context 1 (№11–15) — `ctx-zhargy` as is, replacing the booklet's three
 * photos (= 93504 context 2); only the ids are re-stamped to this booklet's
 * task numbers. Esenov pp. 69–70 (Тәуке, the council of biys at Күлтөбе near
 * Turkestan, «Жеті жарғы», Төле / Қазыбек / Әйтеке by zhuz). */
const zhargy = block('ctx-zhargy')
const ctx1: ContextBlock = {
  ...zhargy,
  id: 'sch-93502-ctx1',
  questions: zhargy.questions.map((q, i) => ({ ...q, id: `sch-93502-${11 + i}` })),
}

/* Context 2 (№16–20) — NEW, replacing the booklet's Қаратаев context
 * (= 93506 context 2). 1 Амангелді Иманов (Esenov pp. 134–135, 138),
 * 2 Тұрар Рысқұлов (pp. 134, 138, 152–153), 3 Қайрат Рысқұлбеков (p. 183).
 * The descriptions never give a name, and never print the answer of a task:
 * the grandfather's khan (17), the 1916 region of person 2 (18), Soviet power
 * (19), the 1937 charge and the 1996 title (20) are left to knowledge. */
const ctx2: ContextBlock = {
  id: 'sch-93502-ctx2',
  kind: 'person',
  topicId: 54,
  figures: [
    { n: 1, src: '/portraits/amangeldi-imanov.webp' },
    { n: 2, src: '/portraits/turar-ryskulov.webp' },
    { n: 3, src: '/portraits/kairat-ryskulbekov.webp' },
  ],
  title: {
    kz: 'Халық үшін күрескен тұлғалар',
    ru: 'Люди, боровшиеся за народ',
  },
  passage: {
    kz:
      '1. Торғай өңірінің халық батыры; атасы да батыр болған. ' +
      '1916 жылғы көтеріліс кезінде Торғай даласындағы көтерілісшілерді бастады. ' +
      'Жасағын әскери тәртіппен ұйымдастырды: сарбаздар ондық, жүздік және мыңдық болып бөлінді, ' +
      'ал шешімдерді штаб рөліндегі Әскери кеңес қабылдады. ' +
      'Серіктерінің арасында атақты мерген Кейкі батыр болды. ' +
      '1917 жылдың соңында Торғай қаласын алды.\n' +
      '2. Мемлекет және партия қайраткері. ' +
      '1933 жылы РКФСР Халық Комиссарлары Кеңесі төрағасының орынбасары қызметінде жүріп, ' +
      'Қазақстандағы ұжымдастырудың ауыр зардаптары туралы И. Сталинге хат жазды.\n' +
      '3. Жас ақын. 1986 жылғы желтоқсанда Алматыдағы жастар шеруіне қатысты. ' +
      'Оған жасақшы Савицкийдің өліміне кінәлі деген айып тағылып, өлім жазасы кесілді; ' +
      '1988 жылы бұл жаза 20 жыл бас бостандығынан айырумен ауыстырылды.',
    ru:
      '1. Народный батыр из Тургайского края; батыром был и его дед. ' +
      'Во время восстания 1916 г. возглавил повстанцев Тургайской степи. ' +
      'Свой отряд он выстроил по-военному: бойцы делились на десятки, сотни и тысячи, ' +
      'а решения принимал Военный совет, служивший штабом. ' +
      'Среди его соратников был знаменитый стрелок Кейки-батыр. ' +
      'В конце 1917 г. взял город Тургай.\n' +
      '2. Государственный и партийный деятель. ' +
      'В 1933 г., будучи заместителем председателя Совета народных комиссаров РСФСР, ' +
      'написал И. Сталину письмо о тяжёлых последствиях коллективизации в Казахстане.\n' +
      '3. Молодой поэт. В декабре 1986 г. участвовал в выступлении молодёжи в Алматы. ' +
      'Его обвинили в гибели дружинника Савицкого и приговорили к смертной казни; ' +
      'в 1988 г. приговор заменили 20 годами лишения свободы.',
  },
  questions: [
    // Esenov p. 183: Ryskulbekov was charged with the druzhinnik Savitsky's
    // death, the sentence commuted in 1988; Sypatayev and Seitembekov are
    // named among the other December participants.
    {
      id: 'sch-93502-16',
      topicId: 46,
      level: 'A',
      pattern: 'P2',
      category: CATEGORY,
      question: {
        kz: '3-тұлғаны анықтаңыз:',
        ru: 'Определите личность 3:',
      },
      options: [
        { id: 'a', label: { kz: 'Т. Рысқұлов', ru: 'Т. Рыскулов' } },
        { id: 'b', label: { kz: 'Е. Сыпатаев', ru: 'Е. Сыпатаев' } },
        { id: 'c', label: { kz: 'Қ. Рысқұлбеков', ru: 'К. Рыскулбеков' } },
        { id: 'd', label: { kz: 'О. Сейтембеков', ru: 'О. Сейтембеков' } },
      ],
      correctId: 'c',
      explanation: {
        kz: 'Желтоқсан оқиғасына қатысып, жасақшының өліміне кінәлі деп айыпталған және өлім жазасы 1988 жылы 20 жылға бас бостандығынан айырумен ауыстырылған жас ақын — Қ. Рысқұлбеков. Тұзақ — Т. Рысқұлов: тегі ұқсас, бірақ ол 1910–1930 жылдардың мемлекет қайраткері; Е. Сыпатаев пен О. Сейтембеков та Желтоқсанға қатысқан, бірақ сипаттамадағы айып пен үкім Рысқұлбековке қатысты.',
        ru: 'Молодой поэт, участник Декабрьских событий, обвинённый в гибели дружинника, которому в 1988 г. смертный приговор заменили 20 годами лишения свободы, — К. Рыскулбеков. Ловушка — Т. Рыскулов: фамилия похожа, но это государственный деятель 1910–1930-х годов; Е. Сыпатаев и О. Сейтембеков тоже были среди участников Декабря, но обвинение и приговор из описания относятся к Рыскулбекову.',
      },
    },
    // Esenov p. 135: Amangeldi Imanov was the grandson of Iman batyr, who took
    // part in Kenesary's uprising and was the khan's companion (also p. 100).
    {
      id: 'sch-93502-17',
      topicId: 27,
      level: 'B',
      pattern: 'P2',
      category: CATEGORY,
      question: {
        kz: '1-тұлғаның атасы көтерілісіне қатысып, серігі болған хан:',
        ru: 'Хан, в восстании которого участвовал и соратником которого был дед личности 1:',
      },
      options: [
        { id: 'a', label: { kz: 'Абылай', ru: 'Абылай' } },
        { id: 'b', label: { kz: 'Кенесары', ru: 'Кенесары' } },
        { id: 'c', label: { kz: 'Әбілқайыр', ru: 'Абулхаир' } },
        { id: 'd', label: { kz: 'Жәңгір', ru: 'Жангир' } },
      ],
      correctId: 'b',
      explanation: {
        kz: '1-тұлға — Амангелді Иманов: оның атасы Иман батыр Кенесары Қасымұлы көтерілісіне қатысып, ханның сенімді серігі болған. Абылай, Әбілқайыр және Жәңгір — басқа кезеңнің немесе басқа өңірдің хандары: Абылай мен Әбілқайыр XVIII ғасырда өмір сүрді, Жәңгір Бөкей Ордасын билеген.',
        ru: 'Личность 1 — Амангельды Иманов: его дед Иман-батыр участвовал в восстании Кенесары Касымова и был верным соратником хана. Абылай, Абулхаир и Жангир — ханы другого времени или другого края: Абылай и Абулхаир жили в XVIII в., Жангир правил Букеевской Ордой.',
      },
    },
    // Esenov p. 134: among the revolutionary-democratic intelligentsia in the
    // 1916 uprising, Ryskulov is listed for Zhetysu, Imanov for Torgai,
    // Mynbayev for Mangystau, Maikotov for Aktobe.
    {
      id: 'sch-93502-18',
      topicId: 34,
      level: 'A',
      pattern: 'P4',
      category: CATEGORY,
      question: {
        kz: '2-тұлға 1916 жылғы ұлт-азаттық көтеріліске қатысқан өңір:',
        ru: 'Край, в котором личность 2 участвовала в национально-освободительном восстании 1916 г.:',
      },
      options: [
        { id: 'a', label: { kz: 'Торғай', ru: 'Тургай' } },
        { id: 'b', label: { kz: 'Маңғыстау', ru: 'Мангистау' } },
        { id: 'c', label: { kz: 'Жетісу', ru: 'Жетысу (Семиречье)' } },
        { id: 'd', label: { kz: 'Ақтөбе', ru: 'Актобе' } },
      ],
      correctId: 'c',
      explanation: {
        kz: '2-тұлға — Тұрар Рысқұлов: 1916 жылғы көтеріліске қатысқан революцияшыл-демократ зиялылардың ішінде ол Жетісу өңірінде аталады. Тұзақ — Торғай: бұл 1-тұлғаның өңірі; Маңғыстау мен Ақтөбеде көтеріліске басқа қайраткерлер қатысты.',
        ru: 'Личность 2 — Турар Рыскулов: среди революционно-демократической интеллигенции, участвовавшей в восстании 1916 г., он назван в Жетысу. Ловушка — Тургай: это край личности 1; в Мангистау и Актобе в восстании участвовали другие деятели.',
      },
    },
    // Esenov p. 138: Ryskulov and A. Imanov are among the Bolsheviks who took
    // part in establishing Soviet power; p. 139: the Kokand autonomy was led
    // by M. Tynyshbayev, then M. Shokay.
    {
      id: 'sch-93502-19',
      topicId: 36,
      level: 'B',
      pattern: 'P2',
      category: CATEGORY,
      question: {
        kz: '1 және 2-тұлғаларға ортақ қызмет:',
        ru: 'Что объединяет деятельность личностей 1 и 2:',
      },
      options: [
        { id: 'a', label: { kz: '«Қазақ» газетін шығарды', ru: 'издавали газету «Қазақ»' } },
        { id: 'b', label: { kz: 'Алашорда үкіметінің құрамына кірді', ru: 'входили в правительство Алаш-Орды' } },
        {
          id: 'c',
          label: {
            kz: 'Түркістан (Қоқан) автономиясының үкіметін басқарды',
            ru: 'возглавляли правительство Туркестанской (Кокандской) автономии',
          },
        },
        { id: 'd', label: { kz: 'Кеңес өкіметін орнатуға қатысты', ru: 'участвовали в установлении советской власти' } },
      ],
      correctId: 'd',
      explanation: {
        kz: 'Иманов та, Рысқұлов та өз өңірлерінде Кеңес өкіметін орнатуға қатысқан большевиктер қатарында аталады. Қалғандары — басқа саяси күштің ісі: «Қазақ» газеті мен Алашорда — «Алаш» қайраткерлерінікі, ал Түркістан (Қоқан) автономиясын М. Тынышбаев пен М. Шоқай басқарды.',
        ru: 'И Иманов, и Рыскулов названы среди большевиков, участвовавших в установлении советской власти в своих краях. Остальное — дело другой политической силы: газета «Қазақ» и Алаш-Орда — это деятели «Алаша», а Туркестанскую (Кокандскую) автономию возглавляли М. Тынышбаев и М. Шокай.',
      },
    },
    // Esenov p. 153: Ryskulov arrested in 1937 for «pan-Turkism», shot in
    // 1938; p. 183: Ryskulbekov awarded «Халық Қаһарманы» in 1996.
    {
      id: 'sch-93502-20',
      topicId: 46,
      level: 'B',
      pattern: 'P7',
      category: CATEGORY,
      question: {
        kz:
          'Дұрыс тұжырымдарды анықтаңыз:\n' +
          'I. 2-тұлға 1937 жылы «пантүркизм» деген айыппен тұтқындалып, 1938 жылы атылды\n' +
          'II. 3-тұлғаға 1996 жылы «Халық Қаһарманы» атағы берілді\n' +
          'III. 2-тұлға 1986 жылғы Желтоқсан оқиғасына қатысқаны үшін сотталды\n' +
          'IV. 3-тұлға РКФСР Халық Комиссарлары Кеңесі төрағасының орынбасары болды',
        ru:
          'Определите верные суждения:\n' +
          'I. Личность 2 в 1937 г. была арестована по обвинению в «пантюркизме» и в 1938 г. расстреляна\n' +
          'II. Личности 3 в 1996 г. присвоено звание «Халық Қаһарманы» (Народный герой)\n' +
          'III. Личность 2 была осуждена за участие в Декабрьских событиях 1986 г.\n' +
          'IV. Личность 3 была заместителем председателя Совета народных комиссаров РСФСР',
      },
      options: [
        { id: 'a', label: { kz: 'II, III', ru: 'II, III' } },
        { id: 'b', label: { kz: 'I, IV', ru: 'I, IV' } },
        { id: 'c', label: { kz: 'I, II', ru: 'I, II' } },
        { id: 'd', label: { kz: 'III, IV', ru: 'III, IV' } },
      ],
      correctId: 'c',
      explanation: {
        kz: 'I мен II дұрыс: Рысқұлов 1937 жылы «пантүркизм» деп айыпталып, 1938 жылы атылды, ал Рысқұлбековке 1996 жылы «Халық Қаһарманы» атағы берілді. III мен IV — тектері ұқсас екі адамды ауыстырған тұзақ, оны сипаттамалардың өзі әшкерелейді: Желтоқсан бойынша сотталған — 3-тұлға, ал РКФСР ХКК төрағасының орынбасары болған — 2-тұлға.',
        ru: 'I и II верны: Рыскулов в 1937 г. был обвинён в «пантюркизме» и в 1938 г. расстрелян, а Рыскулбекову в 1996 г. присвоено звание «Халық Қаһарманы». III и IV — ловушка с подменой двух людей с похожими фамилиями, и её выдают сами описания: по Декабрю осуждён человек 3, а заместителем председателя СНК РСФСР был человек 2.',
      },
    },
  ],
}

export const v93502: SchoolVariant = {
  id: '93502',
  standalone,
  blocks: [ctx1, ctx2],
}
