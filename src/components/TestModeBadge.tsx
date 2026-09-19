import { FIREBASE_PROJECT_ID, IS_TEST_CONTOUR } from '../lib/environment'

/**
 * A permanent corner marker on the test site.
 *
 * The expensive mistake this exists to prevent is not "which site am I
 * looking at" — it is "which database am I writing to". The two deploys are
 * pixel-identical, so the badge names the Firestore project outright: seeing
 * the production project id here means the test deploy is pointed at real
 * students' data and must be stopped.
 *
 * `pointer-events-none` keeps it from ever swallowing a tap, and `bottom-3`
 * clears the install prompt, which sits at `bottom-20`.
 *
 * Renders nothing in production, where `IS_TEST_CONTOUR` is a build-time
 * `false` and the whole component is dropped from the bundle.
 */
export function TestModeBadge() {
  if (!IS_TEST_CONTOUR) return null

  return (
    <div className="pointer-events-none fixed right-3 bottom-3 z-[60] flex items-center gap-1.5 rounded-full bg-gold px-2.5 py-1 shadow-soft">
      <span className="text-[10.5px] font-bold tracking-[0.08em] text-ink">ТЕСТ</span>
      {FIREBASE_PROJECT_ID !== '' && (
        <span className="max-w-[150px] truncate text-[10px] font-medium text-ink/70">
          {FIREBASE_PROJECT_ID}
        </span>
      )}
    </div>
  )
}
