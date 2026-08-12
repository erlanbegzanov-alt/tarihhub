# TarihHub

Қазақстан тарихын үйренуге арналған қосымша — тарихи тұлғалармен AI арқылы
сөйлесу, викториналар, уақыт сызығы және карта. Қазақша/орысша.

Приложение для изучения истории Казахстана: разговор с историческими
личностями через AI, викторины, лента времени и карта. Казахский/русский.

## Іске қосу / Запуск

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc -b && vite build
npm run lint     # oxlint
```

## Экрандар / Экраны

| Route              | Screen                                                  |
| ------------------ | ------------------------------------------------------- |
| `/`                | Home — оқиға, тұлғалар, сабақтар                        |
| `/explore`         | Іздеу — сүзгілер + тірі іздеу (`?q=` қолдайды)          |
| `/person/:id`      | Тұлға — өмірбаян, AI чат пен викторинаға сілтеме        |
| `/quiz/:personId`  | Викторина — 5 сұрақ, +20 XP (`/quiz` — жалпы нұсқа)     |
| `/ai` `/ai/:id`    | AI чат — тұлға таңдау немесе әңгіме                      |
| `/timeline`        | Уақыт сызығы — дәуір сүзгілері                          |
| `/map`             | Карта — стильденген Қазақстан силуэті + нысандар        |
| `/profile`         | Профиль — деңгей, XP, серия, жетістіктер                |

## AI

`src/lib/ai.ts` → `askPersona(persona, history, question, lang)`.

- Кілт бар болса (`localStorage.tarihhub_gemini_key`) — Google Gemini
  `generateContent` API (`gemini-2.0-flash`) тікелей браузерден шақырылады.
- Кілт жоқ болса немесе сұрау сәтсіз болса — әр тұлғаға жазылған дайын
  жауаптармен жұмыс істейді (~700–1200 мс "жазып жатыр" кідірісімен).

Кілтті AI экранындағы ⚙️ батырмасы арқылы енгізуге болады. Кілт тек осы
браузерде сақталады.

Тегін кілтті [Google AI Studio](https://aistudio.google.com/apikey) сайтынан
алуға болады — Google аккаунты жеткілікті, карта қажет емес.

## Кіру / Вход (Firebase)

Бірінші рет ашқанда: 4 слайдтық таныстыру → кіру экраны → қосымша.
Таңдау браузерде сақталады (`tarihhub_onboarded`, `tarihhub_demo_mode`), сол
себепті қайта кіргенде бірден басты бет ашылады.

При первом открытии: интро из 4 слайдов → экран входа → приложение.

Google арқылы кіруді қосу үшін / Чтобы включить вход через Google:

```bash
cp .env.local.example .env.local   # 6 кілтті толтырыңыз / заполните 6 ключей
npm run dev                        # қайта іске қосу / перезапустить
```

Кілттер: Firebase console → Project settings → Your apps → Web app → SDK setup
and configuration. Firebase console → Authentication → Sign-in method → Google
қосулы болуы керек, ал Authorized domains тізіміне домен қосылуы тиіс.

`.env.local` болмаса — қосымша демо режимде жұмыс істейді: кіру батырмасы
өшірулі, прогресс тек `localStorage`-та. Кірген соң прогресс
`users/{uid}/profile/state` Firestore құжатымен синхрондалады.

## Құрылымы / Структура

```
src/
  data/        типтелген деректер (Person, TimelineEntry, MapSite, QuizQuestion)
  i18n/        kz/ru провайдері + барлық UI жолдары
  lib/         ai.ts, progress.ts (XP), firebase.ts, session.ts, profileSync.ts,
               motion.ts, cn.ts
  components/  AppShell (sidebar ≥768px / bottom tabs <768px), UI примитивтері
  screens/     7 экран
```

Дизайн токендері — `src/index.css` ішіндегі `@theme` блогы (Tailwind v4,
CSS-first, `tailwind.config.js` жоқ). Фотосурет қолданылмайды: барлық визуал —
CSS градиенттері, SVG және lucide иконкалары.
