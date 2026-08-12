import {
  Compass,
  Crown,
  Feather,
  Music,
  Scale,
  Scroll,
  Star,
  Swords,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { MotifKey } from '../data/types'

const MOTIF_ICONS: Record<MotifKey, LucideIcon> = {
  crown: Crown,
  scroll: Scroll,
  sword: Swords,
  scale: Scale,
  feather: Feather,
  music: Music,
  star: Star,
  compass: Compass,
}

export function MotifIcon({
  motif,
  className,
  strokeWidth = 1.5,
}: {
  motif: MotifKey
  className?: string
  strokeWidth?: number
}) {
  const Icon = MOTIF_ICONS[motif]
  return <Icon className={className} strokeWidth={strokeWidth} aria-hidden />
}
