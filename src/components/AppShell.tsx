import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import type { AvatarGender } from '../data/ranks'
import { cn } from '../lib/cn'
import { springSoft } from '../lib/motion'
import { levelInfo, useProfile } from '../lib/progress'
import { resolveRankIdentity } from '../lib/rankIdentity'
import { OWNER_EMAIL } from '../lib/rankStyle'
import { useSession } from '../lib/session'
import { useLang } from '../i18n/useLang'
import { s } from '../i18n/strings'
import { activeNavPath, navItems } from './navItems'
import { InstallPrompt } from './InstallPrompt'
import { RankBadge } from './RankBadge'
import { Wordmark } from './Wordmark'

/**
 * What both the top-bar's mini avatar and the drawer's profile snippet
 * render from — kept in one place so the two never drift: the same rank
 * badge (or Google photo, or initials) Profile.tsx itself would show.
 */
function useIdentity() {
  const profile = useProfile()
  const session = useSession()
  const { t } = useLang()

  const displayName =
    session.user?.displayName || session.user?.email || t(s.profile.userName)
  const photoURL = session.user?.photoURL ?? ''
  const isOwner = Boolean(session.user?.email) && session.user?.email === OWNER_EMAIL

  const identity = resolveRankIdentity({
    xp: profile.xp,
    avatarGender: profile.avatarGender,
    displayedAvatarTier: profile.displayedAvatarTier,
    displayedRankTier: profile.displayedRankTier,
    isOwner,
  })

  return { displayName, photoURL, identity, level: levelInfo(profile.xp) }
}

function IdentityAvatar({
  size,
  displayName,
  photoURL,
  avatarGender,
  avatarTierIndex,
  title,
}: {
  size: number
  displayName: string
  photoURL: string
  avatarGender: AvatarGender | null
  avatarTierIndex: number
  title: string
}) {
  if (avatarGender) {
    return <RankBadge tierIndex={avatarTierIndex} gender={avatarGender} title={title} size={size} />
  }
  if (photoURL) {
    return (
      <img
        src={photoURL}
        alt=""
        referrerPolicy="no-referrer"
        style={{ height: size, width: size }}
        className="rounded-full object-cover ring-1 ring-line/60"
      />
    )
  }
  return (
    <div
      style={{
        height: size,
        width: size,
        fontSize: size * 0.4,
        // Same gradient as Profile.tsx's own initials fallback.
        background:
          'linear-gradient(140deg, var(--color-brand) 0%, color-mix(in srgb, var(--color-era-turkic) 60%, var(--color-brand)) 100%)',
      }}
      className="grid place-items-center rounded-full font-bold text-white"
    >
      {displayName.charAt(0)}
    </div>
  )
}

/* ---------------------------- desktop rail ---------------------------- */

function Sidebar({ active }: { active: string }) {
  const { t, lang, toggleLang } = useLang()

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 hidden w-[240px] flex-col md:flex lg:w-[264px]',
        'border-r border-line/70 bg-surface/85 backdrop-blur-xl',
      )}
    >
      <div className="px-6 pt-7 pb-6">
        <Link to="/" className="focus-ring rounded-xl" aria-label={t(s.appName)}>
          <Wordmark />
        </Link>
        <p className="mt-2.5 text-xs text-ink-faint">{t(s.appTagline)}</p>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        {navItems.map((item) => {
          const isActive = active === item.to
          const Icon = item.icon
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'group relative flex items-center gap-3 rounded-2xl px-3.5 py-3',
                'focus-ring text-[15px] font-medium transition-colors duration-200',
                isActive ? 'text-white' : 'text-ink-soft hover:text-ink',
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="sidenav-indicator"
                  className="absolute inset-0 rounded-2xl bg-brand shadow-soft"
                  transition={springSoft}
                />
              )}
              {!isActive && (
                <span className="absolute inset-0 rounded-2xl bg-transparent transition-colors duration-200 group-hover:bg-cream" />
              )}
              <Icon
                className="relative z-10 h-[19px] w-[19px]"
                strokeWidth={isActive ? 2.2 : 1.9}
              />
              <span className="relative z-10">{t(item.label)}</span>
            </Link>
          )
        })}
      </nav>

      <div className="px-5 pb-6">
        <button
          type="button"
          onClick={toggleLang}
          className={cn(
            'focus-ring flex w-full items-center justify-between rounded-2xl',
            'bg-cream px-4 py-3 text-sm font-medium text-ink-soft',
            'ring-1 ring-line/70 transition-colors hover:text-ink',
          )}
        >
          <span>{t(s.profile.language)}</span>
          <span className="flex items-center gap-1 text-xs font-bold">
            <span className={lang === 'kz' ? 'text-brand' : 'text-ink-faint'}>
              ҚАЗ
            </span>
            <span className="text-line">/</span>
            <span className={lang === 'ru' ? 'text-brand' : 'text-ink-faint'}>
              РУС
            </span>
          </span>
        </button>
      </div>
    </aside>
  )
}

/* --------------------------- mobile top bar ---------------------------- */

function MobileTopBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { t } = useLang()
  const { displayName, photoURL, identity } = useIdentity()

  return (
    <div
      className={cn(
        'sticky top-0 z-30 flex items-center gap-3 px-4 py-2.5 md:hidden',
        'border-b border-line/70 bg-surface/92 backdrop-blur-xl',
      )}
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 10px)' }}
    >
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label={t(s.nav.openMenu)}
        className="focus-ring grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line/70 bg-cream text-ink transition-colors hover:text-brand"
      >
        <Menu className="h-[19px] w-[19px]" strokeWidth={2} />
      </button>
      <Link to="/" className="focus-ring rounded-lg" aria-label={t(s.appName)}>
        <Wordmark compact className="h-7" />
      </Link>
      <Link to="/profile" className="focus-ring ml-auto shrink-0 rounded-full" aria-label={t(s.nav.profile)}>
        <IdentityAvatar
          size={32}
          displayName={displayName}
          photoURL={photoURL}
          avatarGender={identity.avatarGender}
          avatarTierIndex={identity.avatarTierIndex}
          title={t(identity.titleText)}
        />
      </Link>
    </div>
  )
}

/* ----------------------------- mobile drawer ---------------------------- */

function MobileDrawer({
  open,
  onClose,
  active,
}: {
  open: boolean
  onClose: () => void
  active: string
}) {
  const { t, lang, toggleLang } = useLang()
  const reduceMotion = useReducedMotion()
  const { displayName, photoURL, identity, level } = useIdentity()

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-ink/50"
            aria-hidden="true"
          />
          <motion.nav
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={reduceMotion ? { duration: 0 } : springSoft}
            className={cn(
              'absolute inset-y-0 left-0 flex w-[82%] max-w-[300px] flex-col',
              'bg-surface shadow-rail',
            )}
            style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
            aria-label={t(s.nav.menuTitle)}
          >
            <div className="flex items-center justify-between border-b border-line-soft px-4 py-4">
              <Wordmark compact className="h-6" />
              <button
                type="button"
                onClick={onClose}
                aria-label={t(s.nav.closeMenu)}
                className="focus-ring grid h-8 w-8 place-items-center rounded-lg bg-cream text-ink-soft hover:text-ink"
              >
                <X className="h-[15px] w-[15px]" strokeWidth={2.2} />
              </button>
            </div>

            <Link
              to="/profile"
              onClick={onClose}
              className="focus-ring mx-3 mt-3 flex items-center gap-3 rounded-2xl bg-cream px-3.5 py-3"
            >
              <IdentityAvatar
                size={44}
                displayName={displayName}
                photoURL={photoURL}
                avatarGender={identity.avatarGender}
                avatarTierIndex={identity.avatarTierIndex}
                title={t(identity.titleText)}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-bold text-ink">{displayName}</p>
                <div className="mt-1.5 h-[5px] w-full max-w-[120px] overflow-hidden rounded-full bg-line">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${level.percent}%` }}
                  />
                </div>
                <p className="mt-1 text-[10.5px] font-medium text-ink-faint">
                  {t(s.battle.levelShort)} {level.level} · {level.xpInLevel}/{level.xpForLevel} XP
                </p>
              </div>
            </Link>

            <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pt-3 pb-2">
              {navItems.map((item) => {
                const isActive = active === item.to
                const Icon = item.icon
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={onClose}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'relative flex items-center gap-3 rounded-2xl px-3.5 py-3',
                      'focus-ring text-[14.5px] font-semibold transition-colors duration-200',
                      isActive ? 'bg-brand text-white shadow-soft' : 'text-ink-soft hover:bg-cream hover:text-ink',
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" strokeWidth={isActive ? 2.2 : 1.9} />
                    <span>{t(item.label)}</span>
                  </Link>
                )
              })}
            </div>

            <div className="px-3 pt-2 pb-3">
              <button
                type="button"
                onClick={toggleLang}
                className={cn(
                  'focus-ring flex w-full items-center justify-between rounded-2xl',
                  'bg-cream px-4 py-3 text-sm font-medium text-ink-soft',
                  'ring-1 ring-line/70 transition-colors hover:text-ink',
                )}
              >
                <span>{t(s.profile.language)}</span>
                <span className="flex items-center gap-1 text-xs font-bold">
                  <span className={lang === 'kz' ? 'text-brand' : 'text-ink-faint'}>ҚАЗ</span>
                  <span className="text-line">/</span>
                  <span className={lang === 'ru' ? 'text-brand' : 'text-ink-faint'}>РУС</span>
                </span>
              </button>
            </div>
          </motion.nav>
        </div>
      )}
    </AnimatePresence>
  )
}

/* ------------------------------- shell -------------------------------- */

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const active = activeNavPath(pathname)
  const [menuOpen, setMenuOpen] = useState(false)

  // A route change from any source (drawer link, back button, deep link)
  // should never leave the drawer sitting open over the new screen.
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  return (
    <div className="min-h-dvh bg-cream">
      <Sidebar active={active} />
      <MobileTopBar onOpenMenu={() => setMenuOpen(true)} />
      <MobileDrawer open={menuOpen} onClose={() => setMenuOpen(false)} active={active} />
      <InstallPrompt />
      <main className="md:pl-[240px] lg:pl-[264px]">
        <div className="mx-auto w-full max-w-[1180px] px-4 pt-5 pb-8 sm:px-6 md:px-8 md:pt-8 md:pb-12">
          {children}
        </div>
      </main>
    </div>
  )
}
