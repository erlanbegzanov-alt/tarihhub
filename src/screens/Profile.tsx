import { motion, useReducedMotion } from 'framer-motion'
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
import { useEffect, useState } from 'react'
import { MotifIcon } from '../components/Motif'
import { RankBadge, RankStatusPill } from '../components/RankBadge'
import { RankSheet } from '../components/RankSheet'
import { IconButton, ProgressBar } from '../components/ui'
import { eraColor } from '../data/eras'
import { badges } from '../data/lessons'
import { rankInfo, ranks } from '../data/ranks'
import { s } from '../i18n/strings'
import { useLang } from '../i18n/useLang'
import { cn } from '../lib/cn'
import { springSoft, staggerContainer, staggerItem } from '../lib/motion'
import {
  DEFAULT_STATE,
  levelInfo,
  normalizeProfile,
  replaceProfile,
  setAvatarGender,
  setDisplayedAvatarTier,
  setDisplayedRankTier,
  useProfile,
} from '../lib/progress'
import { OWNER_TIER_INDEX, OWNER_TITLE } from '../lib/rankStyle'
import { signOutUser, updateDisplayName, useSession } from '../lib/session'
import { useTheme } from '../lib/theme'
import type { ThemePreference } from '../lib/theme'

/** The theme segmented control, in the order it reads on screen. */
const THEME_OPTIONS: { value: ThemePreference; label: typeof s.profile.themeLight }[] = [
  { value: 'light', label: s.profile.themeLight },
  { value: 'dark', label: s.profile.themeDark },
  { value: 'system', label: s.profile.themeSystem },
]

/**
 * Hidden developer panel (see "🛠 Dev режим" below). Off by default for every
 * normal visitor — only active once this localStorage flag is set, which
 * only happens via the `?dev=1` query param or a previous dev session.
 */
const DEV_MODE_KEY = 'tarihhub_dev'

/**
 * The one account the owner tier is granted to. Checked against the *signed-in
 * Firebase session*, not against anything the browser can set — unlike
 * `DEV_MODE_KEY` above, which is a plain localStorage flag anyone with the
 * `?dev=1` link can flip. Email rather than UID because the UID isn't knowable
 * without reading it out of a live session first, and this address is already
 * Google-verified by the time Firebase reports it.
 */
const OWNER_EMAIL = 'erlanbegzanov@gmail.com'

function readDevModeFlag(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(DEV_MODE_KEY) === '1'
  } catch {
    return false
  }
}

