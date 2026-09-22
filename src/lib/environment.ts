/**
 * Which contour this bundle is running in, and what that contour is allowed
 * to do.
 *
 * Two deploys of this repo exist: the production site real students use, and
 * a test site that exists so features can be broken, fixed and broken again
 * without anyone noticing. They are the same code from the same branch — the
 * only thing separating them is a handful of build-time variables, so there
 * is exactly one place (this file) that decides what "test" means.
 *
 * Vite inlines every `VITE_`-prefixed variable into the bundle as a string
 * literal at build time, so the comparisons below collapse to constants and
 * the bundler drops the losing branch outright. Test-only code is therefore
 * not merely hidden in the production bundle, it is absent from it — the same
 * reasoning the hidden developer panel in `Profile.tsx` already relies on
 * with `import.meta.env.DEV`. `vite.config.ts` pins every flag here to its
 * value or to '' when unset, so the folding happens on every build — an unset
 * flag is a literal `''`, never a runtime lookup the bundler has to keep.
 */

/** The two deploy contours. Any other value is treated as production. */
export type AppEnv = 'production' | 'test'

export const APP_ENV: AppEnv =
  import.meta.env.VITE_APP_ENV === 'test' ? 'test' : 'production'

/**
 * True only on the test deploy. Gate behind this anything that must never
 * reach a real student: the corner badge, seeding helpers, half-built screens.
 */
export const IS_TEST_CONTOUR = APP_ENV === 'test'

/**
 * The developer panel on `/profile` — arbitrary XP, rank-tier jumps, raw
 * profile JSON — is available under `npm run dev` and on the test site, and
 * nowhere else. The test site is a production build, so without this it would
 * lose the one tool that reaches a rank-gated screen without grinding XP by
 * hand, which is most of what testing a progression feature consists of.
 */
export const DEV_TOOLS_ENABLED = import.meta.env.DEV || IS_TEST_CONTOUR

/**
 * Team battle and friends: unfinished. Kept behind a flag so the work can land
 * on `master` in small pieces while staying invisible in production. The
 * alternative — a feature branch left to drift for weeks — is the thing that
 * turns a merge into an archaeology project. On by default on the test site;
 * in production it takes a deliberate `VITE_FEATURE_TEAM_BATTLE=1` to appear,
 * which is the switch that finally ships it.
 */
export const FEATURE_TEAM_BATTLE =
  IS_TEST_CONTOUR || import.meta.env.VITE_FEATURE_TEAM_BATTLE === '1'

/**
 * The ҰБТ mock (`/battle/exam`): a full 20-task variant in the real exam's
 * shape — 10 standalone tasks and two context blocks of five.
 *
 * Its own flag rather than a ride on `FEATURE_TEAM_BATTLE`, because the two
 * features are unrelated and will not be ready on the same day. Shipping one
 * must not drag the other out with it.
 *
 * Deliberately not on in production yet. The screen works and its data is
 * tested, but the bank behind it is still short of the specification's
 * difficulty mix (76 of 98 questions are level A, exactly one is level C), so
 * a score here would sit above the same student's real ҰБТ. It goes live with
 * `VITE_FEATURE_EXAM_MOCK=1` once that gap is closed.
 */
export const FEATURE_EXAM_MOCK =
  IS_TEST_CONTOUR || import.meta.env.VITE_FEATURE_EXAM_MOCK === '1'

/**
 * The Firestore project this bundle talks to. Read straight from the env
 * rather than out of `firebase.ts` so that the badge which displays it stays
 * free of the Firebase SDK and costs nothing to import.
 */
export const FIREBASE_PROJECT_ID: string =
  import.meta.env.VITE_FIREBASE_PROJECT_ID ?? ''
