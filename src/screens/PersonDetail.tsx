import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Bookmark,
  Check,
  Landmark,
  MapPin,
  Medal,
  MessageCircle,
  Share2,
  Trophy,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { MotifIcon } from '../components/Motif'
import { PortraitPanel } from '../components/PortraitPanel'
import { EraBadge, IconButton } from '../components/ui'
import { eraColor, eras } from '../data/eras'
import { mapSites } from '../data/mapSites'
import { getPerson, people } from '../data/people'
import { s } from '../i18n/strings'
import { useLang } from '../i18n/useLang'
import { cn } from '../lib/cn'
import { canHover, springSoft, staggerContainer, staggerItem } from '../lib/motion'
import { recordPersonView } from '../lib/progress'

export function PersonDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useLang()
  const [saved, setSaved] = useState(false)
  const person = getPerson(id)

  useEffect(() => {
    if (person) recordPersonView(person.id)
  }, [person])

  if (!person) {
    return (
      <div className="py-24 text-center">
        <p className="text-ink-soft">{t(s.person.missing)}</p>
        <Link
          to="/explore"
          className="focus-ring mt-4 inline-block rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white"
        >
          {t(s.explore.title)}
        </Link>
      </div>
    )
  }

  const color = eraColor(person.eraKey)
  const related = mapSites.filter((site) => site.personId === person.id)
  const alsoSee = people
    .filter((p) => p.id !== person.id && p.eraKey === person.eraKey)
    .slice(0, 3)

  const facts = [
    { id: 'born', label: t(s.person.born), value: t(person.born) },
    ...(person.died
      ? [{ id: 'died', label: t(s.person.died), value: t(person.died) }]
      : []),
  ]

  const share = () => {
    const url = window.location.href
    if (navigator.share) {
      void navigator.share({ title: t(person.name), url }).catch(() => {})
    } else {
      void navigator.clipboard?.writeText(url).catch(() => {})
    }
  }

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      {/* ---------- mobile/tablet: full-bleed hero photo, buttons floating on top —
          no card edge between the portrait and the name/bio below it. Desktop
          keeps the framed, sticky portrait in the 2-column layout instead. */}
      <motion.div
        variants={staggerItem}
        className="relative -mx-4 -mt-5 mb-5 overflow-hidden sm:-mx-6 md:-mx-8 md:-mt-8 lg:hidden"
      >
        <PortraitPanel
          initial={person.initial}
          eraKey={person.eraKey}
          motif={person.motif}
          portrait={person.portrait}
          name={t(person.name)}
          size="lg"
          className="aspect-4/5 w-full sm:aspect-16/10"
        />
        <div className="absolute inset-x-4 top-4 flex items-center justify-between sm:inset-x-6">
          <IconButton
            label={t(s.common.back)}
            onClick={() => navigate(-1)}
            className="bg-surface/90 backdrop-blur-sm"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2} />
          </IconButton>
          <div className="flex items-center gap-2">
            <IconButton
              label={t(s.person.share)}
              onClick={share}
              className="bg-surface/90 backdrop-blur-sm"
            >
              <Share2 className="h-[18px] w-[18px]" strokeWidth={2} />
            </IconButton>
            <IconButton
              label={t(s.person.bookmark)}
              onClick={() => setSaved((prev) => !prev)}
              className={cn('bg-surface/90 backdrop-blur-sm', saved && 'text-gold')}
            >
              <Bookmark
                className="h-[18px] w-[18px]"
                strokeWidth={2}
                fill={saved ? 'currentColor' : 'none'}
              />
            </IconButton>
          </div>
        </div>
      </motion.div>

      {/* ---------- 2-column on laptop ---------- */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:gap-10">
        <motion.div variants={staggerItem} className="hidden lg:sticky lg:top-8 lg:block lg:self-start">
          {/* ---------- desktop-only top bar, sits above the framed portrait ---------- */}
          <div className="mb-5 flex items-center justify-between">
            <IconButton label={t(s.common.back)} onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" strokeWidth={2} />
            </IconButton>
            <div className="flex items-center gap-2">
              <IconButton label={t(s.person.share)} onClick={share}>
                <Share2 className="h-[18px] w-[18px]" strokeWidth={2} />
              </IconButton>
              <IconButton
                label={t(s.person.bookmark)}
                onClick={() => setSaved((prev) => !prev)}
                className={saved ? 'text-gold' : undefined}
              >
                <Bookmark
                  className="h-[18px] w-[18px]"
                  strokeWidth={2}
                  fill={saved ? 'currentColor' : 'none'}
                />
              </IconButton>
            </div>
          </div>

          <PortraitPanel
            initial={person.initial}
            eraKey={person.eraKey}
            motif={person.motif}
            portrait={person.portrait}
            name={t(person.name)}
            size="lg"
            className="aspect-4/5 w-full rounded-card shadow-soft ring-1 ring-line/50"
          />

          {/* actions — sit under the portrait on desktop */}
          <div className="mt-4 flex flex-col gap-2.5">
            <motion.button
              type="button"
              onClick={() => navigate(`/ai/${person.id}`)}
              whileHover={canHover ? { y: -2 } : undefined}
              whileTap={{ scale: 0.97 }}
              transition={springSoft}
              className={cn(
                'focus-ring flex flex-1 items-center justify-center gap-2 rounded-full',
                'bg-brand px-5 py-3.5 text-[15px] font-semibold text-white shadow-soft',
                'transition-colors hover:bg-brand-dark',
              )}
            >
              <MessageCircle className="h-[18px] w-[18px]" strokeWidth={2.2} />
              {t(s.person.chat)}
            </motion.button>
            <motion.button
              type="button"
              onClick={() => navigate(`/quiz/${person.id}`)}
              whileHover={canHover ? { y: -2 } : undefined}
              whileTap={{ scale: 0.97 }}
              transition={springSoft}
              className={cn(
                'focus-ring flex flex-1 items-center justify-center gap-2 rounded-full',
                'bg-surface px-5 py-3.5 text-[15px] font-semibold text-brand',
                'ring-[1.5px] ring-brand/45 transition-colors hover:bg-brand-tint',
              )}
            >
              <Trophy className="h-[18px] w-[18px]" strokeWidth={2.2} />
              {t(s.person.quiz)}
            </motion.button>
          </div>
        </motion.div>

        <div className="min-w-0">
          <motion.div variants={staggerItem}>
            <EraBadge eraKey={person.eraKey}>{t(person.eraBadge)}</EraBadge>
            <h1 className="mt-3 text-[28px] leading-[1.12] font-bold tracking-tight text-ink sm:text-[34px] lg:text-[40px]">
              {t(person.name)}
            </h1>
            <p className="mt-1.5 text-[15px] font-medium text-brand sm:text-base">
              {t(person.role)}
            </p>
            <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink-soft">
              {t(person.tagline)}
            </p>

            {/* ---------- born / died fact chips ---------- */}
            <div className="mt-4 flex flex-wrap gap-2">
              {facts.map((fact) => (
                <span
                  key={fact.id}
                  className="rounded-tile bg-surface px-3.5 py-2 shadow-soft ring-1 ring-line/60"
                >
                  <span className="block text-[11px] font-medium tracking-wide text-ink-faint uppercase">
                    {fact.label}
                  </span>
                  <span className="mt-0.5 block text-[13.5px] leading-snug font-semibold text-ink">
                    {fact.value}
                  </span>
                </span>
              ))}
            </div>

            {/* actions — desktop shows these under the sticky portrait instead */}
            <div className="mt-5 flex gap-2.5 sm:mt-6 lg:hidden">
              <motion.button
                type="button"
                onClick={() => navigate(`/ai/${person.id}`)}
                whileHover={canHover ? { y: -2 } : undefined}
                whileTap={{ scale: 0.97 }}
                transition={springSoft}
                className={cn(
                  'focus-ring flex flex-1 items-center justify-center gap-2 rounded-full',
                  'bg-brand px-5 py-3.5 text-[15px] font-semibold text-white shadow-soft',
                  'transition-colors hover:bg-brand-dark',
                )}
              >
                <MessageCircle className="h-[18px] w-[18px]" strokeWidth={2.2} />
                {t(s.person.chat)}
              </motion.button>
              <motion.button
                type="button"
                onClick={() => navigate(`/quiz/${person.id}`)}
                whileHover={canHover ? { y: -2 } : undefined}
                whileTap={{ scale: 0.97 }}
                transition={springSoft}
                className={cn(
                  'focus-ring flex flex-1 items-center justify-center gap-2 rounded-full',
                  'bg-surface px-5 py-3.5 text-[15px] font-semibold text-brand',
                  'ring-[1.5px] ring-brand/45 transition-colors hover:bg-brand-tint',
                )}
              >
                <Trophy className="h-[18px] w-[18px]" strokeWidth={2.2} />
                {t(s.person.quiz)}
              </motion.button>
            </div>
          </motion.div>

          <motion.section variants={staggerItem} className="mt-7">
            <div className="mb-3 flex items-center gap-2">
              <MotifIcon
                motif={person.motif}
                className="h-[18px] w-[18px]"
                strokeWidth={2}
              />
              <h2 className="text-[17px] font-semibold text-ink">
                {t(s.person.biography)}
              </h2>
            </div>
            <div
              className="rounded-card bg-surface p-5 shadow-soft ring-1 ring-line/60 sm:p-6"
              style={{ borderLeft: `4px solid ${color}` }}
            >
              <p className="text-[15.5px] leading-[1.75] text-ink">
                {t(person.bio)}
              </p>
              <p className="mt-4 text-[13px] text-ink-faint">
                {t(eras[person.eraKey].label)}
              </p>
            </div>
          </motion.section>

          <motion.section variants={staggerItem} className="mt-7">
            <div className="mb-3 flex items-center gap-2">
              <Medal className="h-[18px] w-[18px]" strokeWidth={2} />
              <h2 className="text-[17px] font-semibold text-ink">
                {t(s.person.achievements)}
              </h2>
            </div>
            <ul
              className="space-y-3 rounded-card bg-surface p-5 shadow-soft ring-1 ring-line/60 sm:p-6"
              style={{ borderLeft: `4px solid ${color}` }}
            >
              {person.achievements.map((item) => (
                <li key={item.ru} className="flex items-start gap-2.5">
                  <span
                    className="mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full text-white"
                    style={{ backgroundColor: color }}
                  >
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  <span className="text-[15px] leading-relaxed text-ink">
                    {t(item)}
                  </span>
                </li>
              ))}
            </ul>
          </motion.section>

          <motion.section variants={staggerItem} className="mt-7">
            <div className="mb-3 flex items-center gap-2">
              <Landmark className="h-[18px] w-[18px]" strokeWidth={2} />
              <h2 className="text-[17px] font-semibold text-ink">
                {t(s.person.legacyToday)}
              </h2>
            </div>
            <div
              className="rounded-card bg-surface p-5 shadow-soft ring-1 ring-line/60 sm:p-6"
              style={{ borderLeft: `4px solid ${color}` }}
            >
              <p className="text-[15.5px] leading-[1.75] text-ink">
                {t(person.legacyToday)}
              </p>
            </div>
          </motion.section>

          {related.length > 0 && (
            <motion.section variants={staggerItem} className="mt-7">
              <h2 className="mb-3 text-[17px] font-semibold text-ink">
                {t(s.person.relatedSites)}
              </h2>
              <div className="flex flex-wrap gap-2">
                {related.map((site) => (
                  <Link
                    key={site.id}
                    to="/map"
                    className="focus-ring inline-flex items-center gap-1.5 rounded-full bg-surface px-4 py-2 text-[13.5px] font-medium text-ink-soft shadow-soft ring-1 ring-line/60 hover:text-ink"
                  >
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-ink-faint" strokeWidth={2} />
                    {t(site.name)}
                  </Link>
                ))}
              </div>
            </motion.section>
          )}

          {alsoSee.length > 0 && (
            <motion.section variants={staggerItem} className="mt-7">
              <h2 className="mb-3 text-[17px] font-semibold text-ink">
                {t(s.person.sameEra)}
                <span className="ml-2 text-[14px] font-medium text-ink-faint">
                  {t(eras[person.eraKey].label)}
                </span>
              </h2>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                {alsoSee.map((other) => (
                  <Link
                    key={other.id}
                    to={`/person/${other.id}`}
                    className="focus-ring flex items-center gap-3 rounded-tile bg-surface p-3 shadow-soft ring-1 ring-line/60 transition-shadow hover:shadow-lift"
                  >
                    <PortraitPanel
                      initial={other.initial}
                      eraKey={other.eraKey}
                      motif={other.motif}
                      portrait={other.portrait}
                      name={t(other.name)}
                      size="sm"
                      className="h-11 w-11 shrink-0 rounded-xl"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-semibold text-ink">
                        {t(other.name)}
                      </span>
                      <span className="block truncate text-[12.5px] text-ink-faint">
                        {t(other.role)}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </motion.section>
          )}
        </div>
      </div>
    </motion.div>
  )
}
