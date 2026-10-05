import { AnimatePresence, motion, MotionConfig, useReducedMotion } from 'framer-motion'
import { lazy, Suspense, useEffect } from 'react'
import { ErrorBoundary } from './components/ErrorBoundary'
import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { TestModeBadge } from './components/TestModeBadge'
import { LanguageProvider } from './i18n/LanguageProvider'
import { s } from './i18n/strings'
import { useLang } from './i18n/useLang'
import { FEATURE_EXAM_MOCK, FEATURE_TEAM_BATTLE } from './lib/environment'
import { easeOut, pageVariants } from './lib/motion'
import { completeOnboarding, sessionGate, useSession } from './lib/session'
import { Home } from './screens/Home'
import { Onboarding } from './screens/Onboarding'
import { SignIn } from './screens/SignIn'

// Every other screen is its own chunk, fetched only when a visitor actually
// navigates there — Home used to pull the entire app (Battle, Kahoot, every
// lesson screen) into one bundle before showing anything.
const CourseOutline = lazy(() => import('./screens/CourseOutline').then((m) => ({ default: m.CourseOutline })))
const AIChat = lazy(() => import('./screens/AIChat').then((m) => ({ default: m.AIChat })))
const Battle = lazy(() => import('./screens/Battle').then((m) => ({ default: m.Battle })))
const BattleCasual = lazy(() => import('./screens/BattleCasual').then((m) => ({ default: m.BattleCasual })))
const BattleRanked = lazy(() => import('./screens/BattleRanked').then((m) => ({ default: m.BattleRanked })))
const BattleDuelScreen = lazy(() => import('./screens/BattleDuelScreen').then((m) => ({ default: m.BattleDuelScreen })))
// Behind the flag at the declaration, not just the route, so a production
// build holds no reference to the screen at all.
const Friends = FEATURE_TEAM_BATTLE
  ? lazy(() => import('./screens/Friends').then((m) => ({ default: m.Friends })))
  : null
const TeamBattle = FEATURE_TEAM_BATTLE
  ? lazy(() => import('./screens/TeamBattle').then((m) => ({ default: m.TeamBattle })))
  : null
const ExamMock = FEATURE_EXAM_MOCK
  ? lazy(() => import('./screens/ExamMock').then((m) => ({ default: m.ExamMock })))
  : null
const Kahoot = lazy(() => import('./screens/Kahoot').then((m) => ({ default: m.Kahoot })))
const KahootCreate = lazy(() => import('./screens/KahootCreate').then((m) => ({ default: m.KahootCreate })))
const KahootHost = lazy(() => import('./screens/KahootHost').then((m) => ({ default: m.KahootHost })))
const KahootJoin = lazy(() => import('./screens/KahootJoin').then((m) => ({ default: m.KahootJoin })))
const KahootStudent = lazy(() => import('./screens/KahootStudent').then((m) => ({ default: m.KahootStudent })))
const KahootTeacher = lazy(() => import('./screens/KahootTeacher').then((m) => ({ default: m.KahootTeacher })))
const LessonDetail = lazy(() => import('./screens/LessonDetail').then((m) => ({ default: m.LessonDetail })))
const MapScreen = lazy(() => import('./screens/MapScreen').then((m) => ({ default: m.MapScreen })))
const PersonDetail = lazy(() => import('./screens/PersonDetail').then((m) => ({ default: m.PersonDetail })))
const Profile = lazy(() => import('./screens/Profile').then((m) => ({ default: m.Profile })))
const Quiz = lazy(() => import('./screens/Quiz').then((m) => ({ default: m.Quiz })))
const Timeline = lazy(() => import('./screens/Timeline').then((m) => ({ default: m.Timeline })))

function Page({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      variants={pageVariants}
      initial={reduce ? false : 'initial'}
      animate="animate"
      exit={reduce ? undefined : 'exit'}
    >
      {children}
    </motion.div>
  )
}

/** `/explore?q=…` → `/ai?q=…`. A bare `<Navigate>` would drop the query. */
function RedirectToAI() {
  const { search } = useLocation()
  return <Navigate to={`/ai${search}`} replace />
}

