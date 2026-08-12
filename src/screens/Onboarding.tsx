import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { PanInfo } from 'framer-motion'
import { Clock, Map, Sparkles, Trophy } from 'lucide-react'
import { useState } from 'react'
import type { ReactElement } from 'react'
import { MotifIcon } from '../components/Motif'
import { Wordmark } from '../components/Wordmark'
import { eraColor } from '../data/eras'
import type { LocalizedText } from '../data/types'
import { s } from '../i18n/strings'
import { useLang } from '../i18n/useLang'
import { cn } from '../lib/cn'
import { easeOut, pressable, springSoft } from '../lib/motion'

/* ------------------------------- artwork ------------------------------- */

/** Slide 1: warm steppe horizon with a yurt — pure SVG, no image assets. */
function SteppeArt() {
  return (
    <svg
      viewBox="0 0 320 210"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full"
      aria-hidden
    >
      <defs>
        <linearGradient id="ob-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={eraColor('saka')} stopOpacity="0.34" />
          <stop offset="100%" stopColor="var(--color-gold)" stopOpacity="0.18" />
        </linearGradient>
      </defs>

      <rect width="320" height="210" fill="url(#ob-sky)" />
      <circle cx="238" cy="60" r="28" fill="var(--color-gold)" fillOpacity="0.42" />
      <circle cx="238" cy="60" r="44" fill="var(--color-gold)" fillOpacity="0.14" />

      <path
        d="M0 138C58 114 112 146 170 133c50-11 100 8 150-6v83H0z"
        fill={eraColor('saka')}
        fillOpacity="0.26"
      />
      <path
        d="M0 164C70 147 140 174 210 159c48-10 80 6 110-1v52H0z"
        fill="var(--color-brand)"
        fillOpacity="0.28"
      />

      {/* yurt */}
      <g>
        <path
          d="M104 160v-16c0-19 15-34 34-34s34 15 34 34v16z"
          fill="var(--color-surface)"
          fillOpacity="0.94"
        />
        <path
          d="M104 144h68M138 110v50"
          stroke="var(--color-brand)"
          strokeOpacity="0.35"
          strokeWidth="2"
        />
        <path
          d="M130 160v-18h16v18z"
          fill="var(--color-brand)"
          fillOpacity="0.55"
        />
      </g>
    </svg>
  )
}

/** Slide 2: two portrait tiles, standing in for the historical-figure cards. */
function FiguresArt() {
  const tiles = [
    { motif: 'crown', era: 'khanate', rotate: -5 },
    { motif: 'feather', era: 'alash', rotate: 5 },
  ] as const

  return (
    <div className="flex items-center justify-center gap-4">
      {tiles.map((tile) => {
        const color = eraColor(tile.era)
        return (
          <motion.div
            key={tile.motif}
            initial={{ opacity: 0, y: 16, rotate: 0 }}
            animate={{ opacity: 1, y: 0, rotate: tile.rotate }}
            transition={{ ...springSoft, delay: 0.1 }}
            className="grid h-28 w-24 place-items-center rounded-tile shadow-soft ring-1 ring-line/50 sm:h-32 sm:w-28"
            style={{
              background: `linear-gradient(150deg, color-mix(in srgb, ${color} 24%, white), color-mix(in srgb, ${color} 8%, white))`,
            }}
          >
            <span
              className="grid h-14 w-14 place-items-center rounded-full bg-surface/85"
              style={{ color }}
            >
              <MotifIcon motif={tile.motif} className="h-6 w-6" strokeWidth={1.9} />
            </span>
          </motion.div>
        )
      })}
    </div>
  )
}

/** Slide 3: a two-turn chat mock-up in the app's own bubble styling. */
function ChatArt() {
  const { t } = useLang()
  return (
    <div className="mx-auto flex w-full max-w-[260px] flex-col gap-2.5">
      <motion.p
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ ...springSoft, delay: 0.1 }}
        className="self-end rounded-2xl rounded-br-md bg-brand px-3.5 py-2.5 text-[13px] font-medium text-white shadow-soft"
      >
        {t(s.onboarding.aiBubbleUser)}
      </motion.p>
      <motion.p
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ ...springSoft, delay: 0.28 }}
        className="self-start rounded-2xl rounded-bl-md bg-surface px-3.5 py-2.5 text-[13px] text-ink shadow-soft ring-1 ring-line/60"
      >
        {t(s.onboarding.aiBubbleReply)}
      </motion.p>
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.45, duration: 0.3, ease: easeOut }}
        className="self-center rounded-full bg-brand-tint px-3 py-1 text-[11px] font-semibold text-brand-dark"
      >
        AI
      </motion.span>
    </div>
  )
}

/** Slide 4: the four things the app actually does. */
function FeaturesArt() {
  const { t } = useLang()
  const features = [
    { icon: Map, label: s.onboarding.learnMap, era: 'modern' },
    { icon: Clock, label: s.onboarding.learnTimeline, era: 'turkic' },
    { icon: Trophy, label: s.onboarding.learnQuiz, era: 'golden' },
    { icon: Sparkles, label: s.onboarding.learnBadges, era: 'khanate' },
  ] as const

  return (
    <div className="mx-auto grid w-full max-w-[280px] grid-cols-2 gap-2.5">
      {features.map((feature, i) => {
        const Icon = feature.icon
        const color = eraColor(feature.era)
        return (
          <motion.div
            key={feature.era}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springSoft, delay: 0.06 * i }}
            className="flex items-center gap-2.5 rounded-tile bg-surface px-3 py-2.5 shadow-soft ring-1 ring-line/50"
          >
            <span
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full"
              style={{ background: `color-mix(in srgb, ${color} 14%, white)`, color }}
            >
              <Icon className="h-4 w-4" strokeWidth={2} />
            </span>
            <span className="truncate text-[12.5px] font-medium text-ink">
              {t(feature.label)}
            </span>
          </motion.div>
        )
      })}
    </div>
  )
}

