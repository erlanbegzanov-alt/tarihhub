import { cn } from '../lib/cn'

/** App logo: the T-shaped monument mark with a gold sun, plus the wordmark. */
export function Wordmark({
  className,
  compact = false,
}: {
  className?: string
  compact?: boolean
}) {
  if (compact) {
    return (
      <img
        src="/brand/tarihhub-logo-cropped.png"
        alt="TarihHub"
        className={cn('h-9 w-auto object-contain', className)}
      />
    )
  }

  return (
    <img
      src="/brand/tarihhub-logo-cropped.png"
      alt="TarihHub"
      className={cn('h-10 w-auto object-contain', className)}
    />
  )
}
