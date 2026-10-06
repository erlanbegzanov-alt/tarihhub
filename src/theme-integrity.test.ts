/**
 * The theme holds together only because no component knows about the theme.
 *
 * Every colour in this app flips by redefining a token in `.dark` — there is
 * essentially no `dark:` variant anywhere, which is what makes night mode a
 * seven-line change instead of a rewrite. The cost of that design is that a
 * single hard-coded colour is unpatchable: nothing overrides it at night, and
 * it fails in a way nobody sees unless they open the app in the dark.
 *
 * Both rules below were written after finding real breakage, not in advance:
 *
 * - `#17211e`, the light-mode ink, was mixed into every era label at seven
 *   sites. At night the ground went dark and the text went darker with it;
 *   all ten era colours came out under 3.5:1, and the era system is the first
 *   thing a student loses in a dark room.
 * - `bg-ink/55` was the veil behind three modals. `--color-ink` is near-white
 *   in dark mode, so the layer meant to dim the duel board brightened it.
 */
import { describe, expect, it } from 'vitest'

/**
 * Sources are pulled through vite rather than `node:fs`: the app's tsconfig
 * declares only `vite/client` types, so reaching for node here would break
 * `npm run build` for every developer to make one test convenient.
 */
const tsx = import.meta.glob('./**/*.tsx', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>

const files = Object.entries(tsx).map(([path, text]) => ({
  // glob keys always start './'; slicing it beats a regex that has to
  // survive being written through three layers of escaping.
  path: path.slice(2),
  text,
}))

describe('the theme', () => {
  it('has no component hard-coding a colour a token already owns', () => {
    // A hex written into a .tsx file cannot follow the theme. The hues that
    // legitimately are data — era colours, rank colours — live in `src/data`,
    // which this rule does not cover.
    // One named exception, and it is the opposite case: the four hexes in the
    // Google sign-in mark are that company's brand colours. A brand logo must
    // NOT follow our theme — recolouring it would misrepresent someone else's
    // mark — so it is listed here rather than the rule being softened.
    const brandMarks = new Set(['screens/SignIn.tsx'])
    // The shimmer sweeping across a rank badge is a specular highlight. A
    // reflection is white because of how light works, not because of which
    // theme is on, so it is listed rather than the rule being softened.
    const speculars = new Set(['components/RankBadge.tsx', 'components/battle.tsx'])
    const offenders: string[] = []
    for (const file of files) {
      if (brandMarks.has(file.path)) continue
      for (const match of file.text.matchAll(/#[0-9a-fA-F]{6}\b/g)) {
        offenders.push(`${file.path}: ${match[0]}`)
      }
      // Two forms this rule used to miss, both found in the wild. The map drew
      // its active marker and its capital pills with `#fff` text on the era
      // hue and an `rgba(255,255,255,0.24)` badge veil; the dark theme
      // deliberately lightens every era colour, so fifteen of the twenty
      // era-by-theme cases came out under 4.5:1 and five under 3. White is the
      // easiest literal to write and the hardest to notice, because in the
      // light theme it is exactly `--color-surface` and looks correct.
      if (speculars.has(file.path)) continue
      for (const match of file.text.matchAll(
        /#[0-9a-fA-F]{3}\b|rgba?\(\s*255[\s,]+255[\s,]+255/g,
      )) {
        offenders.push(`${file.path}: ${match[0]}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('never veils a modal with a colour that inverts', () => {
    // `bg-ink/N` reads as "dim it" and does the opposite at night. The scrim
    // token exists precisely so a veil stays dark in both themes.
    const offenders = files
      .filter((file) => /\bbg-ink\/\d+/.test(file.text))
      .map((file) => file.path)
    expect(offenders).toEqual([])
  })

  it('keeps the one-line panel in one place', () => {
    // Eight Kahoot screens had copied these nine classes verbatim before this
    // rule existed, and the look they copied was already wrong in one of them.
    // The panel is `EmptyPanel` in `components/ui.tsx` now; the only legal
    // occurrence of the string is its own definition.
    //
    // This sits in the theme suite, despite not being a colour rule, because
    // it is the only suite that reads the sources as text — and the failure is
    // the same one the rules above catch: a look with nine owners gets fixed
    // in one of them.
    const panel =
      'p-5 text-center text-[14px] leading-relaxed text-ink-soft shadow-soft'
    const offenders = files
      .filter((file) => file.path !== 'components/ui.tsx')
      .filter((file) => file.text.includes(panel))
      .map((file) => file.path)
    expect(offenders).toEqual([])
  })

  it('asks framer-motion to honour the reader before anything renders', () => {
    // This rule is text matching, and it can only prove the declaration is
    // present — not that it works. It is here because the thing it guards is
    // one line in one file that nothing else would miss if it were deleted,
    // and because the stylesheet looks like it already covers the case: the
    // `prefers-reduced-motion` block overrides CSS animation and transition
    // durations, while framer-motion writes `transform` into the inline style
    // from JS, which that block cannot touch. The next person to read
    // index.css will reasonably conclude the app is already covered.
    const root = files.find((file) => file.path === 'App.tsx')
    expect(root, 'App.tsx is where the provider belongs').toBeDefined()
    expect(root?.text).toContain('<MotionConfig reducedMotion="user">')
  })

  it('never takes focus away from a reader who has just answered', () => {
    // Five screens disabled every answer button the moment one was picked.
    // A focused element that becomes disabled drops focus to <body>, so the
    // next Tab starts at the top of the document — in the duel that happened
    // under a twelve-second clock, which makes it a lock-out rather than an
    // inconvenience. `aria-disabled` is the replacement: still announced,
    // still focusable, and every one of those handlers already refuses a
    // second answer.
    const offenders = files
      // The lookbehind matters: without it this also matches `aria-disabled`,
      // so the rule would flag the very fix it exists to protect.
      .filter((file) => /(?<!aria-)disabled=\{(revealed|picked)/.test(file.text))
      .map((file) => file.path)
    expect(offenders).toEqual([])
  })

  // A sixth rule belongs here — "every colour token declared in the light
  // block has a counterpart in `.dark`, except the scrim" — and it is not
  // written, deliberately. This suite runs under vitest's node environment,
  // where a CSS import resolves to an empty string, so the check would pass
  // without ever reading the stylesheet. A test that cannot fail is worse
  // than no test, because it reports coverage it does not have. Moving this
  // file out of `src` would let it use `node:fs`, but `tsconfig.app.json`
  // declares only `vite/client` types and covers all of `src`, so that is a
  // build-config change, not a test change.
})