/* -------------------------------- slides ------------------------------- */

interface Slide {
  id: string
  art: () => ReactElement
  /** Slide 1 shows the wordmark instead of a heading. */
  hero?: boolean
  title?: LocalizedText
  text: LocalizedText
  caption?: LocalizedText
  cta: LocalizedText
}

const SLIDES: Slide[] = [
  {
    id: 'hero',
    art: SteppeArt,
    hero: true,
    text: s.onboarding.heroTagline,
    caption: s.onboarding.heroCaption,
    cta: s.onboarding.start,
  },
  {
    id: 'figures',
    art: FiguresArt,
    title: s.onboarding.exploreTitle,
    text: s.onboarding.exploreText,
    cta: s.onboarding.next,
  },
  {
    id: 'ai',
    art: ChatArt,
    title: s.onboarding.aiTitle,
    text: s.onboarding.aiText,
    cta: s.onboarding.next,
  },
  {
    id: 'learn',
    art: FeaturesArt,
    title: s.onboarding.learnTitle,
    text: s.onboarding.learnText,
    cta: s.onboarding.enter,
  },
]

const slideVariants = {
  enter: (direction: number) => ({ opacity: 0, x: direction >= 0 ? 48 : -48 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.32, ease: easeOut } },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction >= 0 ? -48 : 48,
    transition: { duration: 0.2, ease: easeOut },
  }),
}

const SWIPE_THRESHOLD = 56

/* -------------------------------- screen ------------------------------- */

export function Onboarding({ onDone }: { onDone: () => void }) {
  const { t } = useLang()
  const reduce = useReducedMotion()
  const [[index, direction], setPage] = useState<[number, number]>([0, 0])

  const slide = SLIDES[index]
  const isLast = index === SLIDES.length - 1

  const go = (delta: number) => {
    const next = index + delta
    if (next < 0) return
    if (next >= SLIDES.length) {
      onDone()
      return
    }
    setPage([next, delta])
  }

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -SWIPE_THRESHOLD) go(1)
    else if (info.offset.x > SWIPE_THRESHOLD) go(-1)
  }

  return (
    <div className="flex min-h-dvh flex-col bg-cream">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-5 pb-8 sm:px-6">
        <div className="flex h-9 items-center justify-end">
          {!isLast && (
            <button
              type="button"
              onClick={onDone}
              className="focus-ring rounded-full px-3 py-1.5 text-[13px] font-medium text-ink-faint transition-colors hover:text-ink"
            >
              {t(s.onboarding.skip)}
            </button>
          )}
        </div>

        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={slide.id}
            custom={direction}
            variants={slideVariants}
            initial={reduce ? false : 'enter'}
            animate="center"
            exit={reduce ? undefined : 'exit'}
            drag={reduce ? false : 'x'}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.16}
            onDragEnd={onDragEnd}
            className="flex flex-1 cursor-grab flex-col justify-center active:cursor-grabbing"
          >
            {/* ---------- art ---------- */}
            <div
              className={cn(
                'relative grid w-full place-items-center overflow-hidden rounded-card',
                slide.hero
                  ? 'h-56 shadow-soft ring-1 ring-line/50 sm:h-64'
                  : 'h-52 bg-cream-deep/45 sm:h-56',
              )}
            >
              <slide.art />
              {slide.hero && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...springSoft, delay: 0.12 }}
                  className="relative"
                >
                  <Wordmark className="h-12 drop-shadow-sm" />
                </motion.div>
              )}
            </div>

            {/* ---------- copy ---------- */}
            <div className="mt-7 text-center">
              {slide.title && (
                <h1 className="text-[22px] font-bold tracking-tight text-ink sm:text-2xl">
                  {t(slide.title)}
                </h1>
              )}
              <p
                className={cn(
                  'mx-auto max-w-[19rem] text-[15px] leading-relaxed',
                  slide.hero
                    ? 'text-[17px] font-semibold text-ink sm:text-lg'
                    : 'mt-2.5 text-ink-soft',
                )}
              >
                {t(slide.text)}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* ---------- pagination ---------- */}
        <div className="mt-8 flex justify-center gap-1.5" aria-hidden>
          {SLIDES.map((item, i) => (
            <motion.span
              key={item.id}
              layout
              transition={springSoft}
              className={cn(
                'h-1.5 rounded-full',
                i === index ? 'w-6 bg-brand' : 'w-1.5 bg-line',
              )}
            />
          ))}
        </div>
        <p className="sr-only" aria-live="polite">
          {t(s.onboarding.slideLabel)} {index + 1} / {SLIDES.length}
        </p>

        {/* ---------- cta ---------- */}
        <div className="mt-5 text-center">
          <motion.button
            type="button"
            onClick={() => go(1)}
            {...pressable}
            className={cn(
              'focus-ring w-full rounded-full bg-brand px-6 py-3.5',
              'text-[15px] font-semibold text-white shadow-soft',
              'transition-colors hover:bg-brand-dark',
            )}
          >
            {t(slide.cta)}
          </motion.button>
          {slide.caption && (
            <p className="mt-3 text-[12.5px] text-ink-faint">{t(slide.caption)}</p>
          )}
        </div>
      </div>
    </div>
  )
}
