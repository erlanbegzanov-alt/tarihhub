import { AnimatePresence, motion } from 'framer-motion'
import { Lock, Star, X } from 'lucide-react'
import { useEffect } from 'react'
import type { AvatarGender } from '../data/ranks'
import { ranks } from '../data/ranks'
import { s } from '../i18n/strings'
import { useLang } from '../i18n/useLang'
import { cn } from '../lib/cn'
import { easeOut, springSoft } from '../lib/motion'
import { OWNER_TIER_INDEX, OWNER_TITLE, tierEffect } from '../lib/rankStyle'
import { RankBadge } from './RankBadge'
import { FilterChip, ProgressBar } from './ui'

/**
 * The full title ladder, as a bottom sheet on phones and a centred dialog from
 * 560px up.
 *
 * Every earned tier can be picked as the one the profile shows off; the tier XP
 * has actually reached is marked with a star when it isn't the one on display.
 * Locked tiers are still rendered with their own animation running — blurred,
 * under a crisp lock — so what's coming is visible without being readable.
 */
export function RankSheet({
  open,
  onClose,
  gender,
  onPickGender,
  realTierIndex,
  displayedTierIndex,
  onSelect,
  ownerTierAvailable,
  xp,
}: {
  open: boolean
  onClose: () => void
  /** `null` until the reader picks a title track — then the sheet asks for one. */
  gender: AvatarGender | null
  onPickGender: (gender: AvatarGender) => void
  /** Tier the reader's real XP reaches. */
  realTierIndex: number
  /** Tier currently on display, which may be any earned tier at or below it. */
  displayedTierIndex: number
  onSelect: (tierIndex: number) => void
  ownerTierAvailable: boolean
  xp: number
}) {
  const { t } = useLang()

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const nextRank = gender ? ranks[realTierIndex + 1] : undefined
  const currentMinXp = ranks[realTierIndex].minXp
  const rankPercent = nextRank
    ? Math.round(((xp - currentMinXp) / (nextRank.minXp - currentMinXp)) * 100)
    : 100

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
          <motion.button
            type="button"
            aria-label={t(s.common.close)}
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: easeOut }}
            className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t(s.profile.rankSheetTitle)}
            initial={{ opacity: 0, y: 28, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={springSoft}
            className={cn(
              'relative z-10 max-h-[82vh] w-full max-w-md overflow-y-auto',
              'rounded-t-card bg-surface p-5 shadow-lift sm:rounded-card sm:p-6',
            )}
          >
            <span
              aria-hidden
              className="mx-auto mb-3.5 block h-1 w-9 rounded-full bg-line sm:hidden"
            />

            <div className="flex items-start justify-between gap-4">
              <h2 className="text-[17px] font-semibold text-ink">
                {t(s.profile.rankSheetTitle)}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label={t(s.common.close)}
                className="focus-ring -mt-1 -mr-1 grid h-9 w-9 place-items-center rounded-full text-ink-faint hover:text-ink"
              >
                <X className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>

            {!gender ? (
              <>
                <p className="mt-1 text-[13.5px] text-ink-soft">
                  {t(s.profile.rankPickTitle)}
                </p>
                <div className="mt-3 flex gap-2">
                  <FilterChip
                    active={false}
                    layoutGroup="rank-gender"
                    onClick={() => onPickGender('m')}
                  >
                    {t(s.profile.rankMale)}
                  </FilterChip>
                  <FilterChip
                    active={false}
                    layoutGroup="rank-gender"
                    onClick={() => onPickGender('f')}
                  >
                    {t(s.profile.rankFemale)}
                  </FilterChip>
                </div>
              </>
            ) : (
              <>
                <p className="mt-1 text-[12.5px] leading-snug text-ink-soft">
                  {t(s.profile.rankSheetHint)}
                </p>

                {/* Always the real XP, never the tier on display. */}
                <div className="mt-4">
                  {nextRank ? (
                    <>
                      <div className="mb-2 flex items-baseline justify-between gap-3">
                        <span className="truncate text-[12.5px] font-medium text-ink-soft">
                          {t(s.profile.rankNext)}: {t(nextRank.title[gender])}
                        </span>
                        <span className="shrink-0 text-[12.5px] font-bold text-ink">
                          {xp - currentMinXp} / {nextRank.minXp - currentMinXp} XP
                        </span>
                      </div>
                      <ProgressBar
                        percent={rankPercent}
                        height={8}
                        color="var(--color-gold)"
                      />
                    </>
                  ) : (
                    <p className="text-[12.5px] font-medium text-ink-soft">
                      {t(s.profile.rankMax)}
                    </p>
                  )}
                </div>

                <ul className="mt-5 grid grid-cols-3 gap-y-3.5 border-t border-line-soft pt-5">
                  {ranks.map((tier, index) => (
                    <TierTile
                      key={tier.minXp}
                      tierIndex={index}
                      gender={gender}
                      title={t(tier.title[gender])}
                      caption={
                        index > realTierIndex
                          ? `${t(s.profile.rankOpensAt)} ${tier.minXp} XP`
                          : undefined
                      }
                      unlocked={index <= realTierIndex}
                      selected={index === displayedTierIndex}
                      starred={index === realTierIndex && index !== displayedTierIndex}
                      lockedLabel={t(s.profile.locked)}
                      reachedLabel={t(s.profile.rankReached)}
                      onSelect={onSelect}
                    />
                  ))}

                  {/* Identity-gated, so it never appears for anyone else and
                      never carries a lock state for the one account it does. */}
                  {ownerTierAvailable && (
                    <TierTile
                      tierIndex={OWNER_TIER_INDEX}
                      gender={gender}
                      title={t(OWNER_TITLE)}
                      unlocked
                      selected={displayedTierIndex === OWNER_TIER_INDEX}
                      starred={false}
                      lockedLabel={t(s.profile.locked)}
                      reachedLabel={t(s.profile.rankReached)}
                      onSelect={onSelect}
                    />
                  )}
                </ul>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

function TierTile({
  tierIndex,
  gender,
  title,
  caption,
  unlocked,
  selected,
  starred,
  lockedLabel,
  reachedLabel,
  onSelect,
}: {
  tierIndex: number
  gender: AvatarGender
  title: string
  caption?: string
  unlocked: boolean
  selected: boolean
  starred: boolean
  lockedLabel: string
  reachedLabel: string
  onSelect: (tierIndex: number) => void
}) {
  const fx = tierEffect(tierIndex)

  const badge = (
    <span
      className="relative block rounded-full"
      style={
        selected
          ? {
              boxShadow: `0 0 0 2.5px var(--color-surface), 0 0 0 4.5px ${
                fx.color ?? 'var(--color-brand)'
              }`,
            }
          : undefined
      }
    >
      <RankBadge tierIndex={tierIndex} gender={gender} title={title} size={56} />
    </span>
  )

  const body = (
    <>
      <span className="relative mx-auto block w-14">
        {unlocked ? (
          badge
        ) : (
          <>
            {/* Blurred, but still animating underneath — a tease, not a reveal. */}
            <span aria-hidden className="block blur-[3.5px]">
              {badge}
            </span>
            <span className="absolute inset-0 grid place-items-center text-ink-faint">
              <Lock
                className="h-[15px] w-[15px]"
                strokeWidth={2.2}
                role="img"
                aria-label={lockedLabel}
              />
            </span>
          </>
        )}

        {starred && (
          <span
            title={reachedLabel}
            className="absolute -top-1 -right-1 grid h-[15px] w-[15px] place-items-center rounded-full bg-brand text-white ring-2 ring-surface"
          >
            <Star className="h-2 w-2 fill-current" strokeWidth={0} aria-hidden />
          </span>
        )}
      </span>

      <span
        className={cn(
          'mt-1.5 block px-1 text-[11.5px] leading-tight font-semibold transition-colors',
          unlocked ? 'text-ink group-hover:text-brand' : 'text-ink-faint',
        )}
      >
        {title}
      </span>

      {caption && (
        <span className="mt-0.5 block text-[10px] leading-tight whitespace-nowrap text-ink-faint">
          {caption}
        </span>
      )}
    </>
  )

  return (
    <li className="text-center">
      {unlocked ? (
        <button
          type="button"
          onClick={() => onSelect(tierIndex)}
          className="focus-ring group block w-full rounded-tile py-1"
        >
          {body}
        </button>
      ) : (
        <div className="py-1">{body}</div>
      )}
    </li>
  )
}
