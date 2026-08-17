import { motion } from 'framer-motion'
import { ChevronDown, ChevronRight, ChevronUp, GraduationCap, Play } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PersonCard } from '../components/PersonCard'
import {
  EraBadge,
  ProgressBar,
  SearchField,
  SectionHeading,
} from '../components/ui'
import { eraColor } from '../data/eras'
import { todaysFeaturedEvent } from '../data/featuredEvents'
import { allLessons } from '../data/lessons'
import { people } from '../data/people'
import { s } from '../i18n/strings'
import { useLang } from '../i18n/useLang'
import { cn } from '../lib/cn'
import { springSoft, staggerContainer, staggerItem } from '../lib/motion'
import { useProfile } from '../lib/progress'
import { useSession } from '../lib/session'

// Collapsed height of the "continue learning" list before it needs its own
// expand toggle — past this, an unbounded number of in-progress lessons would
// make Home scroll forever.
const CONTINUE_LEARNING_COLLAPSED = 4

export function Home() {
  const { t } = useLang()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [showAllInProgress, setShowAllInProgress] = useState(false)
  const session = useSession()
  const profile = useProfile()

  // Deterministic by calendar day — same card for everyone on a given day,
  // rotating through every era over `featuredEvents.length` days so a
  // visitor who returns a few days later sees something different, without
  // recomputing (and so a mid-day re-render never flips it) on every render.
  const featuredEvent = useMemo(() => todaysFeaturedEvent(), [])

  // Real progress, read live from the profile — never baked into the data.
  const lessons = allLessons.map((lesson) => ({
    lesson,
    percent: profile.lessonProgress[lesson.id] ?? 0,
  }))
  const inProgress = lessons.filter(
    (item) => item.percent > 0 && item.percent < 100,
  )

  // Course-wide stat for the CTA card, counted against the lessons that really
  // exist — the number grows on its own as content lands.
  const passedLessons = allLessons.filter((lesson) =>
    profile.completedLessons.includes(lesson.id),
  ).length

  // Greet the signed-in account's first name.
  const greetingName =
    session.user?.displayName?.split(' ')[0] || t(s.profile.userName)

  const submitSearch = (value: string) => {
    setQuery(value)
    // Any non-empty query navigates. Requiring two characters made Enter look
    // broken for a single-letter search, and the Explore field has no such minimum.
    const needle = value.trim()
    if (needle) {
      navigate(`/explore?q=${encodeURIComponent(needle)}`)
    }
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="flex flex-col gap-8 md:gap-10"
    >
      {/* ---------- search ---------- */}
      <motion.div variants={staggerItem} className="md:max-w-2xl">
        <p className="mb-3 text-[13px] font-medium text-ink-faint md:hidden">
          {t(s.home.greeting)}, {greetingName} 👋
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            submitSearch(query)
          }}
        >
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder={t(s.home.searchPlaceholder)}
          />
        </form>
      </motion.div>

      {/*
        One flow on phone (hero → figures → continue → new lessons).
        On laptop the same DOM is re-placed into a real 2-column grid:
        row 1 = hero + continue learning, rows 2/3 = full-width sections.
      */}
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-x-10 lg:gap-y-10">
        <motion.section
          variants={staggerItem}
          className="lg:col-start-1 lg:row-start-1"
        >
          <SectionHeading title={t(s.home.todayTitle)} />
          <motion.div whileHover={{ y: -3 }} transition={springSoft}>
            <Link
              to="/timeline"
              className={cn(
                'focus-ring group relative block overflow-hidden rounded-card',
                'bg-surface shadow-soft ring-1 ring-line/60 transition-shadow duration-300 hover:shadow-lift',
              )}
            >
              <div
                className="relative h-32 w-full sm:h-40"
                style={{
                  background: `color-mix(in srgb, ${eraColor(featuredEvent.eraKey)} 10%, var(--color-surface))`,
                }}
              >
                <img
                  src={featuredEvent.image}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
                <span className="absolute top-4 left-4">
                  <EraBadge
                    eraKey={featuredEvent.eraKey}
                    className="bg-surface/80 backdrop-blur"
                  >
                    {t(featuredEvent.badge)}
                  </EraBadge>
                </span>
                {/* Honest caption — every one of these is an AI scene illustration,
                    not a photo of the actual moment (none survive). */}
                <span
                  className={cn(
                    'absolute bottom-2 left-2 rounded-full px-2 py-0.5',
                    'bg-black/45 text-[10.5px] font-medium text-white backdrop-blur-sm',
                  )}
                >
                  {t(s.person.portraitDepiction)}
                </span>
              </div>
              <div className="p-4 sm:p-5">
                <h3 className="text-lg leading-snug font-semibold text-ink sm:text-xl">
                  {t(featuredEvent.title)}
                </h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-ink-soft">
                  {t(featuredEvent.text)}
                </p>
                <span className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-brand">
                  {t(s.timeline.title)}
                  <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          </motion.div>
        </motion.section>

        {/* ---------- popular figures ---------- */}
        <motion.section
          variants={staggerItem}
          className="min-w-0 lg:col-span-2 lg:row-start-2"
        >
          <SectionHeading
            title={t(s.home.popularFigures)}
            action={
              <Link
                to="/explore"
                className="focus-ring inline-flex items-center gap-0.5 rounded-lg text-[13px] font-semibold text-brand"
              >
                {t(s.common.seeAll)}
                <ChevronRight className="h-4 w-4" />
              </Link>
            }
          />

          {/* phone: horizontal rail — laptop: real grid */}
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className={cn(
              'rail-scroll -mx-4 flex min-w-0 snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6',
              'md:mx-0 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0 lg:grid-cols-4 xl:grid-cols-5',
            )}
          >
            {people.slice(0, 10).map((person) => (
              <PersonCard
                key={person.id}
                person={person}
                className="w-[150px] shrink-0 snap-start sm:w-[168px] md:w-auto"
              />
            ))}
          </motion.div>
        </motion.section>

        {/* continue learning — moves beside the hero on wide screens.
            Hidden entirely while nothing is half-finished. */}
        {inProgress.length > 0 && (
          <motion.section variants={staggerItem} className="lg:col-start-2 lg:row-start-1">
            <SectionHeading title={t(s.home.continueLearning)} />
            <motion.ul
              variants={staggerContainer}
              initial="initial"
              animate="animate"
              className="flex flex-col gap-2.5"
            >
              {(showAllInProgress
                ? inProgress
                : inProgress.slice(0, CONTINUE_LEARNING_COLLAPSED)
              ).map(({ lesson, percent }) => (
                <motion.li key={lesson.id} variants={staggerItem}>
                  <motion.div whileHover={{ y: -2 }} transition={springSoft}>
                    <Link
                      to={`/lesson/${lesson.id}`}
                      className={cn(
                        'focus-ring block w-full rounded-card bg-surface p-3.5 text-left',
                        'shadow-soft ring-1 ring-line/60 transition-shadow duration-300 hover:shadow-lift',
                      )}
                    >
                      <div className="flex items-center gap-3.5">
                        <span
                          className="grid h-11 w-11 shrink-0 place-items-center rounded-full"
                          style={{
                            background: `color-mix(in srgb, ${eraColor(lesson.eraKey)} 14%, var(--color-surface))`,
                          }}
                        >
                          <Play
                            className="h-4 w-4 translate-x-px"
                            strokeWidth={2.4}
                            style={{ color: eraColor(lesson.eraKey) }}
                            fill="currentColor"
                          />
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-[14.5px] font-semibold text-ink">
                            {t(lesson.title)}
                          </h3>
                          <p className="mt-0.5 truncate text-[12.5px] text-ink-faint">
                            {percent}% {t(s.home.complete)}
                          </p>
                          <ProgressBar
                            percent={percent}
                            color={eraColor(lesson.eraKey)}
                            className="mt-1.5"
                          />
                        </div>
                        <ChevronRight className="h-5 w-5 shrink-0 text-ink-faint" />
                      </div>
                    </Link>
                  </motion.div>
                </motion.li>
              ))}
            </motion.ul>

            {inProgress.length > CONTINUE_LEARNING_COLLAPSED && (
              <button
                type="button"
                onClick={() => setShowAllInProgress((prev) => !prev)}
                className="focus-ring mt-2.5 flex w-full items-center justify-center gap-0.5 rounded-lg py-1.5 text-[13px] font-semibold text-brand"
              >
                {showAllInProgress ? (
                  <>
                    {t(s.common.seeLess)}
                    <ChevronUp className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    {t(s.common.seeAll)}
                    <ChevronDown className="h-4 w-4" />
                  </>
                )}
              </button>
            )}
          </motion.section>
        )}

        {/* ---------- the full course ---------- */}
        <motion.section variants={staggerItem} className="lg:col-span-2 lg:row-start-3">
          <SectionHeading title={t(s.home.courseTitle)} />

          <motion.div whileHover={{ y: -3 }} transition={springSoft}>
            <Link
              to="/course"
              className={cn(
                'focus-ring group flex items-center gap-4 rounded-card bg-surface p-4 sm:p-5',
                'shadow-soft ring-1 ring-line/60 transition-shadow duration-300 hover:shadow-lift',
              )}
            >
              <span
                className="grid h-12 w-12 shrink-0 place-items-center rounded-full"
                style={{
                  background: `color-mix(in srgb, ${eraColor('khanate')} 14%, var(--color-surface))`,
                }}
              >
                <GraduationCap
                  className="h-6 w-6"
                  strokeWidth={2}
                  style={{ color: eraColor('khanate') }}
                />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-[16px] font-semibold text-ink">
                  {t(s.home.courseTitle)}
                </h3>
                <p className="mt-0.5 text-[13.5px] leading-relaxed text-ink-soft">
                  {t(s.home.courseText)}
                </p>
                <div className="mt-2 flex items-center gap-2.5">
                  <span className="text-[13px] font-bold text-ink">
                    {passedLessons}
                    <span className="text-ink-faint"> / {allLessons.length}</span>
                  </span>
                  <ProgressBar
                    percent={
                      allLessons.length > 0
                        ? (passedLessons / allLessons.length) * 100
                        : 0
                    }
                    className="max-w-[180px] flex-1"
                  />
                </div>
              </div>
              <span className="inline-flex shrink-0 items-center gap-0.5 text-[13px] font-semibold text-brand">
                <span className="hidden sm:inline">{t(s.home.courseAction)}</span>
                <ChevronRight className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-0.5" />
              </span>
            </Link>
          </motion.div>
        </motion.section>
      </div>
    </motion.div>
  )
}