const ROUTES: { path: string; element: ReactNode }[] = [
  { path: '/', element: <Home /> },
  // «Поиск» was its own section over the same list of people as AI. It is one
  // section now, so this path only forwards — with the query intact, because a
  // link carrying `?q=Абылай` has to keep searching for Абылай.
  { path: '/explore', element: <RedirectToAI /> },
  { path: '/person/:id', element: <PersonDetail /> },
  { path: '/course', element: <CourseOutline /> },
  { path: '/lesson/:id', element: <LessonDetail /> },
  { path: '/map', element: <MapScreen /> },
  { path: '/ai', element: <AIChat /> },
  { path: '/ai/:personId', element: <AIChat /> },
  { path: '/quiz', element: <Quiz /> },
  // The set of the day. A static segment outranks `/quiz/:personId` in the
  // router, so "daily" is never read as a person id.
  { path: '/quiz/daily', element: <Quiz daily /> },
  { path: '/quiz/:personId', element: <Quiz /> },
  { path: '/quiz/lesson/:lessonId', element: <Quiz /> },
  { path: '/timeline', element: <Timeline /> },
  // A section of its own, deliberately not under `/battle`: the mock is what
  // the course is preparation for, and living in the game picker made it read
  // as one more game. It keeps its own flag, so it is still test-site only.
  ...(ExamMock ? [{ path: '/exam', element: <ExamMock /> }] : []),
  { path: '/battle', element: <Battle /> },
  { path: '/battle/casual', element: <BattleCasual /> },
  { path: '/battle/ranked', element: <BattleRanked /> },
  // The duel itself, on its own page — nothing but the duel on screen while it
  // is being played (see `BattleDuelScreen.tsx`).
  { path: '/battle/casual/duel', element: <BattleDuelScreen mode="casual" /> },
  { path: '/battle/ranked/duel', element: <BattleDuelScreen mode="ranked" /> },
  // Unfinished: only routed where the team-battle flag is on (the test site).
  // On a production build `/battle/friends` falls through to Home; the chunk
  // file is still written out but nothing references it, and vite.config.ts
  // keeps it out of the service worker's precache.
  ...(Friends ? [{ path: '/battle/friends', element: <Friends /> }] : []),
  ...(TeamBattle ? [{ path: '/battle/team', element: <TeamBattle /> }] : []),
  // The mock used to live here. An open tab or a pasted link from before the
  // move should land on it, not fall through to Home via the catch-all.
  ...(ExamMock
    ? [{ path: '/battle/exam', element: <Navigate to="/exam" replace /> }]
    : []),
  { path: '/battle/kahoot', element: <Kahoot /> },
  { path: '/battle/kahoot/teacher', element: <KahootTeacher /> },
  { path: '/battle/kahoot/student', element: <KahootStudent /> },
  { path: '/battle/kahoot/create', element: <KahootCreate /> },
  { path: '/battle/kahoot/edit/:gameId', element: <KahootCreate /> },
  { path: '/battle/kahoot/host/:gameId', element: <KahootHost /> },
  { path: '/battle/kahoot/play/:code', element: <KahootJoin /> },
  { path: '/profile', element: <Profile /> },
  { path: '*', element: <Home /> },
]

function RouteFallback() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand"
        role="status"
        aria-hidden
      />
    </div>
  )
}

function AnimatedRoutes() {
  const location = useLocation()

  // Every route change starts at the top, like a native screen push.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [location.pathname])

  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        {ROUTES.map((route) => (
          <Route
            key={route.path}
            path={route.path}
            element={
              <Page>
                {/* One boundary per route, not just one at the root: every
                    screen here is `lazy()`, so a single chunk that fails to
                    arrive would otherwise blank the whole app instead of the
                    one screen. `Routes` is keyed on the path, so navigating
                    away remounts this and clears a failed screen. */}
                <ErrorBoundary where={`route:${route.path}`}>
                  <Suspense fallback={<RouteFallback />}>{route.element}</Suspense>
                </ErrorBoundary>
              </Page>
            }
          />
        ))}
      </Routes>
    </AnimatePresence>
  )
}

/** Held for the instant Firebase needs to restore a persisted session. */
function Splash() {
  const { t } = useLang()
  return (
    <div className="grid min-h-dvh place-items-center bg-cream">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25, duration: 0.3 }}
        className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand"
        role="status"
        aria-label={t(s.auth.loading)}
      />
    </div>
  )
}

function GateContent({ gate }: { gate: ReturnType<typeof sessionGate> }) {
  if (gate === 'loading') return <Splash />
  if (gate === 'onboarding') return <Onboarding onDone={completeOnboarding} />
  if (gate === 'signin') return <SignIn />

  return (
    <BrowserRouter>
      <AppShell>
        <AnimatedRoutes />
      </AppShell>
    </BrowserRouter>
  )
}

/**
 * Entry gate. A first-ever visitor gets the intro tour, then the mandatory
 * sign-in screen; a signed-in visitor goes straight into the app on every
 * later load. The tour and sign-in render outside the router, so a deep link
 * survives the flow and lands once the visitor is through.
 *
 * The crossfade below only fires at these gate transitions (loading→onboarding,
 * onboarding→app, etc.) — `AnimatedRoutes` inside the `app` branch keeps its
 * own separate `AnimatePresence` for in-app route changes, so this one never
 * re-triggers on ordinary navigation.
 */
function Gate() {
  const session = useSession()
  const gate = sessionGate(session)
  const reduce = useReducedMotion()

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={gate}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={reduce ? undefined : { opacity: 0 }}
        transition={{ duration: 0.3, ease: easeOut }}
      >
        <GateContent gate={gate} />
      </motion.div>
    </AnimatePresence>
  )
}

export default function App() {
  return (
    // The stylesheet's `prefers-reduced-motion` block cannot reach any of
    // this. It overrides `animation-duration` and `transition-duration`,
    // while framer-motion animates by writing `transform` into the inline
    // style on every frame from JS — neither a CSS animation nor a CSS
    // transition, so the block never applies to it. Nine components ask
    // `useReducedMotion()` themselves; everything that does not — page
    // transitions, the stagger every screen mounts with, every press and
    // hover — played in full for a reader who had asked the operating system
    // for less. `reducedMotion="user"` makes that the default for the whole
    // tree: transform and layout animations are dropped, opacity is kept, so
    // nothing vanishes, it just stops moving.
    <MotionConfig reducedMotion="user">
      <LanguageProvider>
        <Gate />
        {/* Outside the gate so it also shows on onboarding and sign-in — the
            sign-in screen is exactly where it matters which database you are
            about to enter. */}
        <TestModeBadge />
      </LanguageProvider>
    </MotionConfig>
  )
}
