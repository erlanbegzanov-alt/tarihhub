import type { Transition, Variants } from 'framer-motion'

export const easeOut: Transition['ease'] = [0.22, 1, 0.36, 1]

/**
 * True only for a device that has a real hovering pointer (mouse/trackpad).
 * A touch browser still fires `pointerenter` on first contact, so anything
 * with `whileHover` inside a horizontally draggable rail visibly wobbles as
 * a finger swipes past each card — the drag reads as a hover-then-leave on
 * every card it crosses. Cheap to compute once; hover capability doesn't
 * change mid-session.
 */
export const canHover =
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(hover: hover) and (pointer: fine)').matches
    : true

export const springSoft: Transition = {
  type: 'spring',
  stiffness: 420,
  damping: 34,
  mass: 0.8,
}

/** Page-level fade + slight slide used by every route. */
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.28, ease: easeOut } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.18, ease: easeOut } },
}

/** Container that staggers its children in on mount. */
export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: { staggerChildren: 0.05, delayChildren: 0.04 },
  },
}

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.34, ease: easeOut } },
}

/** Shared press/hover feedback for buttons and cards. */
export const pressable = {
  get whileHover() {
    return canHover ? { y: -2 } : undefined
  },
  whileTap: { scale: 0.97 },
  transition: springSoft,
}
