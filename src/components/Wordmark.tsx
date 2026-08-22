import { cn } from '../lib/cn'

/**
 * App logo: the T-shaped monument mark with a gold sun, plus the wordmark.
 *
 * Two renders of the same mark are shipped — one cut for a light ground, one
 * for a dark one — because each was matted against its own background;
 * showing the light-ground file on a dark page left its baked-in glow
 * looking like a pale box. `dark:` swaps which `<img>` is visible instead of
 * tinting one asset, since the two are genuinely different crops/renders.
 */
export function Wordmark({
  className,
  compact = false,
}: {
  className?: string
  compact?: boolean
}) {
  const sizeClass = compact ? 'h-9' : 'h-10'

  return (
    <span className="inline-flex">
      <img
        src="/brand/tarihhub-logo-light.png"
        alt="TarihHub"
        className={cn(sizeClass, 'w-auto object-contain dark:hidden', className)}
      />
      <img
        src="/brand/tarihhub-logo-dark.png"
        alt="TarihHub"
        className={cn(sizeClass, 'hidden w-auto object-contain dark:block', className)}
      />
    </span>
  )
}