export function Profile() {
  const { t, lang, setLang } = useLang()
  const reduceMotion = useReducedMotion()
  const profile = useProfile()
  const level = levelInfo(profile.xp)
  const gender = profile.avatarGender
  const rank = gender ? rankInfo(profile.xp, gender) : null
  const session = useSession()
  const { preference: themePreference, resolved: resolvedTheme, setTheme } = useTheme()
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [rankSheetOpen, setRankSheetOpen] = useState(false)
  const [rankSheetMode, setRankSheetMode] = useState<'avatar' | 'title'>('title')

  // ---------- rank display ----------
  const ownerTierAvailable = session.user?.email === OWNER_EMAIL
  const realTierIndex = rank?.tierIndex ?? 0
  /**
   * What the profile shows. A stored choice only counts if it is a tier this
   * account can actually claim — an earned one, or the owner tier for the owner
   * — so it degrades to the real tier rather than being trusted on its face.
   * Real XP is read from `profile.xp` throughout and never from this. The
   * title and avatar are two independent choices, so this resolution runs
   * once per choice below.
   */
  const resolveDisplayedTier = (chosen: number | null) => {
    if (chosen === null) return realTierIndex
    if (chosen === OWNER_TIER_INDEX) return ownerTierAvailable ? chosen : realTierIndex
    return chosen <= realTierIndex ? chosen : realTierIndex
  }
  const displayedTitleTierIndex = resolveDisplayedTier(profile.displayedRankTier)
  const displayedAvatarTierIndex = resolveDisplayedTier(profile.displayedAvatarTier)
  const displayedTitle =
    displayedTitleTierIndex === OWNER_TIER_INDEX
      ? t(OWNER_TITLE)
      : gender
        ? t(ranks[displayedTitleTierIndex].title[gender])
        : t(s.profile.rankPickTitle)

  // ---------- dev mode ----------
  const [devMode, setDevMode] = useState(() => readDevModeFlag())
  const [xpDraft, setXpDraft] = useState('')
  const [jsonDraft, setJsonDraft] = useState(() => JSON.stringify(profile, null, 2))
  const [jsonError, setJsonError] = useState<string | null>(null)

  // `?dev=1` flips the flag on (persisted in localStorage) and is then
  // stripped from the address bar so it doesn't linger in history/URL bar.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('dev') !== '1') return
    try {
      window.localStorage.setItem(DEV_MODE_KEY, '1')
    } catch {
      /* storage unavailable — dev mode just won't persist across reloads */
    }
    params.delete('dev')
    const query = params.toString()
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`,
    )
    setDevMode(true)
  }, [])

  // Keeps the JSON editor showing the live profile (e.g. after a tier-jump
  // click) rather than going stale the moment something else changes it.
  useEffect(() => {
    setJsonDraft(JSON.stringify(profile, null, 2))
  }, [profile])

  const disableDevMode = () => {
    try {
      window.localStorage.removeItem(DEV_MODE_KEY)
    } catch {
      /* storage unavailable */
    }
    setDevMode(false)
  }

  const applyXpDraft = () => {
    const parsed = Number(xpDraft)
    if (!Number.isFinite(parsed)) return
    replaceProfile({ ...profile, xp: Math.round(parsed) })
  }

  const applyJsonDraft = () => {
    try {
      replaceProfile(normalizeProfile(JSON.parse(jsonDraft)))
      setJsonError(null)
    } catch (error) {
      setJsonError(error instanceof Error ? error.message : 'Некорректный JSON')
    }
  }

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
                {gender ? (
                  <motion.button
                    type="button"
                    onClick={() => {
                      setRankSheetMode('avatar')
                      setRankSheetOpen(true)
                    }}
                    aria-expanded={rankSheetOpen}
                    aria-label={t(s.profile.rankSheetTitle)}
                    whileHover={reduceMotion ? undefined : { scale: 1.04 }}
                    whileTap={reduceMotion ? undefined : { scale: 0.96 }}
                    transition={springSoft}
                    className="focus-ring block cursor-pointer rounded-full"
                  >
                    <RankBadge
                      tierIndex={displayedAvatarTierIndex}
                      gender={gender}
                      title={displayedTitle}
                      size={64}
                      className="h-16 w-16 sm:!h-[72px] sm:!w-[72px]"
                    />
                  </motion.button>
                ) : photoURL ? (
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
                <RankStatusPill
                  tierIndex={displayedTitleTierIndex}
                  title={displayedTitle}
                  expanded={rankSheetOpen}
                  onClick={() => {
                    setRankSheetMode('title')
                    setRankSheetOpen(true)
                  }}
                />
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

          {/* ---------- dev mode ---------- */}
          {devMode && (
            <motion.section
              variants={staggerItem}
              className="rounded-card border-2 border-dashed border-line bg-surface p-5 shadow-soft sm:p-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-[17px] font-semibold text-ink">🛠 Dev режим</h2>
                <button
                  type="button"
                  onClick={disableDevMode}
                  className="focus-ring shrink-0 rounded-full bg-cream px-4 py-1.5 text-[12.5px] font-bold text-ink-soft transition-colors hover:text-ink"
                >
                  Выключить dev-режим
                </button>
              </div>

              {/* rank-tier jump */}
              <div className="mt-4">
                <p className="mb-2 text-[12.5px] font-semibold text-ink-soft">
                  Быстрый переход по рангам
                </p>
                <div className="flex flex-wrap gap-2">
                  {ranks.map((tier, index) => (
                    <button
                      key={tier.minXp}
                      type="button"
                      onClick={() => replaceProfile({ ...profile, xp: tier.minXp })}
                      className="focus-ring rounded-full bg-cream px-3.5 py-1.5 text-[12.5px] font-semibold text-ink-soft transition-colors hover:text-ink"
                    >
                      {index + 1} — {tier.title.m.ru} / {tier.title.f.ru}
                    </button>
                  ))}
                </div>
              </div>

              {/* gender toggle */}
              <div className="mt-4 border-t border-line-soft pt-4">
                <p className="mb-2 text-[12.5px] font-semibold text-ink-soft">
                  Пол аватара
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAvatarGender('m')}
                    className="focus-ring rounded-full bg-cream px-4 py-1.5 text-[12.5px] font-semibold text-ink-soft transition-colors hover:text-ink"
                  >
                    м
                  </button>
                  <button
                    type="button"
                    onClick={() => setAvatarGender('f')}
                    className="focus-ring rounded-full bg-cream px-4 py-1.5 text-[12.5px] font-semibold text-ink-soft transition-colors hover:text-ink"
                  >
                    ж
                  </button>
                </div>
              </div>

              {/* raw xp */}
              <div className="mt-4 border-t border-line-soft pt-4">
                <p className="mb-2 text-[12.5px] font-semibold text-ink-soft">
                  Произвольный XP
                </p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={xpDraft}
                    onChange={(event) => setXpDraft(event.target.value)}
                    placeholder={String(profile.xp)}
                    className="focus-ring w-32 rounded-tile bg-cream px-3.5 py-1.5 text-[13.5px] text-ink outline-none"
                  />
                  <button
                    type="button"
                    onClick={applyXpDraft}
                    className="focus-ring rounded-full bg-cream px-4 py-1.5 text-[12.5px] font-semibold text-ink-soft transition-colors hover:text-ink"
                  >
                    Применить
                  </button>
                </div>
              </div>

              {/* full JSON editor */}
              <div className="mt-4 border-t border-line-soft pt-4">
                <p className="mb-2 text-[12.5px] font-semibold text-ink-soft">
                  Полный JSON-редактор профиля
                </p>
                <textarea
                  value={jsonDraft}
                  onChange={(event) => setJsonDraft(event.target.value)}
                  rows={12}
                  spellCheck={false}
                  className="focus-ring w-full rounded-tile bg-cream px-3.5 py-2.5 font-mono text-[12px] leading-relaxed text-ink outline-none"
                />
                <div className="mt-2 flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={applyJsonDraft}
                    className="focus-ring rounded-full bg-cream px-4 py-1.5 text-[12.5px] font-semibold text-ink-soft transition-colors hover:text-ink"
                  >
                    Применить JSON
                  </button>
                  {jsonError && (
                    <p className="rounded-tile bg-wrong-tint px-3 py-1.5 text-[12px] font-medium text-wrong">
                      {jsonError}
                    </p>
                  )}
                </div>
              </div>

              {/* reset */}
              <div className="mt-4 border-t border-line-soft pt-4">
                <button
                  type="button"
                  onClick={() => replaceProfile(DEFAULT_STATE)}
                  className="focus-ring rounded-full bg-wrong-tint px-4 py-1.5 text-[12.5px] font-bold text-wrong transition-colors hover:opacity-80"
                >
                  Сбросить профиль
                </button>
              </div>
            </motion.section>
          )}

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

      <RankSheet
        open={rankSheetOpen}
        onClose={() => setRankSheetOpen(false)}
        gender={gender}
        onPickGender={setAvatarGender}
        realTierIndex={realTierIndex}
        displayedAvatarTierIndex={displayedAvatarTierIndex}
        displayedTitleTierIndex={displayedTitleTierIndex}
        initialMode={rankSheetMode}
        onSelectAvatar={(tierIndex) =>
          // `null` restores the default "show whatever XP reaches", so picking
          // the real tier back doesn't pin it in place as new XP arrives.
          setDisplayedAvatarTier(tierIndex === realTierIndex ? null : tierIndex)
        }
        onSelectTitle={(tierIndex) =>
          setDisplayedRankTier(tierIndex === realTierIndex ? null : tierIndex)
        }
        ownerTierAvailable={ownerTierAvailable}
        xp={profile.xp}
      />
    </motion.div>
  )
}
