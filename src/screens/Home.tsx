import { motion } from 'framer-motion'
import { ChevronRight, Play, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PersonCard } from '../components/PersonCard'
import { EraBadge, SearchField, SectionHeading } from '../components/ui'
import { eraColor } from '../data/eras'
import { continueLessons, newLessons } from '../data/lessons'
import { people } from '../data/people'
import { s } from '../i18n/strings'
import { useLang } from '../i18n/useLang'
import { cn } from '../lib/cn'
import { springSoft, staggerContainer, staggerItem } from '../lib/motion'
import { useSession } from '../lib/session'

export function Home() {
  const { t } = useLang()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const session = useSession()

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
                  background: `linear-gradient(140deg,
                    color-mix(in srgb, ${eraColor('khanate')} 26%, var(--color-surface)),
                    color-mix(in srgb, ${eraColor('khanate')} 8%, var(--color-surface)))`,
                }}
              >
                <svg
                  viewBox="0 0 400 160"
                  preserveAspectRatio="none"
                  className="absolute inset-0 h-full w-full"
                  fill="none"
                  aria-hidden
                >
                  <g
                    stroke={eraColor('khanate')}
                    strokeOpacity="0.22"
                    strokeWidth="1"
                  >
                    <path d="M0 120C60 90 90 130 150 104S250 60 310 92 400 78 400 78" />
                    <path d="M0 138C70 112 110 148 170 124S270 84 330 112 400 100 400 100" />
                    <circle cx="330" cy="46" r="22" />
                    <circle cx="330" cy="46" r="34" />
                  </g>
                </svg>
                <span className="absolute top-4 left-4">
                  <EraBadge eraKey="khanate" className="bg-surface/80 backdrop-blur">
                    {t(s.home.todayEventBadge)}
                  </EraBadge>
                </span>
              </div>
              <div className="p-4 sm:p-5">
                <h3 className="text-lg leading-snug font-semibold text-ink sm:text-xl">
                  {t(s.home.todayEventTitle)}
                </h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-ink-soft">
                  {t(s.home.todayEventText)}
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

        {/* continue learning — moves beside the hero on wide screens */}
        <motion.section variants={staggerItem} className="lg:col-start-2 lg:row-start-1">
          <SectionHeading title={t(s.home.continueLearning)} />
          <motion.ul
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="flex flex-col gap-2.5"
          >
            {continueLessons.map((lesson) => (
              <motion.li key={lesson.id} variants={staggerItem}>
                <motion.button
                  type="button"
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.99 }}
                  transition={springSoft}
                  className={cn(
                    'focus-ring w-full rounded-card bg-surface p-3.5 text-left',
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
                        {t(lesson.meta)}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-ink-faint" />
                  </div>
                </motion.button>
              </motion.li>
            ))}
          </motion.ul>
        </motion.section>

        {/* ---------- new lessons ---------- */}
        <motion.section variants={staggerItem} className="lg:col-span-2 lg:row-start-3">
          <SectionHeading title={t(s.home.newLessons)} />
          <motion.ul
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4"
          >
          {newLessons.map((lesson) => (
            <motion.li key={lesson.id} variants={staggerItem}>
              <motion.button
                type="button"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.99 }}
                transition={springSoft}
                className={cn(
                  'focus-ring flex w-full items-center gap-3.5 rounded-card bg-surface p-3.5 text-left',
                  'shadow-soft ring-1 ring-line/60 transition-shadow duration-300 hover:shadow-lift',
                )}
              >
                <span
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full"
                  style={{
                    background: `color-mix(in srgb, ${eraColor(lesson.eraKey)} 14%, var(--color-surface))`,
                  }}
                >
                  <Sparkles
                    className="h-[18px] w-[18px]"
                    strokeWidth={2}
                    style={{ color: eraColor(lesson.eraKey) }}
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-gold-tint px-2 py-0.5 text-[10.5px] font-bold text-gold">
                      {t(s.home.newBadge)}
                    </span>
                    <span className="truncate text-[12px] text-ink-faint">
                      {t(lesson.meta)}
                    </span>
                  </div>
                  <h3 className="mt-1 truncate text-[14.5px] font-semibold text-ink">
                    {t(lesson.title)}
                  </h3>
                  <p className="mt-0.5 truncate text-[12.5px] text-ink-faint">
                    {t(lesson.duration)}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-ink-faint" />
              </motion.button>
            </motion.li>
          ))}
          </motion.ul>
        </motion.section>
      </div>
    </motion.div>
  )
}
