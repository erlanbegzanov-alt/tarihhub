import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { CourseOutline } from './screens/CourseOutline'
import { LanguageProvider } from './i18n/LanguageProvider'
import { s } from './i18n/strings'
import { useLang } from './i18n/useLang'
import { pageVariants } from './lib/motion'
import { recordVisit } from './lib/progress'
import { completeOnboarding, sessionGate, useSession } from './lib/session'
import { AIChat } from './screens/AIChat'
import { Battle } from './screens/Battle'
import { BattleCasual } from './screens/BattleCasual'
import { BattleRanked } from './screens/BattleRanked'
import { Explore } from './screens/Explore'
import { Home } from './screens/Home'
import { Kahoot } from './screens/Kahoot'
import { KahootCreate } from './screens/KahootCreate'
import { KahootHost } from './screens/KahootHost'
import { KahootJoin } from './screens/KahootJoin'
import { KahootStudent } from './screens/KahootStudent'
import { KahootTeacher } from './screens/KahootTeacher'
import { LessonDetail } from './screens/LessonDetail'
import { MapScreen } from './screens/MapScreen'
import { Onboarding } from './screens/Onboarding'
import { PersonDetail } from './screens/PersonDetail'
import { Profile } from './screens/Profile'
import { Quiz } from './screens/Quiz'
import { SignIn } from './screens/SignIn'
import { Timeline } from './screens/Timeline'

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
  { path: '/map', element: <MapScreen /> },
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
            element={<Page>{route.element}</Page>}
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

/**
 * Entry gate. A first-ever visitor gets the intro tour, then the mandatory
 * sign-in screen; a signed-in visitor goes straight into the app on every
 * later load. The tour and sign-in render outside the router, so a deep link
 * survives the flow and lands once the visitor is through.
 */
function Gate() {
  const session = useSession()
  const gate = sessionGate(session)

  // Once per calendar day: bump the visit count and recompute the real streak.
  // Held until the visitor is actually in the app so the intro doesn't count.
  useEffect(() => {
    if (gate === 'app') recordVisit()
  }, [gate])

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

export default function App() {
  return (
    <LanguageProvider>
      <Gate />
    </LanguageProvider>
  )
}
