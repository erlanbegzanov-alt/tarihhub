import { motion } from 'framer-motion'
import { Link, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { cn } from '../lib/cn'
import { springSoft } from '../lib/motion'
import { useLang } from '../i18n/useLang'
import { s } from '../i18n/strings'
import { activeNavPath, navItems } from './navItems'
import { InstallPrompt } from './InstallPrompt'
import { Wordmark } from './Wordmark'

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

/* ---------------------------- mobile tab bar --------------------------- */

function BottomNav({ active }: { active: string }) {
  const { t } = useLang()

  return (
    <nav
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 md:hidden',
        'border-t border-line/70 bg-surface/92 backdrop-blur-xl',
      )}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-lg items-stretch">
        {navItems.map((item) => {
          const isActive = active === item.to
          const Icon = item.icon
          return (
            <li key={item.to} className="flex-1">
              <Link
                to={item.to}
                aria-current={isActive ? 'page' : undefined}
                className="focus-ring relative flex flex-col items-center gap-1 px-1 pt-2.5 pb-2"
              >
                <span className="relative grid h-8 w-[52px] place-items-center">
                  {isActive && (
                    <motion.span
                      layoutId="bottomnav-indicator"
                      className="absolute inset-0 rounded-full bg-brand-tint"
                      transition={springSoft}
                    />
                  )}
                  <Icon
                    className={cn(
                      'relative z-10 h-[21px] w-[21px] transition-colors duration-200',
                      isActive ? 'text-brand' : 'text-ink-faint',
                    )}
                    strokeWidth={isActive ? 2.3 : 1.9}
                  />
                </span>
                <span
                  className={cn(
                    'text-[10.5px] font-medium transition-colors duration-200',
                    isActive ? 'text-brand' : 'text-ink-faint',
                  )}
                >
                  {t(item.label)}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/* ------------------------------- shell -------------------------------- */

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const active = activeNavPath(pathname)

  return (
    <div className="min-h-dvh bg-cream">
      <Sidebar active={active} />
      <BottomNav active={active} />
      <InstallPrompt />
      <main className="md:pl-[240px] lg:pl-[264px]">
        <div className="mx-auto w-full max-w-[1180px] px-4 pt-5 pb-28 sm:px-6 md:px-8 md:pt-8 md:pb-12">
          {children}
        </div>
      </main>
    </div>
  )
}
