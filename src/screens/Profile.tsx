import { motion } from 'framer-motion'
import {
  Check,
  Compass,
  Flame,
  Languages,
  LogOut,
  Medal,
  Moon,
  Pencil,
  Sun,
  Trophy,
  UserRound,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { MotifIcon } from '../components/Motif'
import { IconButton, ProgressBar } from '../components/ui'
import { eraColor } from '../data/eras'
import { badges } from '../data/lessons'
import { s } from '../i18n/strings'
import { useLang } from '../i18n/useLang'
import { cn } from '../lib/cn'
import { springSoft, staggerContainer, staggerItem } from '../lib/motion'
import { levelInfo, useProfile } from '../lib/progress'
import { signOutUser, updateDisplayName, useSession } from '../lib/session'
import { useTheme } from '../lib/theme'
import type { ThemePreference } from '../lib/theme'

/** The theme segmented control, in the order it reads on screen. */
const THEME_OPTIONS: { value: ThemePreference; label: typeof s.profile.themeLight }[] = [
  { value: 'light', label: s.profile.themeLight },
  { value: 'dark', label: s.profile.themeDark },
  { value: 'system', label: s.profile.themeSystem },
]

export function Profile() {
  const { t, lang, setLang } = useLang()
  const profile = useProfile()
  const level = levelInfo(profile.xp)
  const session = useSession()
  const { preference: themePreference, resolved: resolvedTheme, setTheme } = useTheme()
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')

  // The real Google identity, or whatever the user renamed it to.
  const displayName =
    session.user?.displayName || session.user?.email || t(s.profile.userName)
  const photoURL = session.user?.photoURL ?? ''

  const startEditingName = () => {
    setNameDraft(displayName)
    setEditingName(true)
  }

  const saveName = async () => {
    const trimmed = nameDraft.trim()
    setEditingName(false)
    if (trimmed && trimmed !== displayName) {
      await updateDisplayName(trimmed)
    }
  }

  const unlockedCount = badges.filter(
    (badge) => badge.unlocked || profile.unlockedBadges.includes(badge.id),
  ).length

  const stats = [
    {
      id: 'streak',
      icon: Flame,
      value: profile.streak,
      label: t(s.profile.streak),
      color: 'var(--color-era-saka)',
    },
    {
      id: 'quizzes',
      icon: Trophy,
      value: profile.quizzesCompleted,
      label: t(s.profile.quizzes),
      color: 'var(--color-gold)',
    },
    {
      id: 'achievements',
      icon: Medal,
      value: unlockedCount,
      label: t(s.profile.achievements),
      color: 'var(--color-brand)',
    },
    {
      id: 'peopleExplored',
      icon: Compass,
      value: profile.peopleViewed.length,
      label: t(s.profile.peopleExplored),
      color: 'var(--color-era-turkic)',
    },
  ]

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      <motion.div variants={staggerItem}>
        <h1 className="text-2xl font-bold tracking-tight text-ink md:text-[28px]">
          {t(s.profile.title)}
        </h1>
      </motion.div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start">
        <div className="flex flex-col gap-5">
          {/* ---------- identity card ---------- */}
          <motion.section
            variants={staggerItem}
            className="rounded-card bg-surface p-5 shadow-soft ring-1 ring-line/60 sm:p-6"
          >
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                {photoURL ? (
                  <img
                    src={photoURL}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="h-16 w-16 rounded-full object-cover ring-1 ring-line/60 sm:h-[72px] sm:w-[72px]"
                  />
                ) : (
                  <div
                    className="grid h-16 w-16 place-items-center rounded-full text-2xl font-bold text-white sm:h-[72px] sm:w-[72px]"
                    style={{
                      background:
                        'linear-gradient(140deg, var(--color-brand) 0%, color-mix(in srgb, var(--color-era-turkic) 60%, var(--color-brand)) 100%)',
                    }}
                  >
                    {displayName.charAt(0)}
                  </div>
                )}
                <motion.span
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ ...springSoft, delay: 0.2 }}
                  className="absolute -right-1 -bottom-1 grid h-7 w-7 place-items-center rounded-full bg-gold text-[12px] font-bold text-white ring-[3px] ring-surface"
                >
                  {level.level}
                </motion.span>
              </div>

              <div className="min-w-0 flex-1">
                {editingName ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={nameDraft}
                      onChange={(event) => setNameDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') void saveName()
                        if (event.key === 'Escape') setEditingName(false)
                      }}
                      placeholder={t(s.profile.namePlaceholder)}
                      autoFocus
                      className={cn(
                        'min-w-0 flex-1 rounded-full bg-cream px-3.5 py-1.5',
                        'text-[17px] font-bold tracking-tight text-ink',
                        'ring-1 ring-brand/45 focus:outline-none',
                      )}
                    />
                    <IconButton label={t(s.profile.save)} onClick={() => void saveName()}>
                      <Check className="h-4 w-4 text-brand" strokeWidth={2.4} />
                    </IconButton>
                    <IconButton
                      label={t(s.common.cancel)}
                      onClick={() => setEditingName(false)}
                    >
                      <X className="h-4 w-4" strokeWidth={2.2} />
                    </IconButton>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <h2 className="truncate text-xl font-bold tracking-tight text-ink">
                      {displayName}
                    </h2>
                    {session.user && (
                      <IconButton
                        label={t(s.profile.editName)}
                        onClick={startEditingName}
                        className="shrink-0"
                      >
                        <Pencil className="h-[15px] w-[15px]" strokeWidth={2.1} />
                      </IconButton>
                    )}
                  </div>
                )}
                <p className="mt-0.5 truncate text-[13.5px] text-ink-soft">
                  {t(s.profile.role)} · {level.level}
                  {t(s.profile.levelShort)}
                </p>
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <span className="text-[12.5px] font-medium text-ink-soft">
                  {level.nextLevel}
                  {t(s.profile.toNextLevel)}
                </span>
                <span className="text-[12.5px] font-bold text-ink">
                  {level.xpInLevel} / {level.xpForLevel} XP
                </span>
              </div>
              <ProgressBar percent={level.percent} height={8} />
            </div>

            {/* ---------- stats ---------- */}
            <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {stats.map((stat) => {
                const Icon = stat.icon
                return (
                  <div
                    key={stat.id}
                    className="rounded-tile bg-cream px-2 py-3.5 text-center"
                  >
                    <span
                      className="mx-auto grid h-9 w-9 place-items-center rounded-full bg-surface"
                      style={{ color: stat.color }}
                    >
                      <Icon className="h-[18px] w-[18px]" strokeWidth={2.1} />
                    </span>
                    <p className="mt-2 text-xl font-bold text-ink">{stat.value}</p>
                    <p className="mt-0.5 text-[11.5px] leading-tight text-ink-faint">
                      {stat.label}
                    </p>
                  </div>
                )
              })}
            </div>
          </motion.section>

          {/* ---------- settings ---------- */}
          <motion.section
            variants={staggerItem}
            className="rounded-card bg-surface p-5 shadow-soft ring-1 ring-line/60 sm:p-6"
          >
            <h2 className="text-[17px] font-semibold text-ink">
              {t(s.profile.settingsTitle)}
            </h2>

            <div className="mt-4 flex items-center justify-between gap-4">
              <span className="flex items-center gap-2.5 text-[14.5px] font-medium text-ink">
                <Languages className="h-[18px] w-[18px] text-ink-faint" strokeWidth={2} />
                {t(s.profile.language)}
              </span>
              <div className="flex rounded-full bg-cream p-1">
                {(['kz', 'ru'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setLang(option)}
                    aria-pressed={lang === option}
                    className={cn(
                      'focus-ring relative rounded-full px-4 py-1.5 text-[12.5px] font-bold transition-colors duration-200',
                      lang === option ? 'text-white' : 'text-ink-faint hover:text-ink',
                    )}
                  >
                    {lang === option && (
                      <motion.span
                        layoutId="lang-toggle"
                        className="absolute inset-0 rounded-full bg-brand"
                        transition={springSoft}
                      />
                    )}
                    <span className="relative z-10">
                      {option === 'kz' ? 'ҚАЗ' : 'РУС'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-4 border-t border-line-soft pt-4">
              <span className="flex items-center gap-2.5 text-[14.5px] font-medium text-ink">
                {resolvedTheme === 'dark' ? (
                  <Moon className="h-[18px] w-[18px] text-ink-faint" strokeWidth={2} />
                ) : (
                  <Sun className="h-[18px] w-[18px] text-ink-faint" strokeWidth={2} />
                )}
                {t(s.profile.theme)}
              </span>
              <div className="flex shrink-0 rounded-full bg-cream p-1">
                {THEME_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTheme(option.value)}
                    aria-pressed={themePreference === option.value}
                    className={cn(
                      'focus-ring relative rounded-full px-3 py-1.5 text-[12.5px] font-bold transition-colors duration-200',
                      themePreference === option.value
                        ? 'text-white'
                        : 'text-ink-faint hover:text-ink',
                    )}
                  >
                    {themePreference === option.value && (
                      <motion.span
                        layoutId="theme-toggle"
                        className="absolute inset-0 rounded-full bg-brand"
                        transition={springSoft}
                      />
                    )}
                    <span className="relative z-10">{t(option.label)}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ---------- account ---------- */}
            <div className="mt-4 flex items-center justify-between gap-4 border-t border-line-soft pt-4">
              <span className="flex min-w-0 items-center gap-2.5 text-[14.5px] font-medium text-ink">
                <UserRound
                  className="h-[18px] w-[18px] shrink-0 text-ink-faint"
                  strokeWidth={2}
                />
                <span className="min-w-0">
                  <span className="block truncate">{t(s.profile.account)}</span>
                  <span className="block truncate text-[12px] font-normal text-ink-faint">
                    {session.user
                      ? session.user.email || t(s.auth.syncOn)
                      : t(s.auth.loading)}
                  </span>
                </span>
              </span>

              {/* Reaching Profile at all already requires a signed-in user
                  (see App.tsx's mandatory sign-in gate), so sign-out is the
                  only action this control ever needs to offer. */}
              <button
                type="button"
                onClick={() => void signOutUser()}
                className={cn(
                  'focus-ring flex shrink-0 items-center gap-1.5 rounded-full bg-cream px-4 py-1.5',
                  'text-[12.5px] font-bold text-ink-soft transition-colors hover:text-ink',
                )}
              >
                <LogOut className="h-[14px] w-[14px]" strokeWidth={2.2} />
                {t(s.auth.signOut)}
              </button>
            </div>
          </motion.section>
        </div>

        {/* ---------- achievements ---------- */}
        <motion.section variants={staggerItem}>
          <h2 className="mb-3 text-[17px] font-semibold text-ink">
            {t(s.profile.badgesTitle)}
          </h2>
          <motion.ul
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="grid grid-cols-2 gap-2.5 sm:grid-cols-3"
          >
            {badges.map((badge) => {
              const unlocked =
                badge.unlocked || profile.unlockedBadges.includes(badge.id)
              const color = eraColor(badge.eraKey)
              return (
                <motion.li key={badge.id} variants={staggerItem}>
                  <motion.div
                    whileHover={unlocked ? { y: -3 } : undefined}
                    transition={springSoft}
                    className={cn(
                      'flex h-full flex-col items-center rounded-card p-4 text-center',
                      'ring-1 transition-shadow duration-300',
                      unlocked
                        ? 'bg-surface shadow-soft ring-line/60 hover:shadow-lift'
                        : 'bg-surface/50 ring-line/40',
                    )}
                  >
                    <span
                      className="grid h-12 w-12 place-items-center rounded-full"
                      style={{
                        background: unlocked
                          ? `color-mix(in srgb, ${color} 15%, var(--color-surface))`
                          : 'var(--color-cream-deep)',
                        color: unlocked ? color : 'var(--color-ink-faint)',
                      }}
                    >
                      <MotifIcon
                        motif={badge.motif}
                        className="h-[22px] w-[22px]"
                        strokeWidth={1.9}
                      />
                    </span>
                    <p
                      className={cn(
                        'mt-2.5 text-[13.5px] font-semibold',
                        unlocked ? 'text-ink' : 'text-ink-faint',
                      )}
                    >
                      {t(badge.title)}
                    </p>
                    <p className="mt-1 text-[11.5px] leading-snug text-ink-faint">
                      {unlocked ? t(badge.description) : t(s.profile.locked)}
                    </p>
                  </motion.div>
                </motion.li>
              )
            })}
          </motion.ul>
        </motion.section>
      </div>
    </motion.div>
  )
}
