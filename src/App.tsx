import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { lazy, Suspense, useEffect } from 'react'
import type { ReactNode } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { LanguageProvider } from './i18n/LanguageProvider'
import { s } from './i18n/strings'
import { useLang } from './i18n/useLang'
import { easeOut, pageVariants } from './lib/motion'
import { recordVisit } from './lib/progress'
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
const Explore = lazy(() => import('./screens/Explore').then((m) => ({ default: m.Explore })))
const Kahoot = lazy(() => import('./screens/Kahoot').then((m) => ({ default: m.Kahoot })))
const KahootCreate = lazy(() => import('./screens/KahootCreate').then((m) => ({ default: m.KahootCreate })))
const KahootHost = lazy(() => import('./screens/KahootHost').then((m) => ({ default: m.KahootHost })))
const KahootJoin = lazy(() => import('./screens/KahootJoin').then((m) => ({ default: m.KahootJoin })))
const KahootStudent = lazy(() => import('./screens/KahootStudent').then((m) => ({ default: m.KahootStudent })))
const KahootTeacher = lazy(() => import('./screens/KahootTeacher').then((m) => ({ default: m.KahootTeacher })))
const LessonDetail = lazy(() => import('./screens/LessonDetail').then((m) => ({ default: m.LessonDetail })))
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

const ROUTES: { path: string; element: ReactNode }[] = [
  { path: '/', element: <Home /> },
  { path: '/explore', element: <Explore /> },
  { path: '/person/:id', element: <PersonDetail /> },
  { path: '/course', element: <CourseOutline /> },
  { path: '/lesson/:id', element: <LessonDetail /> },
  { path: '/ai', element: <AIChat /> },
  { path: '/ai/:personId', element: <AIChat /> },
  { path: '/quiz', element: <Quiz /> },
  { path: '/quiz/:personId', element: <Quiz /> },
  { path: '/quiz/lesson/:lessonId', element: <Quiz /> },
  { path: '/timeline', element: <Timeline /> },
  { path: '/battle', element: <Battle /> },
  { path: '/battle/casual', element: <BattleCasual /> },
  { path: '/battle/ranked', element: <BattleRanked /> },
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
                <Suspense fallback={<RouteFallback />}>{route.element}</Suspense>
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

  // Once per calendar day: bump the visit count and recompute the real streak.
  // Held until the visitor is actually in the app so the intro doesn't count.
  useEffect(() => {
    if (gate === 'app') recordVisit()
  }, [gate])

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
    <LanguageProvider>
      <Gate />
    </LanguageProvider>
  )
}
